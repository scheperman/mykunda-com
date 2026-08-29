/* ============================================================
   MYKUNDA — shared data + helpers
   ============================================================ */

/* ---------- MapTiler ----------
   Eén plek voor de sleutel, de stijlen en de zoomgrenzen van elke kaart op de
   site. Roteren of overstappen op een eigen stijl is hier één regel, niet
   vijftig bestanden. De sleutel is in het MapTiler-dashboard vastgezet op
   mykunda.com en *.mykunda.com; dát is de bescherming, niet geheimhouding —
   een sleutel in browsercode is altijd leesbaar.

   Sinds 25-08-2026 draait het account op Flex. Wat dat hier verandert:
   • @2x-tegels kosten exact evenveel als 1x — MapTiler rekent per tegel, niet
     per pixel — dus die halen we op elk scherm met echte extra pixels op;
   • de v4-generatie stijlen is beschikbaar; de oude v2-stijlen blijven werken
     maar krijgen geen ontwerpupdates meer;
   • het MapTiler-logo hoeft niet meer op de kaart. De tekstattributie met
     links naar MapTiler én OpenStreetMap blijft wel verplicht, op elke kaart. */
window.MK_MAP = {
  /* Wie levert de kaart: 'maptiler' of 'mapbox'. Eén regel voor de hele site.
     Zie het MK_MAPBOX-blok hieronder voor wat er dan verandert. */
  provider: 'mapbox',
  key: 'gw2XoLm9z2VCXUcbu383',
  /* Eigen stijl gemaakt in MapTiler Cloud? Zet het stijl-ID hier neer en de
     hele site volgt. Flex geeft er twintig; zie CLAUDE.md voor de stappen.
     Het tegelformaat staat er los naast, want een eigen stijl heet 01a03b…
     en dan valt er niets meer aan de naam af te leiden.

     Beide op WebP, ook de luchtfoto. Dat laatste is tegen de intuïtie in — het
     bronbeeld is JPEG, dus WebP is een hercompressie — maar gemeten boven
     Kololi op 25-08-2026 is het bij @2x eenderde minder bytes (83 kB tegen
     135 kB op zoom 17) met PSNR 39 dB tussen de twee: naast elkaar gelegd geen
     zichtbaar verschil. Op 4G in Gambia weegt dat zwaarder dan de theorie. */
  satellite:       '01a04c84-8aeb-7298-a365-5f127c3bcb3b',   /* MyKunda Satellite */
  satelliteFormat: 'webp',
  streets:         '01a03b2e-4c26-7f79-b769-29d6fb5b7f55',   /* MyKunda Paper */
  streetsFormat:   'webp',
  /* Waar het bronbeeld ophoudt. Gemeten boven Kololi op 25-08-2026: scherp tot
     en met Leaflet-zoom 19, daarboven zichtbaar opgerekt. Vanaf dat punt
     schaalt Leaflet zelf verder — dat oogt hetzelfde en kost geen tegel. */
  satNativeMax: 19,
  streetsNativeMax: 20,
  maxZoom: 21,
  /* Wanneer loont @2x? Alleen als het scherm de pixels ook echt heeft. Bij
     125%-schaling (DPR 1,25 — een heel gewone Windows-instelling) wordt een
     tegel van 1024 px teruggeschaald naar 640 en zie je maar een fractie van
     het verschil, voor drie tot vier keer zoveel bytes. Vanaf 1,5 is het de
     moeite; telefoons zitten op 2 of 3 en krijgen hem dus altijd. */
  hidpiMinDpr: 1.5,
  /* En niet op overzichtszoom. Daar zijn satelliettegels juist het zwaarst —
     gemeten boven Kololi 362 kB tegen 96 kB — terwijl je naar kustlijnen kijkt
     en niet naar daken. Leaflet-zoom, niet de zoom in de URL. */
  hidpiFromZoom: 14
};
window.MAPTILER_KEY = window.MK_MAP.key;      /* oude naam, blijft werken */

/* ---------- Mapbox als tweede leverancier ----------
   De tegels komen dan van de Static Tiles API; Mapbox noemt Leaflet in hun
   eigen documentatie met zoveel woorden als afnemer daarvan. Wat er anders is
   dan bij MapTiler, en waarom de code hieronder splitst:

   • Een tegel van 512 px telt als één verzoek, niet als vier. Van de gratis
     laag (200.000 verzoeken per maand) blijft dus ook 200.000 tegels over,
     waar de 500.000 van MapTiler Flex op 125.000 tegels uitkomt. Daarboven
     $0,50 per 1.000. `tileSize: 512` met `zoomOffset: -1` blijft net zo
     belangrijk: 256 px kost er vier voor hetzelfde beeld.
   • Een afgewezen token geeft HTTP 401 met een JSON-melding, geen tegel met
     een watermerk. De sleuteltoets op tiles.json is daarmee overbodig —
     Leaflet ziet een echte fout en de terugval loopt via `tileerror`.
   • Het Mapbox-logo is wél verplicht op elke kaart, ook op de kleine kaartjes
     van de wijkpagina's en op de perceelfoto. Dat is een eis van Mapbox, geen
     keuze; de tekstattributie hieronder is dat evenmin.
   • De zoomgrenzen hieronder zijn overgenomen van de MapTiler-meting van
     25-08-2026 en dus nog niet gemeten op dit bronbeeld. Meet ze opnieuw boven
     Kololi zodra de token er is, net zoals CLAUDE.md dat voor MapTiler vraagt.

   Zolang `token` leeg is blijft de site op MapTiler draaien, ook als
   `MK_MAP.provider` al op 'mapbox' staat. Zo kan de schakelaar vooruit zonder
   dat er ergens een kaart uitvalt. */
window.MK_MAPBOX = {
  /* Vastgezet op mykunda.com en *.mykunda.com in het Mapbox-dashboard; zonder
     die Referer geeft de API 403. Lokaal testen kan dus alleen met een eigen
     token of door de terugval zijn werk te laten doen. */
  token: 'pk.eyJ1IjoibXlrdW5kYSIsImEiOiJjbXRlNWF2N3UwdnE4MzBzOHlwenVzOHRtIn0.x19fTfAmoXKA_ZirgC0xow',
  satellite: 'mapbox/satellite-streets-v12',
  streets:   'mapbox/streets-v12',
  satelliteFormat: 'webp',
  streetsFormat:   'webp',
  /* Gemeten 29-08-2026 op mykunda.com, niet geschat. Per zoomniveau is de tegel
     vergeleken met de opgeschaalde ouderquadrant en is de gemiddelde Laplaciaan
     (scherpte) berekend, boven Kololi, Serrekunda, Tujereng en Basse. De scherpte
     loopt door tot bron-zoom 17 en zakt daar met een factor 4 a 6 in:
       Kololi     22,9 (z16) -> 25,0 (z17) -> 4,3 (z18)
       Serrekunda 28,3 -> 26,7 -> 4,2
       Tujereng   17,4 -> 15,5 -> 2,7
       Basse      23,7 -> 10,6 -> 3,9
     Bron-zoom 17 is op 13,4 NB 0,58 m/px; dat past op het 50 cm-beeld dat Mapbox
     wereldwijd levert (hoger dan 50 cm heeft Mapbox alleen in Noord-Amerika,
     Europa en Australie). Alles daarboven is opschaling.
     Let op de omrekening: deze lagen draaien op 512px-tegels met zoomOffset -1,
     dus de kaartzoom ligt er een boven de bron-zoom. Nagemeten in de browser:
     kaartzoom 19 vraagt bron-zoom 18 op, kaartzoom 17 vraagt 16 op. maxNativeZoom
     18 vraagt dus bron-zoom 17 - het laatste echte niveau. Stond op 19, en haalde
     daarmee een hele ronde tegels op zonder nieuw detail (37 kB tegen 84 kB). */
  satNativeMax: 18,
  streetsNativeMax: 20
};
window.mkProvider = function(){
  return (window.MK_MAP.provider === 'mapbox' && window.MK_MAPBOX.token) ? 'mapbox' : 'maptiler';
};

/* Verplicht op elke kaart — ook op de terugvallagen verderop. */
window.MK_ATTR_MAPTILER = '&copy; <a href="https://www.maptiler.com/copyright/" target="_blank" rel="noopener">MapTiler</a> &copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap contributors</a>';
/* Mapbox schrijft deze drie voor, met deze links. "Improve this map" hoort
   erbij; de kleur en het formaat mogen mee met het ontwerp, de tekst niet. */
window.MK_ATTR_MAPBOX = '&copy; <a href="https://www.mapbox.com/about/maps" target="_blank" rel="noopener">Mapbox</a> &copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a> <a href="https://apps.mapbox.com/feedback/" target="_blank" rel="noopener">Improve this map</a>';
/* Op satellietbeeld hoort de beeldleverancier erbij: Mapbox' eigen Leaflet-
   handleiding schrijft "&copy; Maxar" voor naast de drie hierboven. De kaartlaag
   (streets) is OpenStreetMap-gebaseerd en heeft die regel niet nodig. */
window.MK_ATTR_MAPBOX_SAT = '&copy; <a href="https://www.mapbox.com/about/maps" target="_blank" rel="noopener">Mapbox</a> &copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a> &copy; <a href="https://www.maxar.com/" target="_blank" rel="noopener">Maxar</a> <a href="https://apps.mapbox.com/feedback/" target="_blank" rel="noopener">Improve this map</a>';
window.MK_ATTR = window.mkProvider() === 'mapbox' ? window.MK_ATTR_MAPBOX : window.MK_ATTR_MAPTILER;
/* Eén plek die per laagsoort en per leverancier de juiste regel teruggeeft.
   MK_ATTR blijft bestaan voor wie hem rechtstreeks gebruikt. */
window.mkAttr = function(kind){
  if(window.mkProvider() !== 'mapbox') return window.MK_ATTR_MAPTILER;
  return (kind !== 'streets') ? window.MK_ATTR_MAPBOX_SAT : window.MK_ATTR_MAPBOX;
};

/* @2x kost bij MapTiler niets extra aan verbruik, maar wel twee tot vier keer
   zoveel bytes. Meldt de browser een 2G-verbinding of staat databesparing aan,
   dan blijft het bij 1x; net zo bij een scherm dat de extra pixels toch niet
   kan tonen. */
window.mkHiDPI = function(){
  if((window.devicePixelRatio || 1) < (window.MK_MAP.hidpiMinDpr || 1.5)) return false;
  var c = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
  if(c && (c.saveData || /^(slow-)?2g$/.test(c.effectiveType || ''))) return false;
  return true;
};

/* Kan deze browser WebP aan? Een canvas dat om een WebP wordt gevraagd en een
   PNG teruggeeft, kan het niet. Eén keer meten, daarna onthouden. */
window.mkWebP = (function(){
  var ok = null;
  return function(){
    if(ok !== null) return ok;
    try{
      var c = document.createElement('canvas');
      ok = !!(c.getContext && c.getContext('2d')) &&
           c.toDataURL('image/webp').indexOf('data:image/webp') === 0;
    }catch(e){ ok = false; }
    return ok;
  };
})();

/* forceHd: true of false dwingt @2x af of juist niet; weglaten laat mkHiDPI
   beslissen. mkTileLayer maakt daarmee twee sjablonen en kiest per tegel. */
window.mapTilerUrl = function(style, ext, forceHd){
  var s  = style || window.MK_MAP.satellite;
  /* Zonder opgegeven formaat: de stijl die als satelliet in MK_MAP staat
     krijgt het satellietformaat, de rest dat van de kaartlaag. Aan de naam
     van een eigen stijl valt niets af te lezen, dus vergelijken we met wat er
     in MK_MAP staat en niet met een woord in het ID. */
  var sat = (s === window.MK_MAP.satellite);
  var e  = ext || (sat ? window.MK_MAP.satelliteFormat : window.MK_MAP.streetsFormat) || 'jpg';
  /* Oude browsers zonder WebP krijgen het formaat dat er het dichtst bij komt:
     JPEG voor een luchtfoto, PNG voor vlakke kaartkleuren. */
  if(e === 'webp' && !window.mkWebP()) e = sat ? 'jpg' : 'png';
  var hd = (forceHd === undefined ? window.mkHiDPI() : forceHd) ? '@2x' : '';
  return 'https://api.maptiler.com/maps/' + s + '/{z}/{x}/{y}' + hd + '.' + e +
         '?key=' + window.MK_MAP.key;
};

/* Eén tegel-URL-sjabloon, wie hem ook levert. kind is 'satellite' of 'streets';
   forceHd dwingt @2x af of juist niet, weglaten laat mkHiDPI beslissen.
   Bij Mapbox zit het formaat achter de tegelcoördinaten en de sleutel als
   access_token in de query; verder is de vorm dezelfde als bij MapTiler. */
window.mkTileTemplate = function(kind, forceHd){
  var sat = kind !== 'streets';
  var hd  = (forceHd === undefined ? window.mkHiDPI() : forceHd) ? '@2x' : '';
  if(window.mkProvider() === 'mapbox'){
    var M = window.MK_MAPBOX;
    var e = (sat ? M.satelliteFormat : M.streetsFormat) || 'webp';
    /* Oude browsers zonder WebP: JPEG voor een luchtfoto, PNG voor vlakke
       kaartkleuren. Mapbox schrijft 'jpeg' voluit, niet 'jpg'. */
    if(e === 'webp' && !window.mkWebP()) e = sat ? 'jpeg' : 'png';
    return 'https://api.mapbox.com/styles/v1/' + (sat ? M.satellite : M.streets) +
           '/tiles/512/{z}/{x}/{y}' + hd + '.' + e +
           '?access_token=' + M.token;
  }
  var stijl   = sat ? window.MK_MAP.satellite       : window.MK_MAP.streets;
  var formaat = sat ? window.MK_MAP.satelliteFormat : window.MK_MAP.streetsFormat;
  return window.mapTilerUrl(stijl, formaat, forceHd);
};

/* Waar het bronbeeld ophoudt, per leverancier. */
window.mkNativeMax = function(kind){
  var sat = kind !== 'streets';
  var C = window.mkProvider() === 'mapbox' ? window.MK_MAPBOX : window.MK_MAP;
  return sat ? C.satNativeMax : C.streetsNativeMax;
};

/* Eén plek waar een kaartlaag ontstaat: overal dezelfde tegelgrootte, dezelfde
   zoomgrenzen, dezelfde attributie. kind is 'satellite' of 'streets'. */
window.mkTileLayer = function(kind, extra){
  var sat = kind !== 'streets';
  var o = {
    tileSize: 512, zoomOffset: -1, crossOrigin: true,
    maxZoom: window.MK_MAP.maxZoom,
    maxNativeZoom: window.mkNativeMax(kind),
    attribution: window.mkAttr(kind),
    updateWhenZooming: false,       /* pas tegels halen als het zoomen klaar is */
    keepBuffer: 1                   /* één rij tegels buiten beeld, niet twee */
  };
  if(extra) for(var k in extra) o[k] = extra[k];
  var gewoon = window.mkTileTemplate(kind, false);
  var layer  = L.tileLayer(gewoon, o);
  /* Twee sjablonen, en per tegel kiezen. Op overzichtszoom is een @2x-tegel
     drie tot vier keer zo zwaar terwijl je er nauwelijks iets van ziet; van
     dichtbij is het verschil juist duidelijk en de tegel het lichtst. */
  /* extra.mkHidpi:false zet @2x helemaal uit voor deze laag. Bedoeld voor de
     kleine kaartjes op de wijkpagina's: een vak van ruim 300 px breed heeft de
     extra pixels niet nodig, en het scheelt daar het meeste. */
  if(window.mkHiDPI() && (!extra || extra.mkHidpi !== false)){
    var scherp = window.mkTileTemplate(kind, true);
    layer.getTileUrl = function(coords){
      var z = this._getZoomForUrl();
      var tpl = (coords.z >= (window.MK_MAP.hidpiFromZoom || 0)) ? scherp : gewoon;
      return tpl.replace('{z}', z).replace('{x}', coords.x).replace('{y}', coords.y);
    };
  }
  layer.__mkKind = sat ? 'satellite' : 'streets';
  /* Mapbox eist het logo op elke kaart. Het hangt aan de laag en niet aan
     mkMap, want alleen een laag weet wie de tegels levert; de terugval naar
     Esri en OpenStreetMap haalt hem daarom ook weer weg. */
  if(window.mkProvider() === 'mapbox'){
    layer.on('add', function(){ window.mkBrandLogo(this._map); });
  }
  return layer;
};

/* Het Mapbox-woordmerk, linksonder naast de schaalbalk. Zelf gehost, want de
   CSP laat geen plaatjes van vreemde hosts toe — en het scheelt een verzoek.
   Eén per kaart; de stijl mag niet veranderen, de plaats wel. */
window.mkBrandLogo = function(map){
  if(!map || map.__mkLogo) return;
  map.__mkLogo = true;
  if(!document.getElementById('mkLogoCSS')){
    var st = document.createElement('style'); st.id = 'mkLogoCSS';
    st.textContent = '.mk-mapbox-logo a{display:block;width:88px;height:23px;'
      + 'background:url(images/mapbox-logo.svg) no-repeat;background-size:88px 23px}';
    document.head.appendChild(st);
  }
  var ctl = L.control({ position: 'bottomleft' });
  ctl.onAdd = function(){
    var d = L.DomUtil.create('div', 'mk-mapbox-logo');
    d.innerHTML = '<a href="https://www.mapbox.com/" target="_blank" rel="noopener" aria-label="Mapbox"></a>';
    L.DomEvent.disableClickPropagation(d);
    return d;
  };
  ctl.addTo(map);
  map.__mkLogoCtl = ctl;
};

/* Kaart met de instellingen die overal gelijk horen te zijn. */
window.mkMap = function(el, opts){
  var o = {
    zoomControl: true, scrollWheelZoom: false,
    minZoom: 3, maxZoom: window.MK_MAP.maxZoom,
    wheelPxPerZoomLevel: 120,       /* rustiger dan Leaflets standaard 60 */
    zoomAnimationThreshold: 6,
    worldCopyJump: false
  };
  if(opts) for(var k in opts) o[k] = opts[k];
  var m = L.map(el, o);
  if(m.attributionControl && m.attributionControl.setPrefix) m.attributionControl.setPrefix('');
  return m;
};

/* Schaalbalk, metrisch — Gambia rekent in meters. */
window.mkScale = function(m){
  try{ L.control.scale({ imperial:false, metric:true, maxWidth:110, position:'bottomleft' }).addTo(m); }
  catch(e){}
  return m;
};

/* Kaart/Satelliet-knop: twee lagen, één schakelaar, dezelfde vorm op elke
   pagina. Geeft de twee lagen terug plus set() om van buiten te wisselen. */
window.mkBaseToggle = function(m, opts){
  opts = opts || {};
  var laagOpts = opts.hidpi === false ? { mkHidpi: false } : null;
  var sat = window.mkTileLayer('satellite', laagOpts);
  var str = window.mkTileLayer('streets', laagOpts);
  var cur = opts.start === 'streets' ? 'streets' : 'satellite';
  var box = null;
  (cur === 'streets' ? str : sat).addTo(m);
  if(!document.getElementById('mkBaseCSS')){
    var st = document.createElement('style'); st.id = 'mkBaseCSS';
    st.textContent = '.mk-baseswap{display:flex;overflow:hidden;border-radius:9px;box-shadow:0 1px 5px rgba(0,0,0,.32);font:700 12px/1 var(--sans,system-ui,sans-serif)}'
      + '.mk-baseswap button{appearance:none;-webkit-appearance:none;border:0;margin:0;padding:8px 11px;background:#fff;color:#15463A;cursor:pointer}'
      + '.mk-baseswap button+button{border-left:1px solid rgba(21,70,58,.16)}'
      + '.mk-baseswap button.on{background:#15463A;color:#fff}';
    document.head.appendChild(st);
  }
  function mark(){
    if(!box) return;
    var bs = box.querySelectorAll('button[data-mk]');
    for(var i=0;i<bs.length;i++) bs[i].classList.toggle('on', bs[i].getAttribute('data-mk') === cur);
  }
  function set(next){
    if(next === cur) return;
    cur = next;
    if(cur === 'streets'){ if(m.hasLayer(sat)) m.removeLayer(sat); str.addTo(m); }
    else { if(m.hasLayer(str)) m.removeLayer(str); sat.addTo(m); }
    mark();
  }
  var ctl = L.control({ position: opts.position || 'topright' });
  ctl.onAdd = function(){
    box = L.DomUtil.create('div', 'mk-baseswap');
    box.innerHTML = '<button type="button" data-mk="satellite">Satellite</button>'
                  + '<button type="button" data-mk="streets">Map</button>';
    L.DomEvent.disableClickPropagation(box);
    L.DomEvent.disableScrollPropagation(box);
    box.addEventListener('click', function(e){
      var b = e.target && e.target.closest && e.target.closest('button[data-mk]');
      if(b) set(b.getAttribute('data-mk'));
    });
    mark();
    return box;
  };
  ctl.addTo(m);
  return { satellite: sat, streets: str, set: set, current: function(){ return cur; } };
};

/* De eenenveertig wijkpagina's hebben allemaal dezelfde kleine kaart. Die
   staat hier, zodat een wijziging één bestand is in plaats van eenenveertig. */
window.mkAreaMap = function(elId, center, zoom){
  if(typeof L === 'undefined') return null;
  var el = document.getElementById(elId || 'hoodMap');
  if(!el) return null;
  var m = window.mkMap(el, {
    scrollWheelZoom: false, minZoom: 8,
    center: center, zoom: zoom || 15
  });
  /* Klein vak, dus geen @2x: op ruim 300 px breed zie je het verschil niet en
     op de eenenveertig wijkpagina's samen scheelt het het meeste. */
  window.mkBaseToggle(m, { hidpi: false });
  window.mkScale(m);
  if(typeof guardMapTouch === 'function') guardMapTouch(m, el);
  setTimeout(function(){ try{ m.invalidateSize(); }catch(e){} }, 300);
  return m;
};

/* ---------- Terugval als MapTiler niet levert ----------
   Een afgewezen sleutel faalt niet als een kapotte afbeelding: de API stuurt
   een prima te tekenen PNG met het grijze "Invalid key"-watermerk terug, dus
   Leaflet meldt de tegel als geladen en er komt nooit een foutgebeurtenis.
   De enige betrouwbare toets is de status van een aanroep, en die doen we op
   tiles.json — dat is bij MapTiler gratis, telt niet mee in het verbruik en
   geeft 403 zodra de sleutel op dit domein niet geldig is. Een netwerkfout
   zegt niets over de sleutel en laat de kaart dus met rust; daarvoor blijft
   tileerror de vangnetmelding. Slaagt de toets niet, dan stappen alle
   MapTiler-lagen op de pagina over op sleutelloze bronnen: Esri-luchtfoto met
   een namenlaag voor satelliet, OpenStreetMap voor de kaartlaag. Zelfde plek,
   nog steeds een echte kaart van Gambia. */
