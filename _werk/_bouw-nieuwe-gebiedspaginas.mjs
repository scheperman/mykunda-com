/* De zes nieuwe gebiedspagina's schrijven — 31-08-2026.
   Zelfde opbouw als de vijf van augustus 2026 (Mamuda c.s.): zes secties,
   kaart, en een blok dat opsomt wat we NIET weten.

   Bedragen staan hier bewust NIET in: dit script zet placeholders neer die
   build-area-prices.mjs vult. Zo blijft area-prices.json de enige bron.
   Bronnen per bewering: _werk/onderzoek-nieuwe-gebieden-2026-08-31.md

   node _werk/_bouw-nieuwe-gebiedspaginas.mjs           proefdraai
   node _werk/_bouw-nieuwe-gebiedspaginas.mjs --write   schrijven
   Daarna: node build-area-prices.mjs --write && node build.mjs           */
import { writeFile, access } from 'node:fs/promises';

const WRITE = process.argv.includes('--write');
const FORCE = process.argv.includes('--force');

const esc = s => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

function bron(lijst) {
  return '<p class="src">Sources for this section:</p>\n        <ul style="margin:6px 0 0;padding-left:20px;font-size:13.5px;line-height:1.9;color:#4A463C">' +
    lijst.map(([t, u]) => `<li><a href="${u}" target="_blank" rel="noopener nofollow">${t}</a></li>`).join('') +
    '</ul>';
}

