const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");
const resources = path.join(root, "android", "app", "src", "main", "res");
const source = path.join(root, "assets", "android-icons");
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
console.log("Android launcher icons configured for 拾光账本");
