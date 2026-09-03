/* Losse test voor renderBookings() en renderBuyerStats() uit dashboard.html.
   Ze zitten in een IIFE en zijn vanuit de pagina niet aan te roepen, dus de
   twee functies worden hier letterlijk uit het gebouwde bestand geknipt en in
   een eigen omhulsel uitgevoerd. Niets nagetypt: wat hier draait staat ook op
   de pagina. */
import { readFileSync } from 'node:fs';

const src = readFileSync('deploy/dashboard.html', 'utf8');

function grab(name){
  const start = src.indexOf('function ' + name + '(');
  if(start < 0) throw new Error('niet gevonden: ' + name);
  let depth = 0, i = src.indexOf('{', start);
  const open = i;
  for(; i < src.length; i++){
    if(src[i] === '{') depth++;
    else if(src[i] === '}'){ depth--; if(depth === 0) break; }
  }
  return src.slice(start, i + 1);
}

const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c =>
  ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

const t = n => new Date(Date.now() + n * 3600e3).toISOString();
let BOOKINGS = [], CONVOS = [], SAVED = [], FAVS = [];
const ssStats = () => null;

const make = new Function('esc', 'BOOKINGS', 'CONVOS', 'SAVED', 'FAVS', 'ssStats',
  grab('renderBookings') + '\n' + grab('renderBuyerStats') +
  '\nreturn { renderBookings, renderBuyerStats };');

function run(bookings){
  const el = { innerHTML: '' };
  const api = make(esc, bookings, CONVOS, SAVED, FAVS, ssStats);
  api.renderBookings(el);
  const stat = { innerHTML: '' };
  api.renderBuyerStats(stat);
  return { list: el.innerHTML, stats: stat.innerHTML };
}

let fails = 0;
function check(label, cond, extra){
  console.log((cond ? 'ok   ' : 'FOUT ') + label + (cond ? '' : '  ' + (extra || '')));
  if(!cond) fails++;
}

// 1. leeg
check('lege lijst geeft de lege staat', /No viewings booked/.test(run([]).list));

// 2. de koper moet kiezen
let r = run([{ status:'proposed', _mustRespond:true, _when:t(48), _listing_title:'Kololi villa' }]);
check('voorstel aan de koper wijst naar messages',
  /choose one in your messages/.test(r.list) && /messages\.html/.test(r.list), r.list);

// 3. koper wacht op de verkoper
r = run([{ status:'proposed', _mustRespond:false, _when:t(48), _listing_title:'Bijilo land' }]);
check('eigen voorstel toont "waiting for the seller"',
  /Waiting for the seller/.test(r.list) && !/messages\.html/.test(r.list), r.list);

// 4. bevestigd, met de tijd
r = run([{ status:'confirmed', _mustRespond:false, _when:t(20), _listing_title:'Senegambia office' }]);
check('bevestigd toont Confirmed en een tijd',
  /Confirmed/.test(r.list) && !/Waiting for a time/.test(r.list), r.list);

// 5. geen tijd bekend
r = run([{ status:'proposed', _mustRespond:false, _when:null, _listing_title:'Geen tijd' }]);
check('zonder tijd staat er "Waiting for a time"', /Waiting for a time/.test(r.list), r.list);

// 6. titels worden ontsmet
r = run([{ status:'confirmed', _mustRespond:false, _when:t(5), _listing_title:'<script>x</script>' }]);
check('titel wordt ontsmet', r.list.includes('&lt;script&gt;'), r.list);

// 7. de teller: alleen wat nog door kan gaan
r = run([
  { status:'confirmed', _mustRespond:false, _when:t(20),  _listing_title:'a' },  // telt
  { status:'proposed',  _mustRespond:true,  _when:t(48),  _listing_title:'b' },  // telt
  { status:'confirmed', _mustRespond:false, _when:t(-20), _listing_title:'c' },  // verleden
  { status:'cancelled', _mustRespond:false, _when:t(60),  _listing_title:'d' },  // afgezegd
  { status:'declined',  _mustRespond:false, _when:t(60),  _listing_title:'e' }   // afgewezen
]);
const num = (r.stats.match(/<div class="num">(\d+)<\/div><div class="lab">Viewings booked/) || [])[1];
check('teller telt alleen bevestigd/openstaand in de toekomst (2)', num === '2', 'gevonden: ' + num);

/* ---- De voet onder een advertentierij ------------------------------------
   listingFoot() en alles wat eraan hangt staat wél in de bovenste scope, maar
   leunt op een paar losse constanten. Daarom knippen we hier één aaneengesloten
   stuk bron uit, van de eerste constante tot aan listingRow(). Weer niets
   nagetypt. */
