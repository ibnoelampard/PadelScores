import { build } from 'esbuild';
import { mkdir, readFile, writeFile, copyFile } from 'node:fs/promises';
await mkdir('dist',{recursive:true});
await build({entryPoints:['src/app.js'],bundle:true,format:'esm',target:['es2022'],outfile:'dist/app.js',minify:true});
await copyFile('styles.css','dist/styles.css');
await writeFile('dist/index.html',(await readFile('index.html','utf8')).replace('src="src/app.js"','src="app.js"'));
await copyFile('legacy-backup.html','dist/legacy-backup.html');
