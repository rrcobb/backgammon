const esbuild = require("esbuild");
const fs = require("fs");
const path = require("path");

// Delete dest directory if it exists
if (fs.existsSync("dest")) {
  fs.rmSync("dest", { recursive: true });
}

esbuild
  .build({
    entryPoints: [
      "src/ui/render.ts",
      "slides.js",
      "index.html",
      "slides.html",
      "src/ui/style.css",
      "src/assets/*",
      "src/assets/dice/*.svg"
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
      '.svg': 'file',
      '.png': 'file',
    },
    publicPath: '/',  // This helps with asset path resolution
    assetNames: '[dir]/[name]',
  })
  .then(() => console.log("built to dest/"))
  .catch(() => process.exit(1));
