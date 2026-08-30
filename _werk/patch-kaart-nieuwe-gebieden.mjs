/* patch-kaart-nieuwe-gebieden.mjs — de vijf gebiedspagina's van augustus 2026
 * krijgen de kaart die de eenenveertig oudere al hebben.
 *
 * Gebruik: node _werk/patch-kaart-nieuwe-gebieden.mjs [--droog]
 *
 * WAAROM
 *   Mamuda, Latriya, Jambanjelly, Salagi en Farato hadden als enige geen kaart.
 *   Dat is niet alleen een gat in de opbouw: hun eigen tekst verwijst er al naar
 *   ("The pin above is a village market point mapped in OpenStreetMap"). Er stond
 *   geen pin. De coördinaat staat bovendien al op de pagina, in de Plus Code-chip,
 *   dus de kaart voegt geen nieuwe bewering toe — hij toont wat er al beweerd werd.
 *
 * ZOOM
 *   Niet overal hetzelfde. Elke pagina zegt zelf hoe nauwkeurig zijn punt is, en
 *   dat bepaalt hier het zoomniveau: een kaart die strak inzoomt op een punt dat
 *   twee kilometer kan schelen, liegt over zijn eigen precisie.
 *     ~2 km   -> 13   Mamuda, Latriya, Salagi
 *     ~0,4 km -> 14   Jambanjelly
 *     ~0,2 km -> 15   Farato   (even scherp als de oudere pagina's)
 *
 * De kaart komt in het blok "Getting there and what is on the ground", boven de
 * tekst. Leaflet wordt pas geladen als de kaart in beeld komt, precies zoals op
 * de oudere pagina's.
 */
import { readFile, writeFile } from 'node:fs/promises';
const root = new URL('../', import.meta.url);
const droog = process.argv.includes('--droog');

/* Coördinaten komen uit gambia-places.js, de enige bron voor plaatsen. */
const PAGINAS = [
  { bestand: 'mamuda.html',      lat: 13.3032, lng: -16.7328, zoom: 13 },
  { bestand: 'latriya.html',     lat: 13.3,    lng: -16.711,  zoom: 13 },
  { bestand: 'salagi.html',      lat: 13.393,  lng: -16.71,   zoom: 13 },
  { bestand: 'jambanjelly.html', lat: 13.2806, lng: -16.7276, zoom: 14 },
  { bestand: 'farato.html',      lat: 13.3152, lng: -16.6632, zoom: 15 },
];

const KAART_DIV = '        <div class="amen-map" id="hoodMap" style="margin-bottom:18px"></div>\n';

const LADER = (lat, lng, zoom) => `<script>
/* Dezelfde kaart als op de oudere gebiedspagina's: mkAreaMap staat in app.js,
   Leaflet wordt pas opgehaald als de kaart bijna in beeld is. */
function initAreaMap(){
  if(typeof mkAreaMap === 'function') mkAreaMap('hoodMap', [${lat},${lng}], ${zoom});
}
(function(){
  var mapEl=document.getElementById('hoodMap');
  if(!mapEl) return;
  var loaded=false;
  function loadLeaflet(){
    if(loaded) return; loaded=true;
    var css=document.createElement('link'); css.rel='stylesheet';
    css.href='vendor/leaflet-1.9.4.css';
    document.head.appendChild(css);
    var js=document.createElement('script');
    js.src='vendor/leaflet-1.9.4.js';
    js.onload=function(){ if(typeof initAreaMap==='function') initAreaMap(); };
    document.head.appendChild(js);
  }
  if('IntersectionObserver' in window){
    new IntersectionObserver(function(entries,obs){
      if(entries[0].isIntersecting){ loadLeaflet(); obs.disconnect(); }
    },{rootMargin:'400px'}).observe(mapEl);
  } else { loadLeaflet(); }
})();
</script>
`;

let veranderd = 0, overgeslagen = 0;
for (const p of PAGINAS) {
  const pad = new URL(p.bestand, root);
  let html = await readFile(pad, 'utf8');

  if (html.includes('id="hoodMap"')) { console.log(`overgeslagen ${p.bestand} — heeft al een kaart`); overgeslagen++; continue; }

  const kop = /(<h2>Getting there and what is on the ground<\/h2>\s*\n)/;
  if (!kop.test(html)) { console.log(`FOUT ${p.bestand} — het blok "Getting there…" is niet gevonden`); overgeslagen++; continue; }
  html = html.replace(kop, `$1${KAART_DIV}`);

  const eind = '</body>';
  if (!html.includes(eind)) { console.log(`FOUT ${p.bestand} — geen </body>`); overgeslagen++; continue; }
  html = html.replace(eind, LADER(p.lat, p.lng, p.zoom) + eind);

  if (!droog) await writeFile(pad, html);
  console.log(`${droog ? 'zou wijzigen' : 'gewijzigd'}  ${p.bestand.padEnd(18)} kaart op ${p.lat},${p.lng} zoom ${p.zoom}`);
  veranderd++;
}
console.log(`\n${veranderd} gewijzigd, ${overgeslagen} overgeslagen${droog ? '  (droogloop: er is niets weggeschreven)' : ''}`);