window.MK_FALLBACK = {
  sat:      'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
  satNames: 'https://services.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}',
  satAttr:  'Imagery &copy; Esri, Maxar, Earthstar Geographics',
  streets:  'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
  strAttr:  '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap contributors</a>'
};
window.MAP_FALLBACK_URL = window.MK_FALLBACK.streets;   /* oude naam */
(function(){
  var layers = [], probed = false, down = false, named = [];
  function swap(layer){
    if(layer.__mkSwapped) return;
    layer.__mkSwapped = true;
    var sat = layer.__mkKind !== 'streets';
    var map = layer._map, old = layer.options.attribution;
    layer.options.tileSize     = 256;
    layer.options.zoomOffset   = 0;
    layer.options.maxNativeZoom = 19;
    layer.options.attribution  = sat ? window.MK_FALLBACK.satAttr : window.MK_FALLBACK.strAttr;
    if(map && map.attributionControl){
      if(old) map.attributionControl.removeAttribution(old);
      map.attributionControl.addAttribution(layer.options.attribution);
    }
    /* mkTileLayer kan getTileUrl hebben overschreven om per zoom tussen 1x en
       @2x te kiezen. Die overschrijving hoort bij MapTiler; voor Esri en
       OpenStreetMap moet Leaflets eigen versie het weer doen. */
    if(Object.prototype.hasOwnProperty.call(layer, 'getTileUrl')) delete layer.getTileUrl;
    layer.setUrl(sat ? window.MK_FALLBACK.sat : window.MK_FALLBACK.streets);
    /* Esri's luchtfoto draagt geen namen. Zonder deze laag is de terugval een
       kale foto — precies zoals het er eerder uitzag. */
    if(sat && map && named.indexOf(map) < 0){
      named.push(map);
      L.tileLayer(window.MK_FALLBACK.satNames, {
        maxZoom: window.MK_MAP.maxZoom, maxNativeZoom: 19,
        crossOrigin: true, opacity: .9, pane: 'overlayPane'
      }).addTo(map);
    }
    /* Het Mapbox-logo hoort bij Mapbox-tegels. Staan die er niet meer, dan
       moet het weg — anders staat er een merk op een kaart van Esri. */
    if(map && map.__mkLogoCtl){
      try{ map.removeControl(map.__mkLogoCtl); }catch(e){}
      map.__mkLogoCtl = null; map.__mkLogo = false;
    }
    if(map) setTimeout(function(){ try{ map.invalidateSize(); }catch(e){} }, 60);
  }
  window.mkSwapMapTiles = function(){ down = true; for(var i=0;i<layers.length;i++) swap(layers[i]); };
  window.mkMapKeyDown   = function(){ return down; };
  function probe(){
    if(probed) return;
    probed = true;
    /* Alleen MapTiler heeft deze toets nodig. Mapbox stuurt bij een afgewezen
       token HTTP 401 met JSON terug in plaats van een tegel met een watermerk,
       dus daar meldt Leaflet zelf een tileerror en loopt de terugval vanzelf. */
    if(window.mkProvider() === 'mapbox') return;
    var url = 'https://api.maptiler.com/maps/' + window.MK_MAP.satellite +
              '/tiles.json?key=' + window.MK_MAP.key;
    try{
      fetch(url, { mode:'cors', credentials:'omit', cache:'no-store' })
        .then(function(r){ if(!r.ok) window.mkSwapMapTiles(); })
        .catch(function(){ /* netwerkfout zegt niets over de sleutel */ });
    }catch(e){}
  }
  window.mkProbeMapKey = probe;
  function patch(){
    if(typeof L === 'undefined' || !L.TileLayer || L.__mkTileFallback) return typeof L !== 'undefined';
    L.__mkTileFallback = true;
    var onAdd = L.TileLayer.prototype.onAdd;
    L.TileLayer.prototype.onAdd = function(map){
      var layer = this;
      if(/api\.(maptiler|mapbox)\.com/.test(this._url || '')){
        layers.push(layer);
        if(down){ setTimeout(function(){ swap(layer); }, 0); }
        else {
          var fails = 0;
          this.on('tileerror', function(){ if(++fails >= 3) swap(layer); });
          setTimeout(probe, 0);
        }
      }
      return onAdd.call(this, map);
    };
    return true;
  }
  /* Wijkpagina's laden Leaflet pas bij het scrollen, dus vangen we het moment
     op waarop window.L wordt gezet, met een poll als vangnet. */
  if(!patch()){
    try{
      var held;
      Object.defineProperty(window, 'L', {
        configurable: true,
        get: function(){ return held; },
        set: function(v){
          Object.defineProperty(window, 'L', { value: v, writable: true, configurable: true });
          held = v; patch();
        }
      });
    }catch(e){}
    var tries = 0;
    var iv = setInterval(function(){ if(patch() || ++tries > 400) clearInterval(iv); }, 150);
    document.addEventListener('DOMContentLoaded', patch);
  }
  window.mkPatchTiles = patch;
})();

/* ---------- Static map ----------
   Eén afbeelding in plaats van een raster losse tegels: scherper, geen naden,
   de attributie zit er al in gebrand en het kost bij MapTiler vijftien
   eenheden in plaats van vier per tegel. Met padding=0 dekt de afbeelding
   exact de opgegeven bbox, dus is de omrekening van lat/lng naar pixels
   lineair in Mercator — dat is wat de perceelfoto nodig heeft. */
window.mkMercY = function(lat){
  return Math.log(Math.tan(Math.PI/4 + (lat*Math.PI/180)/2)) * 180 / Math.PI;
};
window.mkInvMercY = function(y){
  return (2*Math.atan(Math.exp(y*Math.PI/180)) - Math.PI/2) * 180 / Math.PI;
};
/* De perceelomtrek gaat als lijst hoekpunten mee ([lat,lng], zoals Leaflet ze
   geeft), niet als kant-en-klare tekenopdracht: MapTiler wil een path-string,
   Mapbox een GeoJSON-overlay. opts.path blijft werken voor wie hem al zo
   aanlevert, maar dat is dan wel MapTiler-taal. */
window.MK_PLOT_STROKE = '#1F7BFF';
window.mkStaticMapUrl = function(bbox, w, h, opts){
  opts = opts || {};
  var pts = opts.polygon && opts.polygon.length >= 3 ? opts.polygon : null;

  if(window.mkProvider() === 'mapbox'){
    var M = window.MK_MAPBOX;
    var mStyle = opts.style || M.satellite;
    var mHd = opts.hidpi === false ? '' : '@2x';
    /* Mapbox schrijft het formaat voluit en levert maximaal 1280 px per zijde.
       De perceelfoto vraagt 1000x658, dus dat past; groter afkappen zou de
       omrekening naar pixels stilzwijgend scheeftrekken. */
    var mFmt = (opts.format === 'jpg' || opts.format === 'jpeg' || !opts.format) ? 'jpeg'
             : (opts.format === 'webp' ? 'webp' : 'png');
    var over = '';
    if(pts){
      var ring = pts.map(function(p){ return [ +(+p[1]).toFixed(6), +(+p[0]).toFixed(6) ]; });
      ring.push(ring[0]);
      over = '/geojson(' + encodeURIComponent(JSON.stringify({
        type: 'Feature',
        properties: { stroke: window.MK_PLOT_STROKE, 'stroke-width': 5, 'stroke-opacity': 1,
                      fill: window.MK_PLOT_STROKE, 'fill-opacity': 0.22 },
        geometry: { type: 'Polygon', coordinates: [ring] }
      })) + ')';
    }
    /* De bbox staat bij Mapbox tussen blokhaken; padding=0 laat de afbeelding
       exact deze bbox dekken, wat de perceelfoto nodig heeft om de maten er op
       canvas overheen te kunnen zetten. Attributie en logo blijven aan: dat is
       bij Mapbox verplicht, ook op een stilstaande afbeelding. */
    return 'https://api.mapbox.com/styles/v1/' + mStyle + '/static' + over +
           '/[' + bbox.join(',') + ']/' + w + 'x' + h + mHd + '.' + mFmt +
           '?padding=0&access_token=' + M.token;
  }

  var style = opts.style || window.MK_MAP.satellite;
  var hd = opts.hidpi === false ? '' : '@2x';
  var u = 'https://api.maptiler.com/maps/' + style + '/static/' +
          bbox.join(',') + '/' + w + 'x' + h + hd + '.' +
          (opts.format || (style === window.MK_MAP.satellite ? window.MK_MAP.satelliteFormat : window.MK_MAP.streetsFormat) || 'jpg') +
          '?key=' + window.MK_MAP.key + '&padding=0&attribution=' +
          (opts.attribution || 'bottomright');
  var path = opts.path;
  if(!path && pts){
    var poly = pts.map(function(p){ return (+p[1]).toFixed(6) + ',' + (+p[0]).toFixed(6); });
    poly.push(poly[0]);
    path = 'fill:rgba(31,123,255,0.22)|stroke:' + window.MK_PLOT_STROKE + '|width:5|' + poly.join('|');
  }
  if(path) u += '&path=' + encodeURIComponent(path);
  if(opts.markers) u += '&markers=' + encodeURIComponent(opts.markers);
  return u;
};



/* ---------- Zoeken op plaats en adres (MapTiler Geocoding) ----------
   Onze eigen lijst kent zo'n veertig gebieden. Een bezoeker denkt in "Palma
   Rima Road" of "Coco Ocean", dus vragen we het daarnaast aan MapTiler, strak
   op Gambia gezet. Een treffer draagt een echte coördinaat, dus staat de pin
   meteen goed in plaats van op een gebiedsmiddelpunt.

   proximity is een magneet, geen hek: het duwt Groot-Banjul naar boven zonder
   iets in het binnenland weg te gooien. country=gm is wél een hek.
   MapTiler rekent per zoekopdracht af, dus wachten we tot het typen even stil
   valt en telt alleen het antwoord op de laatste toetsaanslag. */
window.MK_GEO_NEAR = '-16.6800,13.4400';       /* Groot-Banjul */

/* Mapbox' Geocoding v6 geeft een ander antwoord dan MapTiler: de coördinaat
   staat in properties, de naam is in drieën geknipt en het soort plek heet
   feature_type. De rest van de site leest f.text, f.place_name, f.center,
   f.place_type en f.context[0].text — dus vertalen we daarnaartoe in plaats
   van vijf plekken in twee pagina's aan te passen. */
window.mkMbFeature = function(f){
  var p = f.properties || {}, c = p.coordinates || {};
  var lng = c.longitude, lat = c.latitude;
  if(lng === undefined && f.geometry && f.geometry.coordinates){
    lng = f.geometry.coordinates[0]; lat = f.geometry.coordinates[1];
  }
  var ctx = [], src = p.context || {};
  ['neighborhood','locality','place','district','region','country'].forEach(function(k){
    if(src[k] && src[k].name) ctx.push({ id: k, text: src[k].name });
  });
  return {
    center: [lng, lat],
    text: p.name || '',
    place_name: p.full_address || [p.name, p.place_formatted].filter(Boolean).join(', ') || p.name || '',
    place_type: [p.feature_type || 'place'],
    context: ctx
  };
};

window.mkGeocode = function(q, opts){
  opts = opts || {};
  if(!q || q.length < (opts.min || 3)) return Promise.resolve([]);
  if(window.mkProvider() === 'mapbox'){
    /* permanent=true is nodig zodra een uitkomst wordt bewaard — bij Mapbox is
       dat een aparte, betaalde eindpuntstand zonder gratis laag. Zoeken om te
       kijken blijft tijdelijk; zie CLAUDE.md. */
    var mu = 'https://api.mapbox.com/search/geocode/v6/forward?q=' + encodeURIComponent(q) +
             '&access_token=' + window.MK_MAPBOX.token +
             '&country=gm&language=en&limit=' + Math.min(opts.limit || 6, 10) +
             '&proximity=' + (opts.near || window.MK_GEO_NEAR) +
             '&autocomplete=' + (opts.autocomplete === false ? 'false' : 'true') +
             (opts.permanent ? '&permanent=true' : '');
    if(opts.types) mu += '&types=' + opts.types;
    return fetch(mu, { mode:'cors', credentials:'omit' })
      .then(function(r){ return r.ok ? r.json() : { features: [] }; })
      .then(function(j){
        return (j.features || []).map(window.mkMbFeature)
                 .filter(function(f){ return f.center[0] !== undefined; });
      })
      .catch(function(){ return []; });
  }
  if(!window.MK_MAP || !window.MK_MAP.key) return Promise.resolve([]);
  var u = 'https://api.maptiler.com/geocoding/' + encodeURIComponent(q) +
          '.json?key=' + window.MK_MAP.key +
          '&country=gm&language=en&limit=' + (opts.limit || 6) +
          '&proximity=' + (opts.near || window.MK_GEO_NEAR) +
          '&autocomplete=' + (opts.autocomplete === false ? 'false' : 'true');
  if(opts.types) u += '&types=' + opts.types;
  return fetch(u, { mode:'cors', credentials:'omit' })
    .then(function(r){ return r.ok ? r.json() : { features: [] }; })
    .then(function(j){ return (j.features || []).filter(function(f){ return f && f.center; }); })
    .catch(function(){ return []; });          /* offline: de eigen lijst blijft werken */
};

/* Omgekeerd: van een pin naar de naam van de plek waar hij staat. */
window.mkReverseGeocode = function(lat, lng, opts){
  opts = opts || {};
  if(window.mkProvider() === 'mapbox'){
    var mu = 'https://api.mapbox.com/search/geocode/v6/reverse?longitude=' + Number(lng).toFixed(6) +
             '&latitude=' + Number(lat).toFixed(6) +
             '&access_token=' + window.MK_MAPBOX.token + '&language=en&limit=1' +
             (opts.permanent ? '&permanent=true' : '');
    if(opts.types) mu += '&types=' + opts.types;
    return fetch(mu, { mode:'cors', credentials:'omit' })
      .then(function(r){ return r.ok ? r.json() : null; })
      .then(function(j){
        var f = j && j.features && j.features[0];
        return f ? window.mkMbFeature(f) : null;
      })
      .catch(function(){ return null; });
  }
  if(!window.MK_MAP || !window.MK_MAP.key) return Promise.resolve(null);
  var u = 'https://api.maptiler.com/geocoding/' + Number(lng).toFixed(6) + ',' + Number(lat).toFixed(6) +
          '.json?key=' + window.MK_MAP.key + '&language=en&limit=1';
  if(opts.types) u += '&types=' + opts.types;
  return fetch(u, { mode:'cors', credentials:'omit' })
    .then(function(r){ return r.ok ? r.json() : null; })
    .then(function(j){ return (j && j.features && j.features[0]) || null; })
    .catch(function(){ return null; });
};

window.mkGeoLabel = function(f){
  var t = (f.place_type || []).join(',');
  if(/poi/.test(t)) return 'place';
  if(/address|road|street/.test(t)) return 'street';
  if(/municipality|locality|place|neighbou?rhood/.test(t)) return 'town';
  return 'location';
};

/* Geeft een functie terug die je bij elke toetsaanslag mag aanroepen. */
window.mkGeoSuggest = function(cb, opts){
  var timer = null, seq = 0;
  return function(q){
    clearTimeout(timer);
    timer = setTimeout(function(){
      var mine = ++seq;
      window.mkGeocode(q, opts).then(function(list){ if(mine === seq) cb(list, q); });
    }, (opts && opts.debounce) || 250);
  };
};


/* ---------- Distance to the Atlantic shoreline ----------
   Shared by the List page and the valuation tool so both measure the same way:
   perpendicular distance to the coastline polyline, not to a named beach. */
window.MK_COASTLINE = [
  [13.4790,-16.5790],[13.4700,-16.5830],[13.4650,-16.6120],[13.4680,-16.6420],[13.4780,-16.6580],
  [13.4880,-16.6650],[13.4930,-16.6690],[13.4880,-16.6760],[13.4835,-16.6790],[13.4780,-16.6850],
  [13.4715,-16.6920],[13.4650,-16.6990],[13.4575,-16.7095],[13.4490,-16.7160],[13.4410,-16.7225],
  [13.4340,-16.7255],[13.4285,-16.7285],[13.4200,-16.7350],[13.4110,-16.7440],[13.4000,-16.7600],
  [13.3910,-16.7660],[13.3830,-16.7715],[13.3700,-16.7810],[13.3530,-16.7955],[13.3400,-16.8000],
  [13.3235,-16.8015],[13.3110,-16.8005],[13.2960,-16.7985],[13.2760,-16.7965],[13.2500,-16.7920],
  [13.2200,-16.7870],[13.1910,-16.7835],[13.1600,-16.7810],[13.1300,-16.7790],[13.0970,-16.7775],
  [13.0640,-16.7760]
];
window.mkSeaDistance = function(lat, lng){
  function mpd(la){ var d=Math.PI/180; return { lat:110574, lng:111320*Math.cos(la*d) }; }
  function segDist(p,a,b){
    var m=mpd(p[0]);
    var px=(p[1]-a[1])*m.lng, py=(p[0]-a[0])*m.lat;
    var bx=(b[1]-a[1])*m.lng, by=(b[0]-a[0])*m.lat;
    var len2=bx*bx+by*by;
    var t = len2 ? (px*bx+py*by)/len2 : 0;
    t = Math.max(0, Math.min(1, t));
    var dx=px-t*bx, dy=py-t*by;
    return Math.sqrt(dx*dx+dy*dy);
  }
  var C=window.MK_COASTLINE, best=Infinity;
  for(var i=0;i<C.length-1;i++){ var d=segDist([lat,lng],C[i],C[i+1]); if(d<best) best=d; }
  return best;
};
window.mkSeaBand = function(m){ return m<=150 ? 'beachfront' : (m<=1200 ? 'walking' : 'inland'); };
window.mkFmtSeaDist = function(m){
  return m<1000 ? Math.round(m/10)*10+' m' : (m/1000).toFixed(m<10000?1:0)+' km';
};

/* isLocalAdmin — safe fallback so header renders before supabase loads */
if(typeof isLocalAdmin==='undefined'){window.isLocalAdmin=function(){try{return localStorage.getItem('mykunda_admin')==='1'}catch(e){return false}}}

/* ---------- Inline SVG icons ---------- */
const ICON = {
  bed:'<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M3 18v-6a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v6"/><path d="M3 18v3M21 18v3M3 13h18"/><path d="M6 10V8a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2M12 10V8a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2"/></svg>',
  bath:'<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M4 12V5.5A1.5 1.5 0 0 1 5.5 4a1.5 1.5 0 0 1 1.5 1.5"/><path d="M3 12h18v2a4 4 0 0 1-4 4H7a4 4 0 0 1-4-4z"/><path d="M6 18l-1 2M18 18l1 2"/><circle cx="7" cy="7.5" r="1"/></svg>',
  area:'<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M3 8V3h5M21 8V3h-5M3 16v5h5M21 16v5h-5"/><path d="M8 8h8v8H8z"/></svg>',
  pin:'<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="2.6"/></svg>',
  heart:'<svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M19.5 5.5a5 5 0 0 0-7.1 0l-.4.4-.4-.4a5 5 0 1 0-7.1 7.1l7.5 7.5 7.5-7.5a5 5 0 0 0 0-7.1Z"/></svg>',
  heartFill:'<svg width="19" height="19" viewBox="0 0 24 24" fill="currentColor"><path d="M12.4 20.6 4.9 13a5 5 0 1 1 7.1-7.1l.4.4.4-.4a5 5 0 0 1 7.1 7.1l-7.5 7.6Z"/></svg>',
  camera:'<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 8a2 2 0 0 1 2-2h2l1.5-2h7L17 6h2a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><circle cx="12" cy="12.5" r="3.2"/></svg>',
  search:'<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="7"/><path d="m21 21-4.3-4.3"/></svg>',
  arrow:'<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14M13 6l6 6-6 6"/></svg>',
  chevron:'<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="m6 9 6 6 6-6"/></svg>',
  star:'<svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor"><path d="m12 2 2.9 6.3 6.9.7-5.1 4.6 1.4 6.8L12 17.6 5.9 20.4l1.4-6.8L2.2 9l6.9-.7z"/></svg>',
  check:'<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg>',
};

const LOGO_MARK = '<img class="logo-mark" src="images/mykunda-icon.png" alt="MyKunda" width="36" height="36" style="border-radius:8px">';

/* ---------- Listings dataset — The Gambia (Kombo / Atlantic coast) ---------- */
const LISTINGS = []; /* demo listings removed 18-08-2026 — real data comes from the database */

/* ==========================================================================
   VALUTASYSTEEM — verankerd op de dalasi

   Er is precies één plek die een koers vaststelt: de edge function
   `fx-rates`, gevoed door de dagelijkse valuation rates van de Central
   Bank of The Gambia. Die geeft dalasi per eenheid terug (`gmd_per`), en
   alles wat de site laat zien wordt daaruit gedeeld.

   Zet hier, in een pagina, of in een andere function NOOIT een tweede
   koers neer. Dat is precies hoe de homepagina op D83 bleef staan terwijl
   de rest van de site op D85,74 rekende.

   Prijzen worden op dit moment nog in euro's opgeslagen en met
   `convert()` omgerekend. Dat is een aparte kwestie — zie het
   koersen-hoofdstuk in CLAUDE.md.
   ========================================================================== */
/* Bump on every deploy. Read it in the console to confirm which bundle is live:
   window.MYKUNDA_BUILD */
window.MYKUNDA_BUILD = '2026-08-14-geo1';

/* Eén bron, en dat is de dalasi.
   -------------------------------------------------------------------
   `gmdPer` is dalasi per 1 eenheid — precies de vorm die de Central Bank
   of The Gambia publiceert en die de fx-rates function teruggeeft. Elke
   andere koers op de site wordt hieruit gedeeld en nergens los ingevoerd.

   `rate` (per 1 euro) blijft er voorlopig naast staan omdat de prijzen op
   dit moment nog in euro's zijn opgeslagen; hij wordt altijd uit `gmdPer`
   berekend, nooit apart gezet. Zodra bedragen in dalasi worden bewaard
   kan `rate` weg.

   De getallen hieronder zijn de noodkoers voor de allereerste
   paginaweergave met een lege cache en een onbereikbare function. Ze zijn
   bewust zichtbaar gedateerd: `FX_FALLBACK_AS_AT` staat in de bouw en in
   de admin, zodat een verouderde noodkoers opvalt in plaats van stil te
   blijven staan. */
const FX_FALLBACK_AS_AT = '2026-08-27';   // CBG-publicatiedatum van de getallen hieronder
const CURRENCIES = {
  GMD:{symbol:'D', gmdPer:1,     rate:85.74,  decimals:0, name:'Gambian Dalasi'},
  EUR:{symbol:'€', gmdPer:85.74, rate:1,      decimals:0, name:'Euro'},
  USD:{symbol:'$', gmdPer:72.70, rate:1.1794, decimals:0, name:'US Dollar'},
  GBP:{symbol:'£', gmdPer:96.34, rate:0.8900, decimals:0, name:'British Pound'},
};

/* ---------- Listing plan pricing (single source of truth) ----------
   The DALASI amount is the real price a seller pays. The euro figure next to it
   is the internal reference the price was set against — it is never shown.

   When the dalasi drifts far from referenceRate, the euro value of every plan
   quietly erodes. Do NOT let the displayed price float: instead re-round the
   gmd amounts to tidy numbers, update the eur figures, and bump reviewedAt.
   pricingReviewDue() flags when that is overdue. */
const PRICING = {
  reviewedAt: '2026-08-12',
  referenceRate: 85.2,        // CBG daily valuation rate when these prices were set
  driftTolerance: 0.05,       // re-round once the rate has moved this far
  /* Ownership Verification — a stand-alone product a BUYER orders for any
     property in The Gambia, listed with us or not. This is NOT the seller's
     Verified plan: no badge, no listing, and the report is addressed to the
     buyer who paid for it. Flat fee, never a percentage of the purchase.
     The full check's site visit is quoted per property — Gambia is long and
     narrow and a plot in Basse is not the same journey as one in Bijilo — so
     the travel sits outside the base fee and is shown before payment.
     Benchmarks behind these numbers (reviewed 12 Aug 2026, 1 USD = D73.6):
       · Gambian conveyancing lawyers charge 1-3% of the purchase price,
         which on a D2m plot is D20,000-60,000 for the whole transaction.
       · A stand-alone title search in Lagos runs EUR 60-240; a flat-fee
         due-diligence job in Ghana runs EUR 120-400.
       · Average gross monthly salary in The Gambia is about D8,000.
     Document Check sits well under half a month's average salary; the Full
     Check stays below 1% of any coastal property. */
  ownership: {
    standard: { gmd: 3500,  eur: 41 },
    full:     { gmd: 20000, eur: 235 }
  },
  boost: { gmd: 2500, eur: 29 },   // 30 days top of search + homepage — one flat price, any property
  /* Parked plans — not sold anywhere right now. Promoted needs a contracted
     photographer, Managed a partner estate agency. Data kept so they can
     return without re-deriving prices. */
  promoted: { gmd: 20000, eur: 235 },
  bands: [
    { max: 2000000,  sub: 'Most plots and smaller compounds',  verified:{gmd:4500,  eur:53},  managed:{gmd:30000, eur:352} },
    { max: 10000000, sub: 'Most coastal homes and apartments', verified:{gmd:8500,  eur:100}, managed:{gmd:45000, eur:528} },
    { max: Infinity, sub: 'Villas and larger developments',    verified:{gmd:16000, eur:188}, managed:{gmd:70000, eur:822} }
  ]
};
/* Rentals always sit in the lowest band — a monthly rent is not a sale value. */
function planBandFor(askingGMD, deal){
  if(deal === 'rent') return PRICING.bands[0];
  const p = parseInt(String(askingGMD||'').replace(/[^0-9]/g,''), 10) || 0;
  for(var i=0; i<PRICING.bands.length; i++){ if(p < PRICING.bands[i].max) return PRICING.bands[i]; }
  return PRICING.bands[PRICING.bands.length-1];
}
function planBandNo(askingGMD, deal){ return PRICING.bands.indexOf(planBandFor(askingGMD, deal)) + 1; }
function planPriceFor(plan, askingGMD, deal){
  if(plan === 'boost') return PRICING.boost.gmd;
  if(plan === 'promoted') return PRICING.promoted.gmd; // parked
  const b = planBandFor(askingGMD, deal);
  if(plan === 'verified') return b.verified.gmd;
  if(plan === 'managed')  return b.managed.gmd;
  return 0;
}
/* How far the live rate has moved from the rate the prices were set against. */
function pricingDrift(){ return CURRENCIES.EUR.gmdPer / PRICING.referenceRate - 1; }
function pricingReviewDue(){
  const months = (Date.now() - new Date(PRICING.reviewedAt).getTime()) / 2592000000;
  return Math.abs(pricingDrift()) > PRICING.driftTolerance || months > 3;
}

