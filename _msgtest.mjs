/* Losse test voor de bezichtigingskaarten in messages.html (03-09-2026).
   Zelfde aanpak als _vrtest.mjs: de functies worden letterlijk uit het
   gebouwde bestand geknipt, niets nagetypt. Getest wordt hoe een rij uit
   `viewings` plus het bijbehorende bericht een kaart wordt, en wie de
   knoppen krijgt. */
import { readFileSync } from 'node:fs';

const src = readFileSync('deploy/messages.html', 'utf8');
function grab(name){
  const start = src.indexOf('function ' + name + '(');
  if(start < 0) throw new Error('niet gevonden: ' + name);
  let depth = 0, i = src.indexOf('{', start);
  for(; i < src.length; i++){
    if(src[i] === '{') depth++;
    else if(src[i] === '}'){ depth--; if(depth === 0) break; }
  }
  return src.slice(start, i + 1);
}
const consts = src.match(/const VW_RE = [^\n]+/)[0];
const code = [consts, grab('esc'), grab('vwParse'), grab('vwStrip'), grab('slotLabel'),
  grab('fmtTm'), grab('fmtSlot'), grab('resolveProposals'), grab('mapDbMsg'), grab('proposeCardHTML')].join('\n');

const ME = 'me-uuid', OTHER = 'other-uuid';
const make = new Function('_myUserId', 'ICON', 'role', code + '\nreturn { mapDbMsg, proposeCardHTML, resolveProposals };');
const api = make(ME, { check:'[check]' }, 'seller');

let n = 0, bad = 0;
function ok(cond, label){ n++; if(cond){ console.log('ok   ' + label); } else { bad++; console.log('FOUT ' + label); } }

const t1 = new Date(Date.now() + 26*3600e3).toISOString();
const t2 = new Date(Date.now() + 50*3600e3).toISOString();
const vBase = { id:'v1', conversation_id:'c1', proposer_id: OTHER, invitee_id: ME, status:'proposed', slots:[t1,t2], chosen_slot:null, note:'Bring the title copy', message_id:'m1', cancel_reason:null };
const mProp = { id:'m1', sender_id: OTHER, body:'Proposed viewing times: …', created_at:t1, read_at:null, viewing_id:'v1' };

