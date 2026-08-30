/* ============================================================
   MyKunda — Supabase client + backend helpers (Phase 1)
   ------------------------------------------------------------
   Load BEFORE app.js on every page:
     <script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2"></script>
     <script src="supabase.js"></script>
     <script src="app.js"></script>

   Fill in the two values below with YOUR project's keys
   (Supabase dashboard → Project Settings → API).
   The anon key is safe to expose in frontend code; RLS protects data.
   ============================================================ */

const MYKUNDA_SUPABASE_URL  = "https://jejaerpqltqryqzjvbjp.supabase.co";
const MYKUNDA_SUPABASE_ANON = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImplamFlcnBxbHRxcnlxemp2YmpwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODE2MTg0MTQsImV4cCI6MjA5NzE5NDQxNH0.PhsM5IGMIY_VOl1eleQyoUJeYB4VoEHUpJtlLxpj7hA";

// Create the client if the library is present; otherwise run in "demo mode"
// so the existing prototype still works before the backend is connected.
let sb = null;
(function(){
  try{
    if (window.supabase && MYKUNDA_SUPABASE_URL.indexOf('YOUR-PROJECT') === -1) {
      sb = window.supabase.createClient(MYKUNDA_SUPABASE_URL, MYKUNDA_SUPABASE_ANON);
    }
  }catch(e){ console.warn('Supabase init skipped:', e); }
})();

/* Is the backend live? Pages use this to decide DB vs. local-demo behaviour. */
function backendReady(){ return !!sb; }

/* ---------------- Auth ---------------- */
async function signUpEmail(email, password, meta){
  if(!sb) throw new Error('backend-offline');
  return sb.auth.signUp({ email, password, options:{ data: meta || {} } });
}
async function signInEmail(email, password){
  if(!sb) throw new Error('backend-offline');
  return sb.auth.signInWithPassword({ email, password });
}
// Sends a 6-digit OTP to a phone. channel: 'whatsapp' (default) or 'sms'.
// WhatsApp is the primary channel in The Gambia — it rides on data instead of
// international SMS routes, which are slower, pricier and less reliable to +220.
// Requires Twilio (or Twilio Verify) as the Supabase SMS provider with the
// WhatsApp channel enabled in the Supabase dashboard.
async function signInPhone(phone, channel, meta){
  if(!sb) throw new Error('backend-offline');
  return sb.auth.signInWithOtp({ phone, options:{ channel: channel || 'whatsapp', data: meta || {} } });
}
async function verifyPhone(phone, token){
  if(!sb) throw new Error('backend-offline');
  // type stays 'sms' for both channels — the channel only affects delivery
  return sb.auth.verifyOtp({ phone, token, type:'sms' });
}
async function signInEmailOtp(email, meta){   // sends a 6-digit code (or magic link) by email
  if(!sb) throw new Error('backend-offline');
  return sb.auth.signInWithOtp({ email, options:{ data: meta || {}, shouldCreateUser: true } });
}
async function verifyEmailOtp(email, token, type){
  if(!sb) throw new Error('backend-offline');
  const tries = [type, 'email', 'magiclink', 'signup'].filter((t,i,a)=>t && a.indexOf(t)===i);
  let last;
  for(const t of tries){
    const res = await sb.auth.verifyOtp({ email, token, type: t });
    if(!res.error) return res;
    last = res;
    // a wrong code is a wrong code — only a type mismatch is worth retrying
    if(!/token|type|invalid/i.test(String(res.error.message||''))) break;
  }
  return last;
}
async function signOut(){ 
  if(sb) try{ await sb.auth.signOut(); }catch(e){ console.warn('signOut:',e); }
  try{ localStorage.removeItem('mykunda_admin'); }catch(e){}
  try{ localStorage.removeItem('mykunda_user'); }catch(e){}
  if(typeof clearUser==='function') clearUser();
}
async function currentUser(){
  if(!sb) return null;
  const { data } = await sb.auth.getUser();
  return data ? data.user : null;
}
async function currentProfile(){
  if(!sb) return null;
  const u = await currentUser();
  if(!u) return null;
  const { data } = await sb.from('profiles').select('*').eq('id', u.id).single();
  // cache admin status for header rendering
  if(data && data.role === 'admin'){
    try{ localStorage.setItem('mykunda_admin','1'); }catch(e){}
  }
  return data;
}
/* Quick sync check for header rendering (no API call) */
function isLocalAdmin(){
  try{ return localStorage.getItem('mykunda_admin')==='1'; }catch(e){ return false; }
}

/* The cached name can be older than the real one: an early sign-in derived it
   from the email address ("edwinscheperman@gmail.com" -> "Edwinscheperman"),
   and everything that greets by first name then has no space to split on. The
   session carries the name the user actually gave, so we heal the cache from
   it. getSession reads local storage — no network call. */
async function syncCachedUserName(){
  if(!sb) return;
  let cached=null;
  try{ cached = JSON.parse(localStorage.getItem('mykunda_user')||'null'); }catch(e){}
  if(!cached) return;
  let u=null;
  try{ const { data } = await sb.auth.getSession(); u = data && data.session ? data.session.user : null; }catch(e){ return; }
  if(!u) return;
  const meta = u.user_metadata || {};
  let real = String(meta.full_name || meta.name || '').trim();
  /* Older accounts kept the name only in profiles. One indexed lookup, and
     only when the session itself carries nothing. */
  if(!real){
    try{
      const { data: p } = await sb.from('profiles').select('full_name').eq('id', u.id).single();
      real = String((p && p.full_name) || '').trim();
    }catch(e){ /* offline or blocked by RLS — leave the cache as it is */ }
  }
  if(!real || real === cached.name) return;
  cached.name = real;
  if(!cached.email && u.email) cached.email = u.email;
  try{ localStorage.setItem('mykunda_user', JSON.stringify(cached)); }catch(e){}
  /* The header was already drawn with the old name — correct it in place. */
  const first = real.split(/\s+/)[0];
  document.querySelectorAll('.user-chip').forEach(function(chip){
    chip.title = real;
    const nm = chip.querySelector('.user-name'); if(nm) nm.textContent = first;
    const av = chip.querySelector('.user-av');
    if(av) av.textContent = (typeof initials==='function') ? initials(real) : first.charAt(0).toUpperCase();
  });
  const wn = document.getElementById('welcomeName');
  if(wn) wn.textContent = 'Welcome back, ' + first;
  try{ document.dispatchEvent(new CustomEvent('mk:user-updated',{ detail: cached })); }catch(e){}
}
/* One tick after DOMContentLoaded: app.js draws the header in its own
   listener, and we want to correct what it drew, not race it. */
