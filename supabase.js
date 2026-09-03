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
  /* Twee pogingen, niet vier. Supabase geeft bij een verkeerd getypte code
     dezelfde melding als bij een verkeerd type ("Token has expired or is
     invalid"), dus de `break` hieronder greep nooit: elke vertypte cijferreeks
     kostte vier verify-aanroepen en vulde de pogingenteller van Supabase vier
     keer zo snel. Gemeten op 31-08-2026 met een echt account: type 'email'
     verifieert óók een signup-code, en auth-email geeft het juiste type
     tegenwoordig zelf mee. 'email' als enige terugval dekt dus alles wat
     'magiclink' en 'signup' dekten. */
  const tries = [type, 'email'].filter((t,i,a)=>t && a.indexOf(t)===i);
  let last;
  for(const t of tries){
    const res = await sb.auth.verifyOtp({ email, token, type: t });
    if(!res.error) return res;
    last = res;
  }
  return last;
}
async function signOut(){ 
  if(sb) try{ await sb.auth.signOut(); }catch(e){ console.warn('signOut:',e); }
  try{ localStorage.removeItem('mykunda_admin'); }catch(e){}
  try{ localStorage.removeItem('mykunda_user'); }catch(e){}
  /* De lokale favorieten spiegelen sinds 03-09-2026 het account; ze blijven
     niet achter voor wie hierna op hetzelfde toestel inlogt. */
  try{ localStorage.removeItem('mykunda_favs'); localStorage.removeItem('mykunda_favs_db'); }catch(e){}
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
  // address_blocked erbij op 31-08-2026: auth-email weigert sinds 30-08 een
  // code naar een adres dat hard gebouncet is en zegt in `error` precies wat de
  // bezoeker moet doen. Die vlag ontbrak hier, dus werd het een exception en
  // zag de bezoeker "Something went wrong" — de enige melding waar hij niets
  // mee kan, uitgerekend bij het enige geval dat hij zelf moet oplossen.
  if(data && data.ok===false && !data.no_account && !data.already_exists
     && !data.rate_limited && !data.invalid_email && !data.address_blocked){
    throw new Error(data.error || 'auth-email failed');
  }
  return data;
}
async function sendPasswordReset(email){ return sendAuthEmail('recovery', email); }
async function sendMagicLink(email){ return sendAuthEmail('magiclink', email); } // not yet wired to a UI button
// The sign-in screen asks for a 6-digit code, so we mail a code, not a link:
// auth-email generates the OTP server-side and sends it from noreply@mykunda.com.
// Returns { verify_type } — pass it to verifyEmailOtp().
// opts: { name, mode:'signin'|'signup', consent, consentMarketing, role }
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
    /* De rolkeuze van het aanmeldscherm. auth-email zet hem in de
       signup-metadata en handle_new_user() schrijft profiles.role. Beide
       kanten filteren op dezelfde drie waarden; 'admin' hoort er niet bij. */
    if(o.role === 'buyer' || o.role === 'seller' || o.role === 'agent') body.role = o.role;
  }
  return sendAuthEmail('email_code', email, body);
}

/* Rol van de ingelogde gebruiker zetten (buyer -> seller -> agent, alleen
   omhoog). Loopt via de edge function set-role omdat de rol 'authenticated'
   geen UPDATE-recht heeft op profiles.role — met opzet, want is_admin() leest
   die kolom. Gebruikt na een Google-aanmelding en straks vanuit het dashboard
   als een zoeker gaat aanbieden. */
