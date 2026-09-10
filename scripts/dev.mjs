import './build.mjs';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
const types={'.js':'text/javascript','.css':'text/css','.html':'text/html'};
createServer(async(req,res)=>{
 const pathname=new URL(req.url,'http://localhost').pathname;
 const file=pathname==='/'?'index.html':pathname.slice(1);
 if(!['index.html','app.js','styles.css','legacy-backup.html'].includes(file)){res.writeHead(404).end();return;}
 try{const content=await readFile(new URL(`../dist/${file}`,import.meta.url));res.writeHead(200,{'Content-Type':types[file.slice(file.lastIndexOf('.'))],'Cache-Control':'no-store'});res.end(content);}catch{res.writeHead(404).end();}
}).listen(5173,'127.0.0.1',()=>console.log('PadelScore: http://127.0.0.1:5173'));
