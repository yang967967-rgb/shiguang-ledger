# 拾光账本

一个移动端优先、数据默认保存在本机的轻量记账应用。当前版本为 1.2.0。

## 项目结构

- `.github/`：GitHub 自动构建 APK 的工作流
- `assets/`：Android 原生应用图标
- `docs/`：界面预览资料
- `icons/`：网页与 PWA 图标
- `release/`：本地可安装 APK，不上传到源码仓库
- `scripts/`：网页资源整理及 Android 构建辅助脚本
- `archive/`：与账本无关但需要保留的本地归档，不上传到源码仓库
- 根目录中的 HTML、CSS 和 JavaScript：GitHub Pages 网页版本源码

## 功能

- 日期选择以及前一天、后一天快捷切换
- 每日收入与支出记录
- 当日收入、当日支出汇总
- 所选月份总支出
- 所选年份总支出
- 收支分类、备注和单笔删除
- JSON 数据备份、导入恢复以及重复记录自动跳过
- Android 应用内检查、下载并安装新版本
- 本地数据持久化
- PWA 离线缓存与添加到桌面支持
- Android 及 iPhone 标准桌面图标

## 运行

直接打开 `index.html` 可以使用基础功能。若要启用离线缓存和添加到桌面，请在当前目录启动本地服务器（无需安装依赖）：

```powershell
npm start
```

然后访问 `http://localhost:8080`。

## 数据说明

账目保存在本机的 `localStorage` 中，不会上传到服务器。网页端清理站点数据，或 Android 端卸载应用、清除应用数据，都会删除账目。建议在重要记账后或每月定期使用“导出数据”保存 JSON 备份，并将备份放到个人云盘或电脑；“导入数据”采用合并模式，已有同 ID 的账目不会重复导入。

## Android 独立应用

项目已经接入 Capacitor。APK 会把网页资源直接打包进应用，不依赖 Chrome 或网络；Android WebView 的本地数据位于应用自己的沙盒中，与浏览器版互不相通。卸载应用会删除该应用中的账目。

将源码上传到 GitHub 后，`.github/workflows/build-android-apk.yml` 会自动执行，并使用 GitHub Secrets 中保存的永久签名构建 Release APK。构建成功后会创建对应版本的 GitHub Release；Android 应用会读取最新 Release，并在应用内完成下载，再交由安卓系统确认安装。

Android 不允许普通应用静默替换自身。首次使用应用内更新时，需要允许拾光账本“安装未知应用”；以后每次更新仍会显示安卓系统安装确认页。

本机开发需要 Node.js 22、Android Studio 2025.2.1 或更高版本，以及 Android SDK 24 或更高版本。常用命令：

```powershell
npm install
npm run android:add
npm run android:open
```