async function setMyRole(role){
  if(!sb) throw new Error('backend-offline');
  const { data, error } = await sb.functions.invoke('set-role', { body: { role } });
  if(error) throw error;
  if(data && data.ok === false) throw new Error(data.error || 'set-role failed');
  return data;
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

     Twee schakelaars, allebei uit reis 3 van de testronde (30-08-2026).

     opts.notify === false slaat de melding hélemaal over: de lead wordt alleen
     vastgelegd. Eén aanroeper gebruikt dat — de bezichtigingsaanvraag van een
     INGELOGDE bezoeker op property.html. Die loopt door de echte keten, en
     notify-viewing mailt dan al béide partijen: de verkoper krijgt de tijden
     mét de knop "Choose a time", de aanvrager zijn bevestiging. Liet je
     notify-lead er daarnaast op los, dan kreeg de verkoper drie mails en de
     koper twee, allemaal binnen twee seconden, met bijna dezelfde onderwerpen.
     Gemeten, eerst aan de verkoperskant en na een halve reparatie aan de
     koperskant. De keten is de eigenaar van die communicatie; deze functie
     legt alleen de lead vast.

     opts.skipTeam laat alleen de teammail weg en houdt de auto-reply overeind.
     Nu niet in gebruik, maar het is de juiste schakelaar zodra er een pad komt
     waar de bezoeker wél een bevestiging van ons moet krijgen en de backoffice
     al langs een andere weg is ingelicht. */
  if(leadId && !(opts && opts.notify === false)) {
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
  'service_charge','min_term_months','plot_width_m',
  /* Prijshistorie, 30-08-2026. */
  'show_price_history'];
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
/* Public URL for a listing photo.
   Pass a width and the URL goes through Supabase's image transformation
   endpoint: it resizes on the fly and serves WebP to browsers that accept
   it, so a search card fetches a card-sized image instead of the full
   stored original. That endpoint is billed per origin image per month
   (Pro: 100 included, then $5 per 1,000), so callers opt in per surface —
   omit the width and the behaviour is exactly as before. */
function mediaUrl(path, isDoc, width){
  if(!sb) return path;
  if(isDoc){ return null; }                     // private — fetch a signed URL when needed
  const opts = width ? { transform:{ width:width, resize:'contain', quality:75 } } : undefined;
  return sb.storage.from('listing-photos').getPublicUrl(path, opts).data.publicUrl;
}

/* Alle foto's van één advertentie, in de volgorde waarin de aanbieder ze heeft
   neergezet (sort komt uit uploadFile). property.html riep dit al aan voor de
   galerij, maar de functie bestond nergens: de galerij viel daardoor altijd
   terug op de coverfoto, hoeveel foto's er ook waren geüpload.

   Documenten blijven eruit — niet alleen omdat de galerij ze niet wil, maar
   omdat ze in de private bucket staan en geen publieke URL hebben. Het
   RLS-beleid "media select" laat foto's van een actieve advertentie aan
   iedereen zien en de rest alleen aan de eigenaar of een beheerder; een
   bezoeker die niets mag zien krijgt hier dus gewoon een lege lijst. */
async function getListingPhotos(listingId, width){
  if(!sb || !listingId) return [];
  const { data, error } = await sb.from('listing_media')
    .select('storage_path, sort, is_document, created_at')
    .eq('listing_id', listingId)
    .order('sort', { ascending:true })
    .order('created_at', { ascending:true });
  if(error || !data) return [];
  return data
    .filter(function(m){ return !m.is_document && m.storage_path; })
    .map(function(m){ return mediaUrl(m.storage_path, false, width || 1200); })
    .filter(Boolean);
}

/* ---------------- Het kantoor achter een professionele aanbieder ----------
   Eén rij per bedrijf in `agencies`, met een logo of foto in de publieke
   bucket agency-logos en een eigen website. De rij is publiek leesbaar (de
   advertentiepagina toont hem), maar alleen te schrijven door wie hem heeft
   aangemaakt — zie de policy "agencies update" in migratie 20260902_01.

   Waarom created_by en niet profiles.agency_id: die kolom mag een gebruiker
   niet zelf zetten, en dat moet zo blijven, anders hangt iedereen zich aan
   het kantoor van een ander. Zodra er teams zijn (fase 4) wordt agency_id de
   tweede weg; de policies kennen hem al.
   -------------------------------------------------------------------------- */

/* Het kantoor van de ingelogde gebruiker, of null. Eerst de koppeling op het
   profiel, want die wint zodra er een team is; anders de rij die hij zelf
   heeft aangemaakt. */
async function fetchMyAgency(){
  if(!sb) return null;
  const u = await currentUser(); if(!u) return null;
  try{
    const prof = await sb.from('profiles').select('agency_id').eq('id', u.id).maybeSingle();
    const aid = prof && prof.data && prof.data.agency_id;
    if(aid){
      const one = await sb.from('agencies').select('*').eq('id', aid).maybeSingle();
      if(one && one.data) return one.data;
    }
  }catch(e){}
  const { data, error } = await sb.from('agencies').select('*')
    .eq('created_by', u.id).order('created_at',{ascending:true}).limit(1);
  if(error){ console.warn('fetchMyAgency:', error.message); return null; }
  return (data && data[0]) || null;
}

/* Een slug die niet botst. De naam van een ander kantoor overnemen mag niet
   stil dezelfde rij opleveren — dat was precies het gat in ensureAgency(). */
function agencySlugify(s){
  return String(s||'').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'')
    .replace(/[^a-z0-9]+/g,'-').replace(/^-+|-+$/g,'').slice(0,60);
}
async function freeAgencySlug(base){
  if(!sb) return base;
  let slug = base || 'agency';
  for(let i=0;i<25;i++){
    const hit = await sb.from('agencies').select('id').eq('slug', slug).maybeSingle();
    if(!hit || !hit.data) return slug;
    slug = (base || 'agency').slice(0,54) + '-' + (i+2);
  }
  return (base||'agency').slice(0,50) + '-' + Date.now().toString(36);
}

/* Maakt het kantoor van deze gebruiker aan als het er nog niet is. */
async function createMyAgency(fields){
  if(!sb) throw new Error('backend-offline');
  const u = await currentUser(); if(!u) throw new Error('not-signed-in');
  const mine = await fetchMyAgency();
  if(mine) return mine;
  const name = String((fields && fields.name) || '').trim();
  if(!name) throw new Error('no-name');
  const row = Object.assign({}, fields, {
    name: name,
    slug: await freeAgencySlug(agencySlugify(name)),
    created_by: u.id
  });
  const { data, error } = await sb.from('agencies').insert(row).select('*').single();
  if(error) throw error;
  return data;
}

/* Alleen de velden die een kantoor over zichzelf mag zeggen. De database
   houdt dezelfde lijst aan met kolomrechten; deze lijst is er zodat een
   typefout in het formulier niet stil een 403 wordt. */
const AGENCY_EDITABLE = ['name','about','phone','whatsapp','email','website','logo_path','areas'];
async function saveMyAgency(agencyId, patch){
  if(!sb) throw new Error('backend-offline');
  const clean = {};
  AGENCY_EDITABLE.forEach(function(k){ if(k in (patch||{})) clean[k] = patch[k]; });
  if(!Object.keys(clean).length) return null;
  const { data, error } = await sb.from('agencies').update(clean).eq('id', agencyId).select('*').single();
  if(error) throw error;
  return data;
}