(function(){
  var run = function(){ setTimeout(syncCachedUserName, 0); };
  if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded', run);
  else run();
})();
/* Full async check + cache update */
async function checkAdmin(){
  if(!sb) return false;
  try{
    const p = await currentProfile();
    return p && p.role === 'admin';
  }catch(e){ return false; }
}

/* ---------------- Auth action emails ----------------
   Password reset / magic-link emails are generated server-side via the
   auth-email Edge Function (supabase.auth.admin.generateLink + Resend),
   so the sender AND the link both stay on mykunda.com — no Supabase
   Custom Domain add-on required. See edge-functions/auth-email. */
async function sendAuthEmail(type, email, extra){
  if(!sb) throw new Error('backend-offline');
  const { data, error } = await sb.functions.invoke('auth-email', { body: Object.assign({ type, email }, extra||{}) });
  if(error) throw error;
  // no_account / already_exists are expected outcomes, not failures — the
  // sign-in screen turns them into a "switch tab" message.
  // rate_limited en invalid_email horen er sinds 27-08-2026 bij: ook dat zijn
  // verwachte uitkomsten die het scherm zelf netjes moet tonen, geen storingen.
  if(data && data.ok===false && !data.no_account && !data.already_exists
     && !data.rate_limited && !data.invalid_email){
    throw new Error(data.error || 'auth-email failed');
  }
  return data;
}
async function sendPasswordReset(email){ return sendAuthEmail('recovery', email); }
async function sendMagicLink(email){ return sendAuthEmail('magiclink', email); } // not yet wired to a UI button
// The sign-in screen asks for a 6-digit code, so we mail a code, not a link:
// auth-email generates the OTP server-side and sends it from noreply@mykunda.com.
// Returns { verify_type } — pass it to verifyEmailOtp().
// opts: { name, mode:'signin'|'signup', consent, consentMarketing }
// mode tells the function which tab the visitor is on, so an unknown address on
// Sign in never silently creates an account (and vice versa). consent carries
// the Terms/Privacy tick through to the profiles trigger.
async function sendEmailCode(email, opts){
  const o = (typeof opts === 'string') ? { name: opts } : (opts || {});
  const body = { mode: o.mode === 'signin' ? 'signin' : 'signup' };
  if(o.name) body.name = o.name;
  if(body.mode === 'signup'){
    body.consent = !!o.consent;
    body.consent_marketing = !!o.consentMarketing;
  }
  return sendAuthEmail('email_code', email, body);
}

/* ---------------- Leads (every form) ---------------- */
/* source: 'valuation' | 'viewing' | 'agent_message' | 'area_alert' | 'contact' | 'listing_enquiry' */
async function submitLead(source, fields, opts){
  const row = {
    source,
    name:  fields.name  || null,
    email: fields.email || null,
    phone: fields.phone || null,
    area:  fields.area  || null,
    message: fields.message || null,
    listing_id: fields.listing_id || null,
    payload: fields.payload || {}
  };
  if(!sb){ console.info('[demo] lead not sent (backend offline):', row); return { demo:true }; }

  // 1) persist the lead via the create_lead RPC (security-definer — returns the
  //    new id even though anon users can't SELECT from leads directly under RLS).
  //    See backend/fix-lead-insert.sql.
  let leadId = null;
  try {
    const { data, error } = await sb.rpc('create_lead', {
      p_source: row.source, p_name: row.name, p_email: row.email, p_phone: row.phone,
      p_area: row.area, p_message: row.message, p_listing_id: row.listing_id, p_payload: row.payload
    });
    if(error) throw error;
    leadId = data;
  } catch(rpcErr) {
    // RPC not deployed yet (run backend/fix-lead-insert.sql) — fall back to a
    // plain insert so the lead is still saved, though no id/email this time.
    console.warn('create_lead RPC unavailable, falling back to plain insert:', rpcErr.message);
    const { error: insertErr } = await sb.from('leads').insert(row);
    if(insertErr) throw insertErr;
  }

  /* 2) fire the notification email (Edge Function) — only if we got an id.

     opts.skipTeam laat de teammail weg en houdt de auto-reply aan de bezoeker
     wél overeind. Eén geval gebruikt dat: de bezichtigingsaanvraag van een
     INGELOGDE bezoeker op property.html. Die loopt sinds 30-08-2026 óók door
     de echte keten (conversatie + viewings-rij), en die keten mailt de
     verkoper zelf — met de knop "Choose a time" erin, wat de bruikbare mail
     van de twee is. Zonder deze schakelaar kreeg de verkoper twee mails binnen
     een halve seconde over dezelfde aanvraag, met verschillende onderwerpen.
     Gemeten tijdens reis 3 van de testronde. De bezoeker moet zijn
     bevestiging wél houden: het scherm belooft er een. */
  if(leadId) {
    try{
      const body = { lead_id: leadId };
      if(opts && opts.skipTeam) body.skip_team = true;
      const fnRes = await sb.functions.invoke('notify-lead', { body });
      if(fnRes.error) console.warn('notify-lead returned error:', fnRes.error.message || fnRes.error);
    } catch(e){
      console.warn('notify-lead Edge Function not reachable — lead saved but no email sent:', e.message);
    }
  }
  return { id: leadId, ok: true };
}

/* ---------------- Listings (read) ---------------- */
async function fetchListings(filters){
  if(!sb) return null;                         // caller falls back to demo data
  filters = filters || {};
  let q = sb.from('listings').select('*, listing_media(*)').in('status', ['active','under_offer']);
  if(filters.kind)     q = q.eq('kind', filters.kind);
  if(filters.category) q = q.eq('category', filters.category);
  if(filters.minPrice) q = q.gte('price', filters.minPrice);
  if(filters.maxPrice) q = q.lte('price', filters.maxPrice);
  if(filters.beds)     q = q.gte('beds', filters.beds);
  q = q.order('created_at', { ascending:false });
  const { data, error } = await q;
  if(error){ console.warn('fetchListings:', error.message); return null; }
  return data;
}
async function fetchListing(id){
  if(!sb) return null;
  /* The agency comes along on the single-listing read only: the detail page
     shows the office behind the listing, the search pages never do. */
  const { data, error } = await sb.from('listings').select('*, listing_media(*), agencies(*)').eq('id', id).single();
  if(error){ console.warn('fetchListing:', error.message); return null; }
  sb.rpc('bump_listing_views', { p_id: id });   // fire-and-forget view count
  return data;
}

/* ---------------- Listings (create — used by the wizard) ---------------- */
/* True when the database does not have this column yet (migration not run).
   Lets a newer page keep working against an older schema. */
function isMissingColumn(error, col){
  const m = ((error && (error.message||'')) + ' ' + (error && error.details||'')).toLowerCase();
  return m.includes(col) && (m.includes('column') || m.includes('schema cache'));
}
/* Columns a newer page may send that an older database has not got yet.
   Dropped one at a time on retry so the save still succeeds. */
