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
  footSrc + '\nreturn { listingFoot, nextAction, stepIndex, dbStatusOf };')(esc);

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
check('label zonder dbStatus wordt herkend', foot.dbStatusOf({ status:'In review' }) === 'pending_review');

console.log(fails ? '\n' + fails + ' test(s) mislukt.' : '\nAlle tests geslaagd.');
process.exit(fails ? 1 : 0);