const footSrc = (() => {
  const a = src.indexOf('const warnIc=');
  const b = src.indexOf('function listingRow(l){');
  if(a < 0 || b < 0 || b < a) throw new Error('voetblok niet gevonden');
  return src.slice(a, b);
})();

const foot = new Function('vrEsc',
  footSrc + '\nreturn { listingFoot, nextAction, stepIndex, dbStatusOf, promoteHTML };')(esc);

function L(extra){
  return Object.assign({ _db:true, id:'L1', type:'sale', dbStatus:'active', review:'',
    photos:8, hasDesc:true, hasGeo:true, verified:true,
    boostedUntil:null, verifiedUntil:null }, extra || {});
}

// 8. de baan: waar staat hij
check('draft staat op stap 1',        /class="lstep now"><span class="d"><\/span>Draft/.test(foot.listingFoot(L({dbStatus:'draft'}))));
check('in review staat op stap 2',    /class="lstep now"><span class="d"><\/span>In review/.test(foot.listingFoot(L({dbStatus:'pending_review'}))));
check('actief staat op stap 3',       /class="lstep now"><span class="d"><\/span>Live/.test(foot.listingFoot(L({dbStatus:'active'}))));
check('verhuur eindigt op "Let"',     /Let<\/span>/.test(foot.listingFoot(L({type:'rent', dbStatus:'active'}))));
check('verkoop eindigt op "Sold"',    /Sold<\/span>/.test(foot.listingFoot(L({type:'sale', dbStatus:'active'}))));
check('afgekeurd heeft geen baan',    !/lsteps/.test(foot.listingFoot(L({dbStatus:'rejected', review:'Doc mismatch'}))));

// 9. de reden van afkeuring
let r9 = foot.listingFoot(L({dbStatus:'rejected', review:'The title document does not match the plot number'}));
check('reden staat er woordelijk in', r9.includes('does not match the plot number'), r9);
check('reden wordt ontsmet',
  foot.listingFoot(L({dbStatus:'rejected', review:'<script>x</script>'})).includes('&lt;script&gt;'));
check('zonder reden geen lege belofte',
  /No reason was recorded/.test(foot.listingFoot(L({dbStatus:'rejected', review:''}))));

// 10. één eerstvolgende stap, de eerste die van toepassing is
check('geen foto\'s wint van geen omschrijving',
  foot.nextAction(L({photos:0, hasDesc:false})).t === 'No photos yet.');
check('weinig foto\'s noemt het aantal',
  /Only 3 photos/.test(foot.nextAction(L({photos:3})).t));
check('één foto is enkelvoud',
  /Only 1 photo —/.test(foot.nextAction(L({photos:1})).t));
check('omschrijving voor kaart',
  /No description yet/.test(foot.nextAction(L({hasDesc:false, hasGeo:false})).t));
check('kaart voor documenten',
  /No location on the map/.test(foot.nextAction(L({hasGeo:false, verified:false})).t));
check('compleet meldt niets openstaands',
  foot.nextAction(L()).ok === true);
check('draft krijgt "Continue"', foot.nextAction(L({dbStatus:'draft'})).a === 'Continue');
check('in review krijgt geen knop', foot.nextAction(L({dbStatus:'pending_review'})).a === '');