/* 1. Ik ben de uitgenodigde: kaart met Choose-knoppen en de afwijs-knop */
{
  const by = { v1: vBase };
  const msgs = [api.mapDbMsg(mProp, by)];
  api.resolveProposals(msgs);
  const m = msgs[0];
  ok(m.f==='propose' && m._db===true && m._vid==='v1', 'DB-voorstel wordt een propose-kaart met _vid');
  ok(m.canPick===true && m.mine===false, 'uitgenodigde mag kiezen');
  ok(m.slots.length===2 && m.slots[0].iso===t1 && /·/.test(m.slots[0].label), 'twee tijden met iso en label');
  const html = api.proposeCardHTML(m, 0);
  ok((html.match(/pickSlot\(0,\d\)/g)||[]).length===2, 'twee Choose-knoppen');
  ok(/declineSlots\(0\)/.test(html), 'afwijzen aanwezig');
  ok(/Bring the title copy/.test(html), 'de notitie van de aanvrager staat op de kaart');
  ok(/Pick one that suits you/.test(html), 'kop voor de kiezer');
}
/* 2. Ik deed het voorstel zelf: alleen-lezen */
{
  const v = Object.assign({}, vBase, { proposer_id: ME, invitee_id: OTHER });
  const m = api.mapDbMsg(Object.assign({}, mProp, { sender_id: ME }), { v1: v });
  const html = api.proposeCardHTML(m, 0);
  ok(m.mine===true && m.canPick===false, 'eigen voorstel: niet kiezen');
  ok(!/pickSlot/.test(html) && /Waiting for a choice/.test(html), 'geen knoppen, wachttekst');
}
/* 3. Bevestigd */
{
  const v = Object.assign({}, vBase, { status:'confirmed', chosen_slot: t2 });
  const m = api.mapDbMsg(mProp, { v1: v });
  const html = api.proposeCardHTML(m, 0);
  ok(m.status==='accepted' && /Viewing confirmed/.test(html) && !/pickSlot/.test(html), 'bevestigde rij toont de gekozen tijd zonder knoppen');
  ok(html.indexOf(m.chosen)>-1, 'gekozen tijd staat erin');
}
/* 4. Afgewezen, vervangen, afgezegd */
{
  const d = api.proposeCardHTML(api.mapDbMsg(mProp, { v1: Object.assign({}, vBase, { status:'declined' }) }), 0);
  ok(/None of these worked/.test(d) && /You asked for other times/.test(d), 'afgewezen door mij → "You asked for other times"');
  const d2 = api.proposeCardHTML(api.mapDbMsg(Object.assign({}, mProp, { sender_id: ME }), { v1: Object.assign({}, vBase, { status:'declined', proposer_id: ME, invitee_id: OTHER }) }), 0);
  ok(/Other times were requested/.test(d2), 'afgewezen door de ander → "Other times were requested"');
  const s = api.proposeCardHTML(api.mapDbMsg(mProp, { v1: Object.assign({}, vBase, { status:'cancelled', cancel_reason:'superseded' }) }), 0);
  ok(/Replaced by newer times/.test(s), 'superseded → vervangen');
  const c = api.proposeCardHTML(api.mapDbMsg(mProp, { v1: Object.assign({}, vBase, { status:'cancelled', cancel_reason:null }) }), 0);
  ok(/Viewing cancelled/.test(c) && !/pickSlot/.test(c), 'afgezegd → geen knoppen');
}
/* 5. Het antwoordbericht (viewing_id maar niet message_id) wordt een systeemregel */
{
  const by = { v1: vBase };
  const r1 = api.mapDbMsg({ id:'m2', sender_id: ME, body:'Viewing confirmed: Thu 04 Sep · 10:00', created_at:t1, viewing_id:'v1' }, by);
  ok(r1.f==='sys' && r1.t==='Viewing confirmed: Thu 04 Sep · 10:00', 'bevestiging als systeemregel');
  const r2 = api.mapDbMsg({ id:'m3', sender_id: ME, body:'None of those times work — could you suggest a few others?', created_at:t1, viewing_id:'v1' }, by);
  ok(r2.f==='sys' && r2.t==='You asked for other times', 'eigen afwijzing → "You asked for other times"');
  const r3 = api.mapDbMsg({ id:'m3', sender_id: OTHER, body:'None of those times work — could you suggest a few others?', created_at:t1, viewing_id:'v1' }, by);
  ok(r3.t==='Other times were requested', 'afwijzing van de ander');
}
/* 6. Zonder bijbehorende rij (nog niet ingelezen) blijft het een gewone bubbel, geen crash */
{
  const m = api.mapDbMsg(mProp, {});
  ok(m.f==='sys' && /Proposed viewing times/.test(m.t), 'rij onbekend → systeemregel met de tekst, geen fout');
  const m2 = api.mapDbMsg({ id:'m9', sender_id: OTHER, body:'Hello', created_at:t1 }, undefined);
  ok(m2.f==='them' && m2.t==='Hello', 'gewoon bericht ongewijzigd');
}
/* 7. Oude tag-vorm wordt nog gelezen */
{
  const m = api.mapDbMsg({ id:'m5', sender_id: OTHER, body:'Proposed viewing times: x [[mk:v1|{"k":"vprop","slots":[{"iso":"'+t1+'","label":"L"}]}]]', created_at:t1 }, {});
  ok(m.f==='propose' && !m._db && m.slots.length===1, 'legacy tag → kaart zonder _db');
}
console.log('\n' + (bad ? bad + ' van ' + n + ' MISLUKT' : 'Alle ' + n + ' tests geslaagd.'));
process.exit(bad ? 1 : 0);