/* ==========================================================================
   LIVE RATES — één aanroep, één bron
   De koers komt van de fx-rates edge function en van nergens anders. Die
   function haalt zelf de dalasi bij de Central Bank of The Gambia, vult
   zelf een ontbrekende munt aan via de ECB, en past zelf een handmatige
   override toe. De browser rekent niet mee: hij leest.

   Tot 27-08-2026 belde deze code bij een ontbrekende notering zélf
   api.frankfurter.app. Dat werkte al niet meer — die host stuurt sinds
   2026 een 302 naar api.frankfurter.dev en de CSP liet alleen .app door —
   en het mengde bovendien twee ankers: een CBG-dalasi met een ECB-dollar.
   Beide problemen verdwijnen door het aan de serverkant te doen.

   RATE_INFO zegt welke koers op het scherm staat en waar elk getal
   vandaan komt, zodat de muntkiezer en de admin dat kunnen benoemen.
   Koersen raken alleen de WEERGAVE — planprijzen staan in PRICING en
   bewegen nooit vanzelf. */
const RATE_INFO = {
  asAt:null,
  source:'built-in fallback',
  stale:false,
  override:false,
  /* Per munt: 'cbg', 'ecb-cross', 'manual' of 'fallback'. De function zegt
     dit zelf; de site verzint het niet meer uit de vorm van het antwoord. */
  sources:{ GMD:'fallback', EUR:'fallback', USD:'fallback', GBP:'fallback' }
};
const RATES_CACHE_KEY = 'mykunda_rates';
const RATES_MAX_AGE = 2 * 60 * 60 * 1000;
/* A stored rate older than this is shown with a caveat rather than trusted. */
const RATE_STALE_DAYS = 7;

/* Must not depend on supabase.js: it is lazy-loaded after app.js on most
   pages, so that constant is often undefined when the rate fetch runs. */
const FX_ENDPOINT = 'https://jejaerpqltqryqzjvbjp.supabase.co/functions/v1/fx-rates';
function fxEndpoint(){
  try{
    if(typeof MYKUNDA_SUPABASE_URL === 'string' && MYKUNDA_SUPABASE_URL.indexOf('YOUR-PROJECT') === -1){
      return MYKUNDA_SUPABASE_URL.replace(/\/+$/, '') + '/functions/v1/fx-rates';
    }
  }catch(e){}
  return FX_ENDPOINT;
}

/* Dalasi per eenheid in, alle koersen eruit. Dit is de enige plek in de
   browser waar een koers wordt gezet. Accepteert ook het oude antwoord
   (per 1 euro), zodat een bezoeker met een oude cache niet zonder koers
   komt te zitten tijdens de uitrol. */
function applyRates(r){
  if(!r) return;
  var per = r.gmd_per;
  if(!per && r.GMD > 0){
    /* Oude vorm: GMD/USD/GBP waren per 1 euro. Terugrekenen naar dalasi
       per eenheid, zodat er verderop maar één rekenwijze bestaat. */
    per = { GMD:1, EUR:r.GMD };
    if(r.USD > 0) per.USD = r.GMD / r.USD;
    if(r.GBP > 0) per.GBP = r.GMD / r.GBP;
  }
  if(!per || !(per.EUR > 0)) return;

  ['GMD','EUR','USD','GBP'].forEach(function(k){
    var v = k === 'GMD' ? 1 : per[k];
    if(!(v > 0) || !CURRENCIES[k]) return;
    CURRENCIES[k].gmdPer = v;
    /* `rate` is per 1 euro en wordt hier afgeleid, nooit los gezet. */
    CURRENCIES[k].rate = k === 'EUR' ? 1 : (k === 'GMD' ? per.EUR : per.EUR / v);
    if(r.sources && r.sources[k]) RATE_INFO.sources[k] = r.sources[k];
    else if(!r.sources) RATE_INFO.sources[k] = 'cbg';
  });

  if(r.as_at) RATE_INFO.asAt = r.as_at;
  if(r.source) RATE_INFO.source = r.source;
  RATE_INFO.override = !!r.override;
  RATE_INFO.stale = !!r.stale || (r.as_at
    ? (Date.now() - new Date(r.as_at).getTime()) > RATE_STALE_DAYS * 86400000
    : false);
}

/* Show something instantly from cache, then refresh in the background.
   De handmatige override zat hier tot 27-08-2026 als localStorage-sleutel
   `mykunda_gmd_eur`. Die gold alleen in de browser waar hij was ingetypt,
   terwijl rates.html beloofde dat het de koers was waarmee élke prijs op
   de site wordt omgerekend. De override staat nu in de database en komt
   dus gewoon met het antwoord van de function mee. De oude sleutel wordt
   hier één keer opgeruimd. */
(function loadCachedRates(){
  try {
    const cached = JSON.parse(localStorage.getItem(RATES_CACHE_KEY)||'null');
    if(cached) applyRates(cached);
  } catch(e){}
  try { localStorage.removeItem('mykunda_gmd_eur'); } catch(e){}
})();

function cacheRates(){
  try {
    localStorage.setItem(RATES_CACHE_KEY, JSON.stringify({
      gmd_per: {
        GMD: 1,
        EUR: CURRENCIES.EUR.gmdPer,
        USD: CURRENCIES.USD.gmdPer,
        GBP: CURRENCIES.GBP.gmdPer
      },
      sources: RATE_INFO.sources,
      as_at: RATE_INFO.asAt, source: RATE_INFO.source,
      override: RATE_INFO.override, stale: RATE_INFO.stale, ts: Date.now()
    }));
  } catch(e){}
}

/* Geeft een promise terug die pas rond is als de koers echt binnen (of
   definitief mislukt) is. rates.html wachtte hier vroeger met een
   setTimeout van anderhalve seconde op, en zette dan "Refreshed ✓" boven
   een getal dat nog niet ververst was. */
function fetchLiveRates(force){
  if(!force){
    try {
      const cached = JSON.parse(localStorage.getItem(RATES_CACHE_KEY)||'null');
      const authoritative = cached && cached.source && cached.source !== 'built-in fallback';
      const maxAge = authoritative ? RATES_MAX_AGE : 15 * 60 * 1000;
      if(cached && cached.ts && (Date.now() - cached.ts < maxAge)) return Promise.resolve(false);
    } catch(e){}
  }
  const url = fxEndpoint();
  if(!url) return Promise.resolve(false);

  return fetch(url, { signal: AbortSignal.timeout(8000), cache: force ? 'no-store' : 'default' })
    .then(function(r){ return r.ok ? r.json() : null; })
    .then(function(d){
      /* De function vult zelf aan wat CBG niet noteerde en past zelf een
         override toe. Komt er niets bruikbaars uit, dan houden we wat we
         hadden — een halve koers is erger dan een oude. */
      if(!d) return false;
      const ok = (d.gmd_per && d.gmd_per.EUR > 0) || d.GMD > 0;
      if(!ok) return false;
      applyRates(d);
      return true;
    })
    .catch(function(){
      console.warn('Currency fetch failed, using cached/fallback rates');
      return false;
    })
    .then(function(got){
      if(RATE_INFO.source !== 'built-in fallback') cacheRates();
      if(typeof onRatesUpdated === 'function') onRatesUpdated();
      if(typeof renderRateNote === 'function') renderRateNote();
      return got;
    });
}
fetchLiveRates();

/* Human-readable provenance for the currency picker and admin. */
function rateNote(){
  const d = RATE_INFO.asAt
    ? new Date(RATE_INFO.asAt).toLocaleDateString('en-GB',{day:'numeric',month:'short',year:'numeric'})
    : null;
  if(RATE_INFO.source === 'manual override') return 'Rate set manually in admin.';
  if(!d) return 'Indicative rate.';
  return (RATE_INFO.stale ? 'Last confirmed rate: ' : 'Rate of ') + d +
    (RATE_INFO.source.indexOf('Central Bank') === 0 ? ' · Central Bank of The Gambia' : ' · ' + RATE_INFO.source);
}
function renderRateNote(){
  document.querySelectorAll('[data-rate-note]').forEach(function(el){ el.textContent = rateNote(); });
}

function getCurrency(){ const c=localStorage.getItem('mykunda_ccy'); return CURRENCIES[c]?c:'GMD'; }
/* One-time migration: old default was USD/EUR, new default is GMD.
   If user never explicitly chose, migrate them to GMD. */
(function migrateCcy(){
  if(!localStorage.getItem('mykunda_ccy_migrated')){
    var old = localStorage.getItem('mykunda_ccy');
    if(!old || old==='USD' || old==='EUR'){
      localStorage.setItem('mykunda_ccy','GMD');
    }
    localStorage.setItem('mykunda_ccy_migrated','1');
  }
})();
function setCurrency(c){ if(CURRENCIES[c]) localStorage.setItem('mykunda_ccy', c); }

/* (duplicate migration removed — handled by migrateCcy above) */

/* ---------- Van dalasi naar de gekozen munt ----------
   Elk bedrag dat de site laat zien is een DALASIbedrag. Een vraagprijs is
   in dalasi afgesproken, een gebiedsprijs is in dalasi waargenomen, een
   planprijs is in dalasi gefactureerd. De euro, dollar en pond zijn wat
   een bezoeker er desgewenst naast wil zien.

   Tot 27-08-2026 was het andersom: bedragen stonden in euro's en werden
   met de live koers naar dalasi vermenigvuldigd. Daardoor steeg elke
   dalasiprijs op de site zodra de dalasi zakte, zonder dat er iets was
   gemeten, en kwam een vraagprijs van D2.000.000 een week later als
   D2.040.000 terug bij de verkoper die hem had ingetypt. */
function fromGMD(gmd){ return gmd / CURRENCIES[getCurrency()].gmdPer; }
/* Historische naam, zelfde functie — hij staat op te veel plekken om te
   hernoemen zonder iets te breken. Neemt dalasi, geeft de weergavemunt. */
function convert(gmd){ return fromGMD(gmd); }

/* Format area market prices (stored in GMD) in current currency */
function fmtAreaPrice(gmd){
  var val = Math.round(fromGMD(gmd));
  return CURRENCIES[getCurrency()].symbol + val.toLocaleString('en-US');
}
function fmtAreaPriceK(gmd){
  var val = Math.round(fromGMD(gmd) / 1000);
  return CURRENCIES[getCurrency()].symbol + val.toLocaleString('en-US') + 'k';
}
function ccyLabel(){ return getCurrency(); }

/* ---------- Formatting (currency-aware) ---------- */
function priceInner(p, type){
  const c=CURRENCIES[getCurrency()];
  const v=Math.round(convert(p));
  const s = c.symbol + v.toLocaleString('en-US');
  return type === 'rent' ? `${s}<span class="per">/mo</span>` : s;
}
function pinInner(p, type){
  const c=CURRENCIES[getCurrency()];
  const v=convert(p);
  if(type==='rent') return c.symbol + Math.round(v).toLocaleString();
  return v>=1000000 ? c.symbol+(v/1000000).toFixed(v%1000000?2:1).replace(/\.?0+$/,'')+'M' : c.symbol+Math.round(v/1000).toLocaleString('en-US')+'k';
}
/* Het dalasibedrag rijdt mee in data-gmd, zodat onRatesUpdated() een prijs
   kan herberekenen die al met de noodkoers was getekend. Heette data-eur
   tot 27-08-2026; de inhoud is nu dalasi, dus de naam moest mee — een
   attribuut dat "eur" heet met dalasi erin is precies hoe een eenheid
   zoekraakt. */
function fmtPrice(p, type){
  return '<span data-gmd="'+p+'" data-ptype="'+(type||'')+'">'+priceInner(p,type)+'</span>';
}
function fmtPin(p, type){
  return '<span data-gmd="'+p+'" data-ptype="'+(type||'')+'" data-pin="1">'+pinInner(p,type)+'</span>';
}

/* Called when live rates land after first paint. Without this every cold-cache
   visitor kept the fallback numbers for the whole session. */
function onRatesUpdated(){
  document.querySelectorAll('[data-gmd]').forEach(function(el){
    const gmd = parseFloat(el.getAttribute('data-gmd'));
    if(!(gmd > 0)) return;
    const t = el.getAttribute('data-ptype') || undefined;
    el.innerHTML = el.hasAttribute('data-pin') ? pinInner(gmd, t) : priceInner(gmd, t);
  });
  document.querySelectorAll('[data-ccy-cross]').forEach(function(el){
    const k = el.getAttribute('data-ccy-cross');
    if(!CURRENCIES[k]) return;
    el.textContent = '= D' + CURRENCIES[k].gmdPer.toLocaleString('en-US', {minimumFractionDigits:1,maximumFractionDigits:1});
  });
  /* Area-guide pages (qs0/qs1/qs2/chartBigPrice/breakdown) paint with whatever
     rate was live at parse time and carry no data-gmd hook — without this they'd
     stay stuck on a stale/fallback rate even after the live rate lands. */
  if(typeof updateAreaPrices === 'function') updateAreaPrices();
}

/* ---------- Google Plus Codes (Open Location Code) ----------
   Google location codes — widely used in The Gambia where
   street addressing is unreliable. Integer reference algorithm. */
const OLC_ALPHABET='23456789CFGHJMPQRVWX';
const OLC_SEP='+', OLC_SEP_POS=8, OLC_ENC_BASE=20;
const OLC_LAT_MAX=90, OLC_LNG_MAX=180;
const OLC_PAIR_LEN=10, OLC_MAX_LEN=15, OLC_GRID_LEN=5;
const OLC_GRID_ROWS=5, OLC_GRID_COLS=4;
const OLC_LAT_MULT=25000000, OLC_LNG_MULT=8192000;
/* full global code, e.g. "7C55F852+G8" (len 10) — internal only; display uses the short form */
function plusCode(latitude, longitude, codeLength){
  codeLength = codeLength || OLC_PAIR_LEN;
  codeLength = Math.min(OLC_MAX_LEN, Math.max(2, codeLength));
  latitude = Math.min(90, Math.max(-90, latitude));
  while(longitude<-180) longitude+=360;
  while(longitude>=180) longitude-=360;
  if(latitude===90) latitude -= 0.9*Math.pow(OLC_ENC_BASE, Math.floor(codeLength/-2 + 2));
  let latVal = Math.floor(Math.round((latitude + OLC_LAT_MAX) * OLC_LAT_MULT * 1e6) / 1e6);
  let lngVal = Math.floor(Math.round((longitude + OLC_LNG_MAX) * OLC_LNG_MULT * 1e6) / 1e6);
  let code='';
  if(codeLength > OLC_PAIR_LEN){
    for(let i=0;i<OLC_GRID_LEN;i++){
      const latDigit = latVal % OLC_GRID_ROWS;
      const lngDigit = lngVal % OLC_GRID_COLS;
      code = OLC_ALPHABET.charAt(latDigit*OLC_GRID_COLS + lngDigit) + code;
      latVal = Math.floor(latVal / OLC_GRID_ROWS);
      lngVal = Math.floor(lngVal / OLC_GRID_COLS);
    }
  } else {
    latVal = Math.floor(latVal / Math.pow(OLC_GRID_ROWS, OLC_GRID_LEN));
    lngVal = Math.floor(lngVal / Math.pow(OLC_GRID_COLS, OLC_GRID_LEN));
  }
  for(let i=0;i<OLC_PAIR_LEN/2;i++){
    code = OLC_ALPHABET.charAt(lngVal % OLC_ENC_BASE) + code;
    code = OLC_ALPHABET.charAt(latVal % OLC_ENC_BASE) + code;
    latVal = Math.floor(latVal / OLC_ENC_BASE);
    lngVal = Math.floor(lngVal / OLC_ENC_BASE);
  }
  code = code.substring(0, OLC_SEP_POS) + OLC_SEP + code.substring(OLC_SEP_POS);
  if(codeLength >= OLC_SEP_POS) return code.substring(0, codeLength + 1);
  return code.substring(0, codeLength) + '0'.repeat(OLC_SEP_POS-codeLength) + OLC_SEP;
}
/* display form: short Google Plus Code (without first 4 chars) + locality label.
   Gambia fits within a small number of grid squares, so the short form is
   what people see on compounds and is easier to remember. */
function plusCodeShort(lat,lng,locality){
  const full=plusCode(lat,lng,10);
  const short=full.substring(4); // drop first 4 chars e.g. "7C55" → "F852+G8"
  return short+(locality?(' '+locality):'');
}
function plusCodeRefPoint(text){
  if(text){ const t=String(text).toLowerCase();
    for(const a of GM_AREAS){ if(t.includes(a[0].toLowerCase())) return [a[1],a[2]]; }
    try{ for(const k in AREA_COORDS){ if(t.includes(k.toLowerCase())) return AREA_COORDS[k]; } }catch(e){}
    try{ for(const p of GAMBIA_PLACES){ if(t.includes(String(p[0]).toLowerCase())) return [p[2],p[3]]; } }catch(e){}
  }
  return [13.4500,-16.7000]; /* Kombo coast — where almost all listings are */
}
/* Expand a short Google Plus Code (e.g. "F852+G8") to the full global code.
   Tries every grid square that covers The Gambia and keeps the candidate that
   (a) falls inside the country and (b) is nearest to the reference point —
   the locality typed with the code, else the Kombo coast. */
function expandShortPlusCode(shortCode, refText){
  shortCode=String(shortCode||'').trim().toUpperCase();
  const sepIdx=shortCode.indexOf('+');
  if(sepIdx>=8){ const ll=plusCodeDecode(shortCode); return ll?{full:shortCode,lat:ll.lat,lng:ll.lng}:null; }
  const codePart=shortCode.replace(/\s+.*/,'');
  const ref=plusCodeRefPoint(refText||shortCode);
  const PREFIXES=['7C45','7C46','7C47','7C55','7C56','7C57','7C65','7C66','7C67'];
  let best=null, bd=Infinity;
  for(const pfx of PREFIXES){
    const full=pfx+codePart;
    const ll=plusCodeDecode(full);
    if(!ll) continue;
    if(ll.lat<12.90||ll.lat>13.95||ll.lng<-17.10||ll.lng>-13.60) continue; /* outside The Gambia */
    const d=Math.hypot(ll.lat-ref[0],(ll.lng-ref[1])*Math.cos(ref[0]*Math.PI/180));
    if(d<bd){ bd=d; best={full,lat:ll.lat,lng:ll.lng}; }
  }
  return best;
}

/* Decode a full Google Plus Code (e.g. "7C55F833+6R") back to its centre lat/lng.
   Returns {lat,lng} or null if the code isn't a valid full global code. */
function plusCodeDecode(code){
  if(!code) return null;
  code = String(code).trim().toUpperCase().replace(/\s+/g,'');
  const sep = code.indexOf(OLC_SEP);
  if(sep!==OLC_SEP_POS) return null;                 // must be a full (not short) code
  const digits = code.replace('+','').replace(/0+$/,'');
  if(digits.length<2) return null;
  for(const ch of digits){ if(OLC_ALPHABET.indexOf(ch)===-1) return null; }
  let lat=-OLC_LAT_MAX, lng=-OLC_LNG_MAX;
  let latRes=OLC_ENC_BASE*OLC_ENC_BASE, lngRes=OLC_ENC_BASE*OLC_ENC_BASE;
  let i=0;
  // pair section (first 10 digits)
  while(i<Math.min(digits.length,OLC_PAIR_LEN)){
    latRes/=OLC_ENC_BASE; lngRes/=OLC_ENC_BASE;
    lat += OLC_ALPHABET.indexOf(digits[i])*latRes;
    lng += OLC_ALPHABET.indexOf(digits[i+1])*lngRes;
    i+=2;
  }
  let latC=latRes, lngC=lngRes;
  // grid refinement section (digits 11+)
  let rowRes=latRes, colRes=lngRes;
  while(i<digits.length){
    const v=OLC_ALPHABET.indexOf(digits[i]);
    const row=Math.floor(v/OLC_GRID_COLS), col=v%OLC_GRID_COLS;
    rowRes/=OLC_GRID_ROWS; colRes/=OLC_GRID_COLS;
    lat += row*rowRes; lng += col*colRes;
    latC=rowRes; lngC=colRes;
    i++;
  }
  return { lat: lat + latC/2, lng: lng + lngC/2 };
}

/* Gambia area centroids - used to name an area from coordinates.
   GEGENEREERD uit gambia-places.js (plaatscontrole 30-08-2026, incl. verwerkte
   eigenaarslijst): zelfde waarden, langste naam eerst zodat substring-matching
   (plusCodeRefPoint) nooit op een kortere naam blijft hangen. Niet met de hand
   bijwerken. */