/* Logo of foto. Één bestand per kantoor: de naam is vast, zodat een tweede
   upload de eerste vervangt en er geen wees achterblijft. upsert mag, want
   de schrijfregel op de bucket kijkt naar de map en die is de agency-id. */
async function uploadAgencyLogo(agencyId, file){
  if(!sb) throw new Error('backend-offline');
  if(!agencyId) throw new Error('no-agency');
  const type = (file && file.type) || '';
  const ext = type.includes('png') ? 'png' : type.includes('webp') ? 'webp'
            : type.includes('avif') ? 'avif' : 'jpg';
  const path = agencyId + '/logo.' + ext;
  const up = await sb.storage.from('agency-logos').upload(path, file, { upsert:true, contentType:type||'image/jpeg' });
  if(up.error) throw up.error;
  return path;
}
async function deleteAgencyLogo(path){
  if(!sb || !path) return;
  try{ await sb.storage.from('agency-logos').remove([path]); }catch(e){ console.warn('logo remove:', e.message); }
}
/* Publieke URL. Zelfde transformatietruc als mediaUrl(): geef een breedte mee
   en de opslag schaalt zelf, zodat een 2 MB logo geen 2 MB over de lijn is. */
function agencyLogoUrl(path, width){
  if(!sb || !path) return '';
  const opts = width ? { transform:{ width:width, resize:'contain', quality:82 } } : undefined;
  return sb.storage.from('agency-logos').getPublicUrl(path, opts).data.publicUrl;
}

/* Het overige aanbod van hetzelfde kantoor, voor het blok "More from this
   office" op de advertentiepagina. Alleen wat live staat — de leesregel op
   listings laat een concept toch niet zien, maar dit scheelt een rondje. */
async function fetchAgencyListings(agencyId, excludeId, limit){
  if(!sb || !agencyId) return [];
  const { data, error } = await sb.from('listings')
    .select('id,title,area,price,kind,price_period,category,listing_media(storage_path,is_document,sort)')
    .eq('agency_id', agencyId)
    .in('status', ['active','under_offer'])
    .order('created_at', { ascending:false })
    .limit((limit || 3) + 1);
  if(error){ console.warn('fetchAgencyListings:', error.message); return []; }
  return (data||[])
    .filter(function(r){ return String(r.id) !== String(excludeId||''); })
    .slice(0, limit || 3)
    .map(function(r){
      const ph = (r.listing_media||[])
        .filter(function(m){ return !m.is_document && m.storage_path; })
        .sort(function(a,b){ return (a.sort||0)-(b.sort||0); })[0];
      return { id:r.id, title:r.title, area:r.area||'', price:Number(r.price)||0,
               kind:r.kind, price_period:r.price_period||null, category:r.category,
               img: ph ? mediaUrl(ph.storage_path, false, 400) : '' };
    });
}

/* ---------------- Viewings ----------------
   Sinds 30-08-2026 loopt alles over public.viewings; viewings_legacy_v0 is
   afgedankt en heeft geen schrijfregels meer. Schrijven gaat uitsluitend via de
   drie SECURITY DEFINER-functies, die zelf controleren of de aanroeper wel
   deelnemer is: propose_viewing, respond_viewing en cancel_viewing.

   requestViewing() stond hier tot vandaag. Die schreef een losse rij in de oude
   tabel voor bezoekers zonder account. De knoppen Accept en Change van het
   dashboard werkten daarop, maar riepen daarna notify-viewing aan met een id
   dat in `viewings` niet bestaat — het scherm zei "the buyer has been emailed"
   en er ging niets weg. Een bezoeker zonder account levert nu een lead op
   (source 'viewing'); die is voor de eigenaar van de advertentie zichtbaar
   sinds de policy "leads owner read". */

/* De uitgenodigde partij bevestigt één van de voorgestelde tijden.
   respond_viewing() eist dat je de invitee bent en dat de tijd echt is
   aangeboden; die controle hoort in de database, niet in de knop. */
async function confirmViewing(viewingId, slotIso){
  if(!sb) throw new Error('backend-offline');
  const { error } = await sb.rpc('respond_viewing', {
    p_viewing_id: viewingId,
    p_slot: slotIso || null
  });
  if(error) throw error;
  try{ await sb.functions.invoke('notify-viewing', { body:{ viewing_id: viewingId } }); }catch(e){
    console.warn('notify-viewing:', e && e.message);
  }
  return true;
}

/* Geen van de tijden kan: afwijzen met een leeg slot. respond_viewing zet de
   status op 'declined' en schrijft er een bericht bij in het gesprek. */
async function declineViewing(viewingId){
  return confirmViewing(viewingId, null);
}

/* Afzeggen kan door beide partijen, zolang de bezichtiging nog loopt. */
async function cancelViewing(viewingId, reason){
  if(!sb) throw new Error('backend-offline');
  const { error } = await sb.rpc('cancel_viewing', { p_viewing_id: viewingId, p_reason: reason || null });
  if(error) throw error;
  try{ await sb.functions.invoke('notify-viewing', { body:{ viewing_id: viewingId } }); }catch(e){
    console.warn('notify-viewing:', e && e.message);
  }
  return true;
}
/* ---------------- Payments ----------------
   No browser-side receipt call lives here on purpose. The customer receipt and
   the backoffice notification hang off a trigger on `payments`
   (payments_notify_status -> notify_payment_status_change), so they fire on
   every switch to succeeded — automatic reconciliation and a hand-confirmed
   bank line behave identically. Calling notify-payment from a page as well
   would send every confirmed payment out twice. */

