// ============================================================
//  MyKunda — listing emails
//  Seller confirmation + backoffice notification, built on the
//  shared wrapper in ./email-template.ts (which re-exports both,
//  so importers only ever need email-template.ts).
//
//  NOTE: everything here is seller-typed input — it is escaped
//  before it reaches the HTML.
// ============================================================
import { BRAND, emailWrap, esc, escOpt, escLines, safeUrl, detailTable, sectionLabel, callout } from './email-template.ts';

export interface ListingInput {
  title?: string; area?: string; price?: number; deal?: string; cat?: string;
  beds?: number; baths?: number; sqm?: number; plot?: number;
  plan?: string; name?: string; email?: string; phone?: string;
  plus?: string; highlights?: string; nearby?: { place: string; dist: string }[];
  customFeats?: string; yearBuilt?: string; videoLink?: string;
  status?: string; id?: string;
  condition?: string; floors?: string; beach?: string; view?: string;
  security?: string; furnished?: string; water?: string; power?: string;
  road?: string; titleType?: string; elec?: string; landWater?: string;
  landBeach?: string; shape?: string; flood?: string; fence?: string;
  beachDist?: string; availDate?: string; features?: string[];
  negotiable?: boolean; docType?: string;
}

const PLAN_LABELS: Record<string, string> = { basic: 'Basic · Free', verified: 'Verified', managed: 'Managed' };
const COND: Record<string, string> = { good: 'Good condition', new: 'New build (0–5 yr)', renovation: 'Needs renovation' };
const FLOOR: Record<string, string> = { '1': 'Single storey', '2': '2 storeys', '3': '3+ storeys' };
const BEACH: Record<string, string> = { inland: 'Inland', walking: 'Walking distance', beachfront: 'Beachfront' };
const VIEW: Record<string, string> = { none: '', ocean: 'Ocean / sea view', garden: 'Garden / green view' };
const SEC: Record<string, string> = { none: '', wall: 'Walled compound', gated: 'Gated compound with guard' };
const FURN: Record<string, string> = { unfurnished: '', semi: 'Semi-furnished', furnished: 'Fully furnished' };
const WATER: Record<string, string> = { nawec: 'Nawec (mains)', borehole: 'Borehole', both: 'Nawec + borehole', none: 'No running water' };
const POWER: Record<string, string> = { no: '', solar: 'Solar panels', generator: 'Generator', both: 'Solar + generator' };
const ROAD: Record<string, string> = { laterite: 'Laterite / dirt road', tarmac: 'Tarmac / paved road', none: 'No road access' };
const TITLE: Record<string, string> = { alkalalo: 'Customary / Alkalalo', freehold: 'Freehold (title deed)', unclear: 'Unclear' };
const ELEC: Record<string, string> = { none: 'No electricity', nearby: 'Available nearby', present: 'Connected on plot' };
const LWATER: Record<string, string> = { none: 'No water', nearby: 'Water nearby', borehole: 'Borehole on plot', nawec: 'Nawec connected' };
const SHAPE: Record<string, string> = { regular: 'Regular (rectangular)', irregular: 'Irregular' };
const FLOOD: Record<string, string> = { no: 'No flood risk', low: 'Low risk (seasonal)', high: 'High risk' };
const FENCE: Record<string, string> = { none: 'Not fenced', partial: 'Partially fenced', full: 'Fully fenced / walled' };
const CAT: Record<string, string> = {
  villa: 'Villa', apartment: 'Apartment', compound: 'Compound', townhouse: 'Townhouse',
  penthouse: 'Penthouse', land: 'Land / plot', lodge: 'Lodge', commercial: 'Commercial',
};

const priceOf = (l: ListingInput) =>
  l.price ? `D ${Number(l.price).toLocaleString()}${l.deal === 'rent' ? '/mo' : ''}` : 'Price on request';

function allFeatures(l: ListingInput): string[] {
  return (l.features || []).concat(
    l.customFeats ? String(l.customFeats).split(',').map((s) => s.trim()).filter(Boolean) : [],
  );
}