const GM_AREAS=[
['Medina Serigne Mass',13.4913,-16.4105],['Bakindick Mandinka',13.4554,-16.4514],['Medina Serign Mass',13.4913,-16.4105],['Tallinding Kunjang',13.4259,-16.6722],['Berending (Kombo)',13.1402,-16.743],['Berending (Niumi)',13.4909,-16.4613],['Boro Dampha Kunda',13.53,-14.7],['Boro Kanda Kassy',13.4227,-14.0286],['Brikama Ba (CRR)',13.5376,-14.9275],['Konti Kunda Niji',13.56667,-15.78333],['Basse Mansajang',13.2959,-14.2095],['Churchills Town',13.4412,-16.6839],['Basse Santa Su',13.31,-14.215],['Boro Modi Bane',13.439,-14.0311],['Brufut Heights',13.4,-16.759],['Bantango Koto',13.55,-14.72],['Sabach Sanjal',13.5968,-15.444],['Sinchu Alagie',13.37808,-16.68374],['Sinchu Baliya',13.3966,-16.6744],['Banjul Nding',13.37333,-16.65722],['Banjulunding',13.3765,-16.6531],['Barrow Kunda',13.4882,-14.1173],['Busura Alieu',13.3,-14.52],['Faraba Banta',13.2667,-16.5167],['Konteh Kunda',13.5663,-15.7929],['Manjai Kunda',13.4422,-16.6981],['New Jeshwang',13.4429,-16.6706],['Niani Sukuta',13.617,-14.9231],['Old Jeshwang',13.4533,-16.6612],['Barry Nabeh',13.23,-16.45],['Besang Dugu',13.52,-14.71],['Bessi Nding',13.3,-16.5833],['Bohum Kunda',13.5556,-13.9506],['Demba Kunda',13.25,-14.2667],['Dippa Kunda',13.4383,-16.6884],['Faraba Sutu',13.2044,-16.4824],['Giboro Koto',13.1761,-16.5752],['Jambanjelly',13.2806,-16.7276],['Janjanbureh',13.5391,-14.7612],['Kerr Serign',13.4325,-16.7203],['Latri Kunda',13.4113,-16.674],['Mansa Konko',13.4585,-15.534],['Njaba Kunda',13.5547,-15.9131],['Pakalinding',13.4634,-15.5517],['Baja Kunda',13.46667,-14.05],['Bantunding',13.4755,-14.0852],['Baro Kunda',13.48333,-15.26667],['Brikama Ba',13.5376,-14.9275],['Cape Point',13.4849,-16.6661],['Faji Kunda',13.41778,-16.66667],['Gambissara',13.2383,-14.3108],['Ghana Town',13.38444,-16.77111],['Jumangsarr',13.5455,-15.7522],['Mandina Ba',13.2804,-16.5899],['Nema Kunku',13.40461,-16.68401],['Njau (CRR)',13.7474,-15.2109],['Old Yundum',13.3625,-16.68611],['Senegambia',13.4431,-16.7198],['Serrekunda',13.4388,-16.6748],['Wellingara',13.404,-16.674],['Allunhari',13.3167,-14.25],['Bakindick',13.4554,-16.4514],['Banyakang',13.54,-14.65],['Barajally',13.5852,-14.9461],['Batokunku',13.3268,-16.7991],['Brikamaba',13.5376,-14.9275],['Busumbala',13.3334,-16.6667],['Darsilami',13.1769,-16.6567],['Ebou Town',13.4366,-16.668],['Farafenni',13.5721,-15.598],['Jiffarong',13.3008,-15.868],['Karantaba',13.43333,-15.51667],['Mandinaba',13.2804,-16.5899],['Marakissa',13.2126,-16.6483],['Serekunda',13.4388,-16.6748],['Talinding',13.42558,-16.67261],['Bakadaji',13.3,-14.38333],['Dankunku',13.5693,-15.3252],['Ebo Town',13.4366,-16.668],['Illiassa',13.5644,-15.7493],['Jappineh',13.423,-15.4212],['Juffureh',13.33861,-16.3825],['Kabafita',13.275,-16.663],['Kanifing',13.4538,-16.6748],['Katchang',13.5,-15.75],['Kembujeh',13.2844,-16.6055],['Kwinella',13.4,-15.8],['No Kunda',13.56667,-15.83333],['Pipeline',13.463,-16.6841],['Selikene',13.48333,-15.96667],['Sutukoba',13.4977,-14.0162],['Tabokoto',13.4066,-16.6658],['Tujereng',13.3179,-16.7889],['Albreda',13.3345,-16.386],['Badarri',13.3414,-14.0956],['Bakoteh',13.4334,-16.6985],['Bambali',13.4765,-15.3349],['Bansang',13.4358,-14.6588],['Berefet',13.2439,-16.3799],['Bintang',13.2508,-16.212],['Bondali',13.2347,-15.9142],['Brikama',13.2744,-16.6454],['Brusubi',13.4073,-16.7306],['Bundung',13.4251,-16.6774],['Diabugu',13.3833,-14.4],['Folonko',13.0908,-16.7617],['Garowol',13.41667,-13.95],['Genieri',13.4142,-15.6181],['Japineh',13.423,-15.4212],['Jattaba',13.2744,-15.827],['Kanilai',13.1699,-16.0097],['Kansala',13.2412,-16.1215],['Kantora',13.3992,-13.891],['Kartong',13.0913,-16.7597],['Kerewan',13.4936,-16.0891],['Kuntair',13.5344,-16.2224],['Kuntaur',13.6709,-14.8898],['Kunting',13.5275,-14.6697],['Latriya',13.3,-16.711],['Madiana',13.3533,-16.7631],['Nianija',13.7833,-14.9333],['Numuyel',13.2759,-14.2946],['Nyambai',13.2794,-16.6541],['Sambang',13.5412,-15.3311],['Sambuya',13.2092,-16.7575],['Sankuia',13.46667,-15.51667],['Sanyang',13.2676,-16.7584],['Sibanor',13.2059,-16.1935],['Sotokoi',13.2262,-16.5033],['Sudowol',13.36667,-13.96667],['Tunjina',13.2833,-16.5667],['Banjul',13.4554,-16.5757],['Bijilo',13.4219,-16.7328],['Brufut',13.3813,-16.7517],['Bureng',13.41667,-15.28333],['Chamoi',13.3189,-14.1657],['Fajara',13.469,-16.6914],['Farato',13.3152,-16.6632],['Fatoto',13.3992,-13.891],['Gunjur',13.176,-16.7599],['Jabang',13.3619,-16.7023],['Jajari',13.5762,-15.746],['Jambur',13.3146,-16.7008],['Jareng',13.6223,-15.1911],['Kafuta',13.2014,-16.466],['Kalagi',13.2466,-15.8379],['Keneba',13.32889,-16.015],['Kololi',13.4404,-16.7156],['Kudang',13.6621,-15.0602],['Kulari',13.4,-14.08333],['Kuloro',13.2806,-16.5781],['Mamuda',13.3032,-16.7328],['Pirang',13.2725,-16.5353],['Salagi',13.393,-16.71],['Sintet',13.2398,-15.8129],['Somita',13.20583,-16.30556],['Sukuta',13.4148,-16.7076],['Yundum',13.3422,-16.6697],['Abuko',13.4042,-16.6558],['Bakau',13.4775,-16.6779],['Banni',13.35,-15.58],['Barra',13.4855,-16.543],['Basse',13.31,-14.215],['Bonto',13.2884,-16.5556],['Brifu',13.5073,-13.9352],['Bulok',13.1767,-16.4158],['Bwiam',13.23528,-16.08639],['Essau',13.4858,-16.5262],['Kaiaf',13.4092,-15.6082],['Kitty',13.2279,-16.668],['Koina',13.48333,-13.86667],['Lamin',13.3874,-16.6439],['Sandu',13.3833,-14.4],['Sifoe',13.18361,-16.6975],['Tanji',13.3586,-16.7975],['Wassu',13.69094,-14.87884],['Fass',13.5641,-16.4261],['Jali',13.35,-15.9667],['Kaur',13.7,-15.333],['Kotu',13.4553,-16.7034],['Njau',13.7474,-15.2109],['Sabi',13.23333,-14.2],['Soma',13.4446,-15.5355],['Wuli',13.4714,-14.0509]
];
/* nearest area name to a lat/lng, within ~12 km; else null */
function areaFromCoords(lat,lng){
  if(typeof lat!=='number'||typeof lng!=='number') return null;
  let best=null,bestD=Infinity;
  for(const a of GM_AREAS){
    const dLat=(lat-a[1]), dLng=(lng-a[2])*Math.cos(lat*Math.PI/180);
    const d=Math.sqrt(dLat*dLat+dLng*dLng)*111; // deg→km approx
    if(d<bestD){ bestD=d; best=a[0]; }
  }
  return bestD<=12 ? best : null;
}
/* area name from a typed Google Plus Code (decodes then matches nearest area) */
function areaFromPlusCode(code){
  const s=String(code||'');
  const m=s.match(/[23456789CFGHJMPQRVWX]{4,8}\+[23456789CFGHJMPQRVWX]{2,3}/i);
  if(!m) return null;
  const tok=m[0].toUpperCase();
  let ll=(tok.indexOf('+')===8)?plusCodeDecode(tok):null;
  if(!ll) ll=expandShortPlusCode(tok, s);   /* short code: expand using typed locality, else Kombo coast */
  return ll ? areaFromCoords(ll.lat,ll.lng) : null;
}
/* small copyable Google Plus Code chip (returns HTML) */
function plusCodeChip(lat,lng,locality,opts){
  opts=opts||{};
  const full=plusCode(lat,lng,10);
  const label=opts.short!==false ? plusCodeShort(lat,lng,locality) : full;
  const pinSvg='<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></svg>';
  return `<button type="button" class="pluscode-chip" data-full="${label}" title="Google Plus Code — tap to copy"
    onclick="domCopy(this.dataset.full);var o=this.querySelector('.pc-label');var t=o.textContent;o.textContent='Copied ✓';setTimeout(function(){o.textContent=t;},1200);">
    ${pinSvg}<span class="pc-key">Google Plus Code</span><span class="pc-label">${label}</span></button>`;
}

/* Robust clipboard copy — works in secure contexts AND sandboxed/non-secure
   iframes where navigator.clipboard is undefined or blocked. */
function domCopy(text){
  text = String(text==null ? '' : text);
  // Try the async Clipboard API first
  if(navigator.clipboard && navigator.clipboard.writeText){
    try{
      navigator.clipboard.writeText(text).catch(function(){ _domCopyFallback(text); });
      return true;
    }catch(e){ /* fall through */ }
  }
  return _domCopyFallback(text);
}
function _domCopyFallback(text){
  try{
    var ta=document.createElement('textarea');
    ta.value=text;
    ta.setAttribute('readonly','');
    ta.style.position='fixed';
    ta.style.top='0'; ta.style.left='0';
    ta.style.width='1px'; ta.style.height='1px';
    ta.style.padding='0'; ta.style.border='none'; ta.style.outline='none';
    ta.style.boxShadow='none'; ta.style.background='transparent';
    ta.style.opacity='0';
    document.body.appendChild(ta);
    ta.focus();
    ta.select();
    ta.setSelectionRange(0, text.length);
    var ok=document.execCommand('copy');
    document.body.removeChild(ta);
    return ok;
  }catch(e){ return false; }
}

/* ---------- Favorites (localStorage) ---------- */
function getFavs(){ try{ return JSON.parse(localStorage.getItem('mykunda_favs')||'[]'); }catch(e){ return []; } }
function isFav(id){ return getFavs().includes(id); }
function toggleFav(id){
  let f = getFavs();
  f = f.includes(id) ? f.filter(x=>x!==id) : [...f, id];
  localStorage.setItem('mykunda_favs', JSON.stringify(f));
  return f.includes(id);
}

/* ---------- User listings (published via the wizard) ----------
   Real Gambia lat/lng per area (used by the listing wizard map).
   GEGENEREERD uit gambia-places.js (plaatscontrole 30-08-2026, incl. verwerkte
   eigenaarslijst): zelfde waarden als GAMBIA_PLACES en GM_AREAS; langste naam
   eerst. Niet met de hand bijwerken. */
const AREA_COORDS = {
'Cape Point, Bakau':[13.4849,-16.6661],'Medina Serigne Mass':[13.4913,-16.4105],'Bakindick Mandinka':[13.4554,-16.4514],'Medina Serign Mass':[13.4913,-16.4105],'Tallinding Kunjang':[13.4259,-16.6722],'Berending (Kombo)':[13.1402,-16.743],'Berending (Niumi)':[13.4909,-16.4613],'Boro Dampha Kunda':[13.53,-14.7],'Boro Kanda Kassy':[13.4227,-14.0286],'Brikama Ba (CRR)':[13.5376,-14.9275],'Konti Kunda Niji':[13.56667,-15.78333],'Basse Mansajang':[13.2959,-14.2095],'Churchills Town':[13.4412,-16.6839],'Basse Santa Su':[13.31,-14.215],'Boro Modi Bane':[13.439,-14.0311],'Brufut Heights':[13.4,-16.759],'Bantango Koto':[13.55,-14.72],'Sabach Sanjal':[13.5968,-15.444],'Sinchu Alagie':[13.37808,-16.68374],'Sinchu Baliya':[13.3966,-16.6744],'Banjul Nding':[13.37333,-16.65722],'Banjulunding':[13.3765,-16.6531],'Barrow Kunda':[13.4882,-14.1173],'Busura Alieu':[13.3,-14.52],'Faraba Banta':[13.2667,-16.5167],'Konteh Kunda':[13.5663,-15.7929],'Manjai Kunda':[13.4422,-16.6981],'New Jeshwang':[13.4429,-16.6706],'Niani Sukuta':[13.617,-14.9231],'Old Jeshwang':[13.4533,-16.6612],'Barry Nabeh':[13.23,-16.45],'Besang Dugu':[13.52,-14.71],'Bessi Nding':[13.3,-16.5833],'Bohum Kunda':[13.5556,-13.9506],'Demba Kunda':[13.25,-14.2667],'Dippa Kunda':[13.4383,-16.6884],'Faraba Sutu':[13.2044,-16.4824],'Giboro Koto':[13.1761,-16.5752],'Jambanjelly':[13.2806,-16.7276],'Janjanbureh':[13.5391,-14.7612],'Kerr Serign':[13.4325,-16.7203],'Latri Kunda':[13.4113,-16.674],'Mansa Konko':[13.4585,-15.534],'Njaba Kunda':[13.5547,-15.9131],'Pakalinding':[13.4634,-15.5517],'Baja Kunda':[13.46667,-14.05],'Bantunding':[13.4755,-14.0852],'Baro Kunda':[13.48333,-15.26667],'Brikama Ba':[13.5376,-14.9275],'Cape Point':[13.4849,-16.6661],'Faji Kunda':[13.41778,-16.66667],'Gambissara':[13.2383,-14.3108],'Ghana Town':[13.38444,-16.77111],'Jumangsarr':[13.5455,-15.7522],'Mandina Ba':[13.2804,-16.5899],'Nema Kunku':[13.40461,-16.68401],'Njau (CRR)':[13.7474,-15.2109],'Old Yundum':[13.3625,-16.68611],'Senegambia':[13.4431,-16.7198],'Serrekunda':[13.4388,-16.6748],'Wellingara':[13.404,-16.674],'Allunhari':[13.3167,-14.25],'Bakindick':[13.4554,-16.4514],'Banyakang':[13.54,-14.65],'Barajally':[13.5852,-14.9461],'Batokunku':[13.3268,-16.7991],'Brikamaba':[13.5376,-14.9275],'Busumbala':[13.3334,-16.6667],'Darsilami':[13.1769,-16.6567],'Ebou Town':[13.4366,-16.668],'Farafenni':[13.5721,-15.598],'Jiffarong':[13.3008,-15.868],'Karantaba':[13.43333,-15.51667],'Mandinaba':[13.2804,-16.5899],'Marakissa':[13.2126,-16.6483],'Serekunda':[13.4388,-16.6748],'Talinding':[13.42558,-16.67261],'Bakadaji':[13.3,-14.38333],'Dankunku':[13.5693,-15.3252],'Ebo Town':[13.4366,-16.668],'Illiassa':[13.5644,-15.7493],'Jappineh':[13.423,-15.4212],'Juffureh':[13.33861,-16.3825],'Kabafita':[13.275,-16.663],'Kanifing':[13.4538,-16.6748],'Katchang':[13.5,-15.75],'Kembujeh':[13.2844,-16.6055],'Kwinella':[13.4,-15.8],'No Kunda':[13.56667,-15.83333],'Pipeline':[13.463,-16.6841],'Selikene':[13.48333,-15.96667],'Sutukoba':[13.4977,-14.0162],'Tabokoto':[13.4066,-16.6658],'Tujereng':[13.3179,-16.7889],'Albreda':[13.3345,-16.386],'Badarri':[13.3414,-14.0956],'Bakoteh':[13.4334,-16.6985],'Bambali':[13.4765,-15.3349],'Bansang':[13.4358,-14.6588],'Berefet':[13.2439,-16.3799],'Bintang':[13.2508,-16.212],'Bondali':[13.2347,-15.9142],'Brikama':[13.2744,-16.6454],'Brusubi':[13.4073,-16.7306],'Bundung':[13.4251,-16.6774],'Diabugu':[13.3833,-14.4],'Folonko':[13.0908,-16.7617],'Garowol':[13.41667,-13.95],'Genieri':[13.4142,-15.6181],'Japineh':[13.423,-15.4212],'Jattaba':[13.2744,-15.827],'Kanilai':[13.1699,-16.0097],'Kansala':[13.2412,-16.1215],'Kantora':[13.3992,-13.891],'Kartong':[13.0913,-16.7597],'Kerewan':[13.4936,-16.0891],'Kuntair':[13.5344,-16.2224],'Kuntaur':[13.6709,-14.8898],'Kunting':[13.5275,-14.6697],'Latriya':[13.3,-16.711],'Madiana':[13.3533,-16.7631],'Nianija':[13.7833,-14.9333],'Numuyel':[13.2759,-14.2946],'Nyambai':[13.2794,-16.6541],'Sambang':[13.5412,-15.3311],'Sambuya':[13.2092,-16.7575],'Sankuia':[13.46667,-15.51667],'Sanyang':[13.2676,-16.7584],'Sibanor':[13.2059,-16.1935],'Sotokoi':[13.2262,-16.5033],'Sudowol':[13.36667,-13.96667],'Tunjina':[13.2833,-16.5667],'Banjul':[13.4554,-16.5757],'Bijilo':[13.4219,-16.7328],'Brufut':[13.3813,-16.7517],'Bureng':[13.41667,-15.28333],'Chamoi':[13.3189,-14.1657],'Fajara':[13.469,-16.6914],'Farato':[13.3152,-16.6632],'Fatoto':[13.3992,-13.891],'Gunjur':[13.176,-16.7599],'Jabang':[13.3619,-16.7023],'Jajari':[13.5762,-15.746],'Jambur':[13.3146,-16.7008],'Jareng':[13.6223,-15.1911],'Kafuta':[13.2014,-16.466],'Kalagi':[13.2466,-15.8379],'Keneba':[13.32889,-16.015],'Kololi':[13.4404,-16.7156],'Kudang':[13.6621,-15.0602],'Kulari':[13.4,-14.08333],'Kuloro':[13.2806,-16.5781],'Mamuda':[13.3032,-16.7328],'Pirang':[13.2725,-16.5353],'Salagi':[13.393,-16.71],'Sintet':[13.2398,-15.8129],'Somita':[13.20583,-16.30556],'Sukuta':[13.4148,-16.7076],'Yundum':[13.3422,-16.6697],'Abuko':[13.4042,-16.6558],'Bakau':[13.4775,-16.6779],'Banni':[13.35,-15.58],'Barra':[13.4855,-16.543],'Basse':[13.31,-14.215],'Bonto':[13.2884,-16.5556],'Brifu':[13.5073,-13.9352],'Bulok':[13.1767,-16.4158],'Bwiam':[13.23528,-16.08639],'Essau':[13.4858,-16.5262],'Kaiaf':[13.4092,-15.6082],'Kitty':[13.2279,-16.668],'Koina':[13.48333,-13.86667],'Lamin':[13.3874,-16.6439],'Sandu':[13.3833,-14.4],'Sifoe':[13.18361,-16.6975],'Tanji':[13.3586,-16.7975],'Wassu':[13.69094,-14.87884],'Fass':[13.5641,-16.4261],'Jali':[13.35,-15.9667],'Kaur':[13.7,-15.333],'Kotu':[13.4553,-16.7034],'Njau':[13.7474,-15.2109],'Sabi':[13.23333,-14.2],'Soma':[13.4446,-15.5355],'Wuli':[13.4714,-14.0509]
};
function getUserListings(){ try{ return JSON.parse(localStorage.getItem('mykunda_listings')||'[]'); }catch(e){ return []; } }
function saveUserListing(obj){
  const all = getUserListings();
  all.unshift(obj);
  localStorage.setItem('mykunda_listings', JSON.stringify(all));
  return obj;
}
function getDbCache(){ if(window.__dbListings) return window.__dbListings; try{ return JSON.parse(sessionStorage.getItem('mykunda_db_cache')||'[]'); }catch(e){ return []; } }
/* Only real listings: the database cache plus anything this visitor published locally. */
function allListings(){
  return [...getDbCache(), ...getUserListings()];
}
function isDemoMode(){ return false; }

/* ---------- Session / auth (prototype) ---------- */
function getUser(){ try{ return JSON.parse(localStorage.getItem('mykunda_user')||'null'); }catch(e){ return null; } }
function setUser(u){ localStorage.setItem('mykunda_user', JSON.stringify(u)); }
function clearUser(){ localStorage.removeItem('mykunda_user'); localStorage.removeItem('mykunda_admin'); }
/* signOut lives in supabase.js (handles Supabase session + localStorage cleanup).
   Fallback for when supabase.js isn't loaded: */
if(typeof signOut==='undefined'){ function signOut(){ clearUser(); } }
function initials(name){ return (name||'?').trim().split(/\s+/).map(w=>w[0]).slice(0,2).join('').toUpperCase(); }
function requireAuth(returnTo){
  if(!getUser()){ location.href='auth.html?next='+encodeURIComponent(returnTo||(location.pathname.split('/').pop()+location.search)); return false; }
  return true;
}

/* ---------- Guides / content hub (metadata; full bodies live in guide.html) ---------- */
const GUIDES = [
  { slug:'buying-property-in-the-gambia-as-a-foreigner', cat:'Buying', mins:9, date:'2026-08-15',
    title:'Buying property in The Gambia as a foreigner', img:'images/home-hero-mobile.webp',
    excerpt:'Can non-residents own property in The Gambia? A clear, step-by-step guide to buying as an expat or diaspora investor — from title checks to transfer.' },
  { slug:'freehold-leasehold-customary-land-explained', cat:'Land & title', mins:8, date:'2026-08-15',
    title:'Freehold, leasehold & customary land explained', img:'images/sanyang.webp',
    excerpt:'The single most important thing to understand before you buy land in The Gambia: what kind of title you are actually getting, and why it matters.' },
  { slug:'cost-of-buying-property-in-the-gambia', cat:'Buying', mins:8, date:'2026-08-15',
    title:'The real cost of buying property in The Gambia', img:'images/kololi.webp',
    excerpt:'Beyond the asking price: transfer fees, legal costs, agent fees and the taxes to budget for when you buy a home or plot on the coast.' },
  { slug:'best-areas-to-buy-on-the-gambian-coast', cat:'Areas', mins:9, date:'2026-08-15',
    title:'The best areas to buy on the Gambian coast', img:'images/capepoint.webp',
    excerpt:'Kololi, Cape Point, Brufut, Bijilo, Sanyang and Kartong compared — prices, vibe and who each area suits, from holiday lets to family homes.' },
  { slug:'bank-mortgages-in-the-gambia', cat:'Buying', mins:7, date:'2026-08-15',
    title:'Bank mortgages in The Gambia — rates, conditions and eligibility', img:'images/banjul.webp',
    excerpt:'Can you get a bank mortgage in The Gambia? A frank look at local housing finance, sky-high interest rates and why it almost never works for foreign buyers.' },
  { slug:'developer-financing-in-the-gambia', cat:'Buying', mins:8, date:'2026-08-15',
    title:'Developer financing in The Gambia — the smart alternative to a mortgage', img:'images/fajara.webp',
    excerpt:'How instalment plans from Gambian developers work, what to expect from TAF Africa Global, Blue Ocean and others, and how to protect yourself.' },
  { slug:'how-to-verify-land-title-in-the-gambia', cat:'Land & title', mins:12, date:'2026-08-15',
    title:'Land in The Gambia: prices, sizes and how to verify title safely', img:'images/brikama.webp',
    excerpt:'What bare land costs by area, what those square metres look like on the ground, and the documents, checks and red flags that establish who actually owns a plot before you pay.' },
  { slug:'building-a-house-in-the-gambia', cat:'Building', mins:11, date:'2026-08-15',
    title:'Building your own house in The Gambia', img:'images/gambia-street-aerial.webp',
    excerpt:'Permits, material prices, cost per square metre and how to control a build from 4,000 km away — the practical guide to building on your own plot.' },
  { slug:'renting-out-property-in-the-gambia', cat:'Renting out', mins:10, date:'2026-08-15',
    title:'Renting out property in The Gambia — season, yields and tax', img:'images/senegambia.webp',
    excerpt:'Occupancy swings from 90% in winter to 25% in summer. What that does to your yield, what tax you owe on gross rent, and how to run a let from abroad.' },
  { slug:'sending-money-to-the-gambia', cat:'Money', mins:8, date:'2026-08-15',
    title:'Sending money to The Gambia — what it really costs', img:'images/serrekunda.webp',
    excerpt:'The fee is not the cost. World Bank corridor data shows the exchange-rate margin doing the damage — and what that means on a purchase-sized transfer.' },
  { slug:'residency-and-retiring-in-the-gambia', cat:'Living there', mins:9, date:'2026-08-15',
    title:'Residency, permits and retiring in The Gambia', img:'images/kotu.webp',
    excerpt:'Buying a house gives you no right to live in it. The permits, the published fees, the annual renewal and what retiring on the coast actually involves.' },
  { slug:'inheritance-and-wills-for-gambian-property', cat:'Land & title', mins:10, date:'2026-08-15',
    title:'Inheritance and wills for Gambian property', img:'images/river-gambia.webp',
    excerpt:'Statutory, Sharia or customary — which law governs your house, why estates freeze without a grant of probate, and the checklist that protects your family.' },
  { slug:'estate-agent-regulation-in-the-gambia', cat:'Land & title', mins:9, date:'2026-08-25',
    title:'Are estate agents regulated in The Gambia?', img:'images/banjul.webp',
    excerpt:'No licence, no register, no regulator — anyone can trade as an estate agent today. What the draft Real Estate Agents Bill would change, how far it has actually got, and what it means for a buyer right now.' },
];

