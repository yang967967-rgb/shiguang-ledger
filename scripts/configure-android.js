const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");
const resources = path.join(root, "android", "app", "src", "main", "res");
const source = path.join(root, "assets", "android-icons");
const nativeSource = path.join(root, "native", "android");
const densities = ["mdpi", "hdpi", "xhdpi", "xxhdpi", "xxxhdpi"];

if (!fs.existsSync(resources)) {
  throw new Error("Android project not found. Run `npx cap add android` first.");
}

for (const density of densities) {
  const sourceIcon = path.join(source, `icon-${density}.png`);
  const targetDirectory = path.join(resources, `mipmap-${density}`);
  fs.mkdirSync(targetDirectory, { recursive: true });
  fs.copyFileSync(sourceIcon, path.join(targetDirectory, "ic_launcher.png"));
  fs.copyFileSync(sourceIcon, path.join(targetDirectory, "ic_launcher_round.png"));
}

fs.rmSync(path.join(resources, "mipmap-anydpi-v26"), { recursive: true, force: true });

const javaDirectory = path.join(root, "android", "app", "src", "main", "java", "cn", "shiguang", "ledger");
fs.mkdirSync(javaDirectory, { recursive: true });
fs.copyFileSync(path.join(nativeSource, "MainActivity.java"), path.join(javaDirectory, "MainActivity.java"));
fs.copyFileSync(path.join(nativeSource, "AppUpdaterPlugin.java"), path.join(javaDirectory, "AppUpdaterPlugin.java"));

const xmlDirectory = path.join(resources, "xml");
fs.mkdirSync(xmlDirectory, { recursive: true });
fs.copyFileSync(path.join(nativeSource, "file_paths.xml"), path.join(xmlDirectory, "file_paths.xml"));

const manifestFile = path.join(root, "android", "app", "src", "main", "AndroidManifest.xml");
let manifest = fs.readFileSync(manifestFile, "utf8");
if (!manifest.includes("android.permission.REQUEST_INSTALL_PACKAGES")) {
  manifest = manifest.replace(
    "<application",
    '<uses-permission android:name="android.permission.REQUEST_INSTALL_PACKAGES" />\n\n    <application',
  );
}
if (!manifest.includes("androidx.core.content.FileProvider")) {
  manifest = manifest.replace(
    "</application>",
    `    <provider
            android:name="androidx.core.content.FileProvider"
            android:authorities="cn.shiguang.ledger.fileprovider"
            android:exported="false"
            android:grantUriPermissions="true">
            <meta-data
                android:name="android.support.FILE_PROVIDER_PATHS"
                android:resource="@xml/file_paths" />
        </provider>
    </application>`,
  );
}
fs.writeFileSync(manifestFile, manifest);

const buildFile = path.join(root, "android", "app", "build.gradle");
const packageVersion = require(path.join(root, "package.json")).version;
const requestedVersionCode = Number(process.env.ANDROID_VERSION_CODE);
const versionCode = Number.isInteger(requestedVersionCode) && requestedVersionCode > 1 ? requestedVersionCode : 2;
let buildConfig = fs.readFileSync(buildFile, "utf8");
buildConfig = buildConfig.replace(/versionCode\s+\d+/, `versionCode ${versionCode}`);
buildConfig = buildConfig.replace(/versionName\s+"[^"]+"/, `versionName "${packageVersion}"`);

const signingVariables = [
  "ANDROID_KEYSTORE_PATH",
  "ANDROID_KEYSTORE_PASSWORD",
  "ANDROID_KEY_ALIAS",
  "ANDROID_KEY_PASSWORD",
];
if (signingVariables.every((name) => process.env[name])) {
  buildConfig += `

android {
    signingConfigs {
        release {
            storeFile file(System.getenv("ANDROID_KEYSTORE_PATH"))
            storePassword System.getenv("ANDROID_KEYSTORE_PASSWORD")
            keyAlias System.getenv("ANDROID_KEY_ALIAS")
            keyPassword System.getenv("ANDROID_KEY_PASSWORD")
        }
    }
    buildTypes {
        release {
            signingConfig signingConfigs.release
        }
    }
}
`;
}
fs.writeFileSync(buildFile, buildConfig);

console.log(`Android resources configured: 拾光账本 v${packageVersion} (${versionCode}), updater enabled`);
