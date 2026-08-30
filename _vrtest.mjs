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

console.log(fails ? '\n' + fails + ' test(s) mislukt.' : '\nAlle tests geslaagd.');
process.exit(fails ? 1 : 0);