/* ---------- User-fillable image (drop real Gambia photos over the fallback) ---------- */
function slotImg(id, src, ph, extra){
  return `<image-slot id="${id}" src="${src}" placeholder="${ph}" radius="0" style="position:absolute;inset:0;width:100%;height:100%;display:block" ${extra||''}></image-slot>`;
}

/* ---------- Card spec renderer (land-aware) ---------- */
function specsHTML(p){
  if(p.cat==='land'){
    return `<span class="card-spec">${ICON.area} ${p.plot.toLocaleString()} m² plot</span>
        <span class="card-spec spec-tag">${p.tag}</span>`;
  }
  return `<span class="card-spec">${ICON.bed} ${p.beds}</span>
        <span class="card-spec">${ICON.bath} ${p.baths}</span>
        <span class="card-spec">${ICON.area} ${p.sqm} m²</span>
        <span class="card-spec spec-tag spec-tag-green">${p.tag}</span>`;
}

/* small grid icon for inline Google Plus Code on cards */
const PLUS_GRID_ICON='<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round" style="flex:none"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></svg>';

/* ---------- Card renderer ---------- */
function cardHTML(p){
  const badges = [];
  if(p.isNew) badges.push('<span class="badge badge-new">New</span>');
  if(p.verified) badges.push('<span class="badge badge-verified"><svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><path d="M12 1l3.09 4.26L20 6.27l-2.18 4.35L19.36 16 12 18.27 4.64 16l1.54-5.38L4 6.27l4.91-1.01L12 1z"/><path d="M9.5 11.5l2 2 3.5-4" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg> Verified</span>');
  if(p.cat==='land') badges.push('<span class="badge badge-rent">Land</span>');
  else badges.push(p.type==='sale' ? '<span class="badge badge-sale">For sale</span>' : '<span class="badge badge-rent">For rent</span>');
  return `
  <a class="card" href="property.html?id=${p.id}" data-id="${p.id}">
    <div class="card-media">
      ${slotImg('ph-'+p.id, p.img, 'Drop a real photo of '+p.title+', '+(p.area.split('· ')[0].trim()))}
      <div class="badges">${badges.join('')}</div>
      <button class="fav ${isFav(p.id)?'on':''}" aria-label="Save" onclick="event.preventDefault();event.stopPropagation();const on=toggleFav('${p.id}');this.classList.toggle('on',on);this.innerHTML=on?ICON.heartFill:ICON.heart;">${isFav(p.id)?ICON.heartFill:ICON.heart}</button>
      <div class="count">${ICON.camera} ${p.photos}</div>
    </div>
    <div class="card-body">
      <div class="card-price">${fmtPrice(p.price, p.type)}</div>
      <div class="card-title">${p.title}</div>
      <div class="card-addr">${ICON.pin} ${p.street} · ${p.area.split('· ')[1]||p.area}</div>
      ${typeof p.lat==='number' ? `<div class="card-plus">${PLUS_GRID_ICON} ${plusCodeShort(p.lat,p.lng)}</div>` : ''}
      <div class="card-specs">
        ${specsHTML(p)}
      </div>
    </div>
  </a>`;
}


/* ---------- Payment methods (single source of truth) ---------- */
const PAY_METHODS = [
  ['wave','Wave','Mobile money','#1DC8FF','<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2.6" stroke-linecap="round"><path d="M3 12c2-4.5 5-4.5 6 0s4 4.5 6 0 4-4.5 6 0"/></svg>'],
  ['afrimoney','Afrimoney','Africell','#5B2D8E','A'],
  ['qmoney','QMoney','QCell','#E2231A','Q'],
  ['aps','APS Wallet','Agents &amp; upcountry','#0E7A4F','APS'],
  ['visa','Visa','Debit &amp; credit','#1A1F71','VISA'],
  ['mastercard','Mastercard','Debit &amp; credit','#16214C','<svg width="26" height="16" viewBox="0 0 34 20"><circle cx="13" cy="10" r="9" fill="#EB001B"/><circle cx="21" cy="10" r="9" fill="#F79E1B" fill-opacity=".85"/></svg>'],
  ['bank','Bank transfer','Any Gambian bank','#3A5247','<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 21h18M3 10h18M12 3l9 7H3z"/><path d="M6 10v8M10 10v8M14 10v8M18 10v8"/></svg>']
];
function payChipsHTML(keys){
  const list = keys && keys.length ? PAY_METHODS.filter(m=>keys.indexOf(m[0])>-1) : PAY_METHODS;
  return `<div class="pay-strip">${list.map(m=>`<span class="pay-chip"><i style="background:${m[3]}">${m[4]}</i>${m[1]}<small>${m[2]}</small></span>`).join('')}</div>`;
}
function payFooterHTML(){
  return `<div class="fb-pay"><div class="wrap fb-pay-in">
      <div class="fp-label">Ways to pay on MyKunda</div>
        ${payChipsHTML()}
        <p class="fp-note"><b>Pay by mobile money or card, or by bank transfer.</b> Online payments are processed by Waychit, a licensed Gambian payment provider. MyKunda never sees your card or wallet details.</p>
        <p class="fp-note">Bank transfers clear once the banks release them. MyKunda only collects listing and service fees — <b>we never take deposits, down payments or purchase money</b>. Those are always paid into the escrow account of your lawyer or notary.</p>
        <p class="fp-note">Currency conversions are indicative only, based on approximate exchange rates. No rights can be derived from displayed amounts in any currency.</p>
    </div></div>`;
}

/* ---------- Social ---------- */
const _IG_ICON='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="3" y="3" width="18" height="18" rx="5"/><circle cx="12" cy="12" r="4"/><circle cx="17.2" cy="6.8" r="1.1" fill="currentColor" stroke="none"/></svg>';
const _TH_ICON='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M16.2 11.4c-.3-2-1.7-3-3.9-3-1.8 0-3.1.7-3.7 2"/><path d="M15.9 15.2c0-2-1.6-3-3.6-2.8-1.6.1-2.6.9-2.5 2 .1 1.2 1.3 1.7 2.4 1.6 2-.2 3.2-1.6 3.4-4.2"/><path d="M12 21.5c-5.2 0-8.5-3.4-8.5-9.5S6.8 2.5 12 2.5s8.5 3.4 8.5 9.5-3.3 9.5-8.5 9.5Z"/></svg>';
const _FB_ICON='<svg viewBox="0 0 24 24" fill="currentColor"><path d="M13.5 21v-8h2.7l.4-3.1h-3.1V7.9c0-.9.25-1.5 1.55-1.5H16.7V3.6a22 22 0 0 0-2.4-.12c-2.4 0-4 1.46-4 4.14V9.9H7.6V13h2.7v8Z"/></svg>';
const _LI_ICON='<svg viewBox="0 0 24 24" fill="currentColor"><path d="M6.94 8.5H3.56V20.5H6.94V8.5Z"/><path d="M5.25 7.03C4.15 7.03 3.25 6.12 3.25 5.02C3.25 3.91 4.15 3 5.25 3C6.36 3 7.25 3.91 7.25 5.02C7.25 6.12 6.36 7.03 5.25 7.03Z"/><path d="M20.75 20.5H17.38V14.6C17.38 13.14 17.35 11.27 15.35 11.27C13.32 11.27 13.01 12.85 13.01 14.5V20.5H9.63V8.5H12.87V10.02H12.92C13.37 9.17 14.46 8.28 16.08 8.28C19.5 8.28 20.75 10.55 20.75 13.87V20.5Z"/></svg>';
function socialLinks(){return [
  ['Facebook','https://www.facebook.com/mykundagambia',_FB_ICON,'#1877F2'],
  ['Instagram','https://www.instagram.com/mykundagambia/',_IG_ICON,'#E1306C'],
  ['Threads','https://www.threads.com/@mykundagambia',_TH_ICON,'#111111'],
  ['LinkedIn','https://www.linkedin.com/company/mykunda',_LI_ICON,'#0A66C2'],
  ['WhatsApp',waLink('Hello MyKunda! I have a question about property in The Gambia.'),_WA_ICON,'#25D366'],
];}

/* ---------- Areas (shared: header nav + the buy/rent search finder) ---------- */
const MK_AREAS = [
  ['Greater Banjul',[['Banjul','banjul.html'],['Bakau','bakau.html'],['Cape Point','cape-point.html'],['Fajara','fajara.html'],['Kotu','kotu.html'],['Pipeline','pipeline.html'],['Bakoteh','bakoteh.html'],['Manjai Kunda','manjai-kunda.html'],['Serrekunda','serrekunda.html']]],
  ['Kombo Coast',[['Kololi','kololi.html'],['Senegambia','senegambia.html'],['Bijilo','bijilo.html'],['Brufut','brufut.html'],['Tanji','tanji.html'],['Batokunku','batokunku.html'],['Tujereng','tujereng.html'],['Sanyang','sanyang.html'],['Gunjur','gunjur.html'],['Kartong','kartong.html']]],
  ['Kombo Inland',[['Brusubi','brusubi.html'],['Kerr Serign','kerr-serign.html'],['Sukuta','sukuta.html'],['Salagi','salagi.html'],['Jabang','jabang.html'],['Nema Kunku','nema-kunku.html'],['Sinchu Alagie','sinchu-alagie.html'],['Lamin','lamin.html'],['Yundum','yundum.html'],['Busumbala','busumbala.html'],['Farato','farato.html'],['Brikama','brikama.html'],['Latriya','latriya.html'],['Mamuda','mamuda.html'],['Jambanjelly','jambanjelly.html']]],
  ['North Bank',[['Barra','barra.html'],['Essau','essau.html'],['Kerewan','kerewan.html'],['Farafenni','farafenni.html']]],
  ['Lower River',[['Soma','soma.html'],['Mansa Konko','mansa-konko.html']]],
  ['Central River',[['Janjanbureh','janjanbureh.html'],['Bansang','bansang.html'],['Kuntaur','kuntaur.html']]],
  ['Upper River',[['Basse Santa Su','basse.html'],['Gambissara','gambissara.html'],['Fatoto','fatoto.html']]]
];
if(typeof window!=='undefined') window.MK_AREAS = MK_AREAS;

/* Gidsen per onderwerp, in dezelfde vorm als MK_AREAS: [groep, [[naam, href], ...]].
   Afgeleid van GUIDES hierboven, dus een nieuwe gids verschijnt vanzelf in het menu. */
const MK_GUIDE_GROUPS = (function(){
  const cats = [];
  GUIDES.forEach(g => { if(cats.indexOf(g.cat) < 0) cats.push(g.cat); });
  return cats.map(c => [c, GUIDES.filter(g => g.cat === c).map(g => [g.title, 'guide-' + g.slug + '.html'])]);
})();

/* Het Areas- en het Guides-menu delen paneel, zoekveld en gedrag (initAreaMenu).
   data-menu op het paneel of het mobiele scherm kiest de bron; zonder attribuut: areas. */
const MK_MENUS = {
  areas:  { groups: MK_AREAS,        title: 'Areas',  single: 'area',  plural: 'areas'  },
  guides: { groups: MK_GUIDE_GROUPS, title: 'Guides', single: 'guide', plural: 'guides' }
};

/* ---------- Shared filter vocabularies (buy/rent search finder + search.html) ---------- */
const MK_CATEGORIES = [
  ['Homes',[['House or villa','house,villa'],['Apartment','apartment'],['Penthouse','penthouse'],['Townhouse','townhouse'],['Compound','compound'],['Lodge','lodge']]],
  ['Other',[['Commercial','commercial'],['Land / plot','land']]]
];
const MK_DOC_TYPES = [
  ['freehold','Freehold (with title deed)'],
  ['leasehold','Leasehold'],
  ['customary','Customary / family land'],
  ['sporting','Sporting lease']
];
const MK_COND = [['new','New build'],['good','Good'],['renovation','Needs renovation']];
const MK_BEACH = [['beachfront','Beachfront · 150 m'],['walking','Walking · 1.2 km'],['near','Within 5 km'],['inland','Inland · 5 km+']];
const MK_FURN = [['furnished','Furnished'],['semi','Part-furnished'],['unfurnished','Unfurnished']];
const MK_SERV_BUILT = [['nawec_water','Mains (NAWEC) water'],['backup_power','Backup power (solar/generator)']];
const MK_SERV_LAND = [['plot_power','Electricity on plot'],['plot_water','Water on plot'],['tarmac','Tarmac road access'],['fenced','Fenced or walled'],['lowflood','Low flood risk']];
const MK_FEAT_SALE = [['pool','Private pool'],['Sea view','Sea view'],['Beachfront','Beachfront'],['Gated','Gated / walled'],['Furnished','Furnished'],['new','Newly listed']];
const MK_FEAT_RENT = [['pool','Private pool'],['Sea view','Sea view'],['Gated','Gated / secured'],['new','Newly listed']];
const MK_FEAT_LAND = [['Sea view','Sea view'],['Beachfront','Beachfront'],['new','Newly listed']];

/* ---------- Header / footer injectors ---------- */
function headerHTML(active, onHero){
  const links = [['Buy','buy.html'],['Rent','rent.html'],['List','sell.html'],['Land','land-for-sale-in-the-gambia.html'],['Verify','verify.html'],['Areas','#'],['Guides','guides.html']];
  const AREA_REGIONS = MK_AREAS;
  const AREAS = AREA_REGIONS.flatMap(r=>r[1]);
  const u = getUser();
  const ccy = getCurrency();
  const ccyPicker = `<div class="ccy-picker" id="ccyPicker">
      <button class="ccy-btn" id="ccyBtn" aria-label="Currency">${CURRENCIES[ccy].symbol} ${ccy}<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="m6 9 6 6 6-6"/></svg></button>
      <div class="ccy-menu" id="ccyMenu">${Object.keys(CURRENCIES).map(k=>{
        var label = '<b>'+CURRENCIES[k].symbol+' '+k+'</b> <span>'+CURRENCIES[k].name+'</span>';
        if(k!=='GMD'){
          var gmdRate = CURRENCIES[k].gmdPer;   /* dalasi per 1 eenheid, rechtstreeks */
          label += ' <span data-ccy-cross="'+k+'" style="opacity:.55;font-size:11px;white-space:nowrap">= D'+gmdRate.toLocaleString('en-US',{minimumFractionDigits:1,maximumFractionDigits:1})+'</span>';
        }
        return '<button data-ccy="'+k+'" class="'+(k===ccy?'on':'')+'">'+label+'</button>';
      }).join('')}
      <div style="padding:6px 14px 10px;font-size:10.5px;color:var(--muted);line-height:1.4;border-top:1px solid var(--line)"><span data-rate-note>Indicative rate.</span><br>Conversions are indicative only. No rights can be derived from displayed amounts.</div>
      </div>
    </div>`;
  const msgBadge = `<a class="icon-btn msg-badge-wrap" href="messages.html" aria-label="Messages" style="position:relative"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg><span class="msg-badge" id="msgBadge" style="display:none;position:absolute;top:-2px;right:-2px;min-width:18px;height:18px;border-radius:50%;background:var(--amber-500);color:#fff;font-size:10px;font-weight:700;align-items:center;justify-content:center;padding:0 4px"></span></a>`;
  const adminGear = `<a class="icon-btn" href="admin.html" aria-label="Admin"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg></a>`;
  const hdrSearchBtn = `<button class="icon-btn" id="hdrSearchBtn" aria-label="Search properties">${ICON.search}</button>`;
  const actions = u
    ? `${hdrSearchBtn}${ccyPicker}<div class="ha-account">${msgBadge}<a class="user-chip" href="dashboard.html" title="${u.name}"><span class="user-av">${initials(u.name)}</span> <span class="user-name">${u.name.split(' ')[0]}</span></a>${isLocalAdmin()?adminGear:''}</div><a class="btn btn-primary btn-sm" href="list.html">Add your property</a>`
    : `${hdrSearchBtn}${ccyPicker}<a class="signin" href="auth.html">Sign in</a><a class="btn btn-primary btn-sm" href="list.html">Add your property</a>`;
  return `
  <header class="site-header ${onHero?'on-hero':''}" id="siteHeader">
    <div class="wrap header-inner">
      <a class="logo" href="/">${LOGO_MARK} MyKunda</a>
      <nav class="nav">
        ${links.map(l=>{
          if(l[0]==='Areas'){
            /* Areas: regio kiezen, dan plaatsen. Zie initAreaMenu(). */
            return `<div class="nav-dd nav-dd-areas"><button class="nav-dd-btn" aria-haspopup="true" ${active==='Areas'?'style="color:var(--green-700)"':''}>Areas <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="m6 9 6 6 6-6"/></svg></button><div class="mkam" data-menu="areas"><div class="mkam-search"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.2-3.2"/></svg><input type="text" class="mkam-input" autocomplete="off" spellcheck="false" placeholder="Find an area \u2014 Kololi, Brufut, Basse\u2026" aria-label="Find an area"></div><div class="mkam-body"><div class="mkam-rail" role="tablist" aria-label="Regions">${AREA_REGIONS.map((r,i)=>`<button type="button" role="tab" class="mkam-rbtn" data-reg="${i}" aria-selected="${i===0?'true':'false'}">${r[0]}<span class="mkam-n">${r[1].length}</span></button>`).join('')}</div><div class="mkam-panes">${AREA_REGIONS.map((r,i)=>`<div class="mkam-pane${i===0?' on':''}" data-reg="${i}"><div class="mkam-ph">${r[0]}<span>${r[1].length} areas</span></div><div class="mkam-list">${r[1].map(a=>`<a href="${a[1]}">${a[0]}</a>`).join('')}</div></div>`).join('')}<div class="mkam-pane mkam-res"></div></div></div><div class="mkam-foot"><a href="areas-in-the-gambia.html">All ${AREAS.length} areas, compared &rarr;</a></div></div></div>`;
          }
          if(l[0]==='Guides'){
            /* Guides: onderwerp kiezen, dan gidsen. Zelfde paneel en gedrag als Areas
               (de klasse nav-dd-areas draagt het gedeelde paneelgedrag). Zie initAreaMenu(). */
            return `<div class="nav-dd nav-dd-areas"><button class="nav-dd-btn" aria-haspopup="true" ${active==='Guides'?'style="color:var(--green-700)"':''}>Guides <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="m6 9 6 6 6-6"/></svg></button><div class="mkam mkam-guides" data-menu="guides"><div class="mkam-search"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.2-3.2"/></svg><input type="text" class="mkam-input" autocomplete="off" spellcheck="false" placeholder="Find a guide — buying, land, money…" aria-label="Find a guide"></div><div class="mkam-body"><div class="mkam-rail" role="tablist" aria-label="Topics">${MK_GUIDE_GROUPS.map((r,i)=>`<button type="button" role="tab" class="mkam-rbtn" data-reg="${i}" aria-selected="${i===0?'true':'false'}">${r[0]}<span class="mkam-n">${r[1].length}</span></button>`).join('')}</div><div class="mkam-panes">${MK_GUIDE_GROUPS.map((r,i)=>`<div class="mkam-pane${i===0?' on':''}" data-reg="${i}"><div class="mkam-ph">${r[0]}<span>${r[1].length} guide${r[1].length===1?'':'s'}</span></div><div class="mkam-list">${r[1].map(a=>`<a href="${a[1]}">${a[0]}</a>`).join('')}</div></div>`).join('')}<div class="mkam-pane mkam-res"></div></div></div><div class="mkam-foot"><a href="guides.html">All ${GUIDES.length} guides &rarr;</a></div></div></div>`;
          }
          if(l[0]==='Verify'){
            return `<a href="${l[1]}" style="display:inline-flex;align-items:center;gap:6px${active==='Verify'?';color:var(--green-700)':''}"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round" style="flex:none"><path d="M12 3 4 6v6c0 5 3.4 7.8 8 9 4.6-1.2 8-4 8-9V6z"/><path d="m9 12 2 2 4-4"/></svg>Verify</a>`;
          }
          return `<a href="${l[1]}" ${active===l[0]?'style="color:var(--green-700)"':''}>${l[0]}</a>`;
        }).join('')}
      </nav>
      <div class="header-actions">
        ${actions}
      </div>
      <button class="nav-toggle" id="navToggle" aria-label="Open menu" aria-expanded="false">
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.1" stroke-linecap="round"><path d="M4 7h16M4 12h16M4 17h16"/></svg>
      </button>
    </div>
  </header>
  <div class="hdr-search" id="hdrSearch" hidden>
    <div class="wrap hdr-search-inner">
      <span class="hdr-s-ic">${ICON.search}</span>
      <input type="text" id="hdrSearchInput" aria-label="Search properties" placeholder="Search by area or town — Kololi, Brufut, Cape Point…">
      <button class="btn btn-primary btn-sm" id="hdrSearchGo">Search</button>
      <button class="hdr-search-x" id="hdrSearchX" aria-label="Close search"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M6 6l12 12M18 6 6 18"/></svg></button>
    </div>
  </div>
  <div class="mobile-drawer" id="mobileDrawer" aria-hidden="true">
    <div class="md-backdrop" id="mdBackdrop"></div>
    <div class="md-panel">
      <div class="md-head">
        <a class="logo" href="/">${LOGO_MARK} MyKunda</a>
        <button class="md-close" id="mdClose" aria-label="Close menu">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M6 6l12 12M18 6 6 18"/></svg>
        </button>
      </div>
      <form class="md-search" id="mdSearchForm" role="search">
        <span class="md-search-ic">${ICON.search}</span>
        <input type="search" id="mdSearchInput" placeholder="Search area or town" aria-label="Search properties">
        <button type="submit" class="md-search-go" aria-label="Search">${ICON.arrow}</button>
      </form>
      <nav class="md-nav">
        ${links.map(l=>{
          if(l[0]==='Areas'){
            /* Areas op mobiel: doorschuiven naar .md-sub, hieronder. */
            return `<button type="button" class="md-drill ${active==='Areas'?'on':''}" data-drill="areas">Areas <span class="md-n">${AREAS.length}</span></button>`;
          }
          if(l[0]==='Guides'){
            /* Guides op mobiel: doorschuiven naar het eigen md-sub-scherm, net als Areas. */
            return `<button type="button" class="md-drill ${active==='Guides'?'on':''}" data-drill="guides">Guides <span class="md-n">${GUIDES.length}</span></button>`;
          }
          if(l[0]==='Verify'){
            return `<a href="${l[1]}" ${active==='Verify'?'class="on"':''} style="display:flex;align-items:center;gap:9px"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round" style="flex:none"><path d="M12 3 4 6v6c0 5 3.4 7.8 8 9 4.6-1.2 8-4 8-9V6z"/><path d="m9 12 2 2 4-4"/></svg>Verify a property</a>`;
          }
          return `<a href="${l[1]}" ${active===l[0]?'class="on"':''}>${l[0]}</a>`;
        }).join('')}
      </nav>
      <!-- Areas en Guides op mobiel: elk hun eigen scherm met drie niveaus. Ook hier
           staat de opmaak op lange regels; deze blokken komen letterlijk in elke pagina. -->
      <div class="md-sub" id="mdAreaSub" data-menu="areas"><div class="md-sub-head"><button type="button" class="md-sub-back"><span class="md-sub-backtxt">Menu</span></button><span class="md-sub-title">Areas</span></div><div class="md-sub-search"><svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.2-3.2"/></svg><input type="search" class="md-sub-input" placeholder="Find an area" aria-label="Find an area"></div><div class="md-sub-scroll"><div class="md-sub-regions">${AREA_REGIONS.map((r,i)=>`<button type="button" class="md-reg" data-reg="${i}">${r[0]}<span class="md-n">${r[1].length}</span></button>`).join('')}<a class="md-sub-all" href="areas-in-the-gambia.html">All ${AREAS.length} areas, compared &rarr;</a></div><div class="md-sub-results"></div>${AREA_REGIONS.map((r,i)=>`<div class="md-lvl3" data-reg="${i}">${r[1].map(a=>`<a href="${a[1]}">${a[0]}</a>`).join('')}</div>`).join('')}</div></div>
      <div class="md-sub" id="mdGuideSub" data-menu="guides"><div class="md-sub-head"><button type="button" class="md-sub-back"><span class="md-sub-backtxt">Menu</span></button><span class="md-sub-title">Guides</span></div><div class="md-sub-search"><svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.2-3.2"/></svg><input type="search" class="md-sub-input" placeholder="Find a guide" aria-label="Find a guide"></div><div class="md-sub-scroll"><div class="md-sub-regions">${MK_GUIDE_GROUPS.map((r,i)=>`<button type="button" class="md-reg" data-reg="${i}">${r[0]}<span class="md-n">${r[1].length}</span></button>`).join('')}<a class="md-sub-all" href="guides.html">All ${GUIDES.length} guides &rarr;</a></div><div class="md-sub-results"></div>${MK_GUIDE_GROUPS.map((r,i)=>`<div class="md-lvl3" data-reg="${i}">${r[1].map(a=>`<a href="${a[1]}">${a[0]}</a>`).join('')}</div>`).join('')}</div></div>
      <div class="md-actions">
        ${u
          ? `<a class="md-user" href="dashboard.html"><span class="user-av">${initials(u.name)}</span><div><b>${u.name}</b><span>My MyKunda dashboard</span></div></a>
             ${isLocalAdmin()?'<a class="btn btn-ghost btn-block" href="admin.html"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:-2px;margin-right:6px"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>Admin console</a>':''}`
          : `<a class="btn btn-ghost btn-block" href="auth.html">Sign in</a>`}
        <a class="btn btn-primary btn-block" href="list.html">Add your property</a>
      </div>
      <div class="md-ccy">
        <span class="md-ccy-label">Currency</span>
        <div class="md-ccy-row">${Object.keys(CURRENCIES).map(k=>`<button data-ccy="${k}" class="${k===ccy?'on':''}">${CURRENCIES[k].symbol} ${k}</button>`).join('')}</div>
      </div>
    </div>
  </div>`;
}

function footerHTML(){
  const cols = [
    ['Explore',['Properties for sale','Properties for rent','Land & plots','Land for sale','Area guides','New developments','Price index']],
    ['For you',['Saved searches','Favorites','Buyer\u2019s guide','Ownership check','Value my property','Diaspora & investor guide']],
    ['Company',['About MyKunda','Partner agents','FAQ','Safe & supported','Contact','Legal & policies']],
  ];
  return `
  <footer class="site-footer">
    <div class="fb-social">
      <div class="wrap fb-social-in">
        <div class="fb-social-txt">
          <div class="fs-title">Follow MyKunda</div>
          <p class="fs-sub">New listings, market updates and a look behind the scenes along the coast.</p>
        </div>
        <nav class="footer-social" aria-label="Follow MyKunda">${socialLinks().map(s=>`<a href="${s[1]}" rel="${s[0]==='WhatsApp'?'noopener':'me noopener'}" target="_blank" aria-label="${s[0]}" title="${s[0]}" style="--sc:${s[3]}">${s[2]}<span>${s[0]}</span></a>`).join('')}</nav>
      </div>
    </div>
    ${payFooterHTML()}
    <div class="fb-nav">
    <div class="wrap footer-top">
      <div class="footer-brand">
        <div class="logo">${LOGO_MARK} MyKunda</div>
        <p>A new property platform for The Gambia, built on proven professional standards and local knowledge. Buy, rent and invest along the Atlantic coast \u2014 with title checks on request, market insights and professional service.</p>
        <div class="footer-contact">
          <a href="mailto:${MYKUNDA_EMAIL}">${_MAIL_ICON}<span>${MYKUNDA_EMAIL}</span></a>
          <a href="${waLink('Hello MyKunda! I have a question about property in The Gambia.')}" target="_blank" rel="noopener">${_WA_ICON}<span>WhatsApp ${MYKUNDA_PHONE_DISPLAY}</span></a>
        </div>
      </div>
      ${cols.map(c=>`<div class="footer-col"><h3>${c[0]}</h3>${c[1].map(a=>{const map={'Partner agents':'agent.html','Area guides':'areas-in-the-gambia.html','Buyer\u2019s guide':'guide-cost-of-buying-property-in-the-gambia.html','Ownership check':'verify.html','Diaspora & investor guide':'guide-buying-property-in-the-gambia-as-a-foreigner.html','Properties for sale':'search.html?type=sale','Properties for rent':'search.html?type=rent','Land & plots':'search.html?type=sale&cat=land','Land for sale':'land-for-sale-in-the-gambia.html','New developments':'search.html?type=sale&feat=new','Price index':'gambia-property-prices.html','Value my property':'sell.html#value','Saved searches':'dashboard.html','Favorites':'dashboard.html','About MyKunda':'about.html','Contact':'contact.html','FAQ':'faq.html','Safe & supported':'safe.html','Legal & policies':'legal.html'};return `<a href="${map[a]||'#'}">${a}</a>`;}).join('')}</div>`).join('')}
    </div>
    <div class="wrap footer-bottom">
      <span>© 2026 MyKunda.com</span>
      <span class="spacer"></span>
      <a href="legal-privacy.html">Privacy</a><a href="legal-terms.html">Terms</a><a href="legal-cookies.html">Cookies</a><a href="photo-credits.html">Photo credits</a>
    </div>
    </div>
  </footer>`;
}

/* ---------- mkFinder: the buy/rent hero search bar ----------
   Renders into the page's #mkFinderMount and wires itself up. One function for
   both buy.html (mode:'sale') and rent.html (mode:'rent') — until 26-08-2026 the
   two pages carried separately hand-written copies of this bar that had already
   drifted (rent.html kept a "Rental term" filter search.html never read; the
   property-type list sent 'villa' only, so listings.category='house' could never
   be found). One function means both pages can no longer drift apart.

   What each filter maps to, and why some groups are mode/category-specific:
   list.html only ever asks a LAND listing for plot size, road, electricity,
   land_water, fencing and title_type; it only ever asks a BUILT listing (house,
   villa, apartment, ...) for water, power, security and furnished. Showing a
   "Tarmac road access" checkbox while browsing apartments would filter on a
   column no apartment ever has — so the More filters panel changes shape with
   the category selection instead of listing every column on every page. */
function mkFinder(mountId, mode){
  const mount = document.getElementById(mountId);
  if(!mount) return;
  const isRent = mode==='rent';

  const S = { q:'', cats:[], pmin:'', pmax:'', beds:0, baths:0, sqm:'', plot:'', plotmax:'',
    cond:'', year:'', beach:'', titles:[], verified:false, serv:[], feats:[], furn:'', from:'' };

  function esc(s){ return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').split('"').join('&quot;'); }
  function isLand(){ return S.cats.length>0 && S.cats.every(c=>c==='land'); }
  function tick(){ return '<svg class="mkf-tick" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg>'; }
  /* Filterdrempels in DALASI, want listings.price staat in dalasi en een
     filter dat in een andere eenheid rekent dan het veld waarop het filtert
     is stil kapot. Dit zijn de oude eurodrempels omgerekend tegen D85,74 en
     op ronde dalasibedragen gelegd — de banden verschuiven daarmee hooguit
     een paar procent, maar ze lezen nu als bedragen die iemand in Gambia
     ook echt zou noemen. */
  function steps(){
    return isRent
      ? [8000, 12500, 17500, 25000, 35000, 50000, 70000, 100000, 175000, 300000]
      : [2000000, 4000000, 6500000, 8500000, 12500000, 17500000, 25000000, 42500000, 65000000, 85000000];
  }
  function money(gmd){ return fmtAreaPrice(gmd); }
  function look(list, v){ for(const o of list){ if(String(o[0])===String(v)) return o[1]; } return v; }
  function catLabel(v){ let out=v; MK_CATEGORIES.forEach(g=>g[1].forEach(t=>{ if(t[1]===v) out=t[0]; })); return out; }
  function servList(){ return isLand() ? MK_SERV_LAND : MK_SERV_BUILT; }
  function featList(){ return isRent ? MK_FEAT_RENT : (isLand() ? MK_FEAT_LAND : MK_FEAT_SALE); }
  function fromLabel(v){
    if(v==='now') return 'Available now';
    if(v==='month') return 'Available within a month';
    if(v==='quarter') return 'Available within 3 months';
    if(/^\d{4}-/.test(v)) return 'Available from '+v;
    return v;
  }

  function single(key, list, cur, anyLabel){
    let h = '<div class="mkf-opts">';
    if(anyLabel!==false) h += '<button type="button" class="mkf-opt'+(!cur?' on':'')+'" data-k="'+key+'" data-v="">'+tick()+(anyLabel||'Any')+'</button>';
    list.forEach(o=>{ const v=String(o[0]); h += '<button type="button" class="mkf-opt'+(String(cur)===v?' on':'')+'" data-k="'+key+'" data-v="'+esc(v)+'">'+tick()+esc(o[1])+'</button>'; });
    return h+'</div>';
  }
  function multi(key, list, arr){
    let h = '<div class="mkf-opts">';
    list.forEach(o=>{ const v=String(o[0]), on=arr.indexOf(v)>=0; h += '<button type="button" class="mkf-opt'+(on?' on':'')+'" data-mk="'+key+'" data-v="'+esc(v)+'">'+tick()+esc(o[1])+'</button>'; });
    return h+'</div>';
  }
  function numOpts(n){ return Array.from({length:n},(_,i)=>[i+1,(i+1)+'+']); }

  mount.innerHTML = `
