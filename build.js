   const esbuild = require('esbuild');

   esbuild.build({
     entryPoints: ['src/render.ts'],
     outdir: 'dest',
     bundle: true,
     minify: true,
     sourcemap: true,
     define: {
       'process.env.NODE_ENV': '"production"'
     }
   }).then(() => console.log("built to dest/")).catch(() => process.exit(1));
