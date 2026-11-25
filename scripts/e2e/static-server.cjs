'use strict';
// Локальный сервер dist/ для браузерных тестов и бенчмарков.
const http=require('node:http');
const fs=require('node:fs');
const path=require('node:path');

const MIME={
 '.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.mjs':'text/javascript; charset=utf-8',
 '.css':'text/css; charset=utf-8','.json':'application/json; charset=utf-8','.svg':'image/svg+xml',
 '.png':'image/png','.jpg':'image/jpeg','.webp':'image/webp','.ico':'image/x-icon',
 '.woff2':'font/woff2','.woff':'font/woff','.ttf':'font/ttf','.mp3':'audio/mpeg','.wav':'audio/wav'
};

function startServer(root,port=0){
 const base=path.resolve(root);
 return new Promise((resolve,reject)=>{
  const server=http.createServer((req,res)=>{
   try{
    const urlPath=decodeURIComponent((req.url||'/').split('?')[0].split('#')[0]);
    const file=path.normalize(path.join(base,urlPath==='/'?'/index.html':urlPath));
    const rel=path.relative(base,file);
    if(rel.startsWith('..')||path.isAbsolute(rel)){res.writeHead(403);res.end('Forbidden');return}
    fs.stat(file,(err,stat)=>{
     if(err||!stat.isFile()){res.writeHead(404);res.end('Not found');return}
     res.writeHead(200,{
      'Content-Type':MIME[path.extname(file).toLowerCase()]||'application/octet-stream',
      'Content-Length':stat.size,
      'Cache-Control':'no-cache'
     });
     fs.createReadStream(file).pipe(res);
    });
   }catch(error){res.writeHead(500);res.end('Server error');}
  });
  server.on('error',reject);
  server.listen(port,'127.0.0.1',()=>resolve(server));
 });
}

module.exports={startServer};