const OPTIONAL_COLUMNS = ['boundary','beach_m',
  'condition','floors','view','security','furnished','water','power','road','title_type',
  'electricity','land_water','land_beach','plot_shape','flood_risk','fencing',
  'highlights','nearby','custom_features','year_built','available_from','video_url','doc_type',
  'contact_name','contact_phone','contact_email',
  /* Commercieel kanaal, 29-08-2026. Staan hier zodat een aanmelding ook slaagt
     wanneer 20260829_02_commercial_segment.sql nog niet gedraaid is: de kolom
     valt dan weg en de rest van de advertentie blijft overeind. */
  'segment','units','parking_spaces','current_use','fit_out',
  'service_charge','min_term_months','plot_width_m'];
function missingOptionalColumn(error){
  return OPTIONAL_COLUMNS.find(c => isMissingColumn(error, c)) || null;
}
async function insertTolerant(table, row, mode, matchId){
  for(let attempt=0; attempt<=OPTIONAL_COLUMNS.length; attempt++){
    const q = mode==='update'
      ? sb.from(table).update(row).eq('id', matchId).select().single()
      : sb.from(table).insert(row).select().single();
    const { data, error } = await q;
    if(!error) return data;
    const drop = missingOptionalColumn(error);
    if(!drop || !(drop in row)) throw error;
    delete row[drop];
  }
  throw new Error('save failed');
}
async function createListing(listing){
  if(!sb) throw new Error('backend-offline');
  const u = await currentUser();
  if(!u) throw new Error('not-signed-in');
  const row = Object.assign({ owner_id: u.id, status: 'pending_review' }, listing);
  return await insertTolerant('listings', row, 'insert');
}
async function uploadListingMedia(listingId, file, kind){
  if(!sb) throw new Error('backend-offline');
  const isDoc = kind === 'document';
  const bucket = isDoc ? 'listing-docs' : 'listing-photos';
  const path = listingId + '/' + Date.now() + '-' + file.name.replace(/[^\w.\-]/g,'_');
  const up = await sb.storage.from(bucket).upload(path, file);
  if(up.error) throw up.error;
  const { data, error } = await sb.from('listing_media')
    .insert({ listing_id: listingId, kind: kind || 'photo', storage_path: path, is_document: isDoc })
    .select().single();
  if(error) throw error;
  return data;
}
function mediaUrl(path, isDoc){
  if(!sb) return path;
  if(isDoc){ return null; }                     // private — fetch a signed URL when needed
  return sb.storage.from('listing-photos').getPublicUrl(path).data.publicUrl;
}

/* ---------------- Viewings ---------------- */
/* opts.notify === false skips the e-mail: the viewing form also writes a lead,
   and notify-lead already mails the buyer and the team. Two mails for one
   request reads as a system talking to itself. The row is still created, so the
   seller sees the request in the dashboard and can answer it there. */
async function requestViewing(v, opts){
  if(!sb){ console.info('[demo] viewing not sent:', v); return { demo:true }; }

  /* Stamp the signed-in buyer on the row. Without it the buyer can never see
     their own request back — and, worse, the RETURNING below fails the read
     policy, which rolls the whole insert back. */
  let u = null;
  try{ u = await currentUser(); }catch(e){}
  const row = u ? Object.assign({ buyer_id: u.id }, v) : v;

  /* Only ask for the row back when the policy can actually return it. A
     visitor without an account gets no representation — and no id, so there is
     nothing to notify about either. The row is saved all the same. */
  if(!u){
    const { error } = await sb.from('viewings_legacy_v0').insert(row);
    if(error) throw error;
    return { ok:true };
  }

  const { data, error } = await sb.from('viewings_legacy_v0').insert(row).select().single();
  if(error) throw error;
  if(!opts || opts.notify !== false){
    try{ await sb.functions.invoke('notify-viewing', { body:{ viewing_id: data.id } }); }catch(e){}
  }
  return data;
}

/* Seller/agent accepts the requested time. The "viewings party update" policy
   allows the listing's owner or agent; notify-viewing mails the buyer, who
   would otherwise never learn that the viewing is on. */
async function confirmViewing(viewingId, slotIso){
  if(!sb) throw new Error('backend-offline');
  const patch = { status:'confirmed' };
  if(slotIso) patch.chosen_slot = slotIso;
  const { data, error } = await sb.from('viewings_legacy_v0').update(patch).eq('id', viewingId).select().single();
  if(error) throw error;
  try{ await sb.functions.invoke('notify-viewing', { body:{ viewing_id: viewingId } }); }catch(e){}
  return data;
}
/* ---------------- Payments ----------------
   No browser-side receipt call lives here on purpose. The customer receipt and
   the backoffice notification hang off a trigger on `payments`
   (payments_notify_status -> notify_payment_status_change), so they fire on
   every switch to succeeded — automatic reconciliation and a hand-confirmed
   bank line behave identically. Calling notify-payment from a page as well
   would send every confirmed payment out twice. */

async function proposeSlots(viewingId, slots){
  if(!sb) throw new Error('backend-offline');
  const { data, error } = await sb.from('viewings_legacy_v0')
    .update({ proposed_slots: slots, status:'slots_proposed' }).eq('id', viewingId).select().single();
  if(error) throw error;
  try{ await sb.functions.invoke('notify-viewing', { body:{ viewing_id: viewingId } }); }catch(e){}
  return data;
}

/* ---------------- Favorites & saved searches ---------------- */
async function dbToggleFavorite(listingId){
  if(!sb) return null;
  const u = await currentUser(); if(!u) return null;
  const { data: existing } = await sb.from('favorites')
    .select('listing_id').eq('user_id', u.id).eq('listing_id', listingId).maybeSingle();
  if(existing){ await sb.from('favorites').delete().eq('user_id', u.id).eq('listing_id', listingId); return false; }
  await sb.from('favorites').insert({ user_id: u.id, listing_id: listingId }); return true;
}
async function saveSearch(filters, area, channel){
  if(!sb) throw new Error('backend-offline');
  const u = await currentUser(); if(!u) throw new Error('not-signed-in');
  const { data, error } = await sb.from('saved_searches')
    .insert({ user_id: u.id, filters, area, channel: channel||'email' }).select().single();
  if(error) throw error;
  return data;
}

