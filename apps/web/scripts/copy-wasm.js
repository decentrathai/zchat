// Script to copy WASM build from wallet-core/pkg to public/wallet-core/pkg
const fs = require('fs');
const path = require('path');

const sourceDir = path.join(__dirname, '../../../packages/wallet-core/pkg');
const targetDir = path.join(__dirname, '../public/wallet-core/pkg');

// Create target directory if it doesn't exist
if (!fs.existsSync(path.dirname(targetDir))) {
  fs.mkdirSync(path.dirname(targetDir), { recursive: true });
}

// Copy the entire pkg directory
function copyRecursiveSync(src, dest) {
  const exists = fs.existsSync(src);
  const stats = exists && fs.statSync(src);
  const isDirectory = exists && stats.isDirectory();
  
  if (isDirectory) {
    if (!fs.existsSync(dest)) {
      fs.mkdirSync(dest, { recursive: true });
    }
    fs.readdirSync(src).forEach(childItemName => {
      copyRecursiveSync(
        path.join(src, childItemName),
        path.join(dest, childItemName)
      );
    });
  } else {
    fs.copyFileSync(src, dest);
  }
}

if (fs.existsSync(sourceDir)) {
  console.log(`Copying WASM from ${sourceDir} to ${targetDir}`);
  copyRecursiveSync(sourceDir, targetDir);
  console.log('WASM files copied successfully!');
} else {
  console.error(`Source directory not found: ${sourceDir}`);
  console.error('Please run "wasm-pack build --target web --out-dir pkg" in packages/wallet-core first');
  process.exit(1);
}