function detailRows(l: ListingInput): [string, unknown][] {
  const isLand = l.cat === 'land';
  const rows: [string, unknown][] = [
    ['Property', escOpt(l.title) || 'Untitled'],
    ['Type', `${esc(CAT[l.cat || ''] || l.cat || 'House')} · For ${esc(l.deal || 'sale')}`],
    ['Location', escOpt(l.area)],
    ['Plus Code', escOpt(l.plus)],
    ['Price', esc(priceOf(l)) + (l.negotiable ? ' (negotiable)' : '')],
    ['Plan', esc(PLAN_LABELS[l.plan || 'basic'] || l.plan || 'Basic')],
  ];
  if (!isLand) {
    rows.push(
      ['Bedrooms', escOpt(l.beds)],
      ['Bathrooms', escOpt(l.baths)],
      ['Built area', l.sqm ? esc(l.sqm) + ' m²' : undefined],
      ['Plot size', l.plot ? esc(l.plot) + ' m²' : undefined],
      ['Condition', escOpt(COND[l.condition || ''])],
      ['Storeys', escOpt(FLOOR[l.floors || ''])],
      ['Security', escOpt(SEC[l.security || ''])],
      ['Furnished', escOpt(FURN[l.furnished || ''])],
      ['Water supply', escOpt(WATER[l.water || ''])],
      ['Power / backup', escOpt(POWER[l.power || ''])],
    );
  } else {
    rows.push(
      ['Plot size', l.plot ? esc(l.plot) + ' m²' : (l.sqm ? esc(l.sqm) + ' m²' : undefined)],
      ['Road access', escOpt(ROAD[l.road || ''])],
      ['Title type', escOpt(TITLE[l.titleType || ''])],
      ['Electricity', escOpt(ELEC[l.elec || ''])],
      ['Water', escOpt(LWATER[l.landWater || ''])],
      ['Plot shape', escOpt(SHAPE[l.shape || ''])],
      ['Flood risk', escOpt(FLOOD[l.flood || ''])],
      ['Fencing', escOpt(FENCE[l.fence || ''])],
    );
  }
  rows.push(
    ['Beach proximity', escOpt(BEACH[l.beach || ''] || BEACH[l.landBeach || ''])],
    ['View', escOpt(VIEW[l.view || ''])],
    ['Year built', escOpt(l.yearBuilt)],
    ['Available from', escOpt(l.availDate)],
    ['Document type', escOpt(l.docType)],
    ['Video', safeUrl(l.videoLink) ? `<a href="${safeUrl(l.videoLink)}" style="color:${BRAND.green}">${safeUrl(l.videoLink)}</a>` : undefined],
  );
  return rows;
}

function featureChips(l: ListingInput): string {
  const feats = allFeatures(l);
  if (!feats.length) return '';
  return `${sectionLabel('Features')}<p style="font-size:14px;color:${BRAND.ink};line-height:1.9;margin:0">${feats
    .map((f) => `<span style="display:inline-block;padding:5px 12px;border-radius:99px;font-size:13px;font-weight:600;background:${BRAND.green50};color:${BRAND.green}">${esc(f)}</span>`)
    .join(' ')}</p>`;
}

function highlightsBlock(l: ListingInput): string {
  if (!l.highlights) return '';
  return callout(`<p style="font-size:11.5px;color:${BRAND.muted};font-weight:700;text-transform:uppercase;letter-spacing:.06em;margin:0 0 5px">What makes it special</p>
    <p style="font-size:14.5px;color:${BRAND.ink};line-height:1.55;margin:0">${escLines(l.highlights)}</p>`);
}

function nearbyBlock(l: ListingInput): string {
  const places = (l.nearby || []).filter((n) => n && n.place);
  if (!places.length) return '';
  const rows = places.map((n) =>
    `<tr><td style="padding:9px 16px;color:${BRAND.ink};font-size:14px;border-bottom:1px solid ${BRAND.line}">${esc(n.place)}</td>
     <td style="padding:9px 16px;color:${BRAND.muted};font-size:14px;border-bottom:1px solid ${BRAND.line};text-align:right;font-weight:600">${esc(n.dist || '—')}</td></tr>`).join('');
  return `${sectionLabel('Nearby')}<table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="width:100%;border-collapse:collapse;background:${BRAND.paper};border-radius:10px">${rows}</table>`;
}