<div class="mkf-bar" id="mkfBar">
  <div class="mkf-field mkf-where" id="mkfFWhere">
    <span class="mkf-fl">Where</span>
    <input type="text" id="mkfQ" autocomplete="off" placeholder="Any area in The Gambia" aria-label="Area or town" aria-expanded="false" role="combobox">
  </div>
  <div class="mkf-div"></div>
  <button type="button" class="mkf-field" id="mkfFType" aria-expanded="false">
    <span class="mkf-fl">Property type</span>
    <span class="mkf-fv mkf-empty" id="mkfVType">Any type</span>
  </button>
  <div class="mkf-div"></div>
  <button type="button" class="mkf-field" id="mkfFBudget" aria-expanded="false">
    <span class="mkf-fl" id="mkfLBudget">${isRent?'Monthly rent':'Budget'}</span>
    <span class="mkf-fv mkf-empty" id="mkfVBudget">${isRent?'Any rent':'Any price'}</span>
  </button>
  <button type="button" class="mkf-more" id="mkfFMore" aria-expanded="false">
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.1" stroke-linecap="round"><path d="M4 6h16M7 12h10M10 18h4"/></svg>
    Filters <span class="mkf-badge" id="mkfBadge">0</span>
  </button>
  <button type="button" class="mkf-go" id="mkfGo">
    <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="7"/><path d="m21 21-4.3-4.3"/></svg>
    Search
  </button>
  <div class="mkf-pop" id="mkfPopWhere" hidden role="listbox" aria-label="Areas"></div>
  <div class="mkf-pop" id="mkfPopType" hidden></div>
  <div class="mkf-pop" id="mkfPopBudget" hidden></div>
  <div class="mkf-pop" id="mkfPopMore" hidden></div>
