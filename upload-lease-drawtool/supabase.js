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
  if(data && data.ok===false && !data.no_account && !data.already_exists){
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
async function submitLead(source, fields){
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

  // 2) fire the notification email (Edge Function) — only if we got an id
  if(leadId) {
    try{
      const fnRes = await sb.functions.invoke('notify-lead', { body: { lead_id: leadId } });
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
  const { data, error } = await sb.from('listings').select('*, listing_media(*)').eq('id', id).single();
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
const OPTIONAL_COLUMNS = ['boundary','beach_m'];
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
async function requestViewing(v){
  if(!sb){ console.info('[demo] viewing not sent:', v); return { demo:true }; }
  const { data, error } = await sb.from('viewings').insert(v).select().single();
  if(error) throw error;
  try{ await sb.functions.invoke('notify-viewing', { body:{ viewing_id: data.id } }); }catch(e){}
  return data;
}
/* ---------------- Payments ----------------
   Checkout hands the finished order to notify-payment: a branded receipt to
   the customer and an action-required notification to the backoffice. Never
   throws — a failed email must not break the confirmation screen. */
async function notifyPayment(order){
  if(!sb){ console.info('[demo] payment notification not sent:', order); return { demo:true }; }
  try{
    const { data, error } = await sb.functions.invoke('notify-payment', { body: order });
    if(error) console.warn('notify-payment returned error:', error.message || error);
    return data;
  }catch(e){
    console.warn('notify-payment not reachable — no receipt sent:', e.message);
    return null;
  }
}

async function proposeSlots(viewingId, slots){
  if(!sb) throw new Error('backend-offline');
  const { data, error } = await sb.from('viewings')
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
  return {
    id: r.id, cat: r.category, type: r.kind,
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
    flood_risk: r.flood_risk||'no', fencing: r.fencing||'none'
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

/* ============================================================
   Sprint 5 — WhatsApp & notification preferences
   ============================================================ */

/* Fetch the current user's notification preferences */
async function fetchNotifPrefs(){
  if(!sb) return null;
  const u = await currentUser();
  if(!u) return null;
  const { data, error } = await sb.from('notification_prefs').select('*').eq('user_id', u.id).single();
  if(error){
    if(error.code==='PGRST116'){
      const { data: created } = await sb.from('notification_prefs').insert({ user_id: u.id }).select().single();
      return created;
    }
    console.warn('fetchNotifPrefs:', error.message);
    return null;
  }
  return data;
}

/* Update notification preferences */
async function updateNotifPrefs(prefs){
  if(!sb) throw new Error('backend-offline');
  const u = await currentUser();
  if(!u) throw new Error('not-signed-in');
  const row = { ...prefs, updated_at: new Date().toISOString() };
  const { data, error } = await sb.from('notification_prefs')
    .upsert({ user_id: u.id, ...row })
    .select().single();
  if(error) throw error;
  return data;
}

/* Send a WhatsApp notification via the wa-notify Edge Function */
async function sendWhatsAppNotification(to, template, params){
  if(!sb) return;
  try{
    await sb.functions.invoke('wa-notify', { body: { to, template, params } });
  }catch(e){ console.warn('wa-notify:', e.message); }
}

/* Send a plain WhatsApp text message (within 24h window) */
async function sendWhatsAppText(to, text){
  if(!sb) return;
  try{
    await sb.functions.invoke('wa-notify', { body: { to, text } });
  }catch(e){ console.warn('wa-notify text:', e.message); }
}

/* ============================================================
   Sprint 4 — Real-time messaging
   ============================================================ */

/* Find or create a conversation between current user and another user, optionally linked to a listing */
async function findOrCreateConversation(otherUserId, listingId){
  if(!sb) throw new Error('backend-offline');
  const u = await currentUser();
  if(!u) throw new Error('not-signed-in');
  // Check if conversation already exists
  const { data: existing } = await sb.from('conversations')
    .select('*')
    .or(`and(participant_a.eq.${u.id},participant_b.eq.${otherUserId}),and(participant_a.eq.${otherUserId},participant_b.eq.${u.id})`)
    .eq(listingId ? 'listing_id' : 'id', listingId || undefined)
    .limit(1);
  if(existing && existing.length) return existing[0];
  // Create new
  const { data, error } = await sb.from('conversations')
    .insert({ participant_a: u.id, participant_b: otherUserId, listing_id: listingId||null })
    .select().single();
  if(error) throw error;
  return data;
}

/* Start a conversation from a listing (buyer → seller/agent) */
async function startConversationForListing(listingId, firstMessage){
  if(!sb) throw new Error('backend-offline');
  const u = await currentUser();
  if(!u) throw new Error('not-signed-in');
  // Get the listing to find the owner/agent
  const { data: listing } = await sb.from('listings').select('owner_id, agent_id').eq('id', listingId).single();
  if(!listing) throw new Error('listing-not-found');
  const recipientId = listing.agent_id || listing.owner_id;
  if(!recipientId) throw new Error('no-recipient');
  // Check existing conversation for this listing pair
  const { data: existing } = await sb.from('conversations').select('*')
    .eq('listing_id', listingId)
    .or(`participant_a.eq.${u.id},participant_b.eq.${u.id}`)
    .limit(1);
  let convo;
  if(existing && existing.length){
    convo = existing[0];
  } else {
    const { data, error } = await sb.from('conversations')
      .insert({ participant_a: u.id, participant_b: recipientId, listing_id: listingId })
      .select().single();
    if(error) throw error;
    convo = data;
  }
  // Send the first message if provided
  if(firstMessage){
    await sendMessage(convo.id, firstMessage);
  }
  return convo;
}

/* Fetch all conversations for the current user, with participant profiles */
async function fetchConversations(){
  if(!sb) return null;
  const u = await currentUser();
  if(!u) return null;
  const { data, error } = await sb.from('conversations')
    .select('*, listing:listings(id, title, price, kind, category)')
    .or(`participant_a.eq.${u.id},participant_b.eq.${u.id}`)
    .order('last_at', { ascending: false });
  if(error){ console.warn('fetchConversations:', error.message); return null; }
  // Attach other participant's profile
  const otherIds = (data||[]).map(c => c.participant_a === u.id ? c.participant_b : c.participant_a).filter(Boolean);
  const uniqueIds = [...new Set(otherIds)];
  let profiles = {};
  if(uniqueIds.length){
    const { data: profs } = await sb.from('profiles').select('id, full_name, email').in('id', uniqueIds);
    if(profs) profs.forEach(p=>{ profiles[p.id]=p; });
  }
  return (data||[]).map(c=>{
    const otherId = c.participant_a === u.id ? c.participant_b : c.participant_a;
    c._other = profiles[otherId] || { full_name: 'User', email: '' };
    c._isInitiator = c.participant_a === u.id;
    return c;
  });
}

/* Fetch messages for a conversation */
async function fetchMessages(conversationId){
  if(!sb) return null;
  const { data, error } = await sb.from('messages')
    .select('*')
    .eq('conversation_id', conversationId)
    .order('created_at', { ascending: true });
  if(error){ console.warn('fetchMessages:', error.message); return null; }
  return data;
}

/* Send a message */
async function sendMessage(conversationId, body, kind, payload){
  if(!sb) throw new Error('backend-offline');
  const u = await currentUser();
  if(!u) throw new Error('not-signed-in');
  const { data, error } = await sb.from('messages')
    .insert({
      conversation_id: conversationId,
      sender_id: u.id,
      body: body,
      kind: kind || 'text',
      payload: payload || {}
    }).select().single();
  if(error) throw error;
  return data;
}

/* Mark messages as read in a conversation (all unread messages not sent by me) */
async function markConversationRead(conversationId){
  if(!sb) return;
  const u = await currentUser();
  if(!u) return;
  await sb.from('messages')
    .update({ read_at: new Date().toISOString() })
    .eq('conversation_id', conversationId)
    .neq('sender_id', u.id)
    .is('read_at', null);
}

/* Get unread message count for current user across all conversations */
async function getUnreadCount(){
  if(!sb) return 0;
  const u = await currentUser();
  if(!u) return 0;
  // Get my conversation IDs
  const { data: convos } = await sb.from('conversations')
    .select('id')
    .or(`participant_a.eq.${u.id},participant_b.eq.${u.id}`);
  if(!convos || !convos.length) return 0;
  const ids = convos.map(c=>c.id);
  const { count, error } = await sb.from('messages')
    .select('id', { count: 'exact', head: true })
    .in('conversation_id', ids)
    .neq('sender_id', u.id)
    .is('read_at', null);
  if(error) return 0;
  return count || 0;
}

/* Subscribe to new messages in a conversation (Supabase Realtime) */
function subscribeToConversation(conversationId, onNewMessage){
  if(!sb) return null;
  const channel = sb.channel('msgs-'+conversationId)
    .on('postgres_changes',
      { event: 'INSERT', schema: 'public', table: 'messages', filter: 'conversation_id=eq.'+conversationId },
      (payload) => { if(onNewMessage) onNewMessage(payload.new); }
    )
    .subscribe();
  return channel;
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
  const { data: convos, error } = await sb.from('conversations')
    .select('id')
    .or(`participant_a.eq.${userId},participant_b.eq.${userId}`);
  if(error || !convos || !convos.length) return [];
  return convos.map(c => sb.channel('msgs-'+c.id+'-'+userId)
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
    status: 'draft',
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
    plan: fields.plan || 'basic'
  };
  return await insertTolerant('listings', row, draftId?'update':'insert', draftId);
}

/* Submit a draft for review (changes status from draft to pending_review) */
async function submitForReview(listingId){
  if(!sb) throw new Error('backend-offline');
  const { data, error } = await sb.from('listings')
    .update({ status: 'pending_review' })
    .eq('id', listingId).select().single();
  if(error) throw error;
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
  let q = sb.from('viewings').select('*')
    .in('listing_id', ids)
    .order('created_at', { ascending: false });
  if(limit) q = q.limit(limit);
  const { data, error } = await q;
  if(error){ console.warn('fetchMyViewings:', error.message); return null; }
  // attach listing titles for display
  return (data||[]).map(v=>({ ...v, _listing_title: titleMap[v.listing_id]||'Property' }));
}

/* Upload a file (photo or document) for a listing — returns the media row */
async function uploadFile(listingId, file, kind){
  if(!sb) throw new Error('backend-offline');
  const isDoc = (kind === 'document');
  const bucket = isDoc ? 'listing-docs' : 'listing-photos';
  const safeName = file.name.replace(/[^\w.\-]/g,'_');
  const path = listingId + '/' + Date.now() + '-' + safeName;
  const { error: upErr } = await sb.storage.from(bucket).upload(path, file);
  if(upErr) throw upErr;
  const { data, error } = await sb.from('listing_media')
    .insert({ listing_id: listingId, kind: kind||'photo', storage_path: path, is_document: isDoc, sort: 0 })
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