/* ---------------- DB → demo card shape ---------------- */
/* Maps a Supabase listing row to the object shape the site's cards/map expect. */
function dbListingToCard(r){
  const photo = (r.listing_media||[]).find(m=>!m.is_document);
  /* Woningmarkt of bedrijfsmarkt. De kolom is de bron zodra migratie 02 gedraaid
     is; staat hij er nog niet, dan leidt de categorie het af. Zo blijven Buy en
     Rent hun aanbod tonen ongeacht de volgorde van upload en migratie. */
  const seg = r.segment || ((typeof mkIsCommercialCat==='function' && mkIsCommercialCat(r.category)) ? 'commercial' : 'residential');
  return {
    id: r.id, cat: r.category, type: r.kind, segment: seg,
    units: r.units||0, parking: r.parking_spaces||0,
    current_use: r.current_use||'', fit_out: r.fit_out||'',
    isNew: true, verified: !!r.is_verified_title, plan: r.plan,
    price: Number(r.price)||0, title: r.title, street: r.street||'', area: r.area||'',
    beds: r.beds||0, baths: r.baths||0, sqm: r.sqm||0, plot: r.plot_sqm||0,
    tag: (r.features&&r.features[0])||'', photos: (r.listing_media||[]).filter(m=>!m.is_document).length||1,
    img: photo ? mediaUrl(photo.storage_path,false) : '',
    lat: r.lat, lng: r.lng, plus: r.plus_code || '',
    boundary: r.boundary || null,
    beach_m: typeof r.beach_m==='number' ? r.beach_m : null,
    desc: r.description||'', features: r.features||[],
    condition: r.condition||'good', floors: String(r.floors||1),
    beach: r.beach||'inland', view: r.view||'none',
    security: r.security||'none', furnished: r.furnished||'unfurnished',
    water: r.water||'nawec', power: r.power||'no',
    road: r.road||'laterite', title_type: r.title_type||'alkalalo',
    electricity: r.electricity||'none', land_water: r.land_water||'none',
    land_beach: r.land_beach||'inland', plot_shape: r.plot_shape||'regular',
    flood_risk: r.flood_risk||'no', fencing: r.fencing||'none',
    /* Added for the buy/rent search filters (26-08-2026): these three columns were
       already written by list.html but never read back, so nothing could filter on
       them. doc_type is the one document-type field collected for every listing —
       land and built alike — via the "Ownership & documents" step. */
    doc_type: r.doc_type||'', year_built: r.year_built||null, available_from: r.available_from||null,
    /* Added 28-08-2026 with the Gambia fields. These are read straight back by
       property.html; anything the database does not have yet stays undefined
       and the block that shows it simply does not appear. */
    created_at: r.created_at||null,
    seller_type: r.seller_type||null, company_name: r.company_name||null,
    fee_type: r.fee_type||null, fee_value: r.fee_value||null,
    mandate_type: r.mandate_type||null, rental_mode: r.rental_mode||null,
    deposit: r.deposit||null, price_period: r.price_period||null,
    min_term_months: r.min_term_months||null, bills_included: r.bills_included||[],
    meter_type: r.meter_type||null, water_tank: r.water_tank, tank_litres: r.tank_litres||null,
    septic_tank: r.septic_tank, solar_kwp: r.solar_kwp||null, generator_kva: r.generator_kva||null,
    plot_width_m: r.plot_width_m||null, plot_depth_m: r.plot_depth_m||null, highway_m: r.highway_m||null,
    tda_zone: r.tda_zone||null, lease_years_remaining: r.lease_years_remaining||null,
    alkalo_name: r.alkalo_name||null, alkalo_village: r.alkalo_village||null,
    lands_registry_ref: r.lands_registry_ref||null,
    payment_terms: r.payment_terms||[], instalment_months: r.instalment_months||null,
    service_charge: r.service_charge||null, service_charge_period: r.service_charge_period||null,
    included_services: r.included_services||[], tenant_criteria: r.tenant_criteria||null,
    management_terms: r.management_terms||null, emergency_phone: r.emergency_phone||null,
    evidence_level: (typeof r.evidence_level==='number') ? r.evidence_level : null,
    phone_verified_at: r.phone_verified_at||null,
    agency: r.agencies || null
  };
}

/* Populates window.__dbListings (used by app.js allListings()) when the backend is live.
   Returns the array, or null in demo mode.

   This is the most expensive query on the site: it reads every active listing with
   all of its media rows. Three guards keep that from scaling into a problem:
     1. once per page      — __dbPrimed short-circuits a second call;
     2. once per session    — the result is reused from sessionStorage for TTL ms,
                             so opening five area pages in a row costs one request;
     3. a hard ceiling      — MK_PRIME_MAX caps the worst case regardless of table size.
   Pages that need ONE listing must call fetchListing(id) instead — that is an
   indexed primary-key lookup, not a table scan. */
const MK_PRIME_TTL = 5 * 60 * 1000;
const MK_PRIME_MAX = 400;

async function primeListings(force){
  if(!sb) return null;
  if(window.__dbPrimed && !force) return window.__dbListings;
  if(!force){
    try{
      const raw = sessionStorage.getItem('mykunda_db_cache');
      const at  = +sessionStorage.getItem('mykunda_db_cache_at') || 0;
      if(raw && (Date.now() - at) < MK_PRIME_TTL){
        window.__dbListings = JSON.parse(raw);
        window.__dbPrimed = true;
        return window.__dbListings;
      }
    }catch(e){}
  }
  try{
    const { data, error } = await sb.from('listings')
      .select('*, listing_media(*)').in('status',['active','under_offer'])
      .order('created_at',{ascending:false}).limit(MK_PRIME_MAX);
    if(error){ console.warn('primeListings:', error.message); return null; }
    window.__dbListings = (data||[]).map(dbListingToCard);
    window.__dbPrimed = true;
    try{
      sessionStorage.setItem('mykunda_db_cache', JSON.stringify(window.__dbListings));
      sessionStorage.setItem('mykunda_db_cache_at', String(Date.now()));
    }catch(e){}
    return window.__dbListings;
  }catch(e){ console.warn('primeListings:', e.message); return null; }
}

/* ---------- Enhanced queries for Sprint 1 ---------- */

/* Server-side filtered listing query — more efficient than fetching all + client filter.
   filters: { kind, category, minPrice, maxPrice, beds, area, q, sort, limit } */
