const { build } = require('esbuild');
const { copyFileSync, mkdirSync, readdirSync, statSync } = require('fs');
const { join, relative } = require('path');

// Recursively copy a directory
const copyDir = (src, dest) => {
  // Create the destination directory
  mkdirSync(dest, { recursive: true });
  
  // Read all items in the source directory
  const items = readdirSync(src);
  
  items.forEach(item => {
    const srcPath = join(src, item);
    const destPath = join(dest, item);
    
    // If it's a directory, recursively copy it
    if (statSync(srcPath).isDirectory()) {
      copyDir(srcPath, destPath);
    } else {
      // Otherwise copy the file
      copyFileSync(srcPath, destPath);
    }
  });
};

// Main build
build({
  entryPoints: [
    "src/ui/render.ts",
    "slides.js",
    "index.html",
    "slides.html",
    "src/ui/style.css",
  ],
  outdir: "dest",
  bundle: true,
  minify: true,
  sourcemap: true,
  define: {
    "process.env.NODE_ENV": '"production"',
  },
  loader: { 
    '.html': 'copy',
    '.css': 'css',
  },
  publicPath: '/',
  assetNames: '[dir]/[name]',
})
.then(() => {
  // Copy entire assets directory
  copyDir('src/assets', 'dest/src/assets');
  console.log("built to dest/");
})
.catch(() => process.exit(1));