// 11. de aftellers
const iso = n => new Date(Date.now() + n*86400e3).toISOString();
check('boost telt af',        /Boost runs for another 5 days/.test(foot.listingFoot(L({boostedUntil: iso(5)}))));
check('boost bijna om is amber', /lclock warn">Boost runs for another 2 days/.test(foot.listingFoot(L({boostedUntil: iso(2)}))));
check('verlopen boost is rood', /lclock gone">Boost ended/.test(foot.listingFoot(L({boostedUntil: iso(-3)}))));
check('verificatie zonder haast noemt alleen de datum',
  /Verified until [^<]*<\/span>/.test(foot.listingFoot(L({verifiedUntil: iso(200)}))) &&
  !/left/.test(foot.listingFoot(L({verifiedUntil: iso(200)}))));
check('verificatie binnen 30 dagen telt af',
  /days left/.test(foot.listingFoot(L({verifiedUntil: iso(12)}))));
check('geen datum, geen afteller', !/lclocks/.test(foot.listingFoot(L())));

// 12. plaatselijke terugval krijgt geen voet
check('rij zonder database krijgt geen voet', foot.listingFoot(L({_db:false})) === '');

/* ---- De Boost-knop op de advertentie zelf (01-09-2026) --------------------
   Een knop die geld kost mag alleen staan waar hij iets kan doen, en hij moet
   de advertentie meegeven — zonder listing_id zet een betaalde Boost nergens
   boosted_until. */
const P = extra => foot.promoteHTML(L(extra));
check('actieve advertentie krijgt een Boost-knop met de id',
  /Boost this listing/.test(P({price:3000000})) && /checkout\.html\?plan=boost&listing=L1/.test(P({price:3000000})));
check('een concept krijgt geen Boost-knop', P({dbStatus:'draft', price:3000000}) === '');
check('in beoordeling krijgt geen Boost-knop', P({dbStatus:'pending_review', price:3000000}) === '');
check('verkocht krijgt geen Boost-knop', P({dbStatus:'sold', price:3000000}) === '');
check('rij zonder database krijgt geen Boost-knop', P({_db:false, price:3000000}) === '');
check('lopende boost biedt verlengen aan',
  /Extend the Boost/.test(P({price:3000000, boostedUntil: iso(9)})) &&
  !/Boost this listing/.test(P({price:3000000, boostedUntil: iso(9)})));
check('verlopen boost biedt gewoon Boost aan',
  /Boost this listing/.test(P({price:3000000, boostedUntil: iso(-2)})));
check('verkoop zonder badge krijgt ook Verified',
  /plan=verified&listing=L1/.test(P({price:3000000, verified:false})));
check('verhuur krijgt nooit Verified',
  !/plan=verified/.test(P({type:'rent', price:25000, verified:false})));
check('verkoop zonder vraagprijs krijgt geen Verified',
  !/plan=verified/.test(P({price:0, verified:false})));
check('met badge geen tweede Verified',
  !/plan=verified/.test(P({price:3000000, verified:true})));
check('label zonder dbStatus wordt herkend', foot.dbStatusOf({ status:'In review' }) === 'pending_review');

/* ---- Boost: telt hij mee, en sorteert "Featured" er echt op? --------------
   mkIsBoosted() staat in app.js (de bron, niet de geminificeerde kopie), de
   sortering in search.html. Allebei uit het bestand geknipt in plaats van
   nagetypt, zodat de test meegaat als de code verandert. */
const appSrc = readFileSync('app.js', 'utf8');
const boostFn = (() => {
  const a = appSrc.indexOf('function mkIsBoosted(');
  if(a < 0) throw new Error('mkIsBoosted niet gevonden');
  let depth = 0, i = appSrc.indexOf('{', a);
  for(; i < appSrc.length; i++){
    if(appSrc[i] === '{') depth++;
    else if(appSrc[i] === '}'){ depth--; if(depth === 0) break; }
  }
  return appSrc.slice(a, i + 1);
})();
const mkIsBoosted = new Function(boostFn + '\nreturn mkIsBoosted;')();
/* Eén functie uit app.js knippen (mkWaNumber en waLinkTo, 03-09-2026). waLinkTo
   leunt op mkWaNumber, dus die gaat mee. */
function appFn(name){
  const cut = n => { const a = appSrc.indexOf('function ' + n + '('); if(a < 0) throw new Error(n + ' niet gevonden in app.js');
    let depth = 0, i = appSrc.indexOf('{', a); for(; i < appSrc.length; i++){ if(appSrc[i] === '{') depth++; else if(appSrc[i] === '}'){ depth--; if(depth === 0) break; } } return appSrc.slice(a, i + 1); };
  return new Function(cut('mkWaNumber') + '\n' + cut('waLinkTo') + '\nreturn ' + name + ';')();
}

/* ---- Het maandequivalent -------------------------------------------------
   Filteren en sorteren op huur gebeurt op één meetpunt, anders is een prijs
   per nacht niet te vergelijken met een maandbudget. Weer letterlijk uit
   app.js geknipt: de tabel én de functie. */
const maandFn = (() => {
  const a = appSrc.indexOf('const PRICE_PER_YEAR =');
  const b = appSrc.indexOf('function priceInner(');
  if(a < 0 || b < 0 || b < a) throw new Error('mkMonthlyPrice-blok niet gevonden in app.js');
  return appSrc.slice(a, b);
})();
const mkMonthlyPrice = new Function(maandFn + '\nreturn mkMonthlyPrice;')();
const rond = n => Math.round(n);
check('koop blijft de prijs zelf', mkMonthlyPrice({ type:'sale', price:3500000 }) === 3500000);
check('maandhuur blijft staan',   mkMonthlyPrice({ type:'rent', price:25000, price_period:'month' }) === 25000);
check('zonder periode geldt maand', mkMonthlyPrice({ type:'rent', price:25000 }) === 25000);
check('jaarhuur wordt door twaalf', rond(mkMonthlyPrice({ type:'rent', price:600000, price_period:'year' })) === 50000);
check('weekhuur telt op naar de maand', rond(mkMonthlyPrice({ type:'rent', price:6000, price_period:'week' })) === 26000);
check('nachtprijs telt op naar de maand', rond(mkMonthlyPrice({ type:'rent', price:2500, price_period:'night' })) === 76042);
check('onbekende periode valt terug op maand', mkMonthlyPrice({ type:'rent', price:25000, price_period:'fortnight' }) === 25000);
check('een jaarhuur valt binnen een maandbudget van 60k',
  mkMonthlyPrice({ type:'rent', price:600000, price_period:'year' }) <= 60000);
check('een vakantieflat per nacht valt er juist buiten',
  mkMonthlyPrice({ type:'rent', price:2500, price_period:'night' }) > 60000);

const searchSrc = readFileSync('search.html', 'utf8');
const sortBlok = (() => {
  const a = searchSrc.indexOf("if(s==='featured') r=[...r].sort(");
  if(a < 0) throw new Error('featured-sortering niet gevonden in search.html');
  const b = searchSrc.indexOf("if(s==='low')", a);
  return searchSrc.slice(a, b);
})();
const featuredSort = new Function('r', 's', 'mkIsBoosted', sortBlok + '\nreturn r;');

const dag = n => new Date(Date.now() + n*86400e3).toISOString();

check('lopende boost telt',        mkIsBoosted({ boosted_until: dag(3) }) === true);
check('verlopen boost telt niet',  mkIsBoosted({ boosted_until: dag(-1) }) === false);
check('geen datum telt niet',      mkIsBoosted({ boosted_until: null }) === false);
check('onzin telt niet',           mkIsBoosted({ boosted_until: 'later' }) === false);

const lijst = [
  { id:'a', verified:false, boosted_until:null },
  { id:'b', verified:true,  boosted_until:null },
  { id:'c', verified:false, boosted_until:dag(5) },   // lopende boost
  { id:'d', verified:false, boosted_until:dag(-5) },  // verlopen boost
  { id:'e', verified:true,  boosted_until:dag(2) }    // boost én verified
];
const gesorteerd = featuredSort(lijst, 'featured', mkIsBoosted).map(x => x.id);
// De twee met een lopende Boost staan vooraan; binnen die twee wint verified.
check('geboost staat bovenaan', gesorteerd.slice(0,2).sort().join(',')==='c,e', gesorteerd.join(','));
check('verified wint binnen de boosts', gesorteerd[0]==='e', gesorteerd.join(','));
check('daarna verified zonder boost',   gesorteerd[2]==='b', gesorteerd.join(','));
check('verlopen boost zakt naar de rest', gesorteerd.indexOf('d') > gesorteerd.indexOf('b'), gesorteerd.join(','));
check('rest houdt zijn volgorde', gesorteerd.indexOf('a') < gesorteerd.indexOf('d'), gesorteerd.join(','));
check('andere sortering blijft ongemoeid',
  featuredSort([...lijst], 'low', mkIsBoosted).map(x=>x.id).join(',') === 'a,b,c,d,e');

/* ---- Fase 5: pijplijn, portefeuille en statistiek -------------------------
   Weer één aaneengesloten stuk bron uit de gebouwde pagina, van LEAD_STAGES
   tot aan de routering. De functies die de DOM aanraken roepen we niet aan;
   de rekenende en tekenende functies wel. */
const proSrc = (() => {
  const a = src.indexOf('var LEAD_STAGES =');
  const b = src.indexOf("/* ---------- routering ---------- */");
  if(a < 0 || b < 0 || b < a) throw new Error('fase 5-blok niet gevonden');
  return src.slice(a, b);
})();

/* waLink() staat bij esc(), buiten het fase 5-blok; leadCard leunt erop
   sinds 03-09-2026. PRO bepaalt sindsdien welke knoppen de kaart krijgt. */
function makePro(state, PRO){
  const st = Object.assign({ LEADS:[], PORTFOLIO:[], VIEWINGS:[], VIEWDAYS:[], PAYMENTS:[],
    PF:{ status:'', kind:'', sel:{} } }, state||{});
  const fn = new Function('esc','ago','money','shortDate','statusFromDb','statusClass','emptyBox',
    'LEADS','PORTFOLIO','VIEWINGS','VIEWDAYS','PAYMENTS','PF','document','PRO',
    'mkWaNumber','waLinkTo',
    grab('leadWa') + '\n' + proSrc + '\nreturn { hoursTxt, median, leadCard, pfRows, viewsPerDay, agendaRow, leadWa };');
  return fn(esc,
    d => 'x ago',
    g => 'D' + Math.round(+g||0).toLocaleString('en-US'),
    iso => new Date(iso).toISOString().slice(0,10),
    s => ({active:'Active',draft:'Draft',pending_review:'In review',sold:'Sold'}[s]||s),
    s => s==='Active' ? 'active' : 'closed',
    () => '<div class="empty"></div>',
    st.LEADS, st.PORTFOLIO, st.VIEWINGS, st.VIEWDAYS, st.PAYMENTS, st.PF,
    { getElementById: () => null, querySelectorAll: () => [] }, PRO!==false,
    appFn('mkWaNumber'), appFn('waLinkTo'));
}

const pro = makePro();

// 13. reactietijd in woorden
check('minuten onder het uur',  pro.hoursTxt(0.5) === '30 min');
check('uren tot twee dagen',    pro.hoursTxt(6) === '6 h');
check('dagen daarboven',        pro.hoursTxt(72) === '3 d');
check('niets zonder waarde',    pro.hoursTxt(null) === '');

// 14. mediaan, en niets verzinnen als er niets te meten valt
check('mediaan van drie',       pro.median([1,5,100]) === 5);
check('mediaan van vier',       pro.median([2,4,6,8]) === 5);
check('lege reeks geeft null',  pro.median([null,undefined,NaN]) === null);

// 15. de leadkaart
const L1 = { id:'l1', stage:'new', name:'Fatou', message:'Kan ik dit zien?',
  _listing_title:'Kololi villa', _listing_area:'Kololi', created_at:new Date().toISOString(),
  source:'viewing', _reply_hours:null, note:null, lost_reason:null, email:'f@x.gm' };
let k = pro.leadCard(L1);
check('nieuwe lead krijgt de volgende stap', /data-stage="contacted"/.test(k));
check('nieuwe lead kan verloren',            /data-stage="lost"/.test(k));
check('nieuwe lead heeft geen Reopen',       !/Reopen/.test(k));
check('elk metablokje in een eigen span',    (k.match(/<div class="met">(.*?)<\/div>/)||['',''])[1].startsWith('<span>'), k);
check('geen reactietijd zonder stempel',     !/answered in/.test(k));

k = pro.leadCard(Object.assign({}, L1, { stage:'won' }));
check('gewonnen lead heeft geen volgende stap', !/data-stage="qualified"/.test(k) && !/→/.test(k));
check('gewonnen lead kan heropend',             /data-stage="new"/.test(k));

k = pro.leadCard(Object.assign({}, L1, { _reply_hours: 30 }));
check('trage reactie is rood', /class="slow">answered in 30 h/.test(k), k);
k = pro.leadCard(Object.assign({}, L1, { _reply_hours: 2 }));
check('snelle reactie is neutraal', /class="">answered in 2 h/.test(k));

k = pro.leadCard(Object.assign({}, L1, { name:'<script>x</script>', note:'<b>let op</b>' }));
check('naam en notitie worden ontsmet', k.includes('&lt;script&gt;') && k.includes('&lt;b&gt;'));

// 16. filters op de portefeuille
const PORT = [
  { id:'a', dbStatus:'active',         type:'sale' },
  { id:'b', dbStatus:'draft',          type:'sale' },
  { id:'c', dbStatus:'active',         type:'rent' },
  { id:'d', dbStatus:'pending_review', type:'rent' }
];
const alles = makePro({ PORTFOLIO: PORT }).pfRows().map(x=>x.id).join(',');
check('zonder filter alles', alles === 'a,b,c,d');
check('filter op status',
  makePro({ PORTFOLIO: PORT, PF:{status:'active',kind:'',sel:{}} }).pfRows().map(x=>x.id).join(',') === 'a,c');
check('filter op type',
  makePro({ PORTFOLIO: PORT, PF:{status:'',kind:'rent',sel:{}} }).pfRows().map(x=>x.id).join(',') === 'c,d');
check('twee filters samen',
  makePro({ PORTFOLIO: PORT, PF:{status:'active',kind:'rent',sel:{}} }).pfRows().map(x=>x.id).join(',') === 'c');

// 17. de reeks bezoeken per dag
const vandaag = new Date().toISOString().slice(0,10);
const gister  = new Date(Date.now()-86400e3).toISOString().slice(0,10);
const reeks = makePro({ VIEWDAYS:[{listing_id:'a',day:vandaag,views:5},{listing_id:'b',day:vandaag,views:2},{listing_id:'a',day:gister,views:3}] }).viewsPerDay(30);
check('reeks is dertig dagen lang', reeks.length === 30);
check('vandaag telt beide advertenties op', reeks[29].n === 7, JSON.stringify(reeks.slice(-2)));
check('gisteren klopt',                     reeks[28].n === 3);
check('een dag zonder bezoek is nul, geen gat', reeks[0].n === 0);

// 18. de agenda
const A = { _listing_title:'Kololi villa', _when:new Date(Date.now()+86400e3).toISOString(),
  status:'proposed', _mustRespond:true, _side:'seller' };
check('de bal bij jou staat er zo bij', /Waiting for your answer/.test(pro.agendaRow(A)));
check('op je eigen advertentie',        /on your listing/.test(pro.agendaRow(A)));
check('zonder tijd geen verzonnen tijd',
  /No time yet/.test(pro.agendaRow(Object.assign({}, A, { _when:null }))));


/* ============================================================
   19. Het bedrijfsprofiel — 02-09-2026
   Dezelfde aanpak als hierboven: de functies worden letterlijk uit de
   gebouwde bestanden geknipt, niet nagetypt. Wat hier draait staat ook
   op de pagina.
   ============================================================ */
function grabIn(text, name){
  const start = text.indexOf('function ' + name + '(');
  if(start < 0) throw new Error('niet gevonden: ' + name);
  let depth = 0, i = text.indexOf('{', start);
  for(; i < text.length; i++){
    if(text[i] === '{') depth++;
    else if(text[i] === '}'){ depth--; if(depth === 0) break; }
  }
  return text.slice(start, i + 1);
}
const propSrc  = readFileSync('deploy/property.html', 'utf8');
const adminSrc = readFileSync('deploy/admin.html', 'utf8');

/* --- 19a. het webadres zoals het dashboard het opschoont --- */
const web = new Function(
  grabIn(src, 'coNormWeb') + '\n' + grabIn(src, 'coWebOk') + '\n' + grabIn(src, 'coHost')
  + '\nreturn { coNormWeb, coWebOk, coHost };')();

check('leeg blijft leeg',              web.coNormWeb('') === '');
check('zonder schema komt https ervoor', web.coNormWeb('kombocoast.gm') === 'https://kombocoast.gm/');
check('http blijft http',              web.coNormWeb('http://kombocoast.gm') === 'http://kombocoast.gm/');
check('het pad blijft staan',          web.coNormWeb('https://kombocoast.gm/kantoor') === 'https://kombocoast.gm/kantoor');
check('leeg is geldig',                web.coWebOk('') === true);
check('een normaal adres is geldig',   web.coWebOk('https://kombocoast.gm') === true);
/* Dit was de vondst van 02-09-2026: "javascript:alert(1)" krijgt in
   coNormWeb https:// voor zich geplakt en kwam daarmee door een patroontoets
   die alleen naar het begin van de tekst keek. Nu moet er een echte hostnaam
   met een punt staan. */
check('javascript: komt er niet door', web.coWebOk(web.coNormWeb('javascript:alert(1)')) === false);
check('een naam zonder punt is geen host', web.coWebOk('https://javascript') === false);
check('losse tekst komt er niet door', web.coWebOk(web.coNormWeb('bel me maar')) === false);
check('alleen het domein in beeld',    web.coHost('https://www.kombocoast.gm/aanbod?p=1') === 'kombocoast.gm');
check('www valt weg',                  web.coHost('kombocoast.gm') === 'kombocoast.gm');
check('onzin geeft geen domein',       web.coHost('bel me maar') === '');

/* --- 19b. dezelfde beoordeling op de advertentiepagina --- */
const pub = new Function(
  grabIn(propSrc, 'agencyUrl') + '\n' + grabIn(propSrc, 'agencyHostOf')
  + '\nreturn { agencyUrl, agencyHostOf };')();

check('zonder website geen link',      pub.agencyUrl({}) === '');
check('zonder schema geen link',       pub.agencyUrl({ website:'kombocoast.gm' }) === '');
check('javascript: geeft geen link',   pub.agencyUrl({ website:'javascript:alert(1)' }) === '');
check('data: geeft geen link',         pub.agencyUrl({ website:'data:text/html,<script>' }) === '');
check('een https-adres geeft een link',
  pub.agencyUrl({ website:'https://kombocoast.gm/' }) === 'https://kombocoast.gm/');
check('de linktekst is het domein',
  pub.agencyHostOf({ website:'https://www.kombocoast.gm/aanbod' }) === 'kombocoast.gm');

/* --- 19c. de regel in het beheerderspaneel --- */
/* agencyLogoUrl komt uit supabase.js en praat met de opslag; hier een stand-in
   die alleen het pad teruggeeft, want wat getest wordt is de regel zelf. */
const adm = new Function('esc', 'agencyLogoUrl',
  grabIn(adminSrc, 'agencyLine') + '\nreturn agencyLine;')(esc, p => 'https://opslag/' + p);

check('een particuliere advertentie krijgt geen regel', adm({ agency:null }) === '');
check('zonder logo staat er dat er geen logo is',
  /geen logo/.test(adm({ agency:{ name:'Kombo Coast', website:'https://kombocoast.gm' } })));
check('de website staat er letterlijk bij',
  /kombocoast\.gm/.test(adm({ agency:{ name:'Kombo Coast', website:'https://kombocoast.gm' } })));
check('zonder website zegt hij dat ook',
  /geen website opgegeven/.test(adm({ agency:{ name:'Kombo Coast' } })));
check('een niet-gecontroleerd kantoor staat er als niet-gecontroleerd',
  /niet gecontroleerd/.test(adm({ agency:{ name:'Kombo Coast' } })));
check('met logo staat er een afbeelding',
  /<img src="https:\/\/opslag\/abc\/logo\.png"/.test(adm({ agency:{ name:'Kombo Coast', logo_path:'abc/logo.png' } })));
/* Een naam met aanhalingstekens mag het attribuut niet openbreken. */
check('de naam wordt ontsmet',
  !/<b>Kombo "<\/b>/.test(adm({ agency:{ name:'Kombo "Coast' } })) &&
  /&quot;/.test(adm({ agency:{ name:'Kombo "Coast' } })));

/* ---- 03-09-2026: contact op de leadkaart, de particuliere variant, en de
   knoppen onder een eigen advertentie ---- */
const L2 = Object.assign({}, L1, { phone:'+220 700 1234' });
k = pro.leadCard(L2);
check('WhatsApp-knop met landcode',      /https:\/\/wa\.me\/2207001234\?text=/.test(k), k);
check('Bel-knop',                        /href="tel:/.test(k));
check('E-mailknop met onderwerp',        /mailto:f@x\.gm\?subject=/.test(k));
check('nummer staat leesbaar op de kaart', /\+220 700 1234/.test(k));
check('zonder nummer geen WhatsApp',     !/wa\.me/.test(pro.leadCard(L1)));
check('lokaal nummer krijgt 220',        pro.leadWa('7001234') === 'https://wa.me/2207001234');
check('00-prefix wordt gestript',        pro.leadWa('00220 700 1234','hi') === 'https://wa.me/2207001234?text=hi');
check('te kort nummer geeft niets',      pro.leadWa('12') === '');

const part = makePro({}, false);
k = part.leadCard(L2);
check('particulier: "I have replied" in plaats van trechter', /I have replied/.test(k) && !/→ Contacted/.test(k));
check('particulier: Close in plaats van Lost',              /data-stage="lost">Close</.test(k));
check('particulier: gesloten lead kan heropend',            /Reopen/.test(part.leadCard(Object.assign({}, L2, { stage:'lost' }))));

const toolsSrc = grab('listingTools') + '\n' + grab('fmtPriceText');
const tools = new Function('vrEsc','dbStatusOf','fmtPrice','document',
  toolsSrc + '\nreturn listingTools;')(esc, l => l.dbStatus, () => '<b>D1,000</b>',
  { createElement: () => { const o = { innerHTML:'' }; Object.defineProperty(o,'textContent',{ get(){ return o.innerHTML.replace(/<[^>]+>/g,''); } }); return o; } });
let tt = tools({ _db:true, id:'abc', dbStatus:'active', type:'sale', title:'Villa', price:1000 });
check('live verkoop: delen, verkocht, onder bod, van de markt', /wa\.me\/\?text=/.test(tt) && /data-to="sold"/.test(tt) && /data-to="under_offer"/.test(tt) && /data-to="archived"/.test(tt));
check('deeltekst bevat titel, prijs en link', /Villa%20%E2%80%94%20D1%2C000/.test(tt) && /property\.html%3Fid%3Dabc/.test(tt), tt);
tt = tools({ _db:true, id:'abc', dbStatus:'active', type:'rent', title:'Flat', price:1000 });
check('live verhuur: "Mark as let"', /data-to="let"/.test(tt) && !/data-to="sold"/.test(tt));
tt = tools({ _db:true, id:'abc', dbStatus:'under_offer', type:'sale', title:'Villa', price:1000 });
check('onder bod: bod vervallen in plaats van onder bod', /Offer fell through/.test(tt) && !/data-to="under_offer"/.test(tt));
tt = tools({ _db:true, id:'abc', dbStatus:'sold', type:'sale', title:'Villa', price:1000 });
check('verkocht: alleen terug op de markt', /data-to="active"/.test(tt) && !/wa\.me/.test(tt));
check('concept: geen knoppen',        tools({ _db:true, id:'abc', dbStatus:'draft', type:'sale' }) === '');
check('in beoordeling: geen knoppen', tools({ _db:true, id:'abc', dbStatus:'pending_review', type:'sale' }) === '');
check('lokale terugval: geen knoppen', tools({ id:'abc', dbStatus:'active', type:'sale' }) === '');

/* ---- 21. leadfilter en aandachtstrook (03-09-2026) ---- */
{
  const lfSrc = grab('leadMatches') + '\n' + grab('leadRows') + '\n' + grab('renderAttention');
  const leadsA = [
    { id:'a', listing_id:'L1', _listing_title:'Villa Bijilo', name:'Fatou Ceesay', phone:'+2207111111', stage:'new', created_at:t(-3) },
    { id:'b', listing_id:'L2', _listing_title:'Flat Kololi', name:'Sarah Mitchell', email:'s@x.uk', stage:'contacted', created_at:t(-30) },
    { id:'c', listing_id:'L1', _listing_title:'Villa Bijilo', name:'Awa Njie', stage:'lost', created_at:t(-200), note:'wanted pets' }
  ];
  const mk = (LF, LEADS, VIEWINGS, CONVOS, PORTFOLIO, PRO) => {
    const el = { hidden:true, innerHTML:'', className:'' };
    const doc = { getElementById: id => id==='attn' ? el : null };
    const api = new Function('LF','LEADS','VIEWINGS','CONVOS','PORTFOLIO','PRO','esc','document',
      lfSrc + '\nreturn { leadRows, renderAttention };')(LF, LEADS, VIEWINGS, CONVOS, PORTFOLIO, PRO, esc, doc);
    return { api, el };
  };
  let r = mk({ listing:'', q:'', stage:'' }, leadsA, [], [], [], true);
  check('leadfilter: leeg filter geeft alles', r.api.leadRows().length === 3);
  r = mk({ listing:'L1', q:'', stage:'' }, leadsA, [], [], [], true);
  check('leadfilter: per advertentie', r.api.leadRows().map(l=>l.id).join() === 'a,c');
  r = mk({ listing:'', q:'sarah', stage:'' }, leadsA, [], [], [], true);
  check('leadfilter: zoeken op naam', r.api.leadRows().map(l=>l.id).join() === 'b');
  r = mk({ listing:'', q:'7111', stage:'' }, leadsA, [], [], [], true);
  check('leadfilter: zoeken op nummer', r.api.leadRows().map(l=>l.id).join() === 'a');
  r = mk({ listing:'', q:'pets', stage:'' }, leadsA, [], [], [], true);
  check('leadfilter: zoeken in de notitie', r.api.leadRows().map(l=>l.id).join() === 'c');
  r = mk({ listing:'L1', q:'sarah', stage:'' }, leadsA, [], [], [], true);
  check('leadfilter: advertentie én zoekwoord samen', r.api.leadRows().length === 0);

  r = mk({}, leadsA, [{ _mustRespond:true, _side:'seller' }, { _mustRespond:true, _side:'buyer' }], [{ _unread:2 }],
         [{ dbStatus:'rejected' }, { dbStatus:'draft' }, { dbStatus:'active', mandateEnds: new Date(Date.now()+10*86400e3).toISOString() }], true);
  r.api.renderAttention();
  check('aandacht: strook zichtbaar', r.el.hidden === false && r.el.className === 'attn');
  check('aandacht: 1 wachtende lead', /<span class="k">1<\/span><span class="t">enquiry waiting/.test(r.el.innerHTML));
  check('aandacht: alleen bezichtigingen aan de verkoperskant', /<span class="k">1<\/span><span class="t">viewing request to answer/.test(r.el.innerHTML));
  check('aandacht: ongelezen berichten naar messages.html', /href="messages.html"><span class="k">2<\/span>/.test(r.el.innerHTML));
  check('aandacht: afgekeurd en concept', /listing sent back to you/.test(r.el.innerHTML) && /draft not sent in yet/.test(r.el.innerHTML));
  check('aandacht: mandaat binnen 30 dagen (PRO)', /mandate ends within 30 days/.test(r.el.innerHTML) && /href="#portfolio"/.test(r.el.innerHTML));
  check('aandacht: PRO-tekst zegt Contacted', /move the lead to Contacted/.test(r.el.innerHTML));
  r = mk({}, leadsA, [], [], [{ dbStatus:'active', mandateEnds: new Date(Date.now()+10*86400e3).toISOString() }], false);
  r.api.renderAttention();
  check('aandacht: particulier ziet geen mandaat en wel "I have replied"', !/mandate/.test(r.el.innerHTML) && /I have replied/.test(r.el.innerHTML));
  r = mk({}, [{ stage:'contacted' }], [], [], [{ dbStatus:'active' }], true);
  r.api.renderAttention();
  check('aandacht: niets te doen → strook verborgen en leeg', r.el.hidden === true && r.el.innerHTML === '');
}

console.log(fails ? '\n' + fails + ' test(s) mislukt.' : '\nAlle tests geslaagd.');
process.exit(fails ? 1 : 0);
