package cn.shiguang.ledger;

import android.content.Intent;
import android.net.Uri;
import android.os.Build;
import android.os.Environment;
import android.provider.Settings;

import androidx.core.content.FileProvider;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import java.io.File;
import java.io.FileOutputStream;
import java.io.InputStream;
import java.net.HttpURLConnection;
import java.net.URL;

@CapacitorPlugin(name = "AppUpdater")
public class AppUpdaterPlugin extends Plugin {
    private static final String TRUSTED_PREFIX =
        "https://github.com/yang967967-rgb/shiguang-ledger/releases/download/";
    private static final int MAX_REDIRECTS = 5;
    private static final long MAX_APK_BYTES = 100L * 1024L * 1024L;

    @PluginMethod
    public void downloadAndInstall(PluginCall call) {
        String downloadUrl = call.getString("url");
        if (downloadUrl == null || !downloadUrl.startsWith(TRUSTED_PREFIX)) {
            call.reject("更新地址不受信任。", "UNTRUSTED_UPDATE_URL");
            return;
        }

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O
            && !getContext().getPackageManager().canRequestPackageInstalls()) {
            Intent permissionIntent = new Intent(
                Settings.ACTION_MANAGE_UNKNOWN_APP_SOURCES,
                Uri.parse("package:" + getContext().getPackageName())
            );
            getActivity().startActivity(permissionIntent);
            call.reject("请允许拾光账本安装未知应用，然后返回并再次点击更新。", "INSTALL_PERMISSION_REQUIRED");
            return;
        }

        new Thread(() -> download(call, downloadUrl), "ledger-apk-updater").start();
    }

    private void download(PluginCall call, String initialUrl) {
        File output = null;
        try {
            URL currentUrl = new URL(initialUrl);
            HttpURLConnection connection = null;

            for (int redirect = 0; redirect <= MAX_REDIRECTS; redirect++) {
                connection = (HttpURLConnection) currentUrl.openConnection();
                connection.setConnectTimeout(15000);
                connection.setReadTimeout(60000);
                connection.setRequestProperty("User-Agent", "ShiguangLedger-Android");
                connection.setInstanceFollowRedirects(false);

                int responseCode = connection.getResponseCode();
                if (responseCode >= 300 && responseCode < 400) {
                    String location = connection.getHeaderField("Location");
                    connection.disconnect();
                    if (location == null) throw new IllegalStateException("更新下载地址无效。");
                    currentUrl = new URL(currentUrl, location);
                    continue;
                }
                if (responseCode != HttpURLConnection.HTTP_OK) {
                    throw new IllegalStateException("下载失败，服务器返回 " + responseCode + "。");
                }
                break;
            }

            if (connection == null || connection.getResponseCode() != HttpURLConnection.HTTP_OK) {
                throw new IllegalStateException("更新下载重定向次数过多。");
            }

            long contentLength = connection.getContentLengthLong();
            if (contentLength > MAX_APK_BYTES) throw new IllegalStateException("更新文件异常过大。");

            File updateDirectory = getContext().getExternalFilesDir(Environment.DIRECTORY_DOWNLOADS);
            if (updateDirectory == null) throw new IllegalStateException("无法访问应用下载目录。");
            output = new File(updateDirectory, "shiguang-ledger-update.apk");

            long downloaded = 0;
            try (InputStream input = connection.getInputStream();
                 FileOutputStream fileOutput = new FileOutputStream(output, false)) {
                byte[] buffer = new byte[8192];
                int count;
                while ((count = input.read(buffer)) != -1) {
                    downloaded += count;
                    if (downloaded > MAX_APK_BYTES) throw new IllegalStateException("更新文件异常过大。");
                    fileOutput.write(buffer, 0, count);
                }
            } finally {
                connection.disconnect();
            }

            if (downloaded < 1024) throw new IllegalStateException("下载到的更新文件无效。");
            File completedApk = output;
            getActivity().runOnUiThread(() -> launchInstaller(call, completedApk));
        } catch (Exception error) {
            if (output != null && output.exists()) output.delete();
            call.reject(error.getMessage() == null ? "更新下载失败。" : error.getMessage(), "UPDATE_DOWNLOAD_FAILED", error);
        }
    }

    private void launchInstaller(PluginCall call, File apk) {
        try {
            Uri apkUri = FileProvider.getUriForFile(
                getContext(),
                getContext().getPackageName() + ".fileprovider",
                apk
            );
            Intent installIntent = new Intent(Intent.ACTION_VIEW);
            installIntent.setDataAndType(apkUri, "application/vnd.android.package-archive");
            installIntent.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
            installIntent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            getContext().startActivity(installIntent);

            JSObject result = new JSObject();
            result.put("downloaded", true);
            call.resolve(result);
        } catch (Exception error) {
            call.reject("无法打开安卓安装界面。", "INSTALLER_OPEN_FAILED", error);
        }
    }
}