async function fetchFilteredListings(filters){
  if(!sb) return null;
  filters = filters || {};
  let q = sb.from('listings').select('*, listing_media(*)').in('status', ['active','under_offer']);
  if(filters.kind)      q = q.eq('kind', filters.kind);
  if(filters.category)  q = q.eq('category', filters.category);
  /* Alleen meesturen als een aanroeper er expliciet om vraagt: zonder de
     kolom (migratie 02 nog niet gedraaid) zou een vaste eq('segment',…) elke
     query laten falen in plaats van iets minder scherp te filteren. */
  if(filters.segment)   q = q.eq('segment', filters.segment);
  if(filters.minPrice)  q = q.gte('price', filters.minPrice);
  if(filters.maxPrice)  q = q.lte('price', filters.maxPrice);
  if(filters.beds)      q = q.gte('beds', filters.beds);
  if(filters.area)      q = q.ilike('area', '%'+filters.area+'%');
  if(filters.q)         q = q.or('title.ilike.%'+filters.q+'%,area.ilike.%'+filters.q+'%,street.ilike.%'+filters.q+'%,description.ilike.%'+filters.q+'%');
  // sorting
  if(filters.sort==='low')       q = q.order('price',{ascending:true});
  else if(filters.sort==='high') q = q.order('price',{ascending:false});
  else if(filters.sort==='sqm')  q = q.order('sqm',{ascending:false});
  else                           q = q.order('created_at',{ascending:false});
  if(filters.limit) q = q.limit(filters.limit);
  const { data, error } = await q;
  if(error){ console.warn('fetchFilteredListings:', error.message); return null; }
  return (data||[]).map(dbListingToCard);
}

/* Fetch listings for a specific area (used by area/neighborhood pages) */
async function fetchAreaListings(areaName, limit){
  if(!sb) return null;
  let q = sb.from('listings').select('*, listing_media(*)')
    .in('status',['active','under_offer'])
    .ilike('area', '%'+areaName+'%')
    .order('created_at',{ascending:false});
  if(limit) q = q.limit(limit);
  const { data, error } = await q;
  if(error){ console.warn('fetchAreaListings:', error.message); return null; }
  return (data||[]).map(dbListingToCard);
}

/* Fetch featured/newest listings for the home page */
async function fetchFeaturedListings(limit){
  if(!sb) return null;
  const { data, error } = await sb.from('listings').select('*, listing_media(*)')
    .in('status',['active','under_offer'])
    .order('is_verified_title',{ascending:false})  // verified first
    .order('created_at',{ascending:false})
    .limit(limit||4);
  if(error){ console.warn('fetchFeaturedListings:', error.message); return null; }
  return (data||[]).map(dbListingToCard);
}

/* Plots for sale. Stond hier voor de strip op de grondpagina; die pagina is
   op 29-08-2026 ingetrokken, dus deze functie heeft nu geen aanroeper meer.
   Unlike fetchFeaturedListings this returns the RAW rows: the page maps them
   once with dbListingToCard itself. Mapping here as well is what made the home
   page feed already-mapped cards back through dbListingToCard a second time. */
async function fetchLandListings(limit){
  if(!sb) return null;
  const { data, error } = await sb.from('listings').select('*, listing_media(*)')
    .in('status',['active','under_offer'])
    .eq('category','land')
    .eq('kind','sale')
    .order('is_verified_title',{ascending:false})  // verified first
    .order('created_at',{ascending:false})
    .limit(limit||6);
  if(error){ console.warn('fetchLandListings:', error.message); return null; }
  return data||[];
}

/* ============================================================
   Sprint 5 — WhatsApp & notification preferences
   ============================================================ */

/* The old Sprint-5 prefs functions are gone: they queried a table that does not
   exist. The one real notification preference is profiles.notify_messages,
   handled by the two functions below. */

/* "Email me about new messages" — one boolean on profiles.notify_messages; the
   notify-message edge function checks it before sending. Select ONLY this column:
   profiles also holds unsubscribe_token, which must never reach the client. */
async function fetchMessageEmailPref(){
  if(!sb) return null;
  const u = await currentUser();
  if(!u) return null;
  const { data, error } = await sb.from('profiles').select('notify_messages').eq('id', u.id).single();
  if(error){ console.warn('fetchMessageEmailPref:', error.message); return null; }
  return data;
}
/* Update only notify_messages — never send role or other profile fields here */
async function updateMessageEmailPref(on){
  if(!sb) throw new Error('backend-offline');
  const u = await currentUser();
  if(!u) throw new Error('not-signed-in');
  const { error } = await sb.from('profiles').update({ notify_messages: !!on }).eq('id', u.id);
  if(error) throw error;
}

/* WhatsApp vanuit de browser: weggehaald op 30-08-2026.
   sendWhatsAppNotification() en sendWhatsAppText() stonden hier maar werden
   nergens aangeroepen (gecontroleerd over alle pagina's). Ze riepen wa-notify
   aan, en die functie eist sinds vandaag een gedeelde sleutel — die een browser
   per definitie niet kan hebben. Ze hadden dus alleen nog 401 kunnen opleveren.
   WhatsApp gaat uitsluitend server-side: wa-inbound roept wa-notify aan. */

/* ============================================================
   Messaging — wired to the live backend (contract 19-08-2026)
   Tables: public.conversations, public.messages
   RPCs:   start_conversation(p_listing_id)
           mark_conversation_read(p_conversation_id)
   Counters, previews, read-marks and e-mail notifications are
   maintained by the database; the client never writes them.
   ============================================================ */

/* Start (or reuse) a conversation for a listing. The RPC picks the seller
   (listings.agent_id, else owner_id) and dedupes via a unique index —
   no client-side "does it exist?" check. Returns the conversation row. */
async function startConversationForListing(listingId, firstMessage){
  if(!sb) throw new Error('backend-offline');
  const { data: conversationId, error } = await sb.rpc('start_conversation', { p_listing_id: listingId });
  if(error) throw error;
  if(firstMessage) await sendMessage(conversationId, firstMessage);
  const { data: convo } = await sb.from('conversations')
    .select('id, listing_id, buyer_id, seller_id, last_message_at, last_message_preview, last_sender_id, buyer_unread, seller_unread')
    .eq('id', conversationId).single();
  return convo || { id: conversationId, listing_id: listingId };
}

/* ---- Bezichtiging aanvragen via de ECHTE keten (30-08-2026) --------------
   Er liepen twee bezichtigingssystemen naast elkaar. Het formulier op
   property.html schreef naar `viewings_legacy_v0`; de chat, de bevestiging,
   de afwijzing, de annulering en de twee herinneringen werken allemaal op
   `viewings`. Een aanvraag via de objectpagina viel dus buiten de hele
   keten: geen bevestiging als de verkoper een tijd koos, geen herinnering,
   niets.

   Waarom dat zo was: propose_viewing() vraagt om een conversation_id, en
   start_conversation() vraagt om een ingelogde koper. Een anonieme bezoeker
   past daar niet in.

   Daarom deze middenweg. Is de bezoeker ingelogd, dan loopt zijn aanvraag
   voortaan door de echte keten — conversatie, bericht, voorgestelde tijd —
   en krijgt hij alles wat daaraan hangt. Is hij dat niet, dan blijft het
   een lead, precies zoals nu. Inloggen verplicht stellen op het moment van
   hoogste koopintentie is de verkeerde prijs voor deze opschoning. */
