/* Minimale statische server voor lokale controle van de site.
   Gebruik: node _werk/serve-lokaal.mjs [poort]   (map = projectroot, default 8791)
   Alleen voor testen — Mapbox-tegels weigeren op localhost (token is aan
   mykunda.com gebonden); de kaart valt dan terug op de sleutelloze laag. */
import {createServer} from 'node:http';
import {readFile} from 'node:fs/promises';
import {join, normalize, extname} from 'node:path';

const ROOT=process.cwd(), PORT=+(process.argv[2]||8791);
const MIME={'.html':'text/html','.js':'text/javascript','.mjs':'text/javascript','.css':'text/css','.json':'application/json','.png':'image/png','.jpg':'image/jpeg','.jpeg':'image/jpeg','.webp':'image/webp','.svg':'image/svg+xml','.ico':'image/x-icon','.woff2':'font/woff2','.woff':'font/woff','.xml':'application/xml','.txt':'text/plain'};
createServer(async (req,res)=>{
  try{
    let p=decodeURIComponent((req.url||'/').split('?')[0]);
    if(p.endsWith('/')) p+='index.html';
    const full=normalize(join(ROOT,p));
    if(!full.startsWith(ROOT)){ res.writeHead(403); res.end(); return; }
    const data=await readFile(full);
    res.writeHead(200,{'content-type':MIME[extname(full).toLowerCase()]||'application/octet-stream','cache-control':'no-store'});
    res.end(data);
  }catch(e){ res.writeHead(404,{'content-type':'text/plain'}); res.end('404'); }
}).listen(PORT,'127.0.0.1',()=>console.log('lokaal: http://localhost:'+PORT+'/'));
