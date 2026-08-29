/* Meet tot welke bron-zoom Mapbox echt beeld levert boven Gambia.
   Plakken in de console op https://mykunda.com — de token is Referer-vergrendeld,
   buiten dat domein geeft Mapbox 403.

   Twee maatstaven per zoomniveau, uit hetzelfde tegelbeeld:
     sharp - gemiddelde Laplaciaan. Blijft meelopen zolang er echt beeld is en
             zakt met een factor 4 a 6 zodra Mapbox gaat opschalen.
     rmse  - verschil met de opgeschaalde ouderquadrant. Steunbewijs, maar minder
             scherp dan sharp: de opschaling hier is nearest-neighbour en die van
             Mapbox is glad, wat ook zonder nieuw detail verschil geeft.

   Het laatste niveau waarop sharp meeloopt is de echte bron-zoom.
   LET OP de omrekening naar app.js: de lagen draaien op 512px-tegels met
   zoomOffset -1, dus MK_MAPBOX.satNativeMax = gemeten bron-zoom + 1.

   Uitkomst 29-08-2026 (satellite-v9): bron-zoom 17 overal het laatste echte
   niveau, dus satNativeMax 18. Zie CLAUDE.md voor de tabel. */
window.meetNativeZoom = async function(naam, lat, lng, z0, z1){
  const TOKEN = window.MK_MAPBOX.token, STYLE = 'mapbox/satellite-v9', S = 512;
  const url=(z,x,y)=>`https://api.mapbox.com/styles/v1/${STYLE}/tiles/${S}/${z}/${x}/${y}?access_token=${TOKEN}`;
  const tileXY=(lat,lng,z)=>{const n=2**z,r=lat*Math.PI/180;
    return [Math.floor((lng+180)/360*n),
            Math.floor((1-Math.log(Math.tan(r)+1/Math.cos(r))/Math.PI)/2*n)];};
  const px=async(z,x,y)=>{const res=await fetch(url(z,x,y)); if(!res.ok) throw new Error(z+' '+res.status);
    const b=await res.blob(), im=await createImageBitmap(b);
    const c=new OffscreenCanvas(S,S), g=c.getContext('2d'); g.drawImage(im,0,0,S,S);
    return {d:g.getImageData(0,0,S,S).data, bytes:b.size};};
  const grey=d=>{const o=new Float64Array(S*S);
    for(let i=0,j=0;i<d.length;i+=4,j++) o[j]=.299*d[i]+.587*d[i+1]+.114*d[i+2]; return o;};
  const sharp=g=>{let s=0,n=0; for(let y=1;y<S-1;y++) for(let x=1;x<S-1;x++){
    const i=y*S+x; s+=Math.abs(4*g[i]-g[i-1]-g[i+1]-g[i-S]-g[i+S]); n++;} return s/n;};
  const upQuad=(g,qx,qy)=>{const o=new Float64Array(S*S); for(let y=0;y<S;y++) for(let x=0;x<S;x++)
    o[y*S+x]=g[((qy*S/2)+(y>>1))*S+(qx*S/2)+(x>>1)]; return o;};
  const rmse=(a,b)=>{let s=0; for(let i=0;i<a.length;i++){const d=a[i]-b[i]; s+=d*d;} return Math.sqrt(s/a.length);};
  const out=[];
  for(let z=z0; z<=z1; z++){
    const [x,y]=tileXY(lat,lng,z), [px1,py1]=tileXY(lat,lng,z-1);
    const kind=await px(z,x,y), ouder=await px(z-1,px1,py1);
    const gk=grey(kind.d), q=upQuad(grey(ouder.d), x-px1*2, y-py1*2);
    out.push({plaats:naam, bronZoom:z, sharp:+sharp(gk).toFixed(2),
              rmse:+rmse(gk,q).toFixed(2), kb:Math.round(kind.bytes/1024)});
  }
  console.table(out);
  return out;
};
/* De vier plaatsen van de meting van 29-08-2026:
   await meetNativeZoom('Kololi',     13.4489, -16.6939, 15, 20);
   await meetNativeZoom('Serrekunda', 13.4382, -16.6781, 15, 20);
   await meetNativeZoom('Tujereng',   13.2586, -16.7794, 15, 20);
   await meetNativeZoom('Basse',      13.3100, -14.2150, 15, 20); */