/* Andere tijden voorstellen. Dat is geen wijziging van de bestaande rij maar
   een nieuw voorstel op hetzelfde gesprek; propose_viewing zet het openstaande
   voorstel zelf op 'cancelled' met reden 'superseded'. Vandaar dat deze functie
   een conversation_id vraagt en geen viewing_id. Maximaal drie tijden, en geen
   tijd binnen het komende halfuur — dat bewaakt de database. */
async function proposeSlots(conversationId, slots, note){
  if(!sb) throw new Error('backend-offline');
  const { data: viewingId, error } = await sb.rpc('propose_viewing', {
    p_conversation_id: conversationId,
    p_slots: slots,
    p_note: note || null
  });
  if(error) throw error;
  try{ await sb.functions.invoke('notify-viewing', { body:{ viewing_id: viewingId } }); }catch(e){
    console.warn('notify-viewing:', e && e.message);
  }
  return viewingId;
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
/* ---- Favorieten horen bij het account (03-09-2026) ----
   Het hartje op search.html en property.html schreef tot vandaag alleen naar
   localStorage (toggleFav in app.js); dbToggleFavorite() bestond maar niets
   riep het aan. Het dashboard leest daarentegen uit de tabel `favorites` —
   dus wie ingelogd een hartje zette, zag op zijn dashboard "No favourites
   yet", en de prijsdaling-melding op favorieten kon nooit afgaan.

   Nu: setFavorite() schrijft één favoriet expliciet aan of uit (geen toggle,
   zodat een dubbele klik nooit de verkeerde kant op valt), en syncFavorites()
   brengt bij het laden van elke pagina de lokale lijst en het account bij
   elkaar. De eerste keer worden de lokale hartjes van vóór het inloggen naar
   het account gebracht; daarna is het account de bron en volgt localStorage,
   zodat een favoriet die op een andere telefoon is verwijderd hier niet
   terugkomt. De vlag mykunda_favs_db zegt "lokaal spiegelt het account". */
async function setFavorite(listingId, on){
  if(!sb) return null;
  const u = await currentUser(); if(!u) return null;
  if(on){
    const { error } = await sb.from('favorites')
      .upsert({ user_id: u.id, listing_id: listingId }, { onConflict: 'user_id,listing_id', ignoreDuplicates: true });
    if(error) throw error;
  }else{
    const { error } = await sb.from('favorites').delete().eq('user_id', u.id).eq('listing_id', listingId);
    if(error) throw error;
  }
  return !!on;
}
async function syncFavorites(){
  if(!sb) return null;
  let cached=null; try{ cached = JSON.parse(localStorage.getItem('mykunda_user')||'null'); }catch(e){}
  if(!cached) return null; /* geen sessie in de cache → niets ophalen voor een anonieme bezoeker */
  const u = await currentUser(); if(!u) return null;
  const local = (typeof getFavs==='function') ? getFavs() : [];
  const { data, error } = await sb.from('favorites').select('listing_id').eq('user_id', u.id);
  if(error){ console.warn('syncFavorites:', error.message); return null; }
  const remote = (data||[]).map(function(r){ return r.listing_id; });
  let mirrored = false;
  try{ mirrored = localStorage.getItem('mykunda_favs_db') === '1'; }catch(e){}
  let merged = remote.slice();
  if(!mirrored){
    /* Eerste keer na inloggen: lokale hartjes meenemen. Alleen echte
       listing-id's (uuid); een rij kan nog steeds falen op de FK als de
       advertentie inmiddels weg is, daarom per stuk en zonder de rest te
       laten vallen. */
    const push = local.filter(function(id){ return remote.indexOf(id)<0 && /^[0-9a-f]{8}-[0-9a-f-]{27}$/i.test(String(id)); });
    for(const id of push){
      const { error: e1 } = await sb.from('favorites')
        .upsert({ user_id: u.id, listing_id: id }, { onConflict: 'user_id,listing_id', ignoreDuplicates: true });
      if(!e1) merged.push(id);
    }
    merged = Array.from(new Set(merged));
  }
  try{
    localStorage.setItem('mykunda_favs', JSON.stringify(merged));
    localStorage.setItem('mykunda_favs_db', '1');
  }catch(e){}
  if(typeof paintFavs==='function') paintFavs();
  return merged;
}
/* Meteen na de naamcorrectie, zelfde tik: één query voor wie ingelogd is,
   niets voor wie dat niet is. */
(function(){
  var run = function(){ setTimeout(function(){ syncFavorites().catch(function(e){ console.warn('syncFavorites:', e && e.message); }); }, 0); };
  if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded', run);
  else run();
})();

async function saveSearch(filters, area, channel){
  if(!sb) throw new Error('backend-offline');
  const u = await currentUser(); if(!u) throw new Error('not-signed-in');
  const { data, error } = await sb.from('saved_searches')
    .insert({ user_id: u.id, filters, area, channel: channel||'email' }).select().single();
  if(error) throw error;
  return data;
}

/* ---- Teruglezen (30-08-2026) ----
   Tot vandaag schreven saveSearch() en dbToggleFavorite() wél, maar was er geen
   enkele leesfunctie: de voetlinks "Saved searches" en "Favorites" wezen naar
   dashboard.html en dat toonde geen van beide. Wat een bezoeker bewaarde
   verdween uit zijn zicht op het moment dat hij het bewaarde. */

async function fetchSavedSearches(){
  if(!sb) return null;
  const u = await currentUser(); if(!u) return null;
  const { data, error } = await sb.from('saved_searches')
    .select('*').eq('user_id', u.id).order('created_at', { ascending:false });
  if(error){ console.warn('fetchSavedSearches:', error.message); return null; }
  return data || [];
}
/* patch: { label } of { channel:'email'|'off' } — meer velden mag deze functie niet zetten. */
async function updateSavedSearch(id, patch){
  if(!sb) throw new Error('backend-offline');
  const u = await currentUser(); if(!u) throw new Error('not-signed-in');
  const clean = {};
  if(typeof patch.label === 'string') clean.label = patch.label.trim().slice(0,80) || null;
  if(patch.channel === 'email' || patch.channel === 'off') clean.channel = patch.channel;
  if(!Object.keys(clean).length) return null;
  const { data, error } = await sb.from('saved_searches')
    .update(clean).eq('id', id).eq('user_id', u.id).select().single();
  if(error) throw error;
  return data;
}
async function deleteSavedSearch(id){
  if(!sb) throw new Error('backend-offline');
  const u = await currentUser(); if(!u) throw new Error('not-signed-in');
  const { error } = await sb.from('saved_searches').delete().eq('id', id).eq('user_id', u.id);
  if(error) throw error;
  return true;
}

/* Favorieten mét de advertentie erbij. Let op de lege embed: RLS op listings
   laat alleen active/under_offer door (of je eigen advertenties), dus een
   favoriet die is verkocht of ingetrokken komt terug als listings:null. Dat is
   informatie, geen fout — het dashboard zegt dan dat hij niet meer aanstaat. */
async function fetchFavorites(){
  if(!sb) return null;
  const u = await currentUser(); if(!u) return null;
  const { data, error } = await sb.from('favorites')
    .select('listing_id, created_at, listings(*, listing_media(*))')
    .eq('user_id', u.id).order('created_at', { ascending:false });
  if(error){ console.warn('fetchFavorites:', error.message); return null; }
  return (data || []).map(function(r){
    return {
      listing_id: r.listing_id,
      saved_at: r.created_at,
      listing: r.listings ? dbListingToCard(r.listings) : null
    };
  });
}
/* De laatste prijswijziging per advertentie, voor de "was D…"-melding op
   favorieten. De trigger listings_price_event() schrijft drie soorten:
   'listed' bij publicatie, 'change' bij een prijswijziging (pct negatief is een
   daling) en 'sold' bij verkoop. Alleen 'change' is hier interessant.

   Ziet een bezoeker niets, dan komt hier gewoon een lege lijst terug en blijft
   de melding weg: de leesregel op listing_price_events eist dat de advertentie
   publiek staat, dat de aanbieder prijshistorie aan heeft laten staan, en dat
   de hoofdschakelaar app_settings.price_history_public aan staat. Geen fout,
   geen lege badge — niets. */
async function fetchPriceDrops(listingIds){
  if(!sb || !listingIds || !listingIds.length) return {};
  const { data, error } = await sb.from('listing_price_events')
    .select('listing_id, old_price, new_price, pct, occurred_at')
    .in('listing_id', listingIds)
    .eq('event','change')
    .order('occurred_at', { ascending:false });
  if(error){ console.warn('fetchPriceDrops:', error.message); return {}; }
  const out = {};
  (data||[]).forEach(function(e){
    if(!out[e.listing_id] && Number(e.new_price) < Number(e.old_price)) out[e.listing_id] = e;
  });
  return out;
}

/* De hele prijsgeschiedenis van één advertentie, voor de objectpagina.
   Dezelfde leesregel als hierboven: mag de bezoeker niets zien, dan komt er een
   lege lijst terug en blijft het blok op de pagina weg. Geen fout, geen lege
   kop — niets. De oplopende volgorde is met opzet: een prijsverloop lees je
   van de eerste vraagprijs naar de laatste. */
async function fetchPriceHistory(listingId){
  if(!sb || !listingId) return [];
  const { data, error } = await sb.from('listing_price_events')
    .select('event, old_price, new_price, pct, occurred_at')
    .eq('listing_id', listingId)
    .order('occurred_at', { ascending: true });
  if(error){ console.warn('fetchPriceHistory:', error.message); return []; }
  return data || [];
}

async function removeFavorite(listingId){
  if(!sb) throw new Error('backend-offline');
  const u = await currentUser(); if(!u) throw new Error('not-signed-in');
  const { error } = await sb.from('favorites').delete().eq('user_id', u.id).eq('listing_id', listingId);
  if(error) throw error;
  return true;
}

/* Gesprekken van deze gebruiker, beide kanten. conversations draagt de
   ongelezen-tellers zelf (buyer_unread / seller_unread), dus dit is één query
   en geen telling over messages. */
async function fetchMyConversations(limit){
  if(!sb) return null;
  const u = await currentUser(); if(!u) return null;
  let q = sb.from('conversations')
    .select('*, listings(id, title, area)')
    .order('last_message_at', { ascending:false });
  if(limit) q = q.limit(limit);
  const { data, error } = await q;
  if(error){ console.warn('fetchMyConversations:', error.message); return null; }
  return (data || []).map(function(c){
    const asBuyer = c.buyer_id === u.id;
    return Object.assign({}, c, {
      _asBuyer: asBuyer,
      _unread: asBuyer ? (c.buyer_unread||0) : (c.seller_unread||0),
      _listing_title: (c.listings && c.listings.title) || 'A property'
    });
  });
}

/* Alles uit. Gebruikt door de afmeldlink onderaan de welkomstmail
   (dashboard.html?alerts=off): die wees tot 30-08-2026 naar een pagina die er
   niets mee deed. Zet zowel de marketingtoestemming als elke losse
   zoekopdracht-alert uit, zodat "uit" ook echt overal uit betekent. */
async function turnOffAllAlerts(){
  if(!sb) throw new Error('backend-offline');
  const u = await currentUser(); if(!u) throw new Error('not-signed-in');
  const { error: e1 } = await sb.from('profiles').update({ consent_marketing:false }).eq('id', u.id);
  if(e1) throw e1;
  const { error: e2 } = await sb.from('saved_searches').update({ channel:'off' }).eq('user_id', u.id);
  if(e2) throw e2;
  return true;
}

/* En weer aan. Symmetrisch met turnOffAllAlerts(): de schakelaar onder Account
   is een hoofdschakelaar, dus hij zet de alert op elke opgeslagen zoekopdracht
   ook weer aan. Anders zet je hem aan en gebeurt er niets, omdat elke losse
   zoekopdracht nog op 'off' staat van de vorige keer. Wie daarna één
   zoekopdracht stil wil hebben, zet die er los weer uit. */
async function turnOnAllAlerts(){
  if(!sb) throw new Error('backend-offline');
  const u = await currentUser(); if(!u) throw new Error('not-signed-in');
  const { error: e1 } = await sb.from('profiles').update({ consent_marketing:true }).eq('id', u.id);
  if(e1) throw e1;
  const { error: e2 } = await sb.from('saved_searches').update({ channel:'email' }).eq('user_id', u.id);
  if(e2) throw e2;
  return true;
}

/* fetchMyBookings() stond hier, op de afgedankte tabel. Hij is samengevoegd
   met fetchMyViewings() verderop: één query, beide kanten. */

/* Het eigen profiel: rol, naam en de voorkeuren die het dashboard toont.
   unsubscribe_token staat er met opzet NIET bij — dat veld mag de browser
   nooit zien. */
async function fetchMyProfile(){
  if(!sb) return null;
  const u = await currentUser(); if(!u) return null;
  const { data, error } = await sb.from('profiles')
    .select('id, role, full_name, email, phone, agency_id, consent_marketing, notify_messages, created_at')
    .eq('id', u.id).maybeSingle();
  if(error){ console.warn('fetchMyProfile:', error.message); return null; }
  return data;
}

/* Naam en telefoonnummer van de ingelogde gebruiker bijwerken (02-09-2026).
   Alleen deze twee: 'authenticated' mag van profiles precies acht kolommen
   schrijven, en van de drie die over de persoon zelf gaan heeft `locale`
   nergens een scherm. Het e-mailadres staat in auth.users en hoort daar — dat
   verhuist alleen op verzoek, via admin@.

   Tot vandaag stond hier niets en toonde het dashboard "Phone — Not added yet"
   zonder ergens een veld: wie zijn naam verkeerd typte bij het aanmelden droeg
   die naam voorgoed, in elke mail en elk gesprek.

   De naam gaat óók naar de metadata van de sessie. Niet omdat de site hem daar
   leest — profiles is de bron — maar omdat syncCachedUserName() bij het laden
   de naamcache uit die metadata heelt; zonder deze tweede schrijfactie zou de
   koptekst bij de volgende paginaweergave terugspringen naar de oude naam.
   Mislukt hij, dan is dat geen reden om de wijziging te laten stranden. */
async function saveMyDetails(patch){
  if(!sb) throw new Error('backend-offline');
  const u = await currentUser(); if(!u) throw new Error('not-signed-in');
  const has = function(k){ return Object.prototype.hasOwnProperty.call(patch||{}, k); };
  const clean = {};
  if(has('full_name')) clean.full_name = String(patch.full_name||'').trim().slice(0,80);
  if(has('phone')){
    const p = String(patch.phone||'').trim().slice(0,24);
    clean.phone = p || null;      // leeg is een geldige keuze: het nummer weghalen
  }
  if(!Object.keys(clean).length) return null;
  const { data, error } = await sb.from('profiles').update(clean)
    .eq('id', u.id).select('full_name, phone').maybeSingle();
  if(error) throw error;
  if(has('full_name') && clean.full_name){
    try{ await sb.auth.updateUser({ data: { full_name: clean.full_name } }); }
    catch(e){ console.warn('updateUser(full_name):', e && e.message); }
  }
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
    /* Sinds 30-08-2026 mee, want de sortering "Featured" en de voorpagina
       lezen hem nu echt. Zonder dit veld op de kaart is een Boost een
       aankoop zonder gevolg. Zie mkIsBoosted() in app.js. */
    boosted_until: r.boosted_until || null,
    price: Number(r.price)||0, title: r.title, street: r.street||'', area: r.area||'',
    beds: r.beds||0, baths: r.baths||0, sqm: r.sqm||0, plot: r.plot_sqm||0,
    tag: (r.features&&r.features[0])||'', photos: (r.listing_media||[]).filter(m=>!m.is_document).length||1,
    /* 1000px via de transformatie-URL. Dit ene veld voedt zowel de zoekkaart
       als de hero van property.html, dus het is de bovenkant van wat een kaart
       nodig heeft en de onderkant van wat de hero wil. Zodra de kaarten een
       eigen veld krijgen kan dit omlaag naar 600 en de hero naar 1600. */
    img: photo ? mediaUrl(photo.storage_path,false,1000) : '',
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

/* De strook op de voorpagina. "Featured on the homepage for 30 days" is de
   helft van wat een Boost verkoopt, dus die komt eerst — en dan pas de rest.

   Twee queries en geen sortering achteraf, met opzet: een advertentie met een
   lopende Boost die buiten de nieuwste tien valt zou anders nooit bovenaan
   komen, precies bij de aanbieder die ervoor betaald heeft. De eerste query
   vraagt alleen wat nu geboost is, de tweede vult aan en laat die eruit.
   Staat er niets geboost, dan is het één query zoals vroeger. */
async function fetchFeaturedListings(limit){
  if(!sb) return null;
  const n = limit || 4;
  const nu = new Date().toISOString();
  const kolommen = '*, listing_media(*)';

  let geboost = [];
  const { data: b, error: be } = await sb.from('listings').select(kolommen)
    .in('status',['active','under_offer'])
    .gt('boosted_until', nu)
    .order('boosted_until',{ascending:false})   // wie het langst nog loopt, bovenaan
    .limit(n);
  if(be) console.warn('fetchFeaturedListings (boost):', be.message);
  else geboost = b || [];

  if(geboost.length >= n) return geboost.slice(0, n).map(dbListingToCard);

  let q = sb.from('listings').select(kolommen)
    .in('status',['active','under_offer'])
    .order('is_verified_title',{ascending:false})  // verified first
    .order('created_at',{ascending:false})
    .limit(n - geboost.length);
  if(geboost.length) q = q.not('id','in','('+geboost.map(r=>r.id).join(',')+')');
  const { data, error } = await q;
  if(error){
    console.warn('fetchFeaturedListings:', error.message);
    return geboost.length ? geboost.map(dbListingToCard) : null;
  }
  return geboost.concat(data||[]).map(dbListingToCard);
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
    .select('id, sender_id, body, created_at, read_at, viewing_id')
    .eq('conversation_id', conversationId)
    .order('created_at', { ascending: true });
  if(error){ console.warn('fetchMessages:', error.message); return null; }
  return data;
}

/* De bezichtigingen van één gesprek (03-09-2026). propose_viewing() schrijft
   naast de rij in `viewings` een gewoon bericht met viewing_id; tot vandaag
   las messages.html dat als platte tekst, zonder knoppen, terwijl het
   dashboard de koper juist naar "your messages" stuurde om een tijd te kiezen.
   Met deze lijst tekent de chat de kaart uit de databaserij: de tijden, wie
   mag kiezen, en de uitkomst. De leesregel op viewings scoopt op deelnemer. */
async function fetchConversationViewings(conversationId){
  if(!sb) return null;
  const { data, error } = await sb.from('viewings')
    .select('id, conversation_id, proposer_id, invitee_id, status, slots, chosen_slot, note, message_id, cancel_reason, created_at')
    .eq('conversation_id', conversationId)
    .order('created_at', { ascending: true });
  if(error){ console.warn('fetchConversationViewings:', error.message); return null; }
  return data || [];
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

/* Submit a draft for review (changes status from draft to pending_review).
   review_note gaat in dezelfde stap leeg. Die reden hoort bij de vórige ronde:
   hij staat in het dashboard van de aanbieder boven de advertentie, en zou
   daar na het herindienen blijven staan alsof er nog iets mis is. Wijst de
   backoffice hem opnieuw af, dan schrijft die er een nieuwe reden in. */
async function submitForReview(listingId, opts){
  if(!sb) throw new Error('backend-offline');
  const { data, error } = await sb.from('listings')
    .update({ status: 'pending_review', review_note: null })
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

/* ---------------- De professionele back-office (fase 5) ----------------
   Alles hieronder is voor de aanbieder met een portefeuille. Het leunt op wat
   er al lag en nergens op aangesloten was: leads.stage met zeven fases,
   leads.assigned_to, mandate_expires_on, en de bezoekcijfers. */

/* De leads op de eigen advertenties, met de advertentie erbij zodat de
   pijplijn kan tonen waar een lead over gaat. Eén query in plaats van een
   lijstje ids: de leesregel "leads owner read" scoopt al op eigenaar/agent. */
async function fetchLeadPipeline(limit){
  if(!sb) return null;
  const u = await currentUser();
  if(!u) return null;
  let q = sb.from('leads')
    .select('*, listings(id, title, area, owner_id, agent_id)')
    .order('created_at', { ascending: false });
  if(limit) q = q.limit(limit);
  const { data, error } = await q;
  if(error){ console.warn('fetchLeadPipeline:', error.message); return null; }
  return (data||[]).map(function(l){
    const li = l.listings || {};
    /* Reactietijd in uren, en alleen als hij écht meetbaar is: contacted_at
       gezet én na created_at. Een lead die nog niemand aanraakte heeft geen
       reactietijd, geen nul. */
    let hrs = null;
    if(l.contacted_at && l.created_at){
      const d = (new Date(l.contacted_at) - new Date(l.created_at)) / 3600000;
      if(isFinite(d) && d >= 0) hrs = d;
    }
    return Object.assign({}, l, {
      _listing_title: li.title || (l.listing_id ? 'A property' : 'General enquiry'),
      _listing_area: li.area || '',
      _reply_hours: hrs
    });
  });
}

/* Eén lead bijwerken. De database staat alleen stage, contacted_at, note,
   lost_reason en assigned_to toe (kolomrechten sinds 30-08-2026), dus wat hier
   langs komt wordt eerst tot die vijf teruggebracht — een tikfout hoort een
   lege update te zijn, geen fout op iets waar we toch niet bij mogen. */
const LEAD_WRITABLE = ['stage','contacted_at','note','lost_reason','assigned_to'];
async function updateLead(leadId, patch){
  if(!sb) throw new Error('backend-offline');
  const clean = {};
  LEAD_WRITABLE.forEach(function(k){ if(patch && k in patch) clean[k] = patch[k]; });
  if(!Object.keys(clean).length) return null;
  const { data, error } = await sb.from('leads').update(clean).eq('id', leadId).select().single();
  if(error) throw error;
  return data;
}

/* Dagtotalen van de bezoeken, voor de statistiekweergave. Vult de rollup niet
   aan en verzint niets: staat er voor een dag niets, dan waren er die dag geen
   bezoeken (of draaide de rollup nog niet). */
async function fetchViewDays(listingIds, sinceIso){
  if(!sb || !listingIds || !listingIds.length) return [];
  let q = sb.from('listing_view_days')
    .select('listing_id, day, views')
    .in('listing_id', listingIds)
    .order('day', { ascending: true });
  if(sinceIso) q = q.gte('day', String(sinceIso).slice(0,10));
  const { data, error } = await q;
  if(error){ console.warn('fetchViewDays:', error.message); return []; }
  return data || [];
}

/* De eigen betalingen — bonnen en facturen. De leesregel op payments scoopt op
   user_id, dus dit zijn alleen aankopen van deze gebruiker. */
async function fetchMyPayments(limit){
  if(!sb) return null;
  const u = await currentUser();
  if(!u) return null;
  let q = sb.from('payments')
    .select('id, reference, listing_id, plan_id, amount_minor, currency, status, method, paid_at, created_at, fulfilment_status, listings(id, title)')
    .order('created_at', { ascending: false });
  if(limit) q = q.limit(limit);
  const { data, error } = await q;
  if(error){ console.warn('fetchMyPayments:', error.message); return null; }
  return data || [];
}

/* Meerdere advertenties tegelijk op een status zetten. Bewust één rij per
   aanroep in plaats van één update met .in(): zo weet de knop precies welke
   advertentie niet lukte, en blijft de rest staan. */
async function bulkSetListingStatus(listingIds, status){
  if(!sb) throw new Error('backend-offline');
  const ok = [], mis = [];
  for(const id of (listingIds||[])){
    const { error } = await sb.from('listings').update({ status: status }).eq('id', id);
    if(error){ mis.push({ id: id, message: error.message }); }
    else ok.push(id);
  }
  return { ok: ok, failed: mis };
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

/* Alle bezichtigingen van deze gebruiker — beide kanten in één query.
   Er waren hier twee functies: fetchMyViewings() voor de verkoperskant en
   fetchMyBookings() voor de koperskant, allebei op de afgedankte tabel. De
   leesregel op `viewings` scoopt al op deelnemer, dus één query volstaat.

   Welke kant je bent hangt niet af van wie het voorstel deed maar van wie de
   advertentie is: een verkoper mag zelf een tijd voorstellen en blijft dan nog
   steeds de verkoper. _mustRespond zegt of de bal bij jou ligt. */
async function fetchMyViewings(limit){
  if(!sb) return null;
  const u = await currentUser();
  if(!u) return null;
  let q = sb.from('viewings')
    .select('*, listings(id, title, area, owner_id, agent_id)')
    .order('created_at', { ascending: false });
  if(limit) q = q.limit(limit);
  const { data, error } = await q;
  if(error){ console.warn('fetchMyViewings:', error.message); return null; }
  return (data||[]).map(function(v){
    const l = v.listings || {};
    const mine = (l.owner_id === u.id) || (l.agent_id === u.id);
    return Object.assign({}, v, {
      _listing_title: l.title || 'A property',
      _side: mine ? 'seller' : 'buyer',
      _mustRespond: v.status === 'proposed' && v.invitee_id === u.id,
      _when: v.chosen_slot || (Array.isArray(v.slots) && v.slots.length ? v.slots[0] : null)
    });
  });
}
/* Blijft bestaan omdat het dashboard er nog naar vraagt; het is nu dezelfde
   lijst, alleen de koperskant ervan. */
async function fetchMyBookings(limit){
  const all = await fetchMyViewings(limit);
  return all ? all.filter(function(v){ return v._side === 'buyer'; }) : all;
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