async function requestViewingAsUser(listingId, slotIso, note){
  if(!sb) throw new Error('backend-offline');
  const u = await currentUser();
  if(!u) throw new Error('not-signed-in');

  const convo = await startConversationForListing(listingId);
  const convId = convo && convo.id;
  if(!convId) throw new Error('no-conversation');

  const { data: viewingId, error } = await sb.rpc('propose_viewing', {
    p_conversation_id: convId,
    p_slots: [slotIso],
    p_note: note || null
  });
  if(error) throw error;

  /* notify-viewing mailt de aanvrager, de tegenpartij en de backoffice.
     Faalt dat, dan is de aanvraag al opgeslagen — de melding is nooit een
     reden om de bezoeker een fout te tonen. */
  try{ await sb.functions.invoke('notify-viewing', { body:{ viewing_id: viewingId } }); }catch(e){
    console.warn('notify-viewing:', e && e.message);
  }
  return { viewing_id: viewingId, conversation_id: convId };
}

/* Fetch all conversations for the current user. RLS scopes the query to
   the user's own conversations — no .eq()/.or() filter needed. */
async function fetchConversations(){
  if(!sb) return null;
  const u = await currentUser();
  if(!u) return null;
  const { data, error } = await sb.from('conversations')
    .select('id, listing_id, buyer_id, seller_id, last_message_at, last_message_preview, last_sender_id, buyer_unread, seller_unread, listing:listings(id, title, price, kind, category)')
    .order('last_message_at', { ascending: false });
  if(error){ console.warn('fetchConversations:', error.message); return null; }
  const otherIds = [...new Set((data||[]).map(c => c.buyer_id === u.id ? c.seller_id : c.buyer_id).filter(Boolean))];
  let profiles = {};
  if(otherIds.length){
    const { data: profs } = await sb.from('conversation_people').select('id, full_name').in('id', otherIds);
    if(profs) profs.forEach(p=>{ profiles[p.id]=p; });
  }
  return (data||[]).map(c=>{
    const isBuyer = c.buyer_id === u.id;
    c._isBuyer = isBuyer;
    c._other = profiles[isBuyer ? c.seller_id : c.buyer_id] || { full_name: 'MyKunda user' };
    c._unread = isBuyer ? (c.buyer_unread||0) : (c.seller_unread||0);
    return c;
  });
}

/* Fetch messages for a conversation (oldest first) */
async function fetchMessages(conversationId){
  if(!sb) return null;
  const { data, error } = await sb.from('messages')
    .select('id, sender_id, body, created_at, read_at')
    .eq('conversation_id', conversationId)
    .order('created_at', { ascending: true });
  if(error){ console.warn('fetchMessages:', error.message); return null; }
  return data;
}

/* Send a message. sender_id must be the signed-in user or RLS refuses.
   Preview, counters and the e-mail notification are handled by triggers. */
async function sendMessage(conversationId, body){
  if(!sb) throw new Error('backend-offline');
  const u = await currentUser();
  if(!u) throw new Error('not-signed-in');
  const text = (body||'').trim().slice(0, 4000);
  if(!text) throw new Error('empty-message');
  const { data, error } = await sb.from('messages')
    .insert({ conversation_id: conversationId, sender_id: u.id, body: text })
    .select().single();
  if(error) throw error;
  return data;
}

/* Mark a conversation read. Deliberately an RPC: there is no UPDATE policy
   for the client, so a direct update on messages/conversations does nothing. */
async function markConversationRead(conversationId){
  if(!sb) return;
  const { error } = await sb.rpc('mark_conversation_read', { p_conversation_id: conversationId });
  if(error) console.warn('markConversationRead:', error.message);
}

/* Unread total for the header badge — read from the DB-maintained counters */
async function getUnreadCount(){
  if(!sb) return 0;
  const u = await currentUser();
  if(!u) return 0;
  const { data, error } = await sb.from('conversations')
    .select('buyer_id, seller_id, buyer_unread, seller_unread');
  if(error || !data) return 0;
  return data.reduce((n,c)=> n + (c.buyer_id===u.id ? (c.buyer_unread||0) : (c.seller_unread||0)), 0);
}

/* Subscribe to changes in one conversation (Supabase Realtime).
   Fires for INSERT (new message) and UPDATE (read-mark) — the callback
   gets (row, eventType). */
function subscribeToConversation(conversationId, onChange){
  if(!sb) return null;
  return sb.channel('conv:'+conversationId)
    .on('postgres_changes',
      { event: '*', schema: 'public', table: 'messages', filter: 'conversation_id=eq.'+conversationId },
      (payload) => { if(onChange && payload.new) onChange(payload.new, payload.eventType); }
    ).subscribe();
}

/* Subscribe to new messages for the current user (for the unread badge).

   Deliberately NOT a subscription to the whole messages table: an unfiltered
   channel makes every insert on the platform travel to every signed-in browser
   and leans entirely on RLS to keep other people's messages out of the payload.
   Instead we open one filtered channel per conversation the user is actually in,
   so the server does the filtering and nothing else ever reaches the client.
   Returns an array of channels — pass it straight to unsubscribeChannel(). */
async function subscribeToAllMessages(userId, onNewMessage){
  if(!sb) return null;
  const { data: convos, error } = await sb.from('conversations').select('id');
  if(error || !convos || !convos.length) return [];
  return convos.map(c => sb.channel('conv:'+c.id+':badge')
    .on('postgres_changes',
      { event:'INSERT', schema:'public', table:'messages',
        filter:'conversation_id=eq.'+c.id },
      (payload) => {
        if(payload.new && payload.new.sender_id !== userId && onNewMessage) onNewMessage(payload.new);
      }
    ).subscribe());
}

/* Unsubscribe from a channel, or from an array of them */
function unsubscribeChannel(channel){
  if(!sb || !channel) return;
  if(Array.isArray(channel)){ channel.forEach(c=>{ if(c) sb.removeChannel(c); }); return; }
  sb.removeChannel(channel);
}

/* Save or update a listing draft in the database.
   If draftId is set, updates that row; otherwise creates a new draft.
   Returns the saved listing row (with id). */