/* ---------- seller confirmation ---------- */

export function listingConfirmationEmail(listing: ListingInput): string {
  const fname = listing.name ? esc(String(listing.name).trim().split(' ')[0]) : '';
  const isBasic = (listing.plan || 'basic') === 'basic';
  const statusMsg = isBasic
    ? 'Your listing is <strong>live</strong> and buyers can find it right now.'
    : 'Your listing has been <strong>submitted for review</strong>. Our team checks your documents within 1–2 working days and the badge goes live as soon as that is done.';

  return emailWrap({
    heading: fname ? `Thank you, ${fname} — your listing is confirmed` : 'Your listing is confirmed',
    preheader: isBasic
      ? `${listing.title || 'Your property'} is live on MyKunda.`
      : `${listing.title || 'Your property'} is submitted for review — 1–2 working days.`,
    body: `<p style="margin:0 0 16px">${statusMsg}</p>
      ${detailTable(detailRows(listing))}
      ${featureChips(listing)}
      ${highlightsBlock(listing)}
      ${nearbyBlock(listing)}
      <div style="border-top:1px solid ${BRAND.line};margin-top:24px;padding-top:16px">
        <p style="font-size:14.5px;color:${BRAND.ink2};margin:0"><strong>What happens next</strong></p>
        <ul style="padding-left:18px;margin:10px 0 0;color:${BRAND.ink2};font-size:14px;line-height:1.75">
          <li>Buyers find your listing on MyKunda and send enquiries</li>
          <li>You get an email every time someone asks about your property</li>
          <li>Edit, pause or remove it any time from <a href="${BRAND.site}/dashboard.html" style="color:${BRAND.green};font-weight:700">My MyKunda</a></li>
        </ul>
      </div>
      <p style="margin:18px 0 0;font-size:14px;color:${BRAND.muted}">Something not right in the details above? Reply to this email and we will correct it.</p>`,
    cta: listing.id ? 'View your listing' : 'Go to My MyKunda',
    ctaUrl: listing.id ? `${BRAND.site}/property.html?id=${encodeURIComponent(String(listing.id))}` : `${BRAND.site}/dashboard.html`,
    footer: 'You received this because you published a listing on mykunda.com.',
  });
}

/* ---------- backoffice notification ---------- */

export function listingBackofficeEmail(listing: ListingInput): string {
  const plan = listing.plan || 'basic';
  const needsReview = plan !== 'basic';
  return emailWrap({
    heading: 'New listing published',
    preheader: `${PLAN_LABELS[plan] || plan} · ${listing.title || 'Untitled'} · ${listing.area || 'The Gambia'}`,
    body: `${needsReview
      ? callout(`<p style="font-size:14px;color:${BRAND.ink};margin:0"><strong>Action required.</strong> ${plan === 'managed' ? 'Managed' : 'Verified'} listing — documents need review and approval before the badge goes live.</p>`)
      : ''}
      ${sectionLabel('Property')}
      ${detailTable(([['ID', escOpt(listing.id)], ['Status', escOpt(listing.status)]] as [string, unknown][]).concat(detailRows(listing)))}
      ${featureChips(listing)}
      ${highlightsBlock(listing)}
      ${nearbyBlock(listing)}
      ${sectionLabel('Seller')}
      ${detailTable([
        ['Name', escOpt(listing.name)],
        ['Email', listing.email ? `<a href="mailto:${esc(listing.email)}" style="color:${BRAND.green};font-weight:600">${esc(listing.email)}</a>` : undefined],
        ['Phone', escOpt(listing.phone)],
      ])}`,
    cta: 'Open admin console',
    ctaUrl: `${BRAND.site}/admin.html`,
    footer: 'Internal notification from the MyKunda website.',
  });
}
