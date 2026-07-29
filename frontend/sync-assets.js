const fs = require('fs');
const path = require('path');

function copyRecursiveSync(src, dest) {
  const exists = fs.existsSync(src);
  const stats = exists && fs.statSync(src);
  const isDirectory = exists && stats.isDirectory();
  if (isDirectory) {
    fs.mkdirSync(dest, { recursive: true });
    fs.readdirSync(src).forEach(function(childItemName) {
      copyRecursiveSync(path.join(src, childItemName), path.join(dest, childItemName));
    });
  } else {
    fs.copyFileSync(src, dest);
  }
}

console.log("==========================================");
console.log(" Syncing frontend assets to Android build");
console.log("==========================================");

const srcDir = path.join(__dirname, 'assets');
const destDir = path.join(__dirname, 'android', 'app', 'src', 'main', 'assets', 'www');

try {
  copyRecursiveSync(srcDir, destDir);
  console.log("✅ Assets synced successfully!");
} catch (e) {
  console.error("❌ Failed to sync assets:", e);
}