async function saveDraft(fields, draftId){
  if(!sb) throw new Error('backend-offline');
  const u = await currentUser();
  if(!u) throw new Error('not-signed-in');
  const row = {
    owner_id: u.id,
    kind: fields.kind || 'sale',
    category: fields.category || 'house',
    title: fields.title || 'Untitled listing',
    description: fields.description || null,
    street: fields.street || null,
    area: fields.area || null,
    price: fields.price || 0,
    negotiable: !!fields.negotiable,
    beds: fields.beds || 0,
    baths: fields.baths || 0,
    sqm: fields.sqm || 0,
    plot_sqm: fields.plot_sqm || 0,
    lat: fields.lat || null,
    lng: fields.lng || null,
    plus_code: fields.plus_code || null,
    boundary: fields.boundary || null,
    beach_m: (typeof fields.beach_m==='number' ? fields.beach_m : null),
    features: fields.features || [],
    plan: fields.plan || 'basic',
    /* extended details — one source of truth: listingFields() in list.html */
    condition: fields.condition || null, floors: fields.floors || null,
    view: fields.view || null, security: fields.security || null,
    furnished: fields.furnished || null, water: fields.water || null, power: fields.power || null,
    road: fields.road || null, title_type: fields.title_type || null,
    electricity: fields.electricity || null, land_water: fields.land_water || null,
    land_beach: fields.land_beach || null, plot_shape: fields.plot_shape || null,
    flood_risk: fields.flood_risk || null, fencing: fields.fencing || null,
    highlights: fields.highlights || null, nearby: fields.nearby || null,
    custom_features: fields.custom_features || null,
    year_built: fields.year_built || null, available_from: fields.available_from || null,
    video_url: fields.video_url || null, doc_type: fields.doc_type || null,
    contact_name: fields.contact_name || null, contact_phone: fields.contact_phone || null,
    contact_email: fields.contact_email || null,
    /* Commercieel spoor. segment blijft residential zolang niets anders zegt,
       zodat een woningadvertentie precies schrijft wat hij altijd al schreef. */
    segment: fields.segment || 'residential',
    units: fields.units || null, parking_spaces: fields.parking_spaces || null,
    current_use: fields.current_use || null, fit_out: fields.fit_out || null,
    service_charge: fields.service_charge || null,
    min_term_months: fields.min_term_months || null,
    plot_width_m: fields.plot_width_m || null
  };
  /* A new row starts as a draft. An existing row keeps its status: editing an
     active listing must not pull it offline. */
  if(!draftId) row.status = 'draft';
  return await insertTolerant('listings', row, draftId?'update':'insert', draftId);
}

/* Submit a draft for review (changes status from draft to pending_review) */
async function submitForReview(listingId, opts){
  if(!sb) throw new Error('backend-offline');
  const { data, error } = await sb.from('listings')
    .update({ status: 'pending_review' })
    .eq('id', listingId).select().single();
  if(error) throw error;
  if(opts && opts.notify===false) return data;   // caller sends its own richer email
  // notify seller + backoffice (branded listing emails — see edge-functions/notify-listing)
  try{
    const fnRes = await sb.functions.invoke('notify-listing', { body: { listing_id: listingId } });
    if(fnRes.error) console.warn('notify-listing returned error:', fnRes.error.message || fnRes.error);
  }catch(e){ console.warn('notify-listing Edge Function not reachable — listing saved but no email sent:', e.message); }
  return data;
}

/* Load user's existing drafts (to resume editing) */
async function fetchMyDrafts(){
  if(!sb) return [];
  const u = await currentUser();
  if(!u) return [];
  const { data, error } = await sb.from('listings')
    .select('*').eq('owner_id', u.id).eq('status', 'draft')
    .order('updated_at', { ascending: false }).limit(5);
  if(error){ console.warn('fetchMyDrafts:', error.message); return []; }
  return data || [];
}

/* Fetch the current user's own listings (all statuses) */
async function fetchMyListings(){
  if(!sb) return null;
  const u = await currentUser();
  if(!u) return null;
  const { data, error } = await sb.from('listings')
    .select('*, listing_media(*)')
    .eq('owner_id', u.id)
    .order('created_at', { ascending: false });
  if(error){ console.warn('fetchMyListings:', error.message); return null; }
  return data;
}

/* Fetch leads related to the current user's listings */
async function fetchMyLeads(limit){
  if(!sb) return null;
  const u = await currentUser();
  if(!u) return null;
  // First get the user's listing IDs
  const { data: listings, error: le } = await sb.from('listings')
    .select('id').eq('owner_id', u.id);
  if(le || !listings || !listings.length) return [];
  const ids = listings.map(l=>l.id);
  let q = sb.from('leads').select('*')
    .in('listing_id', ids)
    .order('created_at', { ascending: false });
  if(limit) q = q.limit(limit);
  const { data, error } = await q;
  if(error){ console.warn('fetchMyLeads:', error.message); return null; }
  return data;
}

/* Fetch viewings for the current user's listings */
async function fetchMyViewings(limit){
  if(!sb) return null;
  const u = await currentUser();
  if(!u) return null;
  const { data: listings, error: le } = await sb.from('listings')
    .select('id, title').eq('owner_id', u.id);
  if(le || !listings || !listings.length) return [];
  const ids = listings.map(l=>l.id);
  const titleMap = {};
  listings.forEach(l=>{ titleMap[l.id]=l.title; });
  let q = sb.from('viewings_legacy_v0').select('*')
    .in('listing_id', ids)
    .order('created_at', { ascending: false });
  if(limit) q = q.limit(limit);
  const { data, error } = await q;
  if(error){ console.warn('fetchMyViewings:', error.message); return null; }
  // attach listing titles for display
  return (data||[]).map(v=>({ ...v, _listing_title: titleMap[v.listing_id]||'Property' }));
}

/* Upload a file (photo or document) for a listing — returns the media row */
async function uploadFile(listingId, file, kind, sort){
  if(!sb) throw new Error('backend-offline');
  const isDoc = (kind === 'document');
  const bucket = isDoc ? 'listing-docs' : 'listing-photos';
  const safeName = file.name.replace(/[^\w.\-]/g,'_');
  const path = listingId + '/' + Date.now() + '-' + safeName;
  const { error: upErr } = await sb.storage.from(bucket).upload(path, file);
  if(upErr) throw upErr;
  const { data, error } = await sb.from('listing_media')
    .insert({ listing_id: listingId, kind: kind||'photo', storage_path: path, is_document: isDoc, sort: (typeof sort==='number'?sort:0) })
    .select().single();
  if(error) throw error;
  return data;
}

/* Delete a media item */
async function deleteMedia(mediaId, storagePath, isDoc){
  if(!sb) return;
  const bucket = isDoc ? 'listing-docs' : 'listing-photos';
  try{ await sb.storage.from(bucket).remove([storagePath]); }catch(e){}
  await sb.from('listing_media').delete().eq('id', mediaId);
}

/* Count listings in an area (for area pages sidebar) */
async function countAreaListings(areaName){
  if(!sb) return null;
  const { count, error } = await sb.from('listings')
    .select('id', { count:'exact', head:true })
    .in('status',['active','under_offer'])
    .ilike('area', '%'+areaName+'%');
  if(error){ console.warn('countAreaListings:', error.message); return null; }
  return count;
}

/* ---------------- Market index (backoffice) ----------------
   Monthly price development per segment. Tables and rollup live in
   backend/market-index.sql; the console is market.html. Admin-only. */

