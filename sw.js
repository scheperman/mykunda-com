/* MyKunda service worker — tuned for high-latency 4G in The Gambia.

   Static assets : cache-first (instant repeat views, zero network).
   HTML          : stale-while-revalidate — the cached page paints immediately and
                   the fresh copy is fetched in the background for the next visit.
                   On a link with 200–400 ms round trips this is the difference
                   between "instant" and "a second of white screen" per tap.
   First visit   : network with a 6 s guard, then whatever is in cache. A stalled
                   4G socket no longer leaves the visitor on a blank page.
   Map tiles     : never cached here (external, volume too large). */
const V = 'mk-v115';
const STATIC = V + '-static';
const PAGES  = V + '-pages';
const MAX_PAGES = 60;

/* The shell every page needs. Precaching it means the second page a visitor
   opens costs one HTML request instead of four.

   The ?v= stamp MUST match the one in the <head> of the pages — a mismatch makes
   the browser treat the precached file as a different URL and the whole precache
   becomes dead weight. Do not edit STAMP by hand: run `node build.mjs` and it
   rewrites this line and every page from one source. */
const STAMP = '177835907043089';
const PRECACHE = [
  'styles.min.css?v=' + STAMP,
  'redesign.min.css?v=' + STAMP,
  'app.min.js?v=' + STAMP,
  /* De hele site staat in Mulish. Alleen de rechte snede staat hier: de cursieve
     is er voor accenten in koppen en font-display:swap vangt die vertraging op. */
  'fonts/mulish-var-latin.woff2',
  'images/mykunda-icon-sm.png'
];

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(STATIC)
      .then(c => Promise.all(PRECACHE.map(u => c.add(u).catch(()=>{}))))
      .then(()=>self.skipWaiting())
  );
});

self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys =>
    Promise.all(keys.filter(k => !k.startsWith(V)).map(k => caches.delete(k)))
  ).then(()=>self.clients.claim()));
});

/* .json staat er sinds 30-08-2026 bij vanwege gambia-osm.json, het straten- en
   plekkenregister. Zonder die extensie viel het in de HTML-tak: dan belandde een
   bestand van 120 kB in de paginacache en telde het mee voor MAX_PAGES, waardoor
   het echte pagina's uit de cache duwde. Het draagt de buildstempel in de URL,
   dus cache-first is veilig: een nieuw register krijgt een nieuwe URL. */
const isStatic = p => /\.(css|js|json|woff2?|webp|png|jpg|jpeg|svg|ico)$/i.test(p);

/* Signed-in pages are never cached: on a shared phone the next person must not
   be able to page back into someone else's dashboard, inbox or checkout. */
/* The extension is optional: the server serves these pages both as
   /dashboard.html and as /dashboard, and both must stay out of the cache. */
const isPrivate = p => /^\/?(admin|dashboard|messages|list|checkout|betaling-status|auth|rates|sources|title-verification)(\.html?)?$/i.test(p);

/* Keep the page cache from growing without bound on a phone with little storage. */
function trim(cacheName, max){
  caches.open(cacheName).then(c => c.keys().then(keys => {
    if(keys.length <= max) return;
    for(let i = 0; i < keys.length - max; i++) c.delete(keys[i]);
  }));
}

/* Never let a stalled socket hold the page hostage. */
function fetchWithTimeout(req, ms){
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error('timeout')), ms);
    fetch(req).then(r => { clearTimeout(t); resolve(r); },
                    e => { clearTimeout(t); reject(e); });
  });
}

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== location.origin) return;            // map tiles (mapbox/maptiler), APIs → straight to network
  if (url.pathname.startsWith('/api/')) return;
  if (isPrivate(url.pathname)) return;                   // signed-in pages: network only, never stored

  if (isStatic(url.pathname)) {
    e.respondWith(
      caches.match(req).then(hit => hit || fetch(req).then(res => {
        /* Klonen moet HIER gebeuren, niet in de .then van caches.open():
           die draait pas nadat de pagina het antwoord al aan het uitlezen is,
           en dan is de body op en gooit clone() een TypeError. */
        if (res.ok) { const copy = res.clone(); caches.open(STATIC).then(c => c.put(req, copy)); }
        return res;
      }))
    );
    return;
  }

  // HTML: serve the cached copy at once, refresh it in the background.
  e.respondWith(
    caches.match(req).then(hit => {
      const network = fetchWithTimeout(req, 6000).then(res => {
        if (res && res.ok) {
          const copy = res.clone();
          caches.open(PAGES).then(c => c.put(req, copy).then(()=>trim(PAGES, MAX_PAGES)));
        }
        return res;
      }).catch(() => hit || caches.match('/').then(r => r || caches.match('index.html')));
      if (hit) { e.waitUntil(network); return hit; }
      return network;
    })
  );
});