function pagina(a) {
  const nearGrid = a.near.map(([n, km, href]) =>
    `<a class="near" href="${href}"><span class="near-name">${n}</span><span class="near-dist">${km} km away</span></a>`).join('');
  const comp = "var comp=[" + a.comp.map(n => `['${n}',0]`).join(',') + "];";
  const nietGemeten = a.unknown.map(x => `<li>${x}</li>`).join('');

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<link rel="icon" type="image/png" sizes="64x64" href="images/mykunda-icon-sm.png">
<link rel="apple-touch-icon" href="images/mykunda-icon.png">
<link rel="manifest" href="manifest.json">
<meta name="theme-color" content="#15463A">
<title>${esc(a.label)}, The Gambia: plot prices &amp; area guide 2026</title>
<meta name="description" content="${esc(a.metaDesc)}">
<meta name="keywords" content="${esc(a.keywords)}">

<meta property="og:site_name" content="MyKunda">
<meta property="og:locale" content="en_GB">
<meta property="og:image:alt" content="A street in the Greater Banjul area of The Gambia">
<meta name="twitter:card" content="summary_large_image">
<link rel="canonical" href="https://mykunda.com/${a.slug}.html">
<meta property="og:type" content="article">
<meta property="og:title" content="${esc(a.label)} area guide — The Gambia">
<meta property="og:description" content="${esc(a.ogDesc)}">
<meta property="og:url" content="https://mykunda.com/${a.slug}.html">
<meta property="og:image" content="https://mykunda.com/images/og-gambia-street-aerial.jpg">
<meta property="og:image:secure_url" content="https://mykunda.com/images/og-gambia-street-aerial.jpg">
<meta property="og:image:type" content="image/jpeg">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta name="twitter:image" content="https://mykunda.com/images/og-gambia-street-aerial.jpg">
<meta name="twitter:title" content="${esc(a.label)} area guide — The Gambia">
<meta name="twitter:description" content="${esc(a.ogDesc)}">
<script type="application/ld+json">
{"@context": "https://schema.org", "@type": "Place", "name": "${a.label}, The Gambia", "description": "${esc(a.schemaDesc)}", "url": "https://mykunda.com/${a.slug}.html", "geo": {"@type": "GeoCoordinates", "latitude": ${a.lat}, "longitude": ${a.lng}}, "address": {"@type": "PostalAddress", "addressLocality": "${a.label}", "addressRegion": "West Coast Region", "addressCountry": "GM"},"additionalProperty":[{"@type":"PropertyValue","name":"Land asking price per m²","value":0,"unitText":"GMD","valueReference":"2026-08-25"}],"subjectOf":{"@id":"https://mykunda.com/gambia-property-prices.html"}}
</script>
<noscript></noscript>
<link rel="preconnect" href="https://jejaerpqltqryqzjvbjp.supabase.co" crossorigin>
<link rel="preconnect" href="https://api.mapbox.com" crossorigin>
<link rel="preload" href="fonts/mulish-var-latin.woff2" as="font" type="font/woff2" crossorigin>
<link rel="preload" href="images/gambia-street-aerial-mob.webp" as="image" media="(max-width:640px)" fetchpriority="high">
<link rel="preload" href="images/gambia-street-aerial.webp" as="image" media="(min-width:641px)" fetchpriority="high">
<link rel="stylesheet" href="styles.min.css">
<link rel="stylesheet" href="areas.css">

<script type="application/ld+json">
{"@context": "https://schema.org", "@type": "BreadcrumbList", "itemListElement": [{"@type": "ListItem", "position": 1, "name": "Home", "item": "https://mykunda.com/"}, {"@type": "ListItem", "position": 2, "name": "Areas in The Gambia", "item": "https://mykunda.com/areas-in-the-gambia.html"}, {"@type": "ListItem", "position": 3, "name": "${a.label}", "item": "https://mykunda.com/${a.slug}.html"}]}
</script>
<meta property="fb:pages" content="61593360783009">
<meta property="article:publisher" content="https://www.facebook.com/mykundagambia">
</head>
<body>
<a class="skip-link" href="#main">Skip to content</a>
<div id="header" data-static data-active="Areas" data-hero="0"><!--mk-hdr--><!--/mk-hdr--></div>
<main id="main">

<section class="nhero">
  <div class="nhero-bg">
    <picture style="display:contents"><source media="(max-width:640px)" srcset="images/gambia-street-aerial-mob.webp"><img src="images/gambia-street-aerial.webp" alt="A street in the Greater Banjul area of The Gambia — we have no photograph of ${esc(a.label)} yet" fetchpriority="high" loading="eager" decoding="async" onerror="this.style.display='none'" width="1600" height="1200"></picture>
  </div>
  <div class="nhero-inner">
    <div class="wrap">
      <div class="crumbs"><a href="/">Home</a> › <a href="areas-in-the-gambia.html">Areas in The Gambia</a> › <span>${esc(a.label)}</span></div>
      <span class="verdict"><span id="vIc"></span> ${a.verdict}</span>
      <h1>${esc(a.label)} land prices &amp; area guide</h1>
      <div class="sub"><span id="hPin"></span> ${a.sub}</div>
      <div id="hoodPlus" style="margin-top:14px"></div>
    </div>
  </div>
</section>

<div class="qstats">
  <div class="wrap">
    <div class="qstat"><div class="k">Land, per m²</div><div class="v" id="qs0">—</div><div class="t" style="color:var(--muted);font-weight:600">filled by build-area-prices.mjs</div></div><div class="qstat"><div class="k">Typical plot, 400 m²</div><div class="v" id="qs1">—</div><div class="t" style="color:var(--muted);font-weight:600">filled by build-area-prices.mjs</div></div><div class="qstat"><div class="k">House, asking</div><div class="v" id="qs2">—</div><div class="t" style="color:var(--muted);font-weight:600">filled by build-area-prices.mjs</div></div>
  </div>
</div>

<div class="wrap">
  <div class="ncols">
    <div class="main">
      <div class="block vibe">
        <h2>The vibe</h2>
        ${a.vibe}
        <div class="tags" id="vibeTags"></div>
      </div>

      <div class="block">
        <h2>What property costs in ${esc(a.label)}</h2>
        <p class="lead">Filled by build-area-prices.mjs from area-prices.json.</p>
      </div>

      <div class="block">
        <h2>${a.knowHead}</h2>
        ${a.know}
        ${bron(a.bronnen)}
      </div>

      <div class="block">
        <h2>Getting there and what is on the ground</h2>
        <div class="amen-map" id="hoodMap" style="margin-bottom:18px"></div>
        ${a.ground}
      </div>

      <div class="block">
        <h2>What we have not measured here yet</h2>
        <p class="lead">${esc(a.label)} is one of six areas we added to MyKunda in August 2026, and its page is deliberately thinner than our older ones. Rather than fill it with plausible numbers, here is what we do not know.</p>
        <ul style="margin:6px 0 0;padding-left:20px;line-height:1.9">${nietGemeten}</ul>
        ${a.pinNote}
        <p style="margin-top:14px">If you live here, sell here or have bought here, you can correct any of this: <a href="contact.html">tell us what we have wrong</a>. That is how the rest of these pages got better.</p>
      </div>

      <div class="block">
        <h2>Nearby areas</h2>
        <p class="lead">The closest areas we cover, as the crow flies. Roads are longer.</p>
        <div class="near-grid">${nearGrid}</div>
      </div>
    </div>

    <aside class="naside">
      <div class="aside-card">
        <h3>Property in ${esc(a.label)}</h3>
        <p>Listings available now</p>
        <div class="mini-list" id="miniList"></div>
        <a class="btn btn-primary btn-block" href="search.html?q=${encodeURIComponent(a.label)}" style="margin-top:16px">View listings in ${esc(a.label)}</a>
      </div>
      <div class="aside-card">
        <h3>Compare nearby</h3>
        <p>Land, per m²</p>
        <div id="compareList"></div>
      </div>
      <div class="aside-card" style="background:linear-gradient(160deg,var(--green-800),var(--green-700));color:#fff;border:none">
        <h3 style="color:#fff">Get area alerts</h3>
        <p style="color:rgba(255,255,255,.8)">New ${esc(a.label)} listings, straight to your inbox.</p>
        <form onsubmit="event.preventDefault();subscribeAreaAlert(this,'${a.label}')">
          <input type="email" placeholder="Email address" required aria-label="Email address" autocomplete="email" style="width:100%;height:48px;border-radius:999px;border:none;padding:0 18px;font-size:14.5px;outline:none;margin-bottom:10px">
          <button class="btn btn-amber btn-block" type="submit">Notify me</button>
        </form>
      </div>
    </aside>
  </div>
</div>

</main>
<div id="footer" data-static><!--mk-ftr--><!--/mk-ftr--></div>

<script>
window.__sbReady=new Promise(function(res){window.addEventListener('load',function(){
  var s1=document.createElement('script'); s1.src='vendor/supabase-js-2.umd.js';
  s1.onerror=function(){ window.supabase=null; res(); };
  s1.onload=function(){ var s2=document.createElement('script'); s2.src='supabase.js'; s2.onload=res; s2.onerror=res; document.body.appendChild(s2); };
  document.body.appendChild(s1);
});});
</script>
<script src="app.min.js"></script>
<script>
vIc.innerHTML = ICON.star; hPin.innerHTML = ICON.pin;
if(typeof plusCodeChip==="function"){
  document.getElementById("hoodPlus").innerHTML = plusCodeChip(${a.lat},${a.lng},"${a.label}");
  var c=document.querySelector("#hoodPlus .pluscode-chip");
  if(c){ c.style.background="rgba(255,255,255,.16)"; c.style.boxShadow="inset 0 0 0 1.5px rgba(255,255,255,.4)"; c.style.color="#fff"; }
}

var tags=[${a.tags.map(t => JSON.stringify(t)).join(',')}];
vibeTags.innerHTML = tags.map(function(t){return '<span class="tag">'+ICON.check+" "+t+"</span>";}).join("");

var areaLower = "${a.label.toLowerCase()}";
var areaName = "${a.label}";
(async function(){
  var minis = null;
  try{ await window.__sbReady; }catch(e){}
  if(typeof fetchAreaListings==="function" && typeof backendReady==="function" && backendReady()){
    minis = await fetchAreaListings(areaName, 3);
  }
  if(!minis || !minis.length){
    if(typeof primeListings==="function" && typeof backendReady==="function" && backendReady()) await primeListings();
    minis = (typeof allListings==="function"?allListings():[]).filter(function(p){return String(p.area||"").toLowerCase().indexOf(areaLower)>-1;}).slice(0,3);
  }
  var wrap=document.querySelector(".aside-card p");
  if(!minis.length){ if(wrap) wrap.textContent="No listings here yet"; miniList.innerHTML=""; }
  else {
    miniList.innerHTML = minis.map(function(p){return '<a class="mini" href="property.html?id='+p.id+'"><img src="'+p.img+'" alt="" loading="lazy" onerror="this.style.background=\\'#DCEAE3\\'"><div><div class="mp">'+fmtPrice(p.price,p.type)+'</div><div class="mt">'+p.title+"</div></div></a>";}).join("");
    if(typeof countAreaListings==="function" && typeof backendReady==="function" && backendReady()){
      var count = await countAreaListings(areaName);
      if(count!==null && wrap){
        wrap.textContent = count+" listing"+(count!==1?"s":"")+" available now";
        var btnEl = document.querySelector(".aside-card .btn-primary");
        if(btnEl) btnEl.textContent = "View all "+count+" listings";
      }
    }
  }
})();

${comp}
compareList.innerHTML = comp.map(function(c,i){return '<div class="compare-row"><span class="nm">'+c[0]+(i===0?" (here)":"")+'</span><span class="pr">'+fmtAreaPrice(c[1])+"</span></div>";}).join("");

function updateAreaPrices(){
  var v=[];
  v.forEach(function(p){ var e=document.getElementById(p[0]); if(e) e.textContent=fmtAreaPrice(p[1]); });
}
updateAreaPrices();
</script>
<script>
/* Dezelfde kaart als op de oudere gebiedspagina's: mkAreaMap staat in app.js,
   Leaflet wordt pas opgehaald als de kaart bijna in beeld is. */
function initAreaMap(){
  if(typeof mkAreaMap === 'function') mkAreaMap('hoodMap', [${a.lat},${a.lng}], ${a.zoom});
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
</body>
</html>
`;
}

/* ---------- de zes gebieden ---------- */
const AREAS = [];

AREAS.push({
  slug: 'madiana', label: 'Madiana', lat: 13.3533, lng: -16.7631, zoom: 14,
  sub: 'West Coast · Kombo North',
  verdict: 'A large inland village that got its road in May 2026 — and sits on the edge of a demolition case',
  metaDesc: 'Land at Madiana, Kombo North: a village of 5,057 that was cut off in the rains until the Brufut–Madiana road opened in May 2026, what we can and cannot say about prices, and the land case next door.',
  ogDesc: 'The new road, the census figures and the land case next door — what is established about Madiana.',
  schemaDesc: 'A guide to Madiana in Kombo North, The Gambia: what land costs nearby, the Brufut–Madiana road, and what is and is not established about the village.',
  keywords: 'Madiana, Madiana Gambia, Brufut Madiana road, Kombo North land, Gambia plots',
  tags: ['Inland Kombo North', 'Tarred road since May 2026', '5,057 residents in 2013', 'One listing, below our bar', 'Boundary of a demolition case', 'Little established infrastructure'],
  vibe: `<p>Madiana is a large inland village behind the Brufut–Tanji coast, in Kombo North. The 2013 census counts <strong>5,057 residents</strong>, which makes it bigger than Jambanjelly and roughly three times Mamuda — not a hamlet being opened up, but an established village that simply had no road. Until May 2026 the way to Brufut flooded every rainy season; the alkalo, Sanusi Manneh, put it plainly at the opening ceremony, and in 2020 the village had written to the transport union because drivers were charging D35 against a government rate of D18 on the state of that road.</p>
        <p style="margin-top:22px">What changed is the road, and roads move land prices. What we can see of those prices is one advertisement — a single plot, asking well under half what Brufut asks three kilometres away. One listing is not a market, so the figure below is the band rate for the inland Kombo villages, with that one asking price beside it as context. Madiana is close to the coast but it is not coastal: this is farmland behind Brufut and Tanji, and their beachfront rates are not a fair proxy for it.</p>`,
  knowHead: 'What to know before buying at Madiana',
  know: `<p>We found <strong>no documented land dispute at Madiana itself</strong>, and we would rather say that plainly than imply either safety or risk. What we did find is at the neighbours. In the last days of March 2026, roughly forty hours before Eid al-Fitr, the High Court Sheriff Division demolished <strong>more than seventy compounds</strong> at Banyaka, Sinchan and Kunkujang Mariama. The demolition enforced a Kombo South District Tribunal judgment of 29 August 2018 in favour of Doudou Kah Bojang, a man from Jambur.</p>
<p>Madiana appears in that story as a <em>boundary</em>. Foroyaa describes the area covered by the enforcement sketch plan as stretching "from the main road at Kunkujang Mariama through Banyaka to Madiana, and across to another road linking Yuna and Sanyaka". Foroyaa also records that the demolition notices referred to Jambur while local authorities said the land actually lies at Banyaka. Nothing in the reporting says that anything at Madiana was demolished — but a case whose paperwork reaches your village boundary is exactly the case you want to have checked before you buy.</p>
<p>That is the pattern to guard against wherever a farming village is being subdivided: the plot is real, the seller is real, and the line between two villages' land is written down nowhere. Establish in writing which village's land the parcel sits on, get the chain of title, and have a lawyer search it. Our <a href="guide-how-to-verify-land-title-in-the-gambia.html">guide to verifying land title</a> sets out how, and <a href="guide-freehold-leasehold-customary-land-explained.html">freehold, leasehold and customary land explained</a> covers what a family head can and cannot sell.</p>`,
  bronnen: [
    ['Population 5,057 (2013), Madiana, Kombo North — GBoS 2013 Directory of Settlements', 'https://www.gbosdata.org/downloads-file/7-census-2013-directory-of-settlement'],
    ['Brufut–Madiana–Banyaka–Kunkujang Mariama road, 12 km, inaugurated 9 May 2026 — National Roads Authority', 'https://nra.gm/brufut-madiana-banyaka-kunkujang-mariama-road-project-to-be-inaugurated-tomorrow/'],
    ['Barrow inaugurates the 12 km road at Madiana — The Point, May 2026', 'https://thepoint.gm/africa/gambia/headlines/barrow-inaugurates-12km-roads-project-in-madiana'],
    ['"Ending decades of isolation": the alkalo on the old road — GRTS', 'https://www.grts.gm/news-article-details/news/president-barrow-commissions-12km-brufut-madiana-road-ending-decades-of-isolation-in-kombo-south'],
    ['Madiana, Banyaka and Kunkujang Mariama write to the transport union over fares and road condition — Foroyaa, June 2020', 'https://foroyaa.net/three-communities-write-to-transport-union-calling-for-their-intervention/'],
    ['How a land case ended in widespread demolition at Banyaka, with Madiana named as a boundary — Foroyaa, March 2026', 'https://foroyaa.net/how-land-case-ends-in-widespread-demolition/'],
    ['Justice for All demands the legal basis for the demolitions — Foroyaa, March 2026', 'https://foroyaa.net/justice-for-all-demands-sheriff-division-to-provide-legal-basis-for-demolishing-properties-of-its-members/'],
  ],
  ground: `<p>Madiana sits on the <strong>Brufut–Madiana–Banyaka–Kunkujang Mariama road</strong>, twelve kilometres of eight-metre carriageway with double surface dressing and drainage, built by SSTP Construction under the National Roads Authority, paid for by the Gambian government and opened by President Barrow on 9 May 2026 at the Madiana Lower Basic School. GRTS gives the full route as Brufut–Madiana–Banyaka–Kunkujang Mariama–Tujereng. A second scheme, a 10.2 km Jabang–Yuna–Madiana–Tanji road, was announced in August 2026.</p>
<p style="margin-top:14px">Beyond the school and the road we can establish very little. A "Madiana Community Market" is mapped in OpenStreetMap, but tagged as a community centre, so the name is the only evidence of a market. No health post, mosque, mains water or grid connection at Madiana appears in any register, press report or mapping dataset we could reach. A British charity has supported a school it calls "Madiana" since 2014, with figures for pupils and classrooms — but it nowhere says which Madiana, and there are three in the country. We are not going to put those numbers here.</p>`,
  unknown: [
    'Health post, mosque, mains water and electricity — nothing we could source. Treat all four as unknown, not as absent.',
    'A land rate of its own. We can price exactly one plot listing here, and one advertisement is one seller’s opinion — five is our bar.',
    'Rents — no rental listing we can verify.',
    'House prices — no local house listing we can verify; the figure above is land plus build cost.',
    'Any layout scheme, estate or planning approval covering plots being sold here.',
    'What the new road has done to prices. It opened in May 2026 and our measurement is from August 2026 — but on one listing, we cannot see the effect either way.',
  ],
  pinNote: `<p style="margin-top:16px">The pin above is accurate to roughly 600 metres: GeoNames and OpenStreetMap both hold a Madiana here and they disagree by that much. Two things to keep apart. First, the district: the 2013 census lists Madiana under <strong>Kombo North</strong>, while the road coverage describes the corridor as Kombo South, or as spanning both. Second, the name: there are three Madianas in The Gambia, and the one in Central River Region carries a published population of 6,069 — that figure is not this village.</p>`,
  near: [['Brufut', '3.4', 'brufut.html'], ['Ghana Town', '3.6', 'ghana-town.html'], ['Tanji', '3.8', 'tanji.html'], ['Tujereng', '4.8', 'tujereng.html'], ['Batokunku', '4.9', 'batokunku.html']],
  comp: ['Madiana', 'Brufut', 'Tanji', 'Tujereng', 'Batokunku'],
});

AREAS.push({
  slug: 'jambur', label: 'Jambur', lat: 13.3146, lng: -16.7008, zoom: 15,
  sub: 'West Coast · Kombo South',
  verdict: 'A village of 4,750 on the tarred Sukuta–Jambanjelly road, with the country’s largest solar plant at its edge',
  metaDesc: 'Land at Jambur, Kombo South: the Sukuta–Jambanjelly road, the 23 MWp solar plant built on kabilo land, what the World Bank compensation file shows about how plots are sold here, and what land costs in the band.',
  ogDesc: 'The road, the solar plant, and what the compensation file shows about buying land at Jambur.',
  schemaDesc: 'A guide to Jambur in Kombo South, The Gambia: land prices in the inland Kombo band, the Sukuta–Jambanjelly road, the 23 MWp solar plant and how land is held here.',
  keywords: 'Jambur, Jambur Gambia, Jambur solar plant, Sukuta Jambanjelly road, Kombo South land',
  tags: ['Inland Kombo South', 'On the tarred Sukuta–Jambanjelly road', '4,750 residents in 2013', '23 MWp solar plant at the edge', 'Land held by kabilos', 'Four listings, below our bar'],
  vibe: `<p>Jambur is a village of <strong>4,750</strong> in the 2013 census, on the tarred road that runs from Sukuta through Jabang and Jambur to Latriya and Jambanjelly. That road, 13.5 kilometres of it, opened in March 2020 and cost US$23 million; it is the spine of the whole inland Kombo strip, and Jambur sits in the middle of it. The village has a basic-cycle school founded in 1963 with over a thousand pupils, a health facility with two resident nurses, water from the Farato treatment plant and a partial grid connection.</p>
        <p style="margin-top:22px">Since March 2024 it also has the country's largest power station on its doorstep: 23 MWp of solar on 31 hectares beside Bamba Forest Park. That project left behind something unusually valuable for anyone buying land here — a published, audited account of who owned the ground and how it had been sold.</p>`,
  knowHead: 'What to know before buying at Jambur',
  know: `<p>Land at Jambur is held by <strong>kabilos</strong> — landholding lineages — and the World Bank resettlement file for the solar plant sets out exactly what that means in practice. The 31.1 hectares taken for the plant belonged to two of them: Mansa Kunda (12.4 ha, represented by Sheriffo Sonko) and Santanjuba (18.7 ha, communal farmland, headed by Kebba Wuday Bojang). The state leased the ground to NAWEC under the State Lands Act 1991. Compensation came to <strong>D87,946,902.64</strong>, of which D67.2 million was for land, and <strong>1,563 people</strong> were affected.</p>
<p>Read one line in that file twice if you are buying here: Sheriffo Sonko had <strong>already sold plots to roughly 106 people</strong> on land that was later taken, and 76 households of those buyers had to be compensated. Nothing in the file suggests wrongdoing — it is a normal Gambian arrangement. But it shows the shape of the market: plots at Jambur are sold by a lineage head, on land whose boundaries are customary, and a buyer's protection is the paperwork, not the handshake. Establish which kabilo the parcel belongs to, get the chain of title in writing, and have a lawyer search it. See <a href="guide-freehold-leasehold-customary-land-explained.html">freehold, leasehold and customary land explained</a> and our <a href="guide-how-to-verify-land-title-in-the-gambia.html">guide to verifying land title</a>.</p>
<p>One more thing belongs here, because it will come up. The demolition of more than seventy compounds at Banyaka and Kunkujang Mariama in March 2026 was carried out for <strong>a claimant from Jambur</strong>, Doudou Kah Bojang, under a 2018 Kombo South District Tribunal judgment. The land in that case is at Banyaka, not at Jambur — Foroyaa reports that the notices named Jambur while local authorities said the land lies at Banyaka. Nothing was demolished at Jambur. We mention it because searches for "Jambur land" will find it, and it deserves to be read accurately.</p>`,
  bronnen: [
    ['Population 4,750 (2013), Jambur, Kombo South — GBoS 2013 Directory of Settlements', 'https://www.gbosdata.org/downloads-file/7-census-2013-directory-of-settlement'],
    ['Sukuta–Jambanjelly road, US$23m, running through Jabang, Jambur and Latriya — The Point', 'https://thepoint.gm/africa/gambia/article/sukuta-jambanjelly-road-project-costs-us23m-says-gamworks-dg'],
    ['Resettlement Action Plan for the Jambur solar plant: kabilos, compensation and the 106 plot buyers — World Bank, June 2020', 'https://documents1.worldbank.org/curated/en/343681592976460990/pdf/Resettlement-Action-Plan-for-the-On-Grid-Solar-Plant-at-Jambur-West-Coast-Region.pdf'],
    ['Environmental and Social Impact Assessment: school, health facility, water and power at Jambur — World Bank', 'https://documents1.worldbank.org/curated/en/576721579857219553/pdf/Environmental-and-Social-Impact-Assessment.pdf'],
    ['23 MWp Jambur solar plant inaugurated 25 March 2024 — European Investment Bank', 'https://www.eib.org/en/press/all/2024-125-gambia-strong-international-support-for-a-new-era-of-renewables-with-inauguration-of-historic-23-mwp-solar-plant'],
    ['Dutch charity hands over a classroom block to Jambur school — The Point, November 2015', 'https://thepoint.gm/africa/gambia/article/dutch-charity-hands-over-classroom-block-to-jambur-school'],
    ['The Banyaka demolition and the Jambur claimant — Foroyaa, March 2026', 'https://foroyaa.net/how-land-case-ends-in-widespread-demolition/'],
  ],
  ground: `<p>Jambur is on the <strong>Sukuta–Jambanjelly road</strong>, tarred, opened in March 2020: from Sukuta through Jabang and Jambur to Latriya, ending at Jambanjelly where it meets the Brikama–Sanyang connection. The World Bank assessment puts that road 2.5 km west of the solar site and notes a gravel road towards Farato 700 metres to the north.</p>
<p style="margin-top:14px">On the ground, and unusually for a village this size, we have a documented list. <strong>Jambur Basic Cycle School</strong>, founded 1963, over a thousand pupils; <strong>Marina Nursery School</strong> from 2003/2004; a <strong>community health facility</strong> with two permanent nurses and a doctor visiting twice a week from Farato Health Centre; <strong>water</strong> from the Farato treatment plant with NAWEC boreholes; and a <strong>partial grid connection</strong>, with the schools and health centre on continuous supply. A village <strong>market</strong> was funded out of the D1,000,000 community package attached to the solar project, to be managed by the VDC. A mosque and a sports field are mapped in OpenStreetMap.</p>`,
  unknown: [
    'A land rate of its own. Four priced listings is the most local evidence any of these six pages has — and still one short of our bar of five.',
    'Rents — no rental listing we can verify.',
    'House prices — no local house listing we can verify; the figure above is land plus build cost.',
    'Whether the market funded under the solar project has been built.',
    'Any gazetted layout scheme at Jambur. Plots are sold by kabilos; we found no formal scheme.',
    'What the solar plant has done to land values. It is the kind of thing that moves a market, and we have nothing measured on either side of it.',
  ],
  pinNote: `<p style="margin-top:16px">The pin is exact: the census, GeoNames and OpenStreetMap all put Jambur here. Two notes on names. The census places Jambur in <strong>Kombo South</strong>, and so do the World Bank documents — some mapping services say Kombo North, and they are wrong. And the village appears elsewhere as <em>Jambour</em>, <em>Yambur</em> or <em>Jambor</em>; do not confuse it with Jambanjelly, a separate village of 5,285 people five kilometres down the same road.</p>`,
  near: [['Latriya', '2.0', 'latriya.html'], ['Mamuda', '3.7', 'mamuda.html'], ['Farato', '4.1', 'farato.html'], ['Busumbala', '4.2', 'busumbala.html'], ['Yundum', '4.6', 'yundum.html']],
  comp: ['Jambur', 'Latriya', 'Mamuda', 'Farato', 'Busumbala'],
});

AREAS.push({
  slug: 'ghana-town', label: 'Ghana Town', lat: 13.38444, lng: -16.77111, zoom: 14,
  sub: 'West Coast · Kombo North',
  verdict: 'A Ghanaian fishing settlement of about 865 people, hemmed in by the tourism zone — and where hundreds of residents are stateless',
  metaDesc: 'Ghana Town, Kombo North: a fishing village founded around 1960 by Ghanaian migrants, why its land cannot expand, what the statelessness assessment found, and what land costs at neighbouring Brufut.',
  ogDesc: 'A fishing village founded by Ghanaian migrants around 1960 — its land, its limits and its people.',
  schemaDesc: 'A guide to Ghana Town in Kombo North, The Gambia: how the settlement was founded, why its land cannot expand, and what land costs in the nearest measured area.',
  keywords: 'Ghana Town, Ghanatown Gambia, Brufut Ghana Town, fishing village Gambia, Kombo North land',
  tags: ['Kombo coast, next to Brufut', 'Founded around 1960 by Ghanaian fishers', '865 residents in 2013', 'Cannot expand — tourism zone', 'Statelessness documented', 'One listing, below our bar'],
  vibe: `<p>Ghana Town is a fishing settlement on the coast beside Brufut, and it is exactly what its name says. Around 1960 a group of <strong>36 Ghanaian fisherfolk</strong> from Akunfi Imuna, who had sailed to The Gambia and first settled at Bakau, were given ground here: the alkalo of Brufut, Kutubo Sanno, granted permission and his successor Kalifa Sanno oversaw the building. The 2013 census counts <strong>865 residents</strong>. Press reporting from 2024 puts it above 1,500 — but that is one newspaper's estimate, repeated by Wikipedia and GeoNames, so it is one source and not three.</p>
        <p style="margin-top:22px">This is not an ordinary plot market, and the page would be dishonest if it pretended otherwise. The settlement is densely built, it cannot grow seaward because that ground is Tourism Development Area, and the families who own the land around it do not allocate more. Very little changes hands. What is advertised here is housing at the Brufut end, not village plots.</p>`,
  knowHead: 'What to know before buying at Ghana Town',
  know: `<p>Two things define land here, and neither is a price.</p>
<p>The first is that <strong>there is nowhere to expand</strong>. The settlement is hemmed in on the seaward side by the Tourism Development Area, and the surrounding land belongs to families who do not allocate more of it. Reporting in 2024 records the consequence in plain terms: the village is short even of burial space. Anything advertised as "Ghana Town" that involves fresh plots is worth a hard look at which land it actually sits on, and whose.</p>
<p>The second is <strong>documented statelessness</strong>. In late October 2024 the Gambia Commission on Refugees, the Statelessness Focal Point of the Immigration Department and UNHCR ran a week-long assessment here. It found more than 600 residents at risk of statelessness: about 87% hold no foreign documentation, roughly 99% regard The Gambia as home, and 247 hold a valid or expired Gambian ID card. Identity documents issued under the previous government were withdrawn in 2019 and the replacements have remained pending. We record this because it bears directly on land: a seller's ability to prove who they are is not incidental to a transfer, and a buyer should expect documentation here to be harder, not easier. It is a matter of public record and of active government and UN attention, not a rumour.</p>
<p>Whatever you are shown, get the chain of title in writing and have a lawyer search it — see our <a href="guide-how-to-verify-land-title-in-the-gambia.html">guide to verifying land title</a> and <a href="guide-freehold-leasehold-customary-land-explained.html">freehold, leasehold and customary land explained</a>.</p>`,
  bronnen: [
    ['Population 865 (2013), Ghana Town, Kombo North — GBoS 2013 Directory of Settlements', 'https://www.gbosdata.org/downloads-file/7-census-2013-directory-of-settlement'],
    ['The founding of Ghana Town: 36 fisherfolk from Akunfi Imuna, and the alkalos who granted the land', 'https://www.gunjuronline.com/post/brufut-ghana-town-a-look-back-at-the-birth-of-a-little-slice-of-ghana-in-the-gambia'],
    ['No room to expand — the tourism zone seaward and landowners who will not allocate more — The Trumpet, November 2024', 'https://trumpet.gm/2024/11/05/ghana-town-offsprings-of-migrants-living-with-fear-of-statelessness/'],
    ['Assessment uncovers hundreds of stateless Ghana Town residents — Citizenship Rights in Africa', 'https://citizenshiprightsafrica.org/gambia-assessment-uncovers-hundreds-of-ghana-town-residents-stateless/'],
    ['Over 600 at risk; 247 hold a valid or expired ID — The Voice, December 2025', 'https://citizenshiprightsafrica.org/en/the-gambia-time-to-end-decades-of-statelessness-in-ghana-town/'],
    ['The Kombo coastal road and the resurfacing works listed for the Kololi–Ghana Town stretch — AccessGambia', 'https://www.accessgambia.com/information/kombo-coastal-rd.html'],
  ],
  ground: `<p>Ghana Town lies on the <strong>Kombo coastal road</strong>, the bituminised route that runs south from Greater Banjul through Kololi, Bijilo and Brufut to Tanji, Sanyang, Gunjur and Kartong. AccessGambia lists a resurfacing item for the stretch from Kololi up to Ghana Town, but gives no length, date or contractor, so we leave it at that. The 12 km Brufut–Madiana road opened in May 2026 runs inland from Brufut; Ghana Town is not named as a beneficiary in any of the reporting, and we are not going to imply that it is.</p>
<p style="margin-top:14px">On the ground: a mosque and at least one church, both led by people from the settlement; a school built by the community; and a fish smoking site, which is what the place lives on. Sources disagree on the number of churches — one account says one, another five — so we give neither as a fact. A concrete-walled well built by Brikama Area Council was opened in 1962. Health post, mains water and grid electricity: nothing we could source.</p>`,
  unknown: [
    'A land rate of its own. One priced listing is all we can see here; the figure above is Brufut’s, not Ghana Town’s.',
    'Health post, mains water and electricity — nothing we could source. Unknown, not absent.',
    'Rents — no rental listing we can verify.',
    'House prices — no local house listing we can verify; the figure above is land plus build cost.',
    'The current population. The census figure is from 2013; the 1,500 that circulates online is a single 2024 press estimate.',
    'Whether housing advertised as "Brufut Ghana Town" sits on village land or on Brufut land. That distinction matters here more than usual.',
  ],
  pinNote: `<p style="margin-top:16px">The pin is accurate to a few hundred metres: GeoNames and OpenStreetMap hold Ghana Town about 360 metres apart. The census lists it under <strong>Kombo North</strong>. The spelling <em>Ghanatown</em> is also in use. And a warning for anyone searching: the word "Ghana" pulls almost every result towards the country of that name, so coastal-erosion, fishmeal and land-dispute stories that look relevant are usually about somewhere else entirely — including Tanji, which has its own fishmeal controversy and is a different village.</p>`,
  near: [['Brufut', '2.1', 'brufut.html'], ['Madiana', '3.6', 'madiana.html'], ['Tanji', '4.1', 'tanji.html'], ['Tranquil', '4.1', 'tranquil.html'], ['Brusubi', '5.1', 'brusubi.html']],
  comp: ['Ghana Town', 'Brufut', 'Tanji', 'Brusubi', 'Bijilo'],
});

AREAS.push({
  slug: 'tintinto', label: 'Tintinto', lat: 13.29556, lng: -16.78861, zoom: 13,
  sub: 'West Coast · Kombo South',
  verdict: 'A hamlet of 218 on the coastal road, known mainly for a sand-mining operation the government said it would stop in 2022',
  metaDesc: 'Tintinto, Kombo South: a coastal hamlet of 218 people between Tanji and Tujereng, the 2022 sand-mining case in the tourism zone, and why two different places carry this name.',
  ogDesc: 'A hamlet of 218 on the Tanji–Tujereng coast, and the sand-mining case nobody reported the end of.',
  schemaDesc: 'A guide to Tintinto in Kombo South, The Gambia: where it actually is, the 2022 sand-mining case, and what land costs on the Tanji–Tujereng coast.',
  keywords: 'Tintinto, Tintinto Gambia, Tintinto sand mining, Kombo South, Tanji Tujereng coast',
  tags: ['Kombo South coast', '218 residents in 2013', 'On the Coastal Road', 'Sand mining reported in 2022', 'No listings we can price', 'Two places share this name'],
  vibe: `<p>Tintinto is small. The 2013 census counts <strong>218 residents</strong> — 86 of them women — which makes it a hamlet, not a village, and by some distance the smallest place MyKunda covers. It sits on the Kombo South coast between Tanji and Tujereng, about 330 metres off the Coastal Road.</p>
        <p style="margin-top:22px">It has a page here for one reason: in March 2022 the Minister of Tourism and Culture told a press conference that the government was aware of sand mining at Tintinto and that an inter-ministerial taskforce had visited the site. Sand mining in the coastal zone is one of the sharpest land questions on this stretch of the coast, and anyone looking at ground near here should know the case exists. What nobody has reported is how it ended.</p>`,
  knowHead: 'What to know before buying at Tintinto',
  know: `<p>On 1 March 2022, Hamat N.K. Bah, then Minister of Tourism and Culture, said at a press conference in Banjul that his ministry was aware of mining activity at <strong>Tintinto, Kombo South</strong> — a coastal village, along the <strong>Tourism Development Area</strong> — and that a government taskforce including the Office of the President had visited the site the previous Monday. He said the government was waiting for the taskforce's report before deciding what action to take. The Director General of the Gambia Tourism Board confirmed the high-level visit and said the situation could not be allowed to continue. Residents quoted in the same report named a mining company, Zinco, and said the work was being done without the villagers' approval.</p>
<p>That is the whole documented record. We searched The Point, Foroyaa, The Standard and Kerr Fatou: <strong>none of them has ever published an article mentioning Tintinto</strong>. So there is no source saying the taskforce reported, no source saying the mining stopped, and no source saying it continued. We are not going to guess in either direction. If you are looking at land anywhere along this stretch, treat the status of coastal sand extraction as an open question and ask specifically about it — including whether the parcel falls inside the Tourism Development Area, which changes what can be built and by whom.</p>
<p>As everywhere on this coast: get the chain of title in writing and have a lawyer search it. See our <a href="guide-how-to-verify-land-title-in-the-gambia.html">guide to verifying land title</a>.</p>`,
  bronnen: [
    ['Population 218 (2013), Tintinto, Kombo South — GBoS 2013 Directory of Settlements', 'https://www.gbosdata.org/downloads-file/7-census-2013-directory-of-settlement'],
    ['"Gov’t will soon stop sand mining at Tintinto" — The Voice, 1 March 2022', 'https://www.voicegambia.com/hamat-bah-govt-will-soon-stop-sand-mining-at-tintinto/'],
    ['Archived copy of the same report', 'http://web.archive.org/web/20230427011028/https://www.voicegambia.com/2022/03/01/hamat-bah-govt-will-soon-stop-sand-mining-at-tintinto/'],
    ['GeoNames record 2411768 — the gazetteer position we use', 'https://www.geonames.org/search.html?q=tintinto&country=GM'],
  ],
  ground: `<p>Tintinto lies roughly 330 metres from the <strong>Coastal Road</strong>, the tarred primary route between Tanji and Tujereng; the tracks that reach it are unclassified, one of them mapped as dirt. Tujereng is the nearest place we cover, 2.5 km south.</p>
<p style="margin-top:14px">Beyond that we have nothing. No school, health post, mosque, market, water supply or electricity connection at Tintinto appears in any register, press report or mapping dataset we could reach — which for a settlement of this size is not surprising, and is not the same as saying there is none.</p>`,
  unknown: [
    'Essentially everything on the ground: school, health post, mosque, water, electricity. Unknown, not absent.',
    'Land prices. Not one plot or house listing anywhere names Tintinto.',
    'Rents and house prices — nothing we can verify.',
    'Whether the sand mining reported in 2022 was stopped, continued, or licensed. No follow-up reporting exists.',
    'Whether the settlement falls inside or outside the Tourism Development Area boundary.',
    'The current population. The 218 is from 2013.',
  ],
  pinNote: `<p style="margin-top:16px"><strong>Two different places carry this name, ten kilometres apart, and we have deliberately chosen one.</strong> The pin above is the GeoNames record and matches the census entry for Kombo South, the coastal village the 2022 mining report describes. OpenStreetMap also holds a "Tintinto", five kilometres inland in Kombo North — but that node was placed in 2017 from aerial imagery during a water project, carries no source, and appears in no gazetteer and in no census. Where a mapping pin and two official registers disagree, we follow the registers. The pin is accurate to perhaps a kilometre: the GeoNames record dates from 1996 and nothing newer confirms it.</p>`,
  near: [['Tujereng', '2.5', 'tujereng.html'], ['Batokunku', '3.7', 'batokunku.html'], ['Sanyang', '4.5', 'sanyang.html'], ['Mamuda', '6.1', 'mamuda.html'], ['Jambanjelly', '6.8', 'jambanjelly.html']],
  comp: ['Tintinto', 'Tujereng', 'Batokunku', 'Sanyang', 'Tanji'],
});

AREAS.push({
  slug: 'tranquil', label: 'Tranquil', lat: 13.40306, lng: -16.73806, zoom: 14,
  sub: 'West Coast · Kombo North',
  verdict: 'A walled residential pocket beside Brusubi — expensive ground, and the thinnest price evidence on this site',
  metaDesc: 'Tranquil (Trankill) beside Brusubi, Kombo North: a residential area of walled compounds on the Bertil Harding Highway, 1,990 residents in the 2013 census, and why its land figure is the weakest we publish.',
  ogDesc: 'A residential pocket beside Brusubi — what the census calls Trankill, and why its price figure is so thin.',
  schemaDesc: 'A guide to Tranquil (census: Trankill) in Kombo North, The Gambia: where it sits, what the census records, and how thin the land price evidence is.',
  keywords: 'Tranquil Gambia, Trankill, Brusubi Tranquil, Kombo North land, Bertil Harding Highway',
  tags: ['Beside Brusubi', 'Walled residential compounds', '1,990 residents in 2013', 'Census name: Trankill', 'No listings we can price', 'Weakest price evidence on this site'],
  vibe: `<p>Tranquil is a residential pocket immediately south-west of Brusubi, in the wedge between the Bertil Harding Highway and the coastal road. The 2013 census records it as <strong>Trankill</strong>, with <strong>1,990 residents</strong> — smaller than Brusubi's 4,897 and a fraction of Sukuta's 47,048, but a real settlement, on the map since at least 2000 and not a developer's invention. It is walled compounds and quiet streets, with a handful of small guesthouses; the tourism sites that mention it describe it as away from the busy strip, which is roughly the point.</p>
        <p style="margin-top:22px">The price question here is uncomfortable and we would rather say so at the top. Tranquil is 900 metres from Brusubi, and Brusubi is expensive. But we have no listing in Tranquil itself, and even Brusubi's own figure rests on four advertisements — below our own bar of five. The number in the panel below is the thinnest kind of figure anywhere on this site.</p>`,
  knowHead: 'What to know before buying at Tranquil',
  know: `<p>We found <strong>no land dispute, eviction, demolition or court case naming Tranquil</strong> — none, in any Gambian outlet we searched. That is worth stating plainly, and it is also not a clean bill of health: it is a small place with almost no press footprint, so an absence of reporting is not evidence of an absence of trouble.</p>
<p>What does need care here is the name. The census and the gazetteer both spell it <strong>Trankill</strong>; property listings, hotels and residents write <strong>Tranquil</strong>; OpenStreetMap carries the Wolof form <em>Chankill</em> as well. Any title search, any land registry enquiry and any population lookup should be run on <em>Trankill</em>, not on the English-looking spelling — and a document that spells it one way while the registry holds the other is a discrepancy to resolve before money moves, not after.</p>
<p>There is also a second, unrelated "Tranquil" in the gazetteer, 27 kilometres south near Darsilami. And AccessGambia places Brusubi and Tranquil in Kombo South; the census puts both in Kombo North. Get the chain of title in writing and have a lawyer search it — see our <a href="guide-how-to-verify-land-title-in-the-gambia.html">guide to verifying land title</a>.</p>`,
  bronnen: [
    ['Population 1,990 (2013), listed as Trankill, Kombo North — GBoS 2013 Directory of Settlements', 'https://www.gbosdata.org/downloads-file/7-census-2013-directory-of-settlement'],
    ['GeoNames record 2411757, "Trankill", registered in 2000', 'https://www.geonames.org/search.html?q=Trankill&country=GM'],
    ['Brusubi / Tranquil accommodation — AccessGambia (note: gives the district as Kombo South, which the census contradicts)', 'https://www.accessgambia.com/hotels-brusubi-tranquil.html'],
    ['Booking.com maintains a city page under the spelling "Trankill"', 'https://www.booking.com/city/gm/trankill.html'],
  ],
  ground: `<p>Tranquil sits about 410 metres from the <strong>Coastal Road</strong> and 690 metres from the <strong>Bertil Harding Highway</strong>, with Brusubi Phase 1 some 900 metres to the south-east and Brufut Heights a kilometre to the west. Nominatim renders the address as "Tranquil, Sukuta, Kombo North".</p>
<p style="margin-top:14px">The only mapped facility close enough to be confidently inside Tranquil is a walled Sunni mosque, 82 metres from the pin. A language school carrying the local spelling, "Trankil academy", lies 800 metres to the south-west. Everything else people use — the NAWEC office, the Turntable market, the Brusubi Phase 1 market, the hospital, the schools — is in Brusubi, between 750 metres and 1.4 kilometres away. There is no mapped boundary for Tranquil, so how much of that neighbourhood counts as "here" is genuinely undefined.</p>`,
  unknown: [
    'Land prices. No listing in Tranquil itself, and the neighbour we borrow from has only four — read the panel above with that in mind.',
    'Where Tranquil ends. It has no mapped boundary, and "Brusubi Tranquil" is used loosely for an area covering several named places.',
    'School, health post, water supply and electricity specifically at Tranquil — nothing we could source separately from Brusubi.',
    'Rents — no rental listing we can verify.',
    'House prices — no local house listing we can verify; the figure above is land plus build cost.',
    'The origin of the name. No source explains it; the census spelling Trankill predates the English-looking one.',
  ],
  pinNote: `<p style="margin-top:16px">The pin is accurate to about half a kilometre: we use the GeoNames position for Trankill, and the OpenStreetMap node named Tranquil sits 430 metres north of it. We prefer the gazetteer here for a reason — that OSM node existed since 2015 under an entirely different name and was relabelled "Tranquil" by a single mapper in October 2025 on local knowledge. Do not confuse this place with the other Gambian "Tranquil" in the gazetteer, 27 km south near Darsilami.</p>`,
  near: [['Brusubi', '0.9', 'brusubi.html'], ['Bijilo', '2.2', 'bijilo.html'], ['Brufut', '2.8', 'brufut.html'], ['Salagi', '3.2', 'salagi.html'], ['Sukuta', '3.5', 'sukuta.html']],
  comp: ['Tranquil', 'Brusubi', 'Bijilo', 'Brufut', 'Sukuta'],
});

AREAS.push({
  slug: 'old-yundum', label: 'Old Yundum', lat: 13.3625, lng: -16.68611, zoom: 14,
  sub: 'West Coast · Kombo North',
  verdict: 'A town of 10,035 near the airport, with three sold-out estates behind it — and a cemetery that was sold as building plots',
  metaDesc: 'Old Yundum, Kombo North: a town of 10,035 in the 2013 census, the estates that sold out here, the 2018 cemetery land fraud, and why the airport belongs to New Yundum and not to this village.',
  ogDesc: 'A town of 10,035 near the airport — the estates, the cemetery case, and the New Yundum mix-up.',
  schemaDesc: 'A guide to Old Yundum in Kombo North, The Gambia: land prices in the Kombo band, the estates built here, and what to check before buying.',
  keywords: 'Old Yundum, Yundum Koto, Old Yundum land, Banjul airport, Kombo North land prices',
  tags: ['Kombo belt, Kombo North', '10,035 residents in 2013', 'Three estates, two sold out', 'Cemetery land fraud in 2018', 'Airport belongs to New Yundum', 'No listings we can price'],
  vibe: `<p>Old Yundum is a town, not a village. The 2013 census records it as <em>Yundum Koto (Old Yundum)</em> with <strong>10,035 residents</strong>, listed immediately beside its twin, Yundum Kuta (New Yundum), at 10,966. It has a primary and upper basic school, a senior secondary school, a lower basic school, a health centre, a market, mosques and a police station. It also gives its name to a National Assembly constituency, which is why "the Old Yundum lawmaker" turns up in the news rather more often than the town itself does.</p>
        <p style="margin-top:22px">For buyers it is developer country. Global Properties Africa has built and sold out two schemes here — one of 6.5 hectares with 106 plots of 20 × 20 m, another with plots of 25 × 20 m — and is now selling a third, a 202-unit gated development marketed on its distance from the airport. That is seller information, not an independent measurement, and it is the only price signal specific to Old Yundum we can see at all.</p>`,
  knowHead: 'What to know before buying at Old Yundum',
  know: `<p>In October 2018 the Chief of Kombo North, Momodu Bojang, publicly warned two men against selling <strong>cemetery land as residential plots</strong>. The ground belonged to the Sadingka community of Old Yundum; a Senegalese national had sold part of it to a buyer who resold it again. The Chief urged the community to fence the cemetery. Nobody in that chain necessarily knew what they were buying — which is the point. In a town where estates are being laid out over what was communal land, "the seller had papers" is where the check starts, not where it ends.</p>
<p>There is a second item we can see but cannot use. The Voice published a report headlined "Court Orders Eviction In Old Yundum Land Dispute" in April 2026. We could not retrieve the text — the site blocks automated access and there is no archived copy — so we will not describe a case we have not read. It is listed here so that you know it exists and can look it up yourself.</p>
<p>Beyond that: buying into a laid-out estate does not remove the title question, it moves it. Ask which land the scheme sits on, who sold it to the developer, and whether the layout has planning approval. See our <a href="guide-how-to-verify-land-title-in-the-gambia.html">guide to verifying land title</a>, <a href="guide-freehold-leasehold-customary-land-explained.html">freehold, leasehold and customary land explained</a>, and — because two of these schemes sell in instalments — <a href="guide-developer-financing-in-the-gambia.html">developer financing in The Gambia</a>.</p>`,
  bronnen: [
    ['Population 10,035 (2013), listed as Yundum Koto (Old Yundum), Kombo North — GBoS 2013 Directory of Settlements', 'https://www.gbosdata.org/downloads-file/7-census-2013-directory-of-settlement'],
    ['Chief Bojang warns two men against selling Old Yundum cemetery land as plots — The Voice, October 2018', 'https://www.voicegambia.com/2018/10/16/chief-bojang-warns-duo-against-land-fraud/'],
    ['Old Yundum school closed three days over smoke and odour from dumping at its perimeter — The Point, October 2019', 'https://thepoint.gm/africa/gambia/article/old-yundum-school-forced-to-temporary-close'],
    ['Free Mind Organisation at the Old Yundum Health Care Centre — The Point, 2017', 'https://thepoint.gm/africa/gambia/article/free-mind-organisation-operating-in-old-yundum-health-care-centre'],
    ['Old Yundum Senior Secondary School', 'https://oldyundumsss.com/'],
    ['"Old Yundum development": 6.5 ha, 106 plots of 20 × 20 m, listed as sold out — Global Properties Africa', 'https://www.globalpropertiesafrica.com/property/old-yundum-development'],
    ['"The Airport Residency at Old Yundum": 202 units, plots of 15 × 24 m — Global Properties Africa', 'https://www.globalpropertiesafrica.com/property/the-airport-residency-at-old-yundum'],
    ['Yundum is divided into New and Old; the airport is at New Yundum — Wikipedia', 'https://en.wikipedia.org/wiki/Yundum'],
  ],
  ground: `<p>Old Yundum sits in the Kombo belt between Jabang and Yundum, with Sinchu Alagie and Jabang both under two kilometres away. Developer material sells it on proximity — "two minutes from the coastal highway", "five minutes to Banjul International Airport" — but we could find no independent source naming a road project at Old Yundum, and no neutral source confirming which trunk road passes through it, so we leave those claims where they belong: with the seller.</p>
<p style="margin-top:14px">Documented on the ground: <strong>Old Yundum Primary and Upper Basic School</strong> (mapped in OpenStreetMap), <strong>Old Yundum Lower Basic School</strong>, <strong>Old Yundum Senior Secondary School</strong>, and the <strong>Old Yundum Health Care Centre</strong>, described in 2017 as a private or charitable facility with two doctors, two nurses and a laboratory. In October 2019 the basic school closed for three days over smoke and odour from refuse dumped along its perimeter — the alkalo, the VDC and Brikama Area Council were notified. A market, mosques and a police station appear in the mapping data. Mains water and grid electricity: only the developers claim them, so we do not.</p>`,
  unknown: [
    'Land prices. Not one priced plot listing in Old Yundum in the sources we measure — only developer asking prices for their own schemes, which are not an independent market.',
    'Rents — no rental listing we can verify.',
    'House prices — no local house listing we can verify; the figure above is land plus build cost.',
    'Mains water and grid electricity from any source other than estate marketing.',
    'The substance of the April 2026 eviction ruling reported by The Voice. We could not read the article.',
    'Whether the estates here hold gazetted layout approval.',
  ],
  pinNote: `<p style="margin-top:16px">The pin is accurate to roughly 600 metres — the gazetteer and OpenStreetMap disagree by about that much. One confusion is worth more than the rest: <strong>Old Yundum and New Yundum are two separate settlements of almost the same size</strong>, and the airport is at New Yundum. Estate marketing that sells "Old Yundum" on airport proximity is measuring a drive, not an address. Keep the constituency separate from the town as well — it covers a good deal more than this — and note that a "Daru Mbaine (Yundum)" of 194 people exists in North Bank Region, 200 kilometres away.</p>`,
  near: [['Sinchu Alagie', '1.8', 'sinchu-alagie.html'], ['Jabang', '1.8', 'jabang.html'], ['Yundum', '2.9', 'yundum.html'], ['Busumbala', '3.9', 'busumbala.html'], ['Salagi', '4.3', 'salagi.html']],
  comp: ['Old Yundum', 'Sinchu Alagie', 'Jabang', 'Yundum', 'Busumbala'],
});

/* ---------- schrijven ---------- */
let n = 0;
for (const a of AREAS) {
  const f = a.slug + '.html';
  let bestaat = true;
  try { await access(f); } catch { bestaat = false; }
  if (bestaat && !FORCE) { console.log(f.padEnd(20) + 'BESTAAT AL — overgeslagen (--force overschrijft)'); continue; }
  const html = pagina(a);
  if (WRITE) await writeFile(f, html);
  n++;
  console.log(f.padEnd(20) + (WRITE ? 'geschreven' : 'zou schrijven') + '  ' + html.length + ' tekens');
}
console.log('\n' + n + ' pagina(s). Daarna: node build-area-prices.mjs --write && node build.mjs');
if (!WRITE) console.log('Proefdraai — voeg --write toe.');