/* Snapshots from `since` (YYYY-MM-01) onwards, oldest first. */
async function fetchMarketSnapshots(since){
  if(!sb) return null;
  let q = sb.from('market_snapshots').select('*').order('month', { ascending:true });
  if(since) q = q.gte('month', since);
  const { data, error } = await q;
  if(error) throw error;
  return data || [];
}

/* Re-run the rollup for the last N months (admin or service role only). */
async function rebuildMarketIndex(months){
  if(!sb) throw new Error('backend-offline');
  const { data, error } = await sb.rpc('rebuild_market_index', { p_months: months || 24 });
  if(error) throw error;
  return data;
}

/* A deal the platform never saw — counts towards that month's medians. */
async function addMarketObservation(obs){
  if(!sb) throw new Error('backend-offline');
  const u = await currentUser();
  const row = Object.assign({}, obs, u ? { created_by: u.id } : {});
  const { data, error } = await sb.from('market_observations').insert(row).select().single();
  if(error) throw error;
  return data;
}

/* When the index was last calculated (null if never). */
async function lastMarketIndexRun(){
  if(!sb) return null;
  const { data, error } = await sb.from('market_index_runs').select('*').order('ran_at',{ascending:false}).limit(1);
  if(error){ console.warn('lastMarketIndexRun:', error.message); return null; }
  return data && data[0] ? data[0].ran_at : null;
}


/* ---------------- Market sources (backoffice) ----------------
   The registry behind the index: who evidence comes from, what
   each source is trusted with, and whether last night's harvest
   worked. Tables live in backend/market-sources.sql, the console
   is sources.html. Admin-only. */

/* Standard Supabase Functions endpoint: <ref>.supabase.co/functions/v1/<name>.
   The legacy <ref>.functions.supabase.co host also resolves, but there a call to
   a function that is NOT deployed returns a gateway error without CORS headers,
   which the browser reports as a bare "Failed to fetch". */
const MYKUNDA_FN_URL = MYKUNDA_SUPABASE_URL.replace(/\/+$/, '') + '/functions/v1';

/* Registry, run log, macro series and the coverage counters, in one go. */
async function fetchMarketSources(){
  if(!sb) throw new Error('backend-offline');
  const [srcRes, runRes, macroRes] = await Promise.all([
    sb.from('market_sources').select('*').order('sort'),
    sb.from('source_fetch_runs').select('*').order('started_at',{ascending:false}).limit(30),
    sb.from('market_macro').select('*').order('month',{ascending:false}).limit(60)
  ]);
  if(srcRes.error) throw srcRes.error;

  const sources = srcRes.data || [];

  /* Row counts per source, and how much weight each one actually carries. */
  const counts = {};
  const ext = await sb.from('external_listings')
    .select('source_key, status').eq('status','active');
  (ext.data || []).forEach(function(r){ counts[r.source_key] = (counts[r.source_key]||0) + 1; });

  const dup = await sb.from('external_listings')
    .select('id', { count:'exact', head:true }).eq('status','duplicate');
  const own = await sb.from('listings')
    .select('id', { count:'exact', head:true }).not('status','in','("draft","rejected","archived")');
  const obs = await sb.from('market_observations')
    .select('id', { count:'exact', head:true });

  sources.forEach(function(s){
    s.items = s.key === 'mykunda' ? (own.count || 0)
      : s.key === 'observation' ? (obs.count || 0)
      : (counts[s.key] || 0);
  });

  /* Share of the index's total weight that comes from outside mykunda.com. */
  let wOwn = 0, wExt = 0;
  sources.forEach(function(s){
    if(!s.in_index || !s.active) return;
    const w = (s.items || 0) * (s.trust || 0);
    if(s.kind === 'own') wOwn += w; else wExt += w;
  });

  const externalRows = sources.filter(function(s){ return s.kind !== 'own'; })
    .reduce(function(a,s){ return a + (s.items || 0); }, 0);

  /* Latest value per series, newest first. */
  const seen = {}, macro = [];
  (macroRes.data || []).forEach(function(m){
    if(seen[m.series]) return;
    seen[m.series] = true; macro.push(m);
  });

  return {
    sources: sources,
    runs: runRes.data || [],
    macro: macro,
    stats: {
      own: own.count || 0,
      external: externalRows,
      duplicates: dup.count || 0,
      active_sources: sources.filter(function(s){ return s.active && s.in_index; }).length,
      weighted_external: (wOwn + wExt) ? wExt / (wOwn + wExt) : 0
    }
  };
}

/* How far a source may move the index. Takes effect on the next rebuild. */
async function saveSourceTrust(key, trust){
  if(!sb) throw new Error('backend-offline');
  const { error } = await sb.from('market_sources')
    .update({ trust: Math.max(0, Math.min(1, trust)) }).eq('key', key);
  if(error) throw error;
}

/* Harvest. dry=true parses and returns samples without writing anything —
   that is what the Test button uses to tune a selector. */
async function runSourceFetch(key, dry){
  if(!sb) throw new Error('backend-offline');
  const { data: sess } = await sb.auth.getSession();
  const token = sess && sess.session ? sess.session.access_token : MYKUNDA_SUPABASE_ANON;
  let r;
  try{
    r = await fetch(MYKUNDA_FN_URL + '/market-sources', {
      method: 'POST',
      headers: { 'Content-Type':'application/json', 'Authorization': 'Bearer ' + token, 'apikey': MYKUNDA_SUPABASE_ANON },
      body: JSON.stringify({ run: key, dry: !!dry })
    });
  }catch(e){
    /* No HTTP response at all. In practice this means the function is not
       deployed on this project, so the gateway answers the CORS preflight
       with an error and the browser hides the status code. */
    throw new Error('the market-sources function could not be reached — deploy it in Supabase → Edge Functions (see harvest-fix-handleiding.html)');
  }
  if(r.status === 404) throw new Error('market-sources is not deployed on this Supabase project yet');
  if(r.status === 401 || r.status === 403) throw new Error('not authorised — sign in as admin, or switch off "Verify JWT" on the function');
  const out = await r.json().catch(function(){ return {}; });
  if(!r.ok) throw new Error(out.error || ('harvest failed (' + r.status + ')'));
  return out;
}

/* Official series for the market screen: CPI to deflate with, rates for context. */
async function fetchMarketMacro(since){
  if(!sb) return {};
  let q = sb.from('market_macro').select('*').order('month',{ascending:true});
  if(since) q = q.gte('month', since);
  const { data, error } = await q;
  if(error){ console.warn('fetchMarketMacro:', error.message); return {}; }
  const out = {};
  (data || []).forEach(function(m){
    (out[m.series] = out[m.series] || {})[m.month] = Number(m.value);
  });
  return out;
}