</div>
<div class="mkf-chips" id="mkfChips"></div>`;

  const $ = sel => mount.querySelector(sel);
  const FIELD = { where:'#mkfFWhere', type:'#mkfFType', budget:'#mkfFBudget', more:'#mkfFMore' };
  const POP   = { where:'#mkfPopWhere', type:'#mkfPopType', budget:'#mkfPopBudget', more:'#mkfPopMore' };
  let openName = null;

  function closePop(){
    if(!openName) return;
    $(POP[openName]).hidden = true;
    $(FIELD[openName]).classList.remove('mkf-open','mkf-on');
    $(FIELD[openName]).setAttribute('aria-expanded','false');
    if(openName==='where') $('#mkfQ').setAttribute('aria-expanded','false');
    openName = null;
  }
  function openPop(name){
    if(openName===name){ closePop(); return; }
    closePop();
    openName = name;
    if(name==='type') buildType();
    if(name==='budget') buildBudget();
    if(name==='more') buildMore();
    if(name==='where') buildWhere($('#mkfQ').value);
    const pop = $(POP[name]), field = $(FIELD[name]);
    pop.hidden = false;
    if(name==='more'){
      /* Het filterpaneel is hoger dan de ruimte onder de zoekbalk op een gewoon
         laptopscherm. Met een vaste max-height in CSS viel de onderkant — en dus
         de knop Show results — onder de vouw, en moest je eerst de PAGINA
         scrollen om je filters te kunnen toepassen. Hier krijgt het paneel exact
         de hoogte die er nog is; wat niet past scrollt binnen het paneel, met de
         voetbalk er sticky bovenop. */
      /* De cookiebalk staat fixed onderaan met z-index 200 en ligt dus over het
         paneel heen. Zonder deze aftrek verdwijnt de voetbalk — en daarmee de
         knop Show results — er precies achter, en juist bij een eerste bezoek,
         wat het moment is waarop iemand de filters voor het eerst opent. De balk
         wordt na accepteren uit de DOM gehaald, dus dan is de aftrek vanzelf 0. */
      const ccBar = document.getElementById('ccBanner');
      const ccH = ccBar ? ccBar.getBoundingClientRect().height : 0;
      const room = () => window.innerHeight - pop.getBoundingClientRect().top - ccH - 18;
      let avail = room();
      /* Op een korte laptop (1366x768 bijvoorbeeld) vult de hero het hele scherm
         en blijft er te weinig over voor een bruikbaar paneel. Dan schuiven we de
         pagina zover omlaag als nodig — de zoekbalk kruipt naar boven en het
         paneel krijgt de ruimte, in plaats van dat het achter de cookiebalk
         verdwijnt of tot een kier wordt samengeknepen. */
      if(avail < 360){
        const maxScroll = document.documentElement.scrollHeight - window.innerHeight - window.scrollY;
        const shortfall = Math.min(360 - avail, Math.max(0, maxScroll));
        /* behavior:'instant' is hier essentieel: de site zet html{scroll-behavior:smooth},
           en met een geanimeerde scroll meet room() hieronder nog de oude positie —
           dan valt het paneel terug op zijn minimumhoogte terwijl er wel ruimte is. */
        if(shortfall > 0){ window.scrollBy({top: shortfall, behavior: 'instant'}); avail = room(); }
      }
      pop.style.maxHeight = Math.max(260, avail) + 'px';
    }
    field.classList.add(name==='more' ? 'mkf-on' : 'mkf-open');
    field.setAttribute('aria-expanded','true');
    if(name==='where') $('#mkfQ').setAttribute('aria-expanded','true');
    if(name!=='more'){
      const bar = $('#mkfBar').getBoundingClientRect(), fr = field.getBoundingClientRect();
      pop.style.left = Math.max(8, Math.min(fr.left-bar.left, bar.width-pop.offsetWidth-8)) + 'px';
    }
  }
  document.addEventListener('click', e=>{
    if(!openName) return;
    /* composedPath(), not e.target: a multi-select click (category, title,
       service...) re-renders its own popover mid-bubble (buildType()/buildMore()
       replace innerHTML), which detaches the clicked button before this
       document-level listener runs. .contains(e.target) would then see a node
       that is no longer in the tree and close the popover on every single tap.
       composedPath() is captured at dispatch time, before that mutation, so it
       still lists the popover as an ancestor. */
    const path = e.composedPath ? e.composedPath() : [e.target];
    if(path.includes($(POP[openName])) || path.includes($(FIELD[openName]))) return;
    closePop();
  });
  document.addEventListener('keydown', e=>{ if(e.key==='Escape') closePop(); });

  let whereCursor = -1;
  function buildWhere(term){
    term = (term||'').trim().toLowerCase();
    let h = '', n = 0;
    MK_AREAS.forEach(region=>{
      const hits = region[1].filter(a=>!term || a[0].toLowerCase().indexOf(term)>=0);
      if(!hits.length) return;
      h += '<div class="mkf-agroup">'+esc(region[0])+'</div>';
      hits.forEach(a=>{ h += '<button type="button" class="mkf-arow" role="option" data-area="'+esc(a[0])+'">'+esc(a[0])+'<small>'+esc(region[0])+'</small></button>'; n++; });
    });
    if(!n) h = '<div class="mkf-anone">No area matches “'+esc(term)+'”. Search it anyway — the results map will look it up.</div>';
    $('#mkfPopWhere').innerHTML = h;
    whereCursor = -1;
  }
  function pickArea(a){ S.q=a; $('#mkfQ').value=a; closePop(); render(); }
  $('#mkfQ').addEventListener('focus', ()=>openPop('where'));
  $('#mkfQ').addEventListener('input', function(){
    S.q = this.value;
    if(openName!=='where') openPop('where'); else buildWhere(this.value);
    render();
  });
  $('#mkfQ').addEventListener('keydown', function(e){
    if(openName!=='where'){ if(e.key==='ArrowDown') openPop('where'); return; }
    const rows = $('#mkfPopWhere').querySelectorAll('.mkf-arow');
    if(e.key==='ArrowDown' || e.key==='ArrowUp'){
      e.preventDefault();
      if(!rows.length) return;
      whereCursor = e.key==='ArrowDown' ? Math.min(whereCursor+1, rows.length-1) : Math.max(whereCursor-1, 0);
      rows.forEach((r,i)=>r.classList.toggle('mkf-cursor', i===whereCursor));
      rows[whereCursor].scrollIntoView({block:'nearest'});
    } else if(e.key==='Enter'){
      e.preventDefault();
      if(whereCursor>=0 && rows[whereCursor]) pickArea(rows[whereCursor].dataset.area); else { closePop(); goSearch(); }
    }
  });
  $('#mkfPopWhere').addEventListener('click', e=>{ const b=e.target.closest('.mkf-arow'); if(b) pickArea(b.dataset.area); });
  $('#mkfFWhere').addEventListener('click', e=>{ if(e.target.closest('input')) return; $('#mkfQ').focus(); });

  function buildType(){
    let h = '';
    MK_CATEGORIES.forEach(g=>{ h += '<h5>'+esc(g[0])+'</h5>'+multi('cats', g[1].map(t=>[t[1],t[0]]), S.cats)+'<div style="height:12px"></div>'; });
    h += '<div class="mkf-popfoot"><button type="button" class="mkf-clear" data-clear="cats">Clear</button><span class="mkf-spacer"></span><button type="button" class="mkf-apply" data-done="1">Done</button></div>';
    $('#mkfPopType').innerHTML = h;
  }

  function buildBudget(){
    const st = steps(), per = isRent ? ' /mo' : '';
    function opts(cur, label){ return '<option value="">'+label+'</option>' + st.map(v=>'<option value="'+v+'"'+(String(cur)===String(v)?' selected':'')+'>'+money(v)+per+'</option>').join(''); }
    const quick = isRent
      ? [['',400,'Up to '+money(400)+'/mo'],['',800,'Up to '+money(800)+'/mo'],[800,'','Over '+money(800)+'/mo']]
      : [['',50000,'Up to '+money(50000)],['',150000,'Up to '+money(150000)],[150000,500000,money(150000)+' – '+money(500000)],[500000,'','Over '+money(500000)]];
    let h = '<h5>'+(isRent?'Monthly rent':'Price')+'</h5>'
      + '<div class="mkf-range"><select id="mkfSelMin" aria-label="Minimum">'+opts(S.pmin,'No minimum')+'</select><span>–</span>'
      + '<select id="mkfSelMax" aria-label="Maximum">'+opts(S.pmax,'No maximum')+'</select></div>'
      + '<div class="mkf-presets">'+quick.map(q=>'<button type="button" class="mkf-opt" data-qmin="'+q[0]+'" data-qmax="'+q[1]+'">'+esc(q[2])+'</button>').join('')+'</div>'
      + '<div class="mkf-popfoot"><button type="button" class="mkf-clear" data-clear="price">Clear</button><span class="mkf-spacer"></span><button type="button" class="mkf-apply" data-done="1">Done</button></div>';
    $('#mkfPopBudget').innerHTML = h;
    $('#mkfSelMin').addEventListener('change', function(){ S.pmin=this.value; render(); });
    $('#mkfSelMax').addEventListener('change', function(){ S.pmax=this.value; render(); });
  }

  function g(title, body){ return '<div class="mkf-fgroup"><h5>'+title+'</h5>'+body+'</div>'; }
  function titleGroup(){
    return g('Title &amp; documents', multi('titles', MK_DOC_TYPES, S.titles) +
      '<button type="button" class="mkf-switch'+(S.verified?' on':'')+'" data-sw="verified" style="margin-top:11px"><span class="mkf-sw"></span>'+
      '<span><b>Title checked by MyKunda</b><small>Only listings whose deed a specialist has read</small></span></button>');
  }
  function buildMore(){
    let h = '<div class="mkf-fgrid">';
    if(isRent){
      h += g('Bedrooms', single('beds', numOpts(5), S.beds||''));
      h += g('Bathrooms', single('baths', numOpts(3), S.baths||''));
      h += g('Furnishing', single('furn', MK_FURN, S.furn, 'Either'));
      h += g('Available from',
        '<div class="mkf-opts">'+[['now','Now'],['month','Within a month'],['quarter','Within 3 months']].map(o=>
          '<button type="button" class="mkf-opt'+(S.from===o[0]?' on':'')+'" data-k="from" data-v="'+o[0]+'">'+tick()+o[1]+'</button>').join('')+'</div>'+
        '<div class="mkf-dateline"><input type="date" id="mkfDateFrom" aria-label="Available from date" value="'+(/^\d{4}-/.test(S.from)?S.from:'')+'"></div>');
      h += g('Distance to the beach', single('beach', MK_BEACH, S.beach));
      h += g('Services', multi('serv', servList(), S.serv));
      h += g('Features', multi('feats', featList(), S.feats));
    } else if(isLand()){
      h += g('Plot size',
        '<div class="mkf-range"><select id="mkfPlotMin" aria-label="Minimum plot size"><option value="">No minimum</option>'+
        [200,400,600,1000,2000,5000].map(v=>'<option value="'+v+'"'+(String(S.plot)===String(v)?' selected':'')+'>'+v.toLocaleString('en-GB')+' m²</option>').join('')+
        '</select><span>–</span><select id="mkfPlotMax" aria-label="Maximum plot size"><option value="">No maximum</option>'+
        [400,600,1000,2000,5000,10000].map(v=>'<option value="'+v+'"'+(String(S.plotmax)===String(v)?' selected':'')+'>'+(v>=10000?'1 ha':v.toLocaleString('en-GB')+' m²')+'</option>').join('')+
        '</select></div><p class="mkf-hint">One standard plot is about 400 m² — 20 × 20 metres.</p>');
      h += titleGroup();
      h += g('Services &amp; access', multi('serv', servList(), S.serv));
      h += g('Distance to the beach', single('beach', MK_BEACH, S.beach));
      h += g('Features', multi('feats', featList(), S.feats));
    } else {
      h += g('Bedrooms', single('beds', numOpts(5), S.beds||''));
      h += g('Bathrooms', single('baths', numOpts(3), S.baths||''));
      h += g('Living area', single('sqm', [[60,'60 m²+'],[90,'90 m²+'],[120,'120 m²+'],[180,'180 m²+'],[250,'250 m²+']], S.sqm));
      h += g('Condition', single('cond', MK_COND, S.cond));
      h += g('Year built', single('year', [[2024,'2024 or newer'],[2020,'2020 or newer'],[2015,'2015 or newer']], S.year));
      h += titleGroup();
      h += g('Services', multi('serv', servList(), S.serv));
      h += g('Distance to the beach', single('beach', MK_BEACH, S.beach));
      h += g('Features', multi('feats', featList(), S.feats));
    }
    h += '</div><div class="mkf-popfoot"><button type="button" class="mkf-clear" data-clear="all">Clear all filters</button><span class="mkf-spacer"></span><button type="button" class="mkf-apply" data-done="1">Show results</button></div>';
    $('#mkfPopMore').innerHTML = h;
    const d = $('#mkfDateFrom'); if(d) d.addEventListener('change', function(){ S.from=this.value; render(); });
    const pmn = $('#mkfPlotMin'), pmx = $('#mkfPlotMax');
    if(pmn) pmn.addEventListener('change', function(){ S.plot=this.value; render(); });
    if(pmx) pmx.addEventListener('change', function(){ S.plotmax=this.value; render(); });
  }

  mount.addEventListener('click', function(e){
    const t = e.target.closest('[data-k],[data-mk],[data-sw],[data-clear],[data-done],[data-qmin]');
    if(!t) return;
    if(t.dataset.k!==undefined && t.dataset.k!==''){
      const k=t.dataset.k, v=t.dataset.v;
      S[k] = (k==='beds'||k==='baths') ? (v?+v:0) : v;
    } else if(t.dataset.mk){
      const mk=t.dataset.mk, v=t.dataset.v, arr=S[mk], i=arr.indexOf(v);
      if(i>=0) arr.splice(i,1); else arr.push(v);
    } else if(t.dataset.sw){
      S[t.dataset.sw] = !S[t.dataset.sw];
    } else if(t.dataset.clear){
      const c = t.dataset.clear;
      if(c==='cats') S.cats=[];
      else if(c==='price'){ S.pmin=''; S.pmax=''; }
      else { const q=S.q; Object.assign(S,{cats:[],pmin:'',pmax:'',beds:0,baths:0,sqm:'',plot:'',plotmax:'',cond:'',year:'',beach:'',titles:[],verified:false,serv:[],feats:[],furn:'',from:'',q}); }
    } else if(t.dataset.done!==undefined){
      closePop(); render(); return;
    } else if(t.dataset.qmin!==undefined){
      S.pmin = t.dataset.qmin; S.pmax = t.dataset.qmax;
    }
    render();
    if(openName==='more') buildMore();
    if(openName==='type') buildType();
    if(openName==='budget') buildBudget();
  });

  function chipsFor(){
    const out = [];
    const add = (l,k,v) => out.push({l,k,v});
    if(S.q) add(S.q,'q');
    S.cats.forEach(c=>add(catLabel(c),'cats',c));
    if(S.pmin || S.pmax){
      const per = isRent?'/mo':'';
      add(S.pmin && S.pmax ? money(+S.pmin)+' – '+money(+S.pmax)+per : S.pmax ? 'Up to '+money(+S.pmax)+per : 'From '+money(+S.pmin)+per, 'price');
    }
    if(S.beds) add(S.beds+'+ bedrooms','beds');
    if(S.baths) add(S.baths+'+ bathrooms','baths');
    if(S.sqm) add(S.sqm+' m²+ living area','sqm');
    if(S.plot || S.plotmax) add(S.plot && S.plotmax ? S.plot+' – '+S.plotmax+' m² plot' : S.plotmax ? 'Plot up to '+S.plotmax+' m²' : 'Plot from '+S.plot+' m²', 'plotpair');
    if(S.cond) add(look(MK_COND,S.cond),'cond');
    if(S.year) add(look([[2024,'2024 or newer'],[2020,'2020 or newer'],[2015,'2015 or newer']],S.year),'year');
    if(S.furn) add(look(MK_FURN,S.furn),'furn');
    if(S.from) add(fromLabel(S.from),'from');
    if(S.beach) add(look(MK_BEACH,S.beach),'beach');
    S.titles.forEach(t=>add(look(MK_DOC_TYPES,t),'titles',t));
    if(S.verified) add('Title checked','verified');
    S.serv.forEach(s=>add(look(servList(),s),'serv',s));
    S.feats.forEach(f=>add(look(featList(),f),'feats',f));
    return out;
  }
  function extraCount(){
    let n = 0;
    ['beds','baths','sqm','plot','plotmax','cond','year','beach','furn','from'].forEach(k=>{ if(S[k]) n++; });
    return n + S.titles.length + S.serv.length + S.feats.length + (S.verified?1:0);
  }
  function buildParams(){
    const p = new URLSearchParams();
    p.set('type', mode);
    if(S.q) p.set('q', S.q);
    if(S.cats.length) p.set('cat', S.cats.join(','));
    if(S.pmin) p.set('pmin', S.pmin);
    if(S.pmax) p.set('pmax', S.pmax);
    if(S.beds) p.set('beds', S.beds);
    if(S.baths) p.set('baths', S.baths);
    if(S.sqm) p.set('sqm', S.sqm);
    if(S.plot) p.set('plot', S.plot);
    if(S.plotmax) p.set('plotmax', S.plotmax);
    if(S.cond) p.set('cond', S.cond);
    if(S.year) p.set('year', S.year);
    if(S.beach) p.set('beach', S.beach);
    if(S.furn) p.set('furn', S.furn);
    if(S.from) p.set('from', S.from);
    if(S.titles.length) p.set('title', S.titles.join(','));
    if(S.verified) p.set('verified', '1');
    if(S.serv.length) p.set('serv', S.serv.join(','));
    if(S.feats.length) p.set('feat', S.feats.join(','));
    return p;
  }
  function goSearch(){ location.href = 'search.html?' + buildParams().toString(); }

  function render(){
    const vt = $('#mkfVType');
    if(S.cats.length){ vt.textContent = S.cats.length===1 ? catLabel(S.cats[0]) : S.cats.length+' types'; vt.classList.remove('mkf-empty'); }
    else { vt.textContent = 'Any type'; vt.classList.add('mkf-empty'); }

    const vb = $('#mkfVBudget'), per = isRent?'/mo':'';
    if(S.pmin || S.pmax){ vb.textContent = S.pmin && S.pmax ? money(+S.pmin)+' – '+money(+S.pmax)+per : S.pmax ? 'Up to '+money(+S.pmax)+per : 'From '+money(+S.pmin)+per; vb.classList.remove('mkf-empty'); }
    else { vb.textContent = isRent?'Any rent':'Any price'; vb.classList.add('mkf-empty'); }

    const n = extraCount(), badge = $('#mkfBadge');
    badge.textContent = n; badge.classList.toggle('mkf-show', n>0);

    const cs = chipsFor();
    $('#mkfChips').innerHTML = cs.length
      ? cs.map((c,i)=>'<span class="mkf-chip">'+esc(c.l)+'<button type="button" data-rm="'+i+'" aria-label="Remove '+esc(c.l)+'"><svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round"><path d="M6 6l12 12M18 6 6 18"/></svg></button></span>').join('')
        + '<button type="button" class="mkf-clearall" data-clear="all">Clear all</button>'
      : '';
  }
  $('#mkfChips').addEventListener('click', function(e){
    const b = e.target.closest('[data-rm],[data-clear]'); if(!b) return;
    if(b.dataset.clear==='all'){ const q=S.q; Object.assign(S,{cats:[],pmin:'',pmax:'',beds:0,baths:0,sqm:'',plot:'',plotmax:'',cond:'',year:'',beach:'',titles:[],verified:false,serv:[],feats:[],furn:'',from:'',q}); render(); return; }
    const c = chipsFor()[+b.dataset.rm]; if(!c) return;
    if(c.k==='q'){ S.q=''; $('#mkfQ').value=''; }
    else if(c.k==='price'){ S.pmin=''; S.pmax=''; }
    else if(c.k==='plotpair'){ S.plot=''; S.plotmax=''; }
    else if(c.k==='verified'){ S.verified=false; }
    else if(Array.isArray(S[c.k])){ const i=S[c.k].indexOf(c.v); if(i>=0) S[c.k].splice(i,1); }
    else { S[c.k] = (c.k==='beds'||c.k==='baths') ? 0 : ''; }
    render();
  });

  $('#mkfFType').addEventListener('click', ()=>openPop('type'));
  $('#mkfFBudget').addEventListener('click', ()=>openPop('budget'));
  $('#mkfFMore').addEventListener('click', ()=>openPop('more'));
  $('#mkfGo').addEventListener('click', goSearch);

  render();
}

/* ---------- Statische header/footer bijwerken ---------- */
/* build.mjs schrijft header en footer sinds augustus 2026 statisch in de HTML, zodat
   zoekmachines en hulptechnologie de navigatie zonder JavaScript zien. Die statische
   versie is de uitgelogde variant in dalasi — de enige twee dingen die per bezoeker
   verschillen. Wie ingelogd is of een andere munt koos, krijgt de header hier éénmalig
   opnieuw getekend; alle andere bezoekers (en crawlers) doen niets. */
function hydrateStaticHeader(){
  if(window.__mkHdrHydrated) return;
  const hdr = document.getElementById('header');
  if(!hdr || !hdr.hasAttribute('data-static')) return;
  window.__mkHdrHydrated = true;
  if(!getUser() && getCurrency()==='GMD') return;
  hdr.innerHTML = headerHTML(hdr.getAttribute('data-active')||'', hdr.getAttribute('data-hero')==='1');
  if(typeof initAreaMenu === 'function') initAreaMenu();   /* het paneel opnieuw in de compacte stand zetten */
}

/* ---------- On-hero header scroll swap ---------- */
function initHeroHeader(){
  hydrateStaticHeader();
  initCcyPicker();
  initHdrSearch();
  initMsgBadge();
  const h = document.getElementById('siteHeader');
  if(!h || !h.classList.contains('on-hero')) return;
  const onScroll = ()=>{ h.classList.toggle('on-hero', window.scrollY < 80); };
  window.addEventListener('scroll', onScroll, {passive:true});
}

/* ---------- Message badge (unread count) ---------- */
function initMsgBadge(){
  const badge = document.getElementById('msgBadge');
  if(!badge) return;
  if(typeof getUnreadCount!=='function' || typeof backendReady!=='function' || !backendReady()) return;
  // Fetch initial count
  getUnreadCount().then(n=>{
    if(n>0){ badge.textContent=n>9?'9+':n; badge.style.display='flex'; }
  }).catch(()=>{});
  // Subscribe to real-time updates for the badge
  (async function(){
    const u = typeof currentUser==='function' ? await currentUser() : null;
    if(!u) return;
    if(typeof subscribeToAllMessages==='function'){
      subscribeToAllMessages(u.id, ()=>{
        // New message arrived — refresh count
        getUnreadCount().then(n=>{
          if(n>0){ badge.textContent=n>9?'9+':n; badge.style.display='flex'; }
          else { badge.style.display='none'; }
        }).catch(()=>{});
      });
    }
  })();
}

/* ---------- Currency picker behaviour ---------- */
function initCcyPicker(){
  const btn=document.getElementById('ccyBtn'), menu=document.getElementById('ccyMenu');
  if(!btn||btn.dataset.wired) return;
  /* Static headers ship hard-coded crosses (= D85); refresh them from the live rate. */
  menu && menu.querySelectorAll('[data-ccy-cross]').forEach(function(el){
    var k=el.getAttribute('data-ccy-cross');
    if(CURRENCIES[k]) el.textContent='= D'+CURRENCIES[k].gmdPer.toLocaleString('en-US', {minimumFractionDigits:1,maximumFractionDigits:1});
  });
  renderRateNote();
  btn.dataset.wired='1';
  btn.addEventListener('click',e=>{ e.stopPropagation(); menu.classList.toggle('show'); });
  document.addEventListener('click',()=>menu.classList.remove('show'));
  menu.querySelectorAll('button').forEach(b=>b.addEventListener('click',()=>{
    setCurrency(b.dataset.ccy);
    location.reload();
  }));
}

/* Both the desktop icon and the drawer field land here, so search behaves the
   same on every viewport. The desktop actions row is hidden under 1080px, which
   is exactly why the drawer needs its own field. */
function goToSearch(q){
  q = (q||'').trim();
  location.href = 'search.html' + (q ? '?q=' + encodeURIComponent(q) : '');
}
function initHdrSearch(){
  const btn=document.getElementById('hdrSearchBtn'), panel=document.getElementById('hdrSearch');
  if(btn && panel && !btn.dataset.wired){
    btn.dataset.wired='1';
    const input=document.getElementById('hdrSearchInput');
    const go=function(){ goToSearch(input.value); };
    btn.addEventListener('click',function(){ panel.hidden=!panel.hidden; if(!panel.hidden) input.focus(); });
    document.getElementById('hdrSearchX').addEventListener('click',function(){ panel.hidden=true; });
    document.getElementById('hdrSearchGo').addEventListener('click',go);
    input.addEventListener('keydown',function(e){ if(e.key==='Enter') go(); if(e.key==='Escape') panel.hidden=true; });
  }
  const mdForm=document.getElementById('mdSearchForm');
  if(mdForm && !mdForm.dataset.wired){
    mdForm.dataset.wired='1';
    mdForm.addEventListener('submit',function(e){
      e.preventDefault();
      goToSearch(document.getElementById('mdSearchInput').value);
    });
  }
}

function qs(name){ return new URLSearchParams(location.search).get(name); }

/* ============================================================
   SEO — structured data (schema.org) injected on every page
   ============================================================ */
const SITE_URL = 'https://mykunda.com';
function addJsonLd(obj){
  const s=document.createElement('script');
  s.type='application/ld+json';
  s.textContent=JSON.stringify(obj);
  document.head.appendChild(s);
}
function injectGlobalSEO(){
  // Organization / RealEstateAgent — appears on every page
  addJsonLd({
    "@context":"https://schema.org",
    "@type":"RealEstateAgent",
    "@id":SITE_URL+"/#organization",
    "name":"MyKunda",
    "url":SITE_URL+"/",
    "image":SITE_URL+"/images/og/home-hero.jpg",
    "logo":{"@type":"ImageObject","url":SITE_URL+"/images/mykunda-icon.png"},
    "email":"info@mykunda.com",
    "address":{"@type":"PostalAddress","addressRegion":"West Coast Region","addressCountry":"GM"},
    "contactPoint":{"@type":"ContactPoint","contactType":"customer support","email":"info@mykunda.com","availableLanguage":["English","Wolof","Mandinka"]},
    "description":"MyKunda is a new property platform for The Gambia — built on proven professional standards. Buy, rent and invest in homes and land along the Atlantic coast, with title checks on request and professional service.",
    "areaServed":{"@type":"Country","name":"The Gambia"},
    
    "sameAs":socialLinks().filter(s=>s[0]!=='WhatsApp').map(s=>s[1]),
    "priceRange":"$$",
    "knowsLanguage":["en","Wolof","Mandinka"]
  });
  // WebSite + Sitelinks search box
  addJsonLd({
    "@context":"https://schema.org",
    "@type":"WebSite",
    "@id":SITE_URL+"/#website",
    "name":"MyKunda",
    "url":SITE_URL+"/",
    "inLanguage":"en",
    "publisher":{"@id":SITE_URL+"/#organization"},
    "potentialAction":{
      "@type":"SearchAction",
      "target":{"@type":"EntryPoint","urlTemplate":SITE_URL+"/search.html?q={search_term_string}"},
      "query-input":"required name=search_term_string"
    }
  });
}
function breadcrumbLd(items){
  return {
    "@context":"https://schema.org","@type":"BreadcrumbList",
    "itemListElement":items.map((it,i)=>({"@type":"ListItem","position":i+1,"name":it[0],"item":SITE_URL+"/"+it[1]}))
  };
}

/* Run SEO injection on every page once the DOM is ready */
function injectSEOBoilerplate(){
  if(!document.querySelector('link[rel="icon"]')){
    const l=document.createElement('link'); l.rel='icon'; l.type='image/png'; l.href='images/mykunda-icon.png'; document.head.appendChild(l);
  }
  // Fonts are now self-hosted via @font-face in styles.css — no external loading needed
  const boiler=[
    ['name','theme-color','#15463A'],
    ['name','author','MyKunda'],
    ['name','geo.region','GM'],
    ['name','geo.placename','Kombo, The Gambia'],
    ['property','og:site_name','MyKunda'],
    ['property','og:locale','en_GB'],
    ['name','twitter:card','summary_large_image'],
  ];
  boiler.forEach(([attr,key,val])=>{
    if(!document.querySelector(`meta[${attr}="${key}"]`)){
      const m=document.createElement('meta'); m.setAttribute(attr,key); m.setAttribute('content',val); document.head.appendChild(m);
    }
  });
  // default OG image if a page didn't set one
  if(!document.querySelector('meta[property="og:image"]')){
    [['og:image',SITE_URL+'/images/og/home-hero.jpg'],['og:image:secure_url',SITE_URL+'/images/og/home-hero.jpg'],['og:image:type','image/jpeg'],['og:image:width','1200'],['og:image:height','630']].forEach(([k,v])=>{const m=document.createElement('meta'); m.setAttribute('property',k); m.setAttribute('content',v); document.head.appendChild(m);});
  }
  // hreflang — single-language site: self-referential en + x-default
  const _can=document.querySelector('link[rel="canonical"]');
  if(_can && !document.querySelector('link[rel="alternate"][hreflang]')){
    ['en','x-default'].forEach(h=>{const l=document.createElement('link');l.rel='alternate';l.setAttribute('hreflang',h);l.href=_can.href;document.head.appendChild(l);});
  }
}
/* ---------- Mobile nav drawer ---------- */
function initMobileNav(){
  const toggle=document.getElementById('navToggle'), drawer=document.getElementById('mobileDrawer');
  if(!toggle||!drawer||toggle.dataset.wired) return;
  toggle.dataset.wired='1';
  const open=()=>{drawer.classList.add('open');document.body.style.overflow='hidden';toggle.setAttribute('aria-expanded','true');drawer.setAttribute('aria-hidden','false');};
  const close=()=>{drawer.classList.remove('open');document.body.style.overflow='';toggle.setAttribute('aria-expanded','false');drawer.setAttribute('aria-hidden','true');};
  toggle.addEventListener('click',open);
  document.getElementById('mdClose')?.addEventListener('click',close);
  document.getElementById('mdBackdrop')?.addEventListener('click',close);
  drawer.querySelectorAll('.md-ccy-row button').forEach(b=>b.addEventListener('click',()=>{ setCurrency(b.dataset.ccy); location.reload(); }));
}

/* ---------- Areas- en Guides-menu: desktoppaneel + mobiele niveaus ----------
 *
 * De opmaak staat in headerHTML(); alle gebieds- en gidslinks staan statisch in
 * de pagina en blijven daar. Beide menus delen dezelfde opbouw; data-menu op het
 * paneel of het mobiele scherm kiest de bron in MK_MENUS (zonder attribuut: areas).
 * Deze functie doet drie dingen en verder niets:
 *   1. groep wisselen in het desktoppaneel (muis, klik, pijltjes),
 *   2. filteren op naam, dwars door alle groepen heen,
 *   3. de drie niveaus van het mobiele scherm.
 *
 * Alles loopt via gedelegeerde listeners op document, zodat het blijft werken
 * nadat hydrateStaticHeader() de header opnieuw tekent voor wie is ingelogd.
 *
 * Twee dingen om in de gaten te houden bij het bewerken van headerHTML():
 * de opmaak staat daar op lange regels omdat alles binnen die template letterlijk
 * in elke pagina terechtkomt, en een apostrof in een commentaar binnen een
 * ${...} van die template zet de minifier in build.mjs in stringmodus, waarna
 * hij de rest van het bestand niet meer opschoont (gemeten: ruim 8 kB extra).
 * De klasse mkam-js zet het paneel in de compacte stand; zonder JavaScript
 * blijft het de oude lijst met alle regios onder elkaar. */
function initAreaMenu(){
  document.querySelectorAll('.mkam').forEach(el=>el.classList.add('mkam-js'));
  markCurrentArea();
  if(document.documentElement.dataset.mkamWired) return;
  document.documentElement.dataset.mkamWired = '1';

  const esc = s => String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').split('"').join('&quot;');
  /* Bron van een element: het dichtstbijzijnde data-menu bepaalt areas of guides. */
  const srcOf = el => { const host = el.closest('[data-menu]'); return MK_MENUS[(host && host.dataset.menu) || 'areas'] || MK_MENUS.areas; };
  const totalOf = src => src.groups.reduce((n,r)=>n+r[1].length,0);
  const hits = (term, src) => { const t=term.trim().toLowerCase(), out=[];
    src.groups.forEach(r=>r[1].forEach(a=>{ if(a[0].toLowerCase().indexOf(t)>=0) out.push([a,r[0]]); })); return out; };

  /* ----- desktop ----- */
  function showRegion(panel, i){
    panel.querySelectorAll('.mkam-pane').forEach(p=>p.classList.toggle('on', p.dataset.reg===String(i)));
    panel.querySelectorAll('.mkam-rbtn').forEach(b=>b.setAttribute('aria-selected', b.dataset.reg===String(i)?'true':'false'));
  }
  function showResults(panel, term){
    const res = panel.querySelector('.mkam-res'); if(!res) return;
    const src = srcOf(panel);
    const list = hits(term, src);
    res.innerHTML = list.length
      ? '<div class="mkam-ph">'+list.length+' result'+(list.length>1?'s':'')+'<span>for “'+esc(term)+'”</span></div>' +
        '<div class="mkam-list">'+list.map(h=>'<a href="'+h[0][1]+'">'+esc(h[0][0])+'<span class="mkam-reg">'+esc(h[1])+'</span></a>').join('')+'</div>'
      : '<div class="mkam-ph">No match</div><p class="mkam-none">Nothing matches “'+esc(term)+'”. Try the first letters, or open all '+totalOf(src)+' '+src.plural+' below.</p>';
    panel.querySelectorAll('.mkam-pane').forEach(p=>p.classList.remove('on'));
    panel.querySelectorAll('.mkam-rbtn').forEach(b=>b.setAttribute('aria-selected','false'));
    res.classList.add('on');
  }
  function resetPanel(panel){
    const inp = panel.querySelector('.mkam-input'); if(inp) inp.value='';
    showRegion(panel, panel.dataset.home || 0);
  }
  document.addEventListener('mouseover', e=>{
    const b = e.target.closest && e.target.closest('.mkam-rbtn'); if(!b) return;
    const panel = b.closest('.mkam'), inp = panel.querySelector('.mkam-input');
    if(inp && inp.value.trim()) return;
    showRegion(panel, b.dataset.reg);
  });
  document.addEventListener('click', e=>{
    const b = e.target.closest && e.target.closest('.mkam-rbtn');
    if(b){ e.preventDefault(); const panel=b.closest('.mkam'); const inp=panel.querySelector('.mkam-input');
      if(inp) inp.value=''; showRegion(panel, b.dataset.reg); b.focus(); }
  });
  document.addEventListener('input', e=>{
    const inp = e.target.closest && e.target.closest('.mkam-input');
    if(inp){ const panel=inp.closest('.mkam');
      inp.value.trim() ? showResults(panel, inp.value) : resetPanel(panel); return; }
    const mi = e.target.closest && e.target.closest('.md-sub-input');
    if(mi) mobileFilter(mi);
  });
  document.addEventListener('keydown', e=>{
    const wrap = e.target.closest && e.target.closest('.nav-dd-areas');
    if(!wrap) return;
    const panel = wrap.querySelector('.mkam'), btns = [].slice.call(panel.querySelectorAll('.mkam-rbtn'));
    if(e.key==='Escape'){
      wrap.classList.add('mkam-shut');
      wrap.querySelector('.nav-dd-btn').focus();
      wrap.addEventListener('mouseleave', ()=>wrap.classList.remove('mkam-shut'), {once:true});
      return;
    }
    if(e.key!=='ArrowDown' && e.key!=='ArrowUp') return;
    wrap.classList.remove('mkam-shut');
    const cur = e.target.closest('.mkam-rbtn');
    if(!cur){ e.preventDefault(); const sel=panel.querySelector('.mkam-rbtn[aria-selected="true"]')||btns[0]; sel.focus(); return; }
    e.preventDefault();
    const i = btns.indexOf(cur), n = (i + (e.key==='ArrowDown' ? 1 : btns.length-1)) % btns.length;
    const inp = panel.querySelector('.mkam-input'); if(inp) inp.value='';
    btns[n].focus(); showRegion(panel, btns[n].dataset.reg);
  });

  /* ----- mobiel ----- */
  function subOf(el, name){ const p = el.closest('.md-panel');
    return p.querySelector('.md-sub[data-menu="'+name+'"]') || p.querySelector('.md-sub'); }
  function level(sub, n, title, back){
    sub.classList.toggle('lvl3', n===3);
    sub.classList.toggle('on', n>1);
    sub.querySelector('.md-sub-title').textContent = title;
    sub.querySelector('.md-sub-backtxt').textContent = back;
    if(n<3) sub.querySelectorAll('.md-lvl3').forEach(l=>l.classList.remove('on'));
    /* Elke niveauwissel begint met een leeg zoekveld, anders staat het scherm
       de volgende keer nog op de vorige zoekterm. */
    const inp = sub.querySelector('.md-sub-input'); if(inp) inp.value='';
    sub.classList.remove('searching');
    sub.querySelector('.md-sub-results').classList.remove('on');
    sub.querySelector('.md-sub-scroll').scrollTop = 0;
  }
  function mobileFilter(inp){
    const sub = inp.closest('.md-sub'), box = sub.querySelector('.md-sub-results'), term = inp.value.trim(), src = srcOf(sub);
    sub.classList.toggle('searching', !!term);
    box.classList.toggle('on', !!term);
    if(!term) return;
    const list = hits(term, src);
    box.innerHTML = list.length
      ? list.map(h=>'<a href="'+h[0][1]+'">'+esc(h[0][0])+'<span class="mkam-reg">'+esc(h[1])+'</span></a>').join('')
      : '<p class="md-sub-none">No '+src.single+' matches “'+esc(term)+'”.</p>';
  }
  document.addEventListener('click', e=>{
    const t = e.target.closest ? e.target : null; if(!t) return;
    const drill = t.closest('[data-drill]');
    if(drill){ e.preventDefault(); const sub=subOf(drill, drill.dataset.drill); if(!sub) return;
      drill.closest('.md-panel').scrollTop = 0; level(sub, 2, srcOf(sub).title, 'Menu'); return; }
    const back = t.closest('.md-sub-back');
    if(back){ e.preventDefault(); const sub=back.closest('.md-sub'), src=srcOf(sub);
      sub.classList.contains('lvl3') ? level(sub, 2, src.title, 'Menu') : level(sub, 1, src.title, 'Menu'); return; }
    if(t.closest('.md-close') || t.closest('.md-backdrop')){
      t.closest('.mobile-drawer').querySelectorAll('.md-sub').forEach(sub=>level(sub, 1, srcOf(sub).title, 'Menu'));
      return;
    }
    const reg = t.closest('.md-reg');
    if(reg){ e.preventDefault(); const sub=reg.closest('.md-sub'), i=reg.dataset.reg, src=srcOf(sub);
      sub.querySelectorAll('.md-lvl3').forEach(l=>l.classList.toggle('on', l.dataset.reg===i));
      level(sub, 3, src.groups[+i][0], src.title);
      sub.classList.add('lvl3'); }
  });
}

/* Markeert de huidige pagina in beide menus: een areapagina opent haar regio in
   het Areas-paneel, een gidspagina haar onderwerp in het Guides-paneel. Panelen
   zonder treffer blijven op hun eerste groep staan. */
function markCurrentArea(){
  const here = (location.pathname.split('/').pop()||'').toLowerCase();
  if(!here) return;
  document.querySelectorAll('.mkam').forEach(panel=>{
    const src = MK_MENUS[panel.dataset.menu || 'areas'] || MK_MENUS.areas;
    let home = -1;
    src.groups.forEach((r,i)=>{ if(r[1].some(a=>a[1].toLowerCase()===here)) home = i; });
    if(home < 0) return;
    panel.dataset.home = home;
    panel.querySelectorAll('.mkam-pane').forEach(p=>p.classList.toggle('on', p.dataset.reg===String(home)));
    panel.querySelectorAll('.mkam-rbtn').forEach(b=>b.setAttribute('aria-selected', b.dataset.reg===String(home)?'true':'false'));
  });
  document.querySelectorAll('.mkam-list a, .md-lvl3 a').forEach(a=>{
    if((a.getAttribute('href')||'').toLowerCase()===here) a.setAttribute('aria-current','page');
  });
}

/* ---------- WhatsApp + Share (Google Plus Code aware) ---------- */
const WA_NUMBER = '2202282717'; // MyKunda Gambia line: +220 228 2717
function waLink(message){ return 'https://wa.me/' + WA_NUMBER + '?text=' + encodeURIComponent(message); }

/* Build a rich share/WhatsApp message for a listing, including its Google Plus Code */
function listingShareText(p, opts){
  opts = opts || {};
  const loc = p.area ? p.area.split('·')[0].trim() : '';
  const price = p.type==='rent' ? '€'+p.price.toLocaleString()+'/mo' : '€'+p.price.toLocaleString();
  const base = (location.origin && location.origin!=='null') ? location.origin + location.pathname.replace(/[^/]*$/, '') : '';
  const url = base + 'property.html?id=' + p.id;
  const lines = [];
  lines.push(opts.lead || ('🏠 ' + p.title));
  lines.push(price + ' · ' + p.street + ', ' + loc);
  if(typeof p.lat==='number'){
    lines.push('📍 Google Plus Code: ' + plusCodeShort(p.lat, p.lng, loc));
    lines.push('🗺️ https://plus.codes/' + plusCode(p.lat, p.lng, 10));
  }
  lines.push(url);
  if(opts.tail) lines.push('', opts.tail);
  return lines.join('\n');
}

const _WA_ICON='<svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2a10 10 0 0 0-8.6 15l-1.3 4.7 4.8-1.3A10 10 0 1 0 12 2Zm5.5 14c-.2.6-1.3 1.2-1.8 1.2-.5.1-1 .2-3.2-.7-2.7-1.1-4.4-3.8-4.5-4-.1-.2-1.1-1.4-1.1-2.7s.7-1.9.9-2.1c.2-.2.5-.3.7-.3h.5c.2 0 .4 0 .6.5l.8 2c.1.2.1.4 0 .5l-.4.5c-.2.2-.3.4-.1.7.2.3.8 1.3 1.7 2.1 1.2 1 2.1 1.3 2.4 1.5.2 0 .4 0 .6-.2l.7-.8c.2-.2.4-.2.6-.1l1.9.9c.2.1.4.2.5.3.1.3.1.7-.1 1.2Z"/></svg>';
const _MAIL_ICON='<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="5" width="18" height="14" rx="2"/><path d="m3 7 9 6 9-6"/></svg>';
const _LINK_ICON='<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M10 13a5 5 0 0 0 7 0l3-3a5 5 0 0 0-7-7l-1 1"/><path d="M14 11a5 5 0 0 0-7 0l-3 3a5 5 0 0 0 7 7l1-1"/></svg>';
const _GRID_ICON='<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></svg>';

/* Generic share sheet — custom popover (always offers WhatsApp + copy + Google Plus Code).
   On touch devices we also surface the native share sheet as a first option. */
function openShareSheet(cfg){
  document.getElementById('domShareSheet') && document.getElementById('domShareSheet').remove();
  const waMsg = cfg.text + (cfg.url && cfg.text.indexOf(cfg.url)===-1 ? '\n'+cfg.url : '');
  const full = cfg.text + (cfg.url ? '\n'+cfg.url : '');
  const canNative = !!navigator.share;
  const wrap = document.createElement('div');
  wrap.id='domShareSheet'; wrap.className='share-sheet';
  wrap.innerHTML = `
    <div class="share-backdrop"></div>
    <div class="share-panel" role="dialog" aria-label="Share">
      <div class="share-head"><h4>Share this property</h4><button class="share-x" aria-label="Close">&times;</button></div>
      ${cfg.previewHTML?`<div class="share-preview">${cfg.previewHTML}</div>`:''}
      <div class="share-actions">
        <a class="share-act wa" target="_blank" rel="noopener" href="${waLink(waMsg)}">${_WA_ICON}<span>WhatsApp</span></a>
        <a class="share-act fb" target="_blank" rel="noopener" href="https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(cfg.url||SITE_URL+'/')}">${_FB_ICON}<span>Facebook</span></a>
        <a class="share-act mail" href="mailto:?subject=${encodeURIComponent(cfg.title||'Property on MyKunda')}&body=${encodeURIComponent(waMsg)}">${_MAIL_ICON}<span>Email</span></a>
        <button class="share-act copy" data-copy="${full.replace(/"/g,'&quot;')}">${_LINK_ICON}<span>Copy</span></button>
      </div>
      ${cfg.plus?`<div class="share-plus">${_GRID_ICON}<div class="sp-text"><span class="sp-k">Google Plus Code</span><span class="sp-v">${cfg.plus}</span></div><button class="sp-copy" data-copy="${cfg.plus}">Copy</button></div>`:''}
      ${canNative?`<button class="share-native">More sharing options…</button>`:''}
    </div>`;
  document.body.appendChild(wrap);
  wrap.classList.add('open');
  const close=()=>{ wrap.remove(); };
  wrap.querySelector('.share-backdrop').addEventListener('click',close);
  wrap.querySelector('.share-x').addEventListener('click',close);
  const nativeBtn=wrap.querySelector('.share-native');
  if(nativeBtn) nativeBtn.addEventListener('click',()=>{ navigator.share({title:cfg.title,text:cfg.text,url:cfg.url}).catch(()=>{}); });
  wrap.querySelectorAll('[data-copy]').forEach(b=>b.addEventListener('click',()=>{
    domCopy(b.getAttribute('data-copy'));
    const o=b.querySelector('span')||b; const t=o.textContent; o.textContent='Copied ✓'; setTimeout(()=>o.textContent=t,1300);
  }));
}

/* ---------- Floating WhatsApp button (site-wide) ---------- */
function injectWhatsApp(){
  if(document.documentElement.hasAttribute('data-no-wa')) return;
  if(document.getElementById('waFab')) return;
  const msg = window.MYKUNDA_WA_MESSAGE || 'Hello MyKunda! I have a question about a property in The Gambia.';
  const a=document.createElement('a');
  a.id='waFab'; a.className='wa-fab'; a.href=waLink(msg); a.target='_blank'; a.rel='noopener';
  a.setAttribute('aria-label','Chat with us on WhatsApp');
  a.innerHTML=_WA_ICON.replace('width="20" height="20"','width="28" height="28"')+'<span class="wa-fab-label">Chat with us</span>';
  document.body.appendChild(a);
}


/* ---------- Contact plumbing (shared by every form on the site) ---------- */
const MYKUNDA_EMAIL='info@mykunda.com';
const MYKUNDA_PHONE_DISPLAY='+220 228 2717';

/* Wait for the lazily-loaded Supabase client, then submit the lead. Throws when
   the backend is offline or in demo mode, so no form on the site can ever show a
   "sent" confirmation for a message that was never actually delivered. */
async function sendLead(source, fields){
  if(window.__sbReady){ try{ await window.__sbReady; }catch(e){} }
  if(typeof submitLead!=='function') throw new Error('backend-offline');
  const r = await submitLead(source, fields);
  if(r && r.demo) throw new Error('backend-offline');
  return r;
}

/* Standard fallback panel — WhatsApp and email always work, even when a
   form doesn't. */
function contactFallbackHTML(waMsg, intro){
  const msg = waMsg || 'Hello MyKunda! I tried to send a message through the website but it did not go through.';
  return '<div style="margin-top:14px;padding:14px 16px;border-radius:12px;background:var(--amber-50);border:1px solid var(--amber-100);text-align:left">'
    + '<p style="font-size:13.5px;color:var(--amber-600);font-weight:600;line-height:1.5;margin:0 0 10px">' + (intro || "We couldn't send that just now. Please reach us directly \u2014 these all work right away:") + '</p>'
    + '<div style="display:flex;gap:8px;flex-wrap:wrap">'
    + '<a class="btn wa btn-sm" target="_blank" rel="noopener" href="' + waLink(msg) + '">' + _WA_ICON + '<span>WhatsApp</span></a>'
    + '<a class="btn btn-ghost btn-sm" href="mailto:' + MYKUNDA_EMAIL + '">' + _MAIL_ICON + '<span>Email us</span></a>'
    + '</div></div>';
}

/* Area-alert & newsletter signup — honest success and failure states.
   Used on the dark green cards, so the note inherits white text. */
async function subscribeAreaAlert(form, area){
  const btn = form.querySelector('button[type=submit]') || form.querySelector('button');
  const input = form.querySelector('input[type=email]') || form.querySelector('input');
  const email = ((input && input.value) || '').trim();
  if(!email) return;
  const label = btn ? btn.textContent : '';
  if(btn){ btn.disabled = true; btn.textContent = 'Saving\u2026'; }
  let note = form.querySelector('.alert-note');
  if(!note){
    note = document.createElement('div');
    note.className = 'alert-note';
    note.style.cssText = 'flex-basis:100%;width:100%;font-size:12.5px;font-weight:600;line-height:1.45;margin-top:9px';
    form.appendChild(note);
  }
  note.textContent = '';
  try{
    await sendLead('area_alert', { email: email, area: area || null, message: area ? 'Area alert signup \u2014 ' + area : 'Newsletter signup' });
    if(btn){ btn.textContent = 'Subscribed \u2713'; btn.style.opacity = '.75'; }
    if(input) input.value = '';
    note.style.color = 'rgba(255,255,255,.86)';
    note.textContent = "Confirmed \u2014 we'll email " + email + '.';
  }catch(e){
    if(btn){ btn.disabled = false; btn.textContent = label || 'Notify me'; }
    note.style.color = 'var(--amber-400)';
    note.innerHTML = "That didn't save. Please try again, or email <a href=\"mailto:" + MYKUNDA_EMAIL + "\" style=\"color:inherit;text-decoration:underline\">" + MYKUNDA_EMAIL + '</a>.';
  }
}

function initSEO(){ injectSEOBoilerplate(); injectGlobalSEO(); hydrateStaticHeader(); initCcyPicker(); initHdrSearch(); initMobileNav(); initAreaMenu(); injectWhatsApp(); injectFaviconManifest(); injectCookieConsent(); if(localStorage.getItem('mykunda_cc')==='all') loadAnalytics(); detectAdmin(); warnPricingDrift(); }

/* Auto-detect admin role on page load — shows Admin link in header */
function warnPricingDrift(){
  if(typeof isLocalAdmin === 'function' && isLocalAdmin() && RATE_INFO.stale){
    console.warn('[MyKunda] Dalasi rate is stale — ' + rateNote() + '. Check the fx-rates function and fx_rate_rejects.');
  }
  if(typeof isLocalAdmin === 'function' && isLocalAdmin() && pricingReviewDue()){
    console.warn('[MyKunda] Listing plan prices need re-rounding — reviewed ' + PRICING.reviewedAt +
      ' at D' + PRICING.referenceRate + '/€1, live rate D' + CURRENCIES.EUR.gmdPer +
      ' (' + Math.round(pricingDrift()*100) + '% drift). See PRICING in app.js.');
  }
}

function detectAdmin(){
  function rerenderHeader(){
    var hdr=document.getElementById('header');
    if(hdr && hdr.innerHTML){
      var hero=document.getElementById('siteHeader');
      var wasHero=hero && hero.classList.contains('on-hero');
      hdr.innerHTML=headerHTML(hdr.getAttribute('data-active')||'', wasHero);
      initCcyPicker(); initHdrSearch(); initMobileNav();
    }
  }
  function run(){
    if(typeof checkAdmin!=='function') return;
    if(!getUser()) return;
    var before = (typeof isLocalAdmin==='function') && isLocalAdmin();
    checkAdmin().then(function(isAdmin){
      isAdmin = !!isAdmin;
      if(!isAdmin){ try{ localStorage.removeItem('mykunda_admin'); }catch(e){} }
      if(isAdmin !== before) rerenderHeader();
    }).catch(function(){});
  }
  /* supabase.js is loaded lazily on most pages, so checkAdmin() usually does not
     exist yet at first paint. Wait for the loader promise before asking the DB —
     otherwise the admin flag is never refilled after a fresh sign-in. */
  if(window.__sbReady && typeof window.__sbReady.then==='function'){ window.__sbReady.then(run).catch(function(){}); }
  else if(typeof checkAdmin==='function'){ run(); }
  else { window.addEventListener('load', function(){ setTimeout(run, 800); }); }
}
if(document.readyState==='loading'){ document.addEventListener('DOMContentLoaded', initSEO); }
else { initSEO(); }

/* ---------- Favicon + PWA manifest (site-wide) ---------- */
function injectFaviconManifest(){
  if(document.querySelector('link[rel="manifest"]')) return;
  const h=document.head;
  const fav=document.createElement('link'); fav.rel='icon'; fav.type='image/png'; fav.sizes='512x512'; fav.href='images/mykunda-icon.png'; h.appendChild(fav);
  const apple=document.createElement('link'); apple.rel='apple-touch-icon'; apple.href='images/mykunda-icon.png'; h.appendChild(apple);
  const man=document.createElement('link'); man.rel='manifest'; man.href='manifest.json'; h.appendChild(man);
}

/* ---------- Cookie consent banner (GDPR/AVG) ---------- */
function injectCookieConsent(){
  if(localStorage.getItem('mykunda_cc')) return;
  if(document.getElementById('ccBanner')) return;
  const el=document.createElement('div'); el.id='ccBanner';
  el.innerHTML=`
    <div class="cc-inner">
      <p>We use essential cookies to make MyKunda work, and analytics cookies to understand how you use the site so we can improve it.
        <a href="legal-cookies.html">Read our cookie policy</a>.</p>
      <div class="cc-btns">
        <button class="btn btn-primary btn-sm" id="ccAccept">Accept all</button>
        <button class="btn btn-ghost btn-sm" id="ccEssential">Essential only</button>
      </div>
    </div>`;
  document.body.appendChild(el);
  document.getElementById('ccAccept').addEventListener('click',()=>{ localStorage.setItem('mykunda_cc','all'); el.remove(); loadAnalytics(); });
  document.getElementById('ccEssential').addEventListener('click',()=>{ localStorage.setItem('mykunda_cc','essential'); el.remove(); });
}

/* ---------- Analytics — Meta Pixel, loaded only after consent ---------- */
const META_PIXEL_ID='1712466110009723';
function loadAnalytics(){
  if(window.fbq||document.getElementById('mkPixel')) return;
  !function(f,b,e,v,n,t,s){if(f.fbq)return;n=f.fbq=function(){n.callMethod?n.callMethod.apply(n,arguments):n.queue.push(arguments)};if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';n.queue=[];t=b.createElement(e);t.id='mkPixel';t.async=!0;t.src=v;s=b.getElementsByTagName(e)[0];s.parentNode.insertBefore(t,s)}(window,document,'script','https://connect.facebook.net/en_US/fbevents.js');
  fbq('init',META_PIXEL_ID);
  fbq('track','PageView');
  mkAutoTrack();
}
/* Fire a pixel event if — and only if — the visitor accepted analytics cookies. */
function mkTrack(ev,params){ if(window.fbq) try{ fbq('track',ev,params||undefined); }catch(e){} }
/* Page-level events derived from the URL, plus a delegated WhatsApp click. */
function mkAutoTrack(){
  if(window.__mkTracked) return; window.__mkTracked=true;
  const p=location.pathname, q=new URLSearchParams(location.search);
  if(/property\.html$/.test(p)&&q.get('id')) mkTrack('ViewContent',{content_type:'home_listing',content_ids:[q.get('id')]});
  if(/search\.html$/.test(p)&&q.get('q')) mkTrack('Search',{search_string:q.get('q')});
  document.addEventListener('click',e=>{
    const a=e.target.closest&&e.target.closest('a[href^="https://wa.me/"]');
    if(a) mkTrack('Contact');
  },true);
  document.addEventListener('submit',()=>{
    if(/sell\.html$|verify\.html$|contact\.html$/.test(p)) mkTrack('Lead');
    if(/auth\.html$/.test(p)) mkTrack('CompleteRegistration');
  },true);
}

/* ---------- Two-finger map touch guard (mobile) ---------- */
/* Call guardMapTouch(leafletMap, containerEl) to prevent accidental
   one-finger drag on embedded maps while scrolling. On mobile, dragging
   is disabled; a "Use two fingers" overlay shows on single-touch. */
function guardMapTouch(lmap, container){
  if(!lmap || !container) return;
  // inject guard overlay if not present
  let guard = container.querySelector('.map-touch-guard');
  if(!guard){
    guard = document.createElement('div');
    guard.className = 'map-touch-guard';
    guard.textContent = 'Use two fingers to move the map';
    container.style.position = container.style.position || 'relative';
    container.appendChild(guard);
  }
  // inject the CSS if not already in the page
  if(!document.getElementById('mapGuardCSS')){
    const s=document.createElement('style'); s.id='mapGuardCSS';
    s.textContent='.map-touch-guard{display:none;position:absolute;inset:0;z-index:1100;background:rgba(14,46,37,.6);color:#fff;font-weight:700;font-size:15px;align-items:center;justify-content:center;text-align:center;padding:20px;pointer-events:none;backdrop-filter:blur(2px);border-radius:inherit}.map-touch-guard.show{display:flex}';
    document.head.appendChild(s);
  }
  let hideTimer=null;
  function isMob(){ return window.innerWidth <= 920; }
  function apply(){
    if(isMob()){ lmap.dragging.disable(); lmap.scrollWheelZoom.disable(); }
    else { lmap.dragging.enable(); lmap.scrollWheelZoom.enable(); }
  }
  const leafEl = container.querySelector('.leaflet-container') || container;
  leafEl.addEventListener('touchstart',function(e){
    if(!isMob()) return;
    if(e.touches.length < 2){
      guard.classList.add('show');
      clearTimeout(hideTimer); hideTimer=setTimeout(()=>guard.classList.remove('show'),1500);
    }
  },{passive:true});
  leafEl.addEventListener('touchend',function(){
    clearTimeout(hideTimer); hideTimer=setTimeout(()=>guard.classList.remove('show'),800);
  },{passive:true});
  window.addEventListener('resize', apply);
  apply();
}


/* ---------- Service worker: offline-first static cache (4G / flaky networks) ---------- */
(function __mkSW(){
  if(!('serviceWorker' in navigator) || location.protocol==='file:') return;
  window.addEventListener('load',function(){ navigator.serviceWorker.register('sw.js').catch(function(){}); });
})();

/* ---------- Lazy Leaflet loader (self-hosted) ---------- */
window.ensureLeaflet=function(cb){
  if(window.L){ cb(); return; }
  if(!window.__lfPromise){
    window.__lfPromise=new Promise(function(res){
      if(!document.querySelector('link[href*="leaflet-1.9.4.css"]')){
        var c=document.createElement('link'); c.rel='stylesheet'; c.href='vendor/leaflet-1.9.4.css'; document.head.appendChild(c);
      }
      var s=document.createElement('script'); s.src='vendor/leaflet-1.9.4.js'; s.onload=res; document.head.appendChild(s);
    });
  }
  window.__lfPromise.then(cb);
};
window.leafletWhenVisible=function(el,cb){
  if(!el) return;
  if('IntersectionObserver' in window){
    new IntersectionObserver(function(e,o){ if(e[0].isIntersecting){ o.disconnect(); window.ensureLeaflet(cb); } },{rootMargin:'300px'}).observe(el);
  } else { window.ensureLeaflet(cb); }
};

/* ============================================================
   Contentguard — houdt kopieerwerk zichtbaar en foto's ter plaatse.
   Drie passieve listeners, geen timers, geen extra request: de kosten
   voor het laden van de pagina zijn nul.
   Uitzetten van een onderdeel: haal het betreffende blok weg.
   ============================================================ */
(function(){
  var LABEL = '\u00a9 MyKunda \u00b7 mykunda.com';

  /* Foto's laten zich niet naar het bureaublad slepen. */
  document.addEventListener('dragstart', function(e){
    var t = e.target;
    if (t && t.tagName === 'IMG' && !t.hasAttribute('data-free')) e.preventDefault();
  });

  /* Rechtermuisknop op een foto geeft geen "afbeelding opslaan". Alleen op
     foto's — de rest van de pagina blijft gewoon rechtsklikbaar, want een
     site die je nergens kunt rechtsklikken irriteert echte bezoekers meer
     dan hij kopieerders tegenhoudt. */
  document.addEventListener('contextmenu', function(e){
    var t = e.target;
    if (t && t.tagName === 'IMG' && !t.hasAttribute('data-free')) e.preventDefault();
  });

  /* Wie een flink stuk tekst kopieert, krijgt de bron mee. Korte selecties
     (een adres, een prijs, een telefoonnummer) blijven ongemoeid. */
  document.addEventListener('copy', function(e){
    try{
      var sel = String(window.getSelection() || '');
      if (sel.length < 240 || !e.clipboardData) return;
      e.clipboardData.setData('text/plain', sel + '\n\n' + LABEL + ' \u2014 ' + location.href);
      e.clipboardData.setData('text/html', '<blockquote>' + sel.replace(/[<>&]/g, function(c){ return {'<':'&lt;','>':'&gt;','&':'&amp;'}[c]; }) + '</blockquote><p>' + LABEL + ' &mdash; <a href="' + location.href + '">' + location.href + '</a></p>');
      e.preventDefault();
    }catch(_){}
  });
})();
