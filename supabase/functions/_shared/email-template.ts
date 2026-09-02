// ============================================================
//  MyKunda — branded email system
//  One layout, one voice, for every automated message the site
//  sends. Edge Functions build a Mail object and hand it to
//  Resend; nothing composes raw HTML by itself any more.
//
//    import { leadAutoReplyEmail, toText } from '../_shared/email-template.ts';
//    const html = leadAutoReplyEmail(lead);
//    send({ html, text: toText(html) });
//
//  Every template goes through emailWrap(), which supplies:
//   · preheader (the grey preview line in the inbox)
//   · a bulletproof CTA button that also renders in Outlook
//   · light-mode lock, so dark-mode clients don't invert the card
//   · a footer with real contact details + optional unsubscribe
//  Visitor input is escaped HERE — callers pass raw values.
//
//  Listing templates live in ./email-listing.ts and are
//  re-exported at the bottom, so importers only need this file.
//  De bankrekening staat in ./bank.ts — één bron, zie daar.
// ============================================================
import { BANK } from './bank.ts';

/* ============================================================
   GERESERVEERDE TESTDOMEINEN (30-08-2026)
   Domeinen uit RFC 2606/6761 hebben geen DNS. Amazon SES houdt zo'n mail
   veertien uur in de wachtrij en boekt daarna een bounce op de reputatie
   van mykunda.com. Deze guard stond alleen in auth-email, terwijl de
   .invalid-rommel in email_events aantoonbaar uit de ándere functies kwam:
   viewingtest-buyer@mykunda-test.invalid kreeg een berichtmail én een
   herinnering, goed voor vijftien delivery_delayed en twee bounces.
   Nu leest elke verzender dezelfde lijst.
   Testen doe je met delivered@resend.dev of bounced@resend.dev.
   ============================================================ */
const RESERVED_EMAIL_DOMAIN =
  /(^|\.)(invalid|test|localhost|example|example\.(com|net|org))$/i;

export function isReservedTestAddress(addr: unknown): boolean {
  const domain = String(addr ?? '').trim().toLowerCase().split('@').pop() ?? '';
  return RESERVED_EMAIL_DOMAIN.test(domain);
}

export const BRAND = {
  name: 'MyKunda',
  site: 'https://mykunda.com',
  logo: 'https://mykunda.com/images/mykunda-icon.png',
  email: 'info@mykunda.com',
  waNumber: '+220 272 0268',
  waLink: 'https://wa.me/2202720268',
  green: '#15463A',
  greenDeep: '#0E2E25',
  green50: '#EAF2ED',
  amber: '#DD8A45',
  amber50: '#FBF1E6',
  ink: '#18201D',
  ink2: '#384640',
  muted: '#5C6B64',
  muted2: '#8A958E',
  paper: '#FAF8F3',
  paper2: '#F3F0E8',
  line: '#EFEBE1',
  font: `-apple-system,BlinkMacSystemFont,'Segoe UI','Helvetica Neue',Helvetica,Arial,sans-serif`,
};

/** Public download link for the Diaspora Buyer's Checklist lead magnet.
 *  File lives in the public `lead-magnets` Storage bucket — upload it there
 *  once via Supabase Studio (Storage → lead-magnets), keep this filename. */
const DIASPORA_CHECKLIST_URL =
  'https://jejaerpqltqryqzjvbjp.supabase.co/storage/v1/object/public/lead-magnets/MyKunda-Diaspora-Buyers-Checklist.pdf';

/* ---------- escaping & small text helpers ---------- */

export function esc(v: unknown): string {
  if (v === null || v === undefined) return '';
  return String(v)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

/* Duizendtallen groeperen zonder Intl.
   Gemeten op 31-08-2026 in de Supabase edge runtime: (20000).toLocaleString('en-US')
   geeft daar "20000" — de cijfergroepering ontbreekt in de meegeleverde
   Intl-gegevens, terwijl datums wél goed opmaken. Elke prijs in een mail kwam
   dus zonder scheidingsteken bij de klant aan ("D4500000"), en een bedrag van
   die lengte leest niemand in één keer goed. In de browser werkt
   toLocaleString wel; alleen de mailtemplates moeten het zonder doen. */
export function nummer(v: unknown, decimalen = 0): string {
  const n = Number(v);
  if (!isFinite(n)) return '';
  const vast = Math.abs(n).toFixed(decimalen);
  const [heel, deel] = vast.split('.');
  const gegroepeerd = heel.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  return (n < 0 ? '-' : '') + gegroepeerd + (deel ? '.' + deel : '');
}

/** Escaped, or undefined when there is nothing worth showing. */
export function escOpt(v: unknown): string | undefined {
  if (v === null || v === undefined || String(v).trim() === '') return undefined;
  return esc(v);
}

/** Escape and keep the line breaks a visitor typed. */
export function escLines(v: unknown): string {
  return esc(v).replace(/\r?\n/g, '<br>');
}

/** Only allow http(s) URLs into href — never javascript: from a data field. */
export function safeUrl(v: unknown): string {
  const s = String(v ?? '').trim();
  return /^https?:\/\//i.test(s) ? esc(s) : '';
}

/**
 * Plain-text alternative. Resend sends it alongside the HTML: it keeps the
 * message readable in text-only clients and measurably improves spam scoring,
 * which is why every send site passes toText(html).
 */
export function toText(html: string): string {
  return html
    .replace(/<div id="preheader"[\s\S]*?<\/div>/i, '')
    .replace(/<tr id="brandhead"[\s\S]*?<\/tr>/i, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<head[\s\S]*?<\/head>/gi, '')
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/<a [^>]*href="([^"]*)"[^>]*>([\s\S]*?)<\/a>/gi, (_m, href: string, label: string) => {
      const l = label.replace(/<[^>]+>/g, '').trim();
      if (!l) return href;
      // mailto:/tel: already read as the address — don't repeat it in brackets
      if (/^(mailto|tel):/i.test(href)) return l;
      return href && href.indexOf(l) === -1 ? `${l} (${href})` : l;
    })
    .replace(/<\/td>\s*<td[^>]*>/gi, ': ')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(p|div|tr|li|h1|h2|h3|h4|table|ul)>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ').replace(/&zwnj;/g, '')
    .replace(/&#39;/g, "'").replace(/&quot;/g, '"')
    .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&')
    .split('\n').map((l) => l.trim())
    .filter((l, i, a) => l !== '' || (a[i - 1] ?? '') !== '')
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

/* ---------- building blocks ---------- */

/** Label/value table — the house style for any set of details. */
export function detailTable(rows: [string, unknown][], tone: 'paper' | 'amber' = 'paper'): string {
  const body = rows
    .filter(([, v]) => v !== null && v !== undefined && String(v).trim() !== '')
    .map(([k, v]) => `<tr><td style="padding:11px 16px;color:${BRAND.muted};font-weight:600;border-bottom:1px solid ${BRAND.line};width:120px;font-size:14px;vertical-align:top">${esc(k)}</td><td style="padding:11px 16px;color:${BRAND.ink};border-bottom:1px solid ${BRAND.line};font-size:14px;vertical-align:top">${v}</td></tr>`).join('');
  if (!body) return '';
  const bg = tone === 'amber' ? BRAND.amber50 : BRAND.paper;
  return `<table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="width:100%;border-collapse:collapse;background:${bg};border-radius:10px;margin:8px 0">${body}</table>`;
}

/** Small caps section label. */
export function sectionLabel(text: string): string {
  return `<p style="font-size:12px;color:${BRAND.muted};font-weight:700;text-transform:uppercase;letter-spacing:.06em;margin:22px 0 6px">${esc(text)}</p>`;
}

/** Highlighted callout — amber by default, red for something that went wrong. */
export function callout(html: string, tone: 'amber' | 'green' | 'red' = 'amber'): string {
  const c = tone === 'red' ? { bg: '#FDECEC', bar: '#C0392B' }
    : tone === 'green' ? { bg: BRAND.green50, bar: BRAND.green }
    : { bg: BRAND.amber50, bar: BRAND.amber };
  return `<div style="background:${c.bg};border-left:4px solid ${c.bar};border-radius:0 10px 10px 0;padding:15px 20px;margin:16px 0">${html}</div>`;
}

function button(label: string, url: string): string {
  const safe = safeUrl(url);
  if (!safe || !label) return '';
  return `<tr><td style="padding:26px 0 0">
    <!--[if mso]><v:roundrect xmlns:v="urn:schemas-microsoft-com:vml" xmlns:w="urn:schemas-microsoft-com:office:word" href="${safe}" style="height:48px;v-text-anchor:middle;width:280px" arcsize="18%" stroke="f" fillcolor="${BRAND.green}"><w:anchorlock/><center style="color:#ffffff;font-family:${BRAND.font};font-size:15px;font-weight:bold">${esc(label)}</center></v:roundrect><![endif]-->
    <!--[if !mso]><!-- --><a href="${safe}" style="display:inline-block;background:${BRAND.green};color:#ffffff;font-family:${BRAND.font};font-weight:700;font-size:15px;text-decoration:none;padding:15px 32px;border-radius:9px;mso-hide:all">${esc(label)}</a><!--<![endif]-->
  </td></tr>`;
}

/* ---------- the wrapper ---------- */

export function emailWrap(opts: {
  heading: string;
  body: string;
  cta?: string;
  ctaUrl?: string;
  footer?: string;
  /** Inbox preview line. Always set one — otherwise clients show stray markup. */
  preheader?: string;
  /** Adds an unsubscribe line. Required for anything marketing-like. */
  unsubscribeUrl?: string;
}): string {
  const { heading, body, cta, ctaUrl, footer, preheader, unsubscribeUrl } = opts;
  const footerText = footer ||
    'You received this email because you contacted MyKunda or used a form on mykunda.com.';
  const pre = preheader
    ? `<div id="preheader" style="display:none;max-height:0;overflow:hidden;mso-hide:all;font-size:1px;line-height:1px;color:${BRAND.paper2};opacity:0">${esc(preheader)}${'&zwnj;&nbsp;'.repeat(60)}</div>`
    : '';
  const unsub = safeUrl(unsubscribeUrl)
    ? `<p style="font-size:12px;color:${BRAND.muted2};margin:10px 0 0">Don't want these updates? <a href="${safeUrl(unsubscribeUrl)}" style="color:${BRAND.muted2};text-decoration:underline">Unsubscribe</a>.</p>`
    : '';

  return `<!DOCTYPE html>
<html lang="en" xmlns:v="urn:schemas-microsoft-com:vml" xmlns:o="urn:schemas-microsoft-com:office:office">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta http-equiv="X-UA-Compatible" content="IE=edge">
<meta name="color-scheme" content="light">
<meta name="supported-color-schemes" content="light">
<title>${esc(heading)}</title>
<!--[if mso]><xml><o:OfficeDocumentSettings><o:PixelsPerInch>96</o:PixelsPerInch></o:OfficeDocumentSettings></xml><![endif]-->
<style>
  body,table,td,p,a,li{font-family:${BRAND.font}}
  a{color:${BRAND.green}}
  .card{padding:36px 34px}
  @media only screen and (max-width:620px){
    .wrap{padding:20px 12px !important}
    .card{padding:26px 20px !important}
    .h1{font-size:21px !important}
  }
</style>
</head>
<body style="margin:0;padding:0;background:${BRAND.paper2};color:${BRAND.ink};-webkit-font-smoothing:antialiased;-webkit-text-size-adjust:100%">
${pre}
<table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="background:${BRAND.paper2}">
  <tr><td align="center" class="wrap" style="padding:32px 16px">
    <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="600" style="max-width:600px;width:100%">
      <tr id="brandhead"><td style="padding:0 0 22px">
        <table role="presentation" border="0" cellpadding="0" cellspacing="0"><tr>
          <td style="padding-right:10px"><a href="${BRAND.site}"><img src="${BRAND.logo}" alt="MyKunda" width="36" height="36" style="border-radius:9px;display:block;border:0"></a></td>
          <td style="font-weight:800;font-size:20px;color:${BRAND.ink};letter-spacing:-.02em"><a href="${BRAND.site}" style="color:${BRAND.ink};text-decoration:none">MyKunda</a></td>
        </tr></table>
      </td></tr>
      <tr><td class="card" style="background:#FFFFFF;border-radius:14px;border:1px solid #EDE9DF;padding:36px 34px">
        <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%">
          <tr><td class="h1" style="font-size:24px;font-weight:800;color:${BRAND.ink};line-height:1.22;letter-spacing:-.01em;padding:0 0 14px">${heading}</td></tr>
          <tr><td style="font-size:15.5px;color:${BRAND.ink2};line-height:1.65">${body}</td></tr>
          ${button(cta ?? '', ctaUrl ?? '')}
        </table>
      </td></tr>
      <tr><td style="padding:24px 8px 0;text-align:center">
        <p style="font-size:12.5px;color:${BRAND.muted2};line-height:1.55;margin:0">${footerText}</p>
        <p style="font-size:12.5px;color:${BRAND.muted2};margin:10px 0 0">
          <a href="${BRAND.site}" style="color:${BRAND.green};font-weight:700;text-decoration:none">mykunda.com</a> &nbsp;·&nbsp;
          <a href="mailto:${BRAND.email}" style="color:${BRAND.muted2};text-decoration:underline">${BRAND.email}</a> &nbsp;·&nbsp;
          <a href="${BRAND.waLink}" style="color:${BRAND.muted2};text-decoration:underline">WhatsApp ${BRAND.waNumber}</a>
        </p>
        <p style="font-size:12px;color:${BRAND.muted2};margin:10px 0 0">
          <a href="${BRAND.site}/legal-privacy.html" style="color:${BRAND.muted2};text-decoration:underline">Privacy</a> ·
          <a href="${BRAND.site}/legal-terms.html" style="color:${BRAND.muted2};text-decoration:underline">Terms</a> ·
          <a href="${BRAND.site}/legal-cookies.html" style="color:${BRAND.muted2};text-decoration:underline">Cookies</a>
        </p>
        ${unsub}
        <p style="font-size:11.5px;color:${BRAND.muted2};margin:14px 0 0">MyKunda · property platform for The Gambia · Kololi, Serrekunda</p>
      </td></tr>
    </table>
  </td></tr>
</table>
</body>
</html>`;
}

/* ============================================================
   LEAD — team notification (to LEAD_EMAIL)
   ============================================================ */

export const LEAD_LABELS: Record<string, string> = {
  valuation: 'Property valuation request',
  viewing: 'Viewing request',
  agent_message: 'Message for an agent',
  area_alert: 'Area-alert signup',
  contact: 'Contact message',
  listing_enquiry: 'Listing enquiry',
  consultation: 'Free consultation booking',
  whatsapp_inbound: 'WhatsApp message',
  verification: 'New ownership check request',
};

export function leadNotificationEmail(lead: {
  source: string; name?: string; email?: string; phone?: string;
  area?: string; message?: string; payload?: any;
}): string {
  const label = LEAD_LABELS[lead.source] ?? 'New enquiry';
  const who = escOpt(lead.name) || escOpt(lead.email) || 'a visitor';

  const rows: [string, unknown][] = [
    ['Type', esc(label)],
    ['Name', escOpt(lead.name)],
    ['Email', lead.email ? `<a href="mailto:${esc(lead.email)}" style="color:${BRAND.green};font-weight:600">${esc(lead.email)}</a>` : undefined],
    ['Phone', lead.phone ? `<a href="tel:${esc(String(lead.phone).replace(/[^\d+]/g, ''))}" style="color:${BRAND.green};font-weight:600">${esc(lead.phone)}</a>` : undefined],
    ['Area', escOpt(lead.area)],
    ['Message', lead.message ? escLines(lead.message) : undefined],
  ];

  let extra = '';
  const p = lead.payload ?? {};
  if (lead.source === 'valuation' && p) {
    extra = detailTable([
      ['Property type', escOpt(p.type)],
      ['Size', p.sqm ? `${esc(p.sqm)} m²` : undefined],
      ['Estimated range', p.estimate_low && p.estimate_high
        ? `$${nummer(p.estimate_low)} – $${nummer(p.estimate_high)}` : undefined],
      ['Location input', escOpt(p.raw_location)],
    ], 'amber');
  }
  if (lead.source === 'contact' && p.subject) {
    /* Herkomst erbij. contact.html schrijft sinds 30-08-2026 ?ref, ?about en
       de paginacontext in payload, maar de teammail liet dat weg — je zag wél
       de vraag en niet waar hij vandaan kwam, en daarvoor moest je de database
       in. Juist bij "report listing" en "ownership check" is dat het eerste
       wat je wilt weten. */
    extra = detailTable([
      ['Subject', escOpt(p.subject)],
      ['Came from', escOpt(p.ref) || escOpt(p.about) || escOpt(p.form)],
    ], 'amber');
  }
  if (lead.source === 'contact' && p.lead_magnet) {
    extra = detailTable([
      ['Lead magnet', p.lead_magnet === 'diaspora_checklist' ? 'Diaspora Buyer’s Checklist' : escOpt(p.lead_magnet)],
      ['Channel', escOpt(p.channel)],
      ['Buying from', escOpt(p.where)],
    ], 'amber');
  }

  return emailWrap({
    heading: `New ${esc(label.toLowerCase())}`,
    preheader: `${label} from ${who} — reply to this email to answer them directly.`,
    body: `<p style="margin:0 0 14px">A new enquiry came in through the website. <strong>Reply to this email</strong> and your answer goes straight to ${who}.</p>
      ${detailTable(rows)}${extra}`,
    cta: 'Open admin console',
    ctaUrl: `${BRAND.site}/admin.html`,
    footer: 'Internal notification from the MyKunda website.',
  });
}

/* ============================================================
   LEAD — auto-reply to the visitor
   ============================================================ */

export function leadAutoReplyEmail(lead: { source: string; name?: string; payload?: any }): string {
  const fname = lead.name ? esc(String(lead.name).trim().split(' ')[0]) : '';
  let intro: string;
  let extraBlock = '';
  let ctaLabel = 'Browse properties';
  let ctaUrl = `${BRAND.site}/search.html`;
  let preheader = 'We have your message — here is what happens next.';
  let unsubscribeUrl: string | undefined;

  switch (lead.source) {
    case 'valuation':
      intro = 'Thanks for requesting a property valuation. A valuer we work with will review your property and confirm the exact figure with you within <strong>1–2 working days</strong>.';
      preheader = 'Your valuation request is in — a valuer confirms the figure within 1–2 working days.';
      if (lead.payload?.estimate_low && lead.payload?.estimate_high) {
        extraBlock = `<div style="background:${BRAND.paper};border-radius:10px;padding:20px 22px;margin:18px 0 6px;border-left:4px solid ${BRAND.amber}">
            <p style="font-size:12px;color:${BRAND.muted};font-weight:700;text-transform:uppercase;letter-spacing:.06em;margin:0 0 6px">Automated estimate</p>
            <p style="font-size:22px;font-weight:800;color:${BRAND.ink};margin:0">$${nummer(lead.payload.estimate_low)} – $${nummer(lead.payload.estimate_high)}</p>
            <p style="font-size:13px;color:${BRAND.muted2};margin:6px 0 0">Based on recent sales data · subject to in-person review</p>
          </div>`;
      }
      ctaLabel = 'Explore similar properties';
      break;
    case 'contact':
      if (lead.payload?.lead_magnet === 'diaspora_checklist') {
        intro = 'Thanks for requesting the Diaspora Buyer’s Checklist. Your copy is ready below — eight pages covering the documents to demand, the questions to ask, and how to stage a payment safely from abroad.';
        preheader = 'Your Diaspora Buyer’s Checklist is ready to download.';
        ctaLabel = 'Download the checklist';
        ctaUrl = DIASPORA_CHECKLIST_URL;
      } else {
        intro = 'Thanks for reaching out to MyKunda. Your message is with our team and someone will get back to you within <strong>1–2 working days</strong>.';
        preheader = 'Your message reached us — expect a reply within 1–2 working days.';
      }
      break;
    case 'listing_enquiry':
      intro = 'Thanks for your enquiry about this property. The listing agent has been notified and will respond within <strong>1–2 working days</strong>.';
      preheader = 'Your enquiry is with the listing agent.';
      ctaLabel = 'View more properties';
      break;
    case 'area_alert':
      intro = 'Your area alert is set up. As soon as a property matching your criteria comes online, you will hear from us first — no more than a handful of emails a month.';
      preheader = 'Your area alert is live — new matches land in your inbox first.';
      ctaLabel = 'Browse current listings';
      unsubscribeUrl = `${BRAND.site}/contact.html?unsubscribe=1`;
      break;
    case 'viewing':
      intro = 'Your viewing request has been received. We are checking it with the owner and will come back with times that work — usually within 1–2 working days.';
      preheader = 'Viewing request received — we are lining up times with the owner.';
      ctaLabel = 'View your dashboard';
      ctaUrl = `${BRAND.site}/dashboard.html`;
      break;
    case 'agent_message':
      intro = 'Your message has been delivered to the agent. They will get back to you as soon as they can, usually within <strong>a few hours</strong>.';
      preheader = 'Your message is with the agent.';
      break;
    case 'consultation':
      intro = 'Your free consultation is booked. An advisor will email you within 1–2 working days with a time slot and a calendar invite. The call takes 20 minutes and there is no obligation.';
      preheader = 'Your free consultation is booked — we will confirm a time within 1–2 working days.';
      ctaLabel = 'Browse properties while you wait';
      break;
    case 'whatsapp_inbound':
      intro = 'Thanks for messaging us on WhatsApp. Our team has your message and will reply there.';
      preheader = 'We have your WhatsApp message.';
      break;
    case 'verification':
      intro = 'Thanks for requesting an ownership check. We confirm by email within <strong>1–2 working days</strong> that we can run the check on this property, and what we will need from you.';
      preheader = 'Your ownership check request is in — we confirm within 1–2 working days.';
      ctaLabel = 'Read how the check works';
      ctaUrl = `${BRAND.site}/verify.html`;
      break;
    default:
      intro = 'Thanks for getting in touch with MyKunda. A member of our team will reply within 1–2 working days.';
  }

  const body = `<p style="margin:0 0 16px">${intro}</p>
    ${extraBlock}
    <p style="margin:16px 0 0">In the meantime you can browse every property and plot we list across The Gambia at <a href="${BRAND.site}" style="color:${BRAND.green};font-weight:700">mykunda.com</a>.</p>
    <div style="border-top:1px solid ${BRAND.line};margin-top:24px;padding-top:18px">
      <p style="font-size:14px;color:${BRAND.muted};margin:0">In a hurry? WhatsApp us at <a href="${BRAND.waLink}" style="color:${BRAND.green};font-weight:600">${BRAND.waNumber}</a> — or simply reply to this email.</p>
    </div>`;

  return emailWrap({
    heading: fname ? `Thank you, ${fname}` : 'Thank you',
    preheader,
    body,
    cta: ctaLabel,
    ctaUrl,
    footer: 'You received this because you submitted a request on mykunda.com. We never sell or share your details.',
    unsubscribeUrl,
  });
}

/* ============================================================
   VIEWINGS
   ============================================================ */

/* Tijden staan in UTC in de database en worden hier in Gambiaanse tijd gezet.
   De timeZone stond hier tot 30-08-2026 niet in: Africa/Banjul is UTC+0 en de
   Deno-runtime draait op UTC, dus het viel niet op. Het is wel een stille val —
   verandert de runtime-tijdzone, dan staan er verkeerde tijden in bevestigings-
   en annuleringsmails. notify-viewing-reminder deed het al wel goed. */
const fmtSlot = (d: string) => {
  try {
    return new Date(d).toLocaleString('en-GB', {
      dateStyle: 'full', timeStyle: 'short', timeZone: 'Africa/Banjul',
    });
  } catch { return String(d); }
};

/** To the seller / team: someone wants to see a property. */
export function viewingNotificationEmail(v: {
  buyer_name?: string; title: string; area?: string;
  requested_slot?: string; buyer_email?: string; buyer_phone?: string;
}): string {
  const who = escOpt(v.buyer_name) || 'A buyer';
  return emailWrap({
    heading: 'New viewing request',
    preheader: `${who} wants to view ${v.title} — confirm or propose another time.`,
    body: `<p style="margin:0 0 14px"><strong>${who}</strong> would like to view <strong>${esc(v.title)}</strong>. Please confirm the time or propose alternatives.</p>
      ${detailTable([
        ['Buyer', escOpt(v.buyer_name) || 'Anonymous'],
        ['Property', `${esc(v.title)}${v.area ? ' · ' + esc(v.area) : ''}`],
        ['Preferred time', v.requested_slot ? esc(fmtSlot(v.requested_slot)) : 'Flexible'],
        ['Email', escOpt(v.buyer_email)],
        ['Phone', escOpt(v.buyer_phone)],
      ])}`,
    cta: 'Respond in dashboard',
    ctaUrl: `${BRAND.site}/dashboard.html`,
    footer: 'Internal notification from the MyKunda website.',
  });
}

/** To the buyer: we have your request. Sent at the same moment as the one above. */
export function viewingConfirmationEmail(v: {
  buyer_name?: string; title: string; area?: string; requested_slot?: string;
}): string {
  const fname = v.buyer_name ? esc(String(v.buyer_name).trim().split(' ')[0]) : '';
  return emailWrap({
    heading: fname ? `Your viewing request, ${fname}` : 'Your viewing request',
    preheader: `We are confirming a time for ${v.title} with the owner.`,
    body: `<p style="margin:0 0 14px">Thanks — your request to view <strong>${esc(v.title)}</strong> is with the owner. They confirm the time or propose alternatives, and you get an email the moment they do. That is usually within 1–2 working days.</p>
      ${detailTable([
        ['Property', `${esc(v.title)}${v.area ? ' · ' + esc(v.area) : ''}`],
        ['Your preferred time', v.requested_slot ? esc(fmtSlot(v.requested_slot)) : 'Flexible'],
      ])}
      ${callout(`<p style="font-size:14px;color:${BRAND.ink};margin:0"><strong>Before you travel to a viewing:</strong> never hand over money to see a property, and ask to see the title documents. Our team can check them for you.</p>`)}
      <p style="margin:16px 0 0;font-size:14px;color:${BRAND.muted}">Need to change the time? Reply to this email or WhatsApp <a href="${BRAND.waLink}" style="color:${BRAND.green};font-weight:600">${BRAND.waNumber}</a>.</p>`,
    cta: 'View your dashboard',
    ctaUrl: `${BRAND.site}/dashboard.html`,
    footer: 'You received this because you are part of a viewing arranged on mykunda.com.',
  });
}

/** To the buyer: the seller accepted the time. Without this mail the buyer
 *  never learns the viewing is on — the seller only clicked in the dashboard. */
export function viewingConfirmedEmail(v: {
  buyer_name?: string; title: string; area?: string; slot?: string;
}): string {
  const fname = v.buyer_name ? esc(String(v.buyer_name).trim().split(' ')[0]) : '';
  return emailWrap({
    heading: 'Your viewing is confirmed',
    preheader: `${v.title} — ${v.slot ? fmtSlot(v.slot) : 'time confirmed'}.`,
    body: `<p style="margin:0 0 14px">${fname ? esc(fname) + ', good news — the' : 'The'} owner has confirmed your viewing of <strong>${esc(v.title)}</strong>.</p>
      ${detailTable([
        ['Property', `${esc(v.title)}${v.area ? ' · ' + esc(v.area) : ''}`],
        ['When', v.slot ? esc(fmtSlot(v.slot)) : 'To be agreed'],
      ])}
      ${callout(`<p style="font-size:14px;color:${BRAND.ink};margin:0"><strong>Before you travel:</strong> never hand over money to see a property, and ask to see the title documents. Our team can check them for you.</p>`)}
      <p style="margin:16px 0 0;font-size:14px;color:${BRAND.muted}">Can't make it after all? Reply to this email or WhatsApp <a href="${BRAND.waLink}" style="color:${BRAND.green};font-weight:600">${BRAND.waNumber}</a> and we move it.</p>`,
    cta: 'Message us on WhatsApp',
    ctaUrl: BRAND.waLink,
    footer: 'You received this because you are part of a viewing arranged on mykunda.com.',
  });
}

/** To the buyer: the seller proposed times. */
/* De knop wees tot 30-08-2026 naar WhatsApp en de mail bevatte geen enkele link
   naar het gesprek — terwijl de ontvanger in Messages met een klik een tijd kan
   kiezen (respond_viewing). Elke acceptatie werd zo handwerk voor de backoffice.
   Nu: de knop gaat naar het gesprek, WhatsApp blijft als tweede weg staan. */
export function viewingSlotsEmail(v: {
  title: string; proposed_slots: string[]; conversation_id?: string;
}): string {
  const slots = (v.proposed_slots || []).map((s) =>
    `<li style="margin:8px 0;color:${BRAND.ink};font-weight:600;font-size:15px">${esc(fmtSlot(s))}</li>`).join('');
  const url = v.conversation_id
    ? `${BRAND.site}/messages.html?c=${encodeURIComponent(v.conversation_id)}`
    : `${BRAND.site}/messages.html`;
  return emailWrap({
    heading: 'Viewing times proposed',
    preheader: `New times to view ${v.title} — pick the one that suits you.`,
    body: `<p style="margin:0 0 14px">These times have been proposed to view <strong>${esc(v.title)}</strong>:</p>
      <div style="background:${BRAND.paper};border-radius:10px;padding:16px 22px;margin:8px 0">
        <ul style="padding-left:20px;margin:0">${slots}</ul>
      </div>
      <p style="margin:14px 0 0">Open the conversation and tap the time that suits you — the other party sees your choice straight away. None of them work? There is a button for that too, and you will be asked for other times.</p>
      <p style="margin:14px 0 0;font-size:14px;color:${BRAND.muted}">Rather not go online? WhatsApp us at <a href="${BRAND.waLink}" style="color:${BRAND.green};font-weight:600">${BRAND.waNumber}</a> and we set it for you.</p>`,
    cta: 'Choose a time',
    ctaUrl: url,
    footer: 'You received this because you are part of a viewing arranged on mykunda.com.',
  });
}

/** To the party that did NOT cancel: the viewing is off. */
export function viewingCancelledEmail(v: {
  recipient_name?: string; canceller_name?: string; title?: string; area?: string;
  slot?: string; reason?: string; conversation_id?: string;
}): string {
  const fname = v.recipient_name ? esc(String(v.recipient_name).trim().split(' ')[0]) : '';
  const who = v.canceller_name ? esc(String(v.canceller_name).trim().split(' ')[0]) : 'the other party';
  const what = v.title
    ? `<strong>${esc(v.title)}</strong>${v.area ? ' · ' + esc(v.area) : ''}`
    : 'a property on MyKunda';
  // Zonder voornaam begint de zin met deze naam, dus dan een hoofdletter.
  const whoStart = fname ? who : who.charAt(0).toUpperCase() + who.slice(1);
  const url = v.conversation_id
    ? `${BRAND.site}/messages.html?c=${encodeURIComponent(v.conversation_id)}`
    : `${BRAND.site}/messages.html`;
  return emailWrap({
    heading: 'The viewing has been cancelled',
    preheader: `${v.canceller_name ? v.canceller_name : 'The other party'} cancelled the viewing of ${v.title ?? 'a property on MyKunda'}.`,
    body: `<p style="margin:0 0 14px">${fname ? fname + ', ' : ''}<strong>${whoStart}</strong> has cancelled the viewing of ${what}.</p>
      ${detailTable([
        ['Property', v.title ? `${esc(v.title)}${v.area ? ' · ' + esc(v.area) : ''}` : undefined],
        ['Was planned', v.slot ? esc(fmtSlot(v.slot)) : undefined],
        ['Cancelled by', v.canceller_name ? esc(v.canceller_name) : undefined],
      ])}
      ${v.reason ? callout(`<p style="font-size:14px;color:${BRAND.ink};margin:0"><strong>Reason given:</strong> ${escLines(v.reason)}</p>`) : ''}
      <p style="margin:16px 0 0">Nothing is lost — a new appointment is made in a moment. Open the conversation and propose another time that suits you both.</p>`,
    cta: 'Propose another time',
    ctaUrl: url,
    footer: 'You received this because you are part of a viewing arranged on mykunda.com.',
  });
}

/** To the team: a viewing was cancelled. */
export function viewingCancelledBackofficeEmail(v: {
  canceller_name?: string; other_name?: string; title?: string; area?: string;
  slot?: string; reason?: string; conversation_id?: string;
}): string {
  const who = escOpt(v.canceller_name) || 'A participant';
  const url = v.conversation_id
    ? `${BRAND.site}/messages.html?c=${encodeURIComponent(v.conversation_id)}`
    : `${BRAND.site}/messages.html`;
  return emailWrap({
    heading: 'Viewing cancelled',
    preheader: `${v.canceller_name ?? 'A participant'} cancelled a viewing${v.title ? ' — ' + v.title : ''}.`,
    body: `<p style="margin:0 0 14px"><strong>${who}</strong> cancelled a viewing. The other party has been emailed.</p>
      ${detailTable([
        ['Property', v.title ? `${esc(v.title)}${v.area ? ' · ' + esc(v.area) : ''}` : undefined],
        ['Was planned', v.slot ? esc(fmtSlot(v.slot)) : undefined],
        ['Cancelled by', escOpt(v.canceller_name)],
        ['Other party', escOpt(v.other_name)],
        ['Reason', escOpt(v.reason)],
      ])}`,
    cta: 'Open the conversation',
    ctaUrl: url,
    footer: 'Internal notification from the MyKunda website.',
  });
}

/* Nieuw op 30-08-2026. respond_viewing() zet de status op 'declined' en schrijft
   een bericht in de conversatie, maar notify-viewing kende alleen proposed,
   confirmed en cancelled — de aanvrager hoorde per mail nooit dat zijn tijden
   niet uitkwamen. Dit sjabloon vult dat gat, aan beide kanten: de aanvrager
   krijgt hem, de backoffice een korte kopie. */
export function viewingDeclinedEmail(v: {
  recipient_name?: string; decliner_name?: string; title?: string; area?: string;
  proposed_slots?: string[]; conversation_id?: string;
}): string {
  const fname = v.recipient_name ? esc(String(v.recipient_name).trim().split(' ')[0]) : '';
  const who = v.decliner_name ? esc(String(v.decliner_name).trim().split(' ')[0]) : 'The other party';
  const what = v.title
    ? `<strong>${esc(v.title)}</strong>${v.area ? ' · ' + esc(v.area) : ''}`
    : 'a property on MyKunda';
  const slots = (v.proposed_slots || []).map((s) =>
    `<li style="margin:6px 0;color:${BRAND.muted};font-size:14px">${esc(fmtSlot(s))}</li>`).join('');
  const url = v.conversation_id
    ? `${BRAND.site}/messages.html?c=${encodeURIComponent(v.conversation_id)}`
    : `${BRAND.site}/messages.html`;
  return emailWrap({
    heading: fname ? `${fname}, those times did not work` : 'Those times did not work',
    preheader: `${v.decliner_name ?? 'The other party'} asked for different times to view ${v.title ?? 'the property'}.`,
    body: `<p style="margin:0 0 14px"><strong>${who}</strong> could not make any of the times you proposed for ${what}, and has asked for a few others.</p>
      ${slots ? `<div style="background:${BRAND.paper};border-radius:10px;padding:14px 22px;margin:8px 0">
        <p style="font-size:12px;color:${BRAND.muted};font-weight:700;text-transform:uppercase;letter-spacing:.06em;margin:0 0 6px">You had proposed</p>
        <ul style="padding-left:20px;margin:0">${slots}</ul>
      </div>` : ''}
      <p style="margin:14px 0 0">Open the conversation and propose one to three new times. It takes a moment, and the other party is notified straight away.</p>`,
    cta: 'Propose other times',
    ctaUrl: url,
    footer: 'You received this because you arranged a viewing on mykunda.com.',
  });
}

/* ============================================================
   PAYMENTS — receipt to the customer, alert to the backoffice
   ============================================================ */

export interface PaymentInfo {
  name?: string;
  email?: string;
  phone?: string;
  plan: string;              // human label, e.g. "Verified listing"
  planNote?: string;         // one line about what it includes
  reference: string;
  amount: string;            // already formatted, e.g. "$99" or "D 4,500"
  method: string;            // "Wave mobile money", "Card ending 4242", "Bank transfer"
  awaitingTransfer?: boolean; // bank transfer: money not in yet
  bank?: { name?: string; account?: string; iban?: string; swift?: string };
  date?: string;             // ISO; defaults to now
}

const payDate = (iso?: string) => {
  const d = iso ? new Date(iso) : new Date();
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
};

export function paymentReceiptEmail(p: PaymentInfo): string {
  const fname = p.name ? esc(String(p.name).trim().split(' ')[0]) : '';
  const waiting = !!p.awaitingTransfer;

  const rows: [string, unknown][] = [
    ['Reference', `<strong>${esc(p.reference)}</strong>`],
    ['Service', esc(p.plan)],
    ['Payment method', esc(p.method)],
    ['Date', esc(payDate(p.date))],
    [waiting ? 'Amount due' : 'Amount paid', `<strong>${esc(p.amount)}</strong>`],
  ];

  /* Derde plek waar een rekeningnummer in beeld kon komen. Dit blok toont
     wat de aanroeper meegeeft in p.bank — niemand doet dat: de trigger op
     payments zet awaitingTransfer altijd op false, en de instructiemail
     komt uit send-payment-instructions, dat zijn gegevens sinds 30-08-2026
     uit _shared/bank.ts leest. Het blok blijft staan voor een handmatige
     aanroep, maar wijst nu naar diezelfde ene bron in plaats van een
     losse set velden te accepteren. Wil je hier ooit weer bankgegevens
     tonen, geef dan geen eigen waarden mee — pas _shared/bank.ts aan.
     De IBAN-regel is weg: Gambia kent geen IBAN, en een leeg veld met dat
     label zet een buitenlandse bank juist op het verkeerde been. */
  const bankBlock = waiting && p.bank
    ? `${sectionLabel('Where to send it')}${detailTable([
        ['Bank', escOpt(p.bank.name) ?? BANK.bank],
        ['Account name', BANK.account_name],
        ['Account', escOpt(p.bank.account) ?? BANK.account_number],
        ['SWIFT', escOpt(p.bank.swift) ?? BANK.swift],
        ['Reference', `<strong>${esc(p.reference)}</strong>`],
      ], 'amber')}`
    : '';

  const intro = waiting
    ? `Thanks${fname ? ', ' + fname : ''} — we have registered your bank transfer of <strong>${esc(p.amount)}</strong>. Quote reference <strong>${esc(p.reference)}</strong> exactly, otherwise we cannot match the payment to your order. Your ${esc(p.plan)} starts the moment the money lands.`
    : `Thanks${fname ? ', ' + fname : ''} — your payment came through and your <strong>${esc(p.plan)}</strong> is confirmed. Keep this email: it is your receipt.`;

  return emailWrap({
    heading: waiting ? 'Transfer registered' : 'Payment confirmed',
    preheader: waiting
      ? `Reference ${p.reference} — quote it with your transfer of ${p.amount}.`
      : `Receipt for ${p.amount} · ${p.plan} · reference ${p.reference}.`,
    body: `<p style="margin:0 0 16px">${intro}</p>
      ${detailTable(rows)}
      ${bankBlock}
      ${p.planNote ? `<p style="margin:16px 0 0;font-size:14.5px;color:${BRAND.ink2}">${esc(p.planNote)}</p>` : ''}
      ${callout(`<p style="font-size:14px;color:${BRAND.ink};margin:0"><strong>MyKunda only ever charges listing and service fees.</strong> We never collect a deposit, a down payment or the purchase price of a property. Anyone asking you to send property money through us is not us — tell us straight away.</p>`)}
      <p style="margin:16px 0 0;font-size:14px;color:${BRAND.muted}">Questions about this payment? Reply to this email with your reference, or WhatsApp <a href="${BRAND.waLink}" style="color:${BRAND.green};font-weight:600">${BRAND.waNumber}</a>.</p>`,
    /* Naar de bestelling zelf, niet naar het dashboard in het algemeen. Bij een
       titelcontrole staat daar ook hoe ver het werk is — precies de vraag die
       een klant na de bon stelt. De terugbetaalmail wijst er al naartoe; nu doen
       de bon en de betaalinstructies dat ook. (31-08-2026) */
    cta: 'See this order',
    ctaUrl: `${BRAND.site}/betaling-status.html?ref=${encodeURIComponent(p.reference)}`,
    footer: 'You received this because you completed an order on mykunda.com. This email is your receipt.',
  });
}

/* De uitkomst hoort erbij. Tot 30-08-2026 nam deze functie alleen PaymentInfo,
   en notify-payment hergebruikte hem óók voor failed/cancelled/expired. De
   backoffice kreeg dan een groene mail met de kop "Payment received", de regel
   "Status: Paid" en de instructie "Activate this order" — bij een betaling die
   niet doorging. Alleen de onderwerpregel klopte. Dat is de enige plek in de
   hele mailketen waar geld verkeerd kon gaan, dus de uitkomst gaat nu mee. */
type PayOutcome = 'succeeded' | 'failed' | 'cancelled' | 'expired';

const BACKOFFICE_OUTCOME: Record<Exclude<PayOutcome, 'succeeded'>, { heading: string; status: string; note: string }> = {
  failed:    { heading: 'Payment failed',              status: 'Failed — nothing received',   note: 'The payment did not go through. <strong>Do not activate this order.</strong> The customer has been emailed and can try again.' },
  cancelled: { heading: 'Payment cancelled',           status: 'Cancelled by the customer',   note: 'The customer stopped before paying. <strong>Do not activate this order.</strong> They have been emailed and can start again.' },
  expired:   { heading: 'Payment reference expired',   status: 'Expired — never paid',        note: 'This reference has passed its date without payment. <strong>Do not activate this order.</strong> The customer has been emailed a fresh start.' },
};

export function paymentBackofficeEmail(p: PaymentInfo, outcome: PayOutcome = 'succeeded'): string {
  const waiting = !!p.awaitingTransfer;
  const bad = outcome !== 'succeeded' ? BACKOFFICE_OUTCOME[outcome] : null;
  return emailWrap({
    heading: bad ? bad.heading : (waiting ? 'Bank transfer registered' : 'Payment received'),
    preheader: `${bad ? bad.heading + ' · ' : ''}${p.amount} · ${p.plan} · ${p.reference}`,
    body: `${bad
      ? callout(`<p style="font-size:14px;color:${BRAND.ink};margin:0">${bad.note}</p>`, 'red')
      : waiting
      ? callout(`<p style="font-size:14px;color:${BRAND.ink};margin:0"><strong>Action required.</strong> Watch the bank account for <strong>${esc(p.amount)}</strong> with reference <strong>${esc(p.reference)}</strong>, then activate the order.</p>`)
      : callout(`<p style="font-size:14px;color:${BRAND.ink};margin:0"><strong>Action required.</strong> Activate this order and confirm to the customer.</p>`, 'green')}
      ${sectionLabel('Order')}
      ${detailTable([
        ['Reference', `<strong>${esc(p.reference)}</strong>`],
        ['Service', esc(p.plan)],
        ['Amount', `<strong>${esc(p.amount)}</strong>`],
        ['Method', esc(p.method)],
        ['Status', bad ? bad.status : (waiting ? 'Awaiting bank transfer' : 'Paid')],
        ['Date', esc(payDate(p.date))],
      ])}
      ${sectionLabel('Customer')}
      ${detailTable([
        ['Name', escOpt(p.name)],
        ['Email', p.email ? `<a href="mailto:${esc(p.email)}" style="color:${BRAND.green};font-weight:600">${esc(p.email)}</a>` : undefined],
        ['Phone', escOpt(p.phone)],
      ])}`,
    cta: 'Open admin console',
    ctaUrl: `${BRAND.site}/admin.html`,
    footer: 'Internal notification from the MyKunda website.',
  });
}

/* ============================================================
   AUTH — password reset / magic link / signup confirm
   ============================================================ */

export function authLinkEmail(opts: { type: 'recovery' | 'magiclink' | 'signup'; link: string }): string {
  const { type, link } = opts;
  const COPY: Record<string, { heading: string; body: string; cta: string; expiry: string; pre: string }> = {
    recovery: {
      heading: 'Reset your password',
      body: 'We received a request to reset the password on your MyKunda account. Choose a new one with the button below.',
      cta: 'Reset password',
      expiry: 'This link expires in one hour. Didn’t request it? You can safely ignore this email — your password stays as it is.',
      pre: 'Your password reset link — valid for one hour.',
    },
    magiclink: {
      heading: 'Your sign-in link',
      body: 'Use the button below to sign in to MyKunda. No password needed.',
      cta: 'Sign in to MyKunda',
      expiry: 'This link expires in one hour and works only once.',
      pre: 'Your sign-in link — valid for one hour.',
    },
    signup: {
      heading: 'Confirm your email',
      body: 'Welcome to MyKunda. Confirm your email address with the button below and your account is ready.',
      cta: 'Confirm email',
      expiry: 'This link expires in one hour.',
      pre: 'One click to confirm your MyKunda account.',
    },
  };
  const c = COPY[type] ?? COPY.magiclink;
  const safe = safeUrl(link);
  return emailWrap({
    heading: c.heading,
    preheader: c.pre,
    body: `<p style="margin:0 0 8px">${c.body}</p>
      <p style="font-size:13px;color:${BRAND.muted2};margin:18px 0 0">${c.expiry}</p>
      <p style="font-size:12.5px;color:${BRAND.muted2};margin:14px 0 0;word-break:break-all">Button not working? Paste this link into your browser:<br><a href="${safe}" style="color:${BRAND.green}">${safe}</a></p>`,
    cta: c.cta,
    ctaUrl: safe,
    footer: 'You received this because this address was used to sign in at mykunda.com. We never ask for your password by email.',
  });
}

/** The 6-digit sign-in code — what auth.html's OTP screen asks for. */
export function authCodeEmail(opts: { code: string; minutes?: number }): string {
  const code = esc(opts.code);
  const mins = opts.minutes ?? 60;
  return emailWrap({
    heading: 'Your sign-in code',
    preheader: `${code} — your MyKunda sign-in code.`,
    body: `<p style="margin:0 0 18px">Enter this code on the MyKunda sign-in screen to continue. No password needed.</p>
      <table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 0 6px"><tr><td style="background:${BRAND.green50};border:1px solid ${BRAND.line};border-radius:12px;padding:18px 26px;font-family:'Courier New',Courier,monospace;font-size:34px;font-weight:700;letter-spacing:.22em;color:${BRAND.ink};text-align:center">${code}</td></tr></table>
      <p style="font-size:13px;color:${BRAND.muted2};margin:18px 0 0">The code expires in ${mins} minutes and works only once. Didn’t ask for it? You can safely ignore this email.</p>`,
    footer: 'You received this because this address was used to sign in at mykunda.com. We never ask for your password by email.',
  });
}

/* ============================================================
   DELIVERABILITY ALERT — from the resend-webhook function
   ============================================================ */

export function emailEventAlertEmail(evt: {
  type: string; recipient?: string | null; subject?: string | null;
  reason?: string | null; emailId?: string | null;
}): string {
  const LABELS: Record<string, string> = {
    'email.bounced': 'Email bounced',
    'email.complained': 'Recipient marked this as spam',
    'email.failed': 'Email failed to send',
    'email.delivery_delayed': 'Email delivery delayed',
    'email.suppressed': 'Email suppressed',
  };
  const heading = LABELS[evt.type] || `Email event: ${esc(evt.type)}`;
  const severe = evt.type === 'email.complained';

  return emailWrap({
    heading,
    preheader: `${heading}${evt.recipient ? ' — ' + evt.recipient : ''}`,
    body: `${callout(
      `<p style="font-size:14px;color:${BRAND.ink};margin:0">${severe
        ? 'A recipient marked a MyKunda email as spam. Repeated complaints get the whole domain blocked by mailbox providers — worth checking what was sent and why.'
        : 'Resend reported a delivery problem with one of our emails.'}</p>`, severe ? 'red' : 'amber')}
      ${detailTable([
        ['To', escOpt(evt.recipient)],
        ['Subject', escOpt(evt.subject)],
        ['Reason', escOpt(evt.reason)],
      ])}`,
    cta: evt.emailId ? 'View in Resend' : undefined,
    ctaUrl: evt.emailId ? `https://resend.com/emails/${esc(evt.emailId)}` : undefined,
    footer: 'Internal deliverability alert from the MyKunda website.',
  });
}

/* ============================================================
   WHATSAPP — the one channel that is not email. Same voice,
   plain text, because WhatsApp has no HTML.
   ============================================================ */

export function whatsappAutoReply(name?: string): string {
  const fname = name ? String(name).trim().split(' ')[0] : '';
  return `Hello${fname ? ' ' + fname : ''}, thanks for messaging MyKunda.

We have your message and a member of our team will reply here within 1–2 working days. Office hours are 9:00–18:00, Monday to Saturday.

In the meantime you can browse every property and plot we list at mykunda.com.

One thing worth knowing: MyKunda never asks you to send money for a property through us. We only charge listing and service fees.

— The MyKunda team`;
}

/* ============================================================
   ACCOUNT CREATED — welcome to the user + heads-up to the team
   ============================================================ */

export interface SignupInfo {
  id: string;
  name?: string;
  email: string;
  /** 'google' for OAuth sign-ups, 'email' for the 6-digit code path. */
  provider: string;
  consentContact: boolean;
  consentAt?: string;
  consentMarketing: boolean;
  createdAt?: string;
  /** profiles.role op het moment van versturen: 'buyer' | 'seller' | 'agent'.
   *  Sinds 30-08-2026 kiest de bezoeker zijn rol bij het aanmelden, dus de
   *  welkomstmail hoeft niet meer alle vier de dingen tegelijk aan te prijzen.
   *  Let op bij Google: de rol wordt daar pas ná het aanmaken van het account
   *  gezet (set-role), en de databasetrigger stuurt deze mail al bij het
   *  aanmaken. Een Google-aanmelding krijgt daardoor meestal de zoekersversie.
   *  Dat is bewust: liever een iets te algemene mail dan geen mail. */
  role?: string;
}

/** One row of the "what your account unlocks" list. */
function featureRow(icon: string, title: string, text: string, url: string): string {
  return `<tr>
    <td style="width:44px;vertical-align:top;padding:12px 0"><table role="presentation" cellpadding="0" cellspacing="0"><tr><td style="width:36px;height:36px;border-radius:9px;background:${BRAND.green50};color:${BRAND.green};font-size:17px;font-weight:800;text-align:center;line-height:36px">${icon}</td></tr></table></td>
    <td style="vertical-align:top;padding:12px 0 12px 12px;border-bottom:1px solid ${BRAND.line}">
      <p style="margin:0;font-size:15px;font-weight:700;color:${BRAND.ink}"><a href="${url}" style="color:${BRAND.ink};text-decoration:none">${title}</a></p>
      <p style="margin:3px 0 0;font-size:14px;color:${BRAND.muted};line-height:1.5">${text}</p>
    </td></tr>`;
}

/** To the new user, once their account is confirmed. */
export function welcomeEmail(u: SignupInfo): string {
  const fname = u.name ? esc(String(u.name).trim().split(' ')[0]) : '';
  const S = BRAND.site;
  const marketing = !!u.consentMarketing;

  /* De rol komt sinds 30-08-2026 uit de aanmeldflow. Hij bepaalt waar de mail
     mee opent en welke rij bovenaan staat; alle vier de rijen blijven staan,
     want een verkoper mag ook zoeken en een zoeker mag ook aanbieden. Zo blijft
     de mail kloppen als de rol later verandert. */
  const role = u.role === 'seller' || u.role === 'agent' ? u.role : 'buyer';
  const opener = {
    buyer: 'Your account is ready. From here you can save the properties and searches you care about, message sellers directly, and ask us to check a title before any money moves.',
    seller: 'Your account is ready. You can publish your first listing in a few minutes — it is free to start — and every enquiry, viewing request and message lands in My MyKunda.',
    agent: 'Your account is ready. You can publish listings straight away, and set up your company profile — your logo, a line about the firm and a link to your own site — so buyers know who they are dealing with before they write.',
  }[role];
  const rowSave = featureRow('♥', 'Save homes and searches', 'Keep favourites and saved searches in one place in My MyKunda, and pick a search back up in one tap.', `${S}/dashboard.html#saved`);
  /* "Managed" stond hier tot 31-08-2026 in. Dat plan is geparkeerd tot er een
     partnerkantoor getekend heeft: het staat als commentaar in sell.html en in
     checkout.html en is nergens te koop. Een welkomstmail die een dienst noemt
     die niemand kan bestellen, kost precies het vertrouwen dat de rest van deze
     mail probeert op te bouwen. Terugzetten zodra Managed echt bestaat. */
  const rowList = featureRow('⌂', 'List a property or plot — free', 'Publish a listing in a few minutes; add Boost or Verified later for more views and a title check.', `${S}/list.html`);
  const rowCheck = featureRow('✓', 'Check ownership before you pay', 'Ask us to review title documents so you know what you are buying.', `${S}/verify.html`);
  const rowMarket = featureRow('%', 'Follow the market', 'Area guides, live prices and the MyKunda market index for the coast and upcountry.', `${S}/market.html`);
  /* Alleen voor een kantoor, sinds 02-09-2026: het bedrijfsprofiel is het
     enige dat een professionele aanbieder heeft en de andere twee rollen niet.
     Bovenaan, want het is het eerste dat hij hoort in te vullen — zonder logo
     staan zijn advertenties met initialen op de kaart. */
  const rowCompany = featureRow('▣', 'Set up your company profile', 'Your logo or a photo, a line about the firm and a link to your own site — shown on every listing you place.', `${S}/dashboard.html#company`);
  const rows = role === 'buyer'
    ? rowSave + rowCheck + rowMarket + rowList
    : role === 'agent'
      ? rowCompany + rowList + rowCheck + rowMarket + rowSave
      : rowList + rowCheck + rowMarket + rowSave;

  return emailWrap({
    heading: fname ? `Welcome to MyKunda, ${fname}` : 'Welcome to MyKunda',
    preheader: 'Your account is ready — here is what you can do now.',
    body: `<p style="margin:0 0 16px">${opener}</p>
      <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="margin:6px 0 4px">
        ${rows}
      </table>
      ${callout(`<p style="font-size:14px;color:${BRAND.ink};margin:0"><strong>Good to know:</strong> MyKunda only ever charges listing and service fees. We never collect deposits, down payments or purchase money — those go to your lawyer or notary's escrow account. Anyone asking otherwise is not us.</p>`, 'green')}
      ${marketing ? `<p style="margin:16px 0 0;font-size:14px;color:${BRAND.muted}">You asked us to email you about new listings and area alerts. You can switch them off — all at once, or per saved search — under Account in <a href="${S}/dashboard.html#account" style="color:${BRAND.green};font-weight:600">My MyKunda</a>.</p>` : ''}
      <div style="border-top:1px solid ${BRAND.line};margin-top:22px;padding-top:18px">
        <p style="font-size:14px;color:${BRAND.muted};margin:0">Questions? Reply to this email, or WhatsApp us at <a href="${BRAND.waLink}" style="color:${BRAND.green};font-weight:600">${BRAND.waNumber}</a> — office hours 9:00–18:00, Monday to Saturday.</p>
      </div>`,
    cta: 'Go to My MyKunda',
    ctaUrl: `${S}/dashboard.html`,
    footer: `You received this because an account was created on mykunda.com with this address${u.provider === 'google' ? ' via Google sign-in' : ''}. Not you? Reply to this email and we will remove it.`,
    unsubscribeUrl: marketing ? `${S}/dashboard.html?alerts=off` : undefined,
  });
}

/** Hoe de rol uit de aanmeldflow in de teammail heet. Een kantoor krijgt hier
 *  nadruk: dat is de enige rol waar iemand iets mee moet doen (licentiecheck). */
const ROLE_WORDS: Record<string, string> = {
  buyer: 'Searching (buyer or renter)',
  seller: 'Private seller',
  agent: '<strong>Business / agency</strong> — licence still to be checked',
  admin: 'Admin',
};

/** To the team: a new account, with the consent state spelled out. */
export function signupBackofficeEmail(u: SignupInfo): string {
  const via = u.provider === 'google' ? 'Google' : 'Email code';
  const fmt = (v: string) => new Date(v).toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Africa/Banjul' });
  const when = u.createdAt ? fmt(u.createdAt) + ' (Banjul)' : undefined;
  const consent = u.consentContact
    ? `Yes${u.consentAt ? ' · ' + esc(fmt(u.consentAt)) : ''}`
    : `<span style="color:#C0392B;font-weight:700">Not recorded</span>`;
  return emailWrap({
    heading: 'New account created',
    preheader: `${u.name || u.email} just joined via ${via}.`,
    body: `<p style="margin:0 0 14px">Someone just created a MyKunda account. <strong>Reply to this email</strong> to reach them directly.</p>
      ${detailTable([
        ['Name', escOpt(u.name) || '—'],
        ['Email', `<a href="mailto:${esc(u.email)}" style="color:${BRAND.green};font-weight:600">${esc(u.email)}</a>`],
        ['Signed up as', ROLE_WORDS[String(u.role ?? '')] ?? 'Searching (buyer or renter)'],
        ['Signed up via', via],
        ['Terms accepted', consent],
        ['Listing alerts', u.consentMarketing ? 'Opted in' : 'No'],
        ['Created', escOpt(when)],
        ['User ID', `<span style="font-family:Courier New,monospace;font-size:12.5px">${esc(u.id)}</span>`],
      ])}
      ${!u.consentContact ? callout(`<p style="font-size:14px;color:${BRAND.ink};margin:0">No consent timestamp on this profile — check the sign-up path before contacting this person for marketing.</p>`) : ''}`,
    cta: 'Open admin console',
    ctaUrl: `${BRAND.site}/admin.html`,
    footer: 'Internal notification from the MyKunda website.',
  });
}

/* ============================================================
   SAVED SEARCH ALERT — nieuw aanbod voor een bewaarde zoekopdracht
   ============================================================ */

export interface AlertListing {
  id: string;
  title?: string;
  area?: string;
  price?: number;
  price_period?: string | null;  // night | week | month | year — hoort bij het bedrag
  kind?: string;            // 'sale' | 'rent'
  beds?: number; baths?: number; sqm?: number; plot?: number;
  cat?: string;
  verified?: boolean;
  img?: string;             // publieke storage-URL van de omslagfoto
}
export interface AlertGroup {
  label: string;            // hoe de zoekopdracht heet in het dashboard
  url: string;              // search.html?… om de hele zoekopdracht te openen
  listings: AlertListing[]; // de nieuwe treffers, al afgekapt
  more: number;             // hoeveel er niet in de mail passen
}
export interface SavedSearchAlertInput {
  name?: string;
  groups: AlertGroup[];
  total: number;
}

/* Het achtervoegsel volgt de periode van de advertentie, net als
   priceSuffixFor() in app.js. Stond hier tot 01-09-2026 vast op /mo, wat bij
   een vakantiewoning per nacht of bedrijfsruimte per jaar onwaar is — en een
   mail met een verkeerd bedrag is erger dan geen mail. */
const ALERT_SUFFIX: Record<string, string> = { night: ' /night', week: ' /wk', month: ' /mo', year: ' /yr' };
const alertPrice = (l: AlertListing) =>
  l.price
    ? `D ${nummer(l.price)}${l.kind === 'rent' ? (ALERT_SUFFIX[String(l.price_period ?? '')] ?? ' /mo') : ''}`
    : 'Price on request';

function alertSpecs(l: AlertListing): string {
  const bits: string[] = [];
  if (l.cat === 'land' || l.cat === 'business_plot') {
    if (l.plot) bits.push(`${nummer(l.plot)} m² plot`);
  } else {
    if (l.beds) bits.push(`${l.beds} bed`);
    if (l.baths) bits.push(`${l.baths} bath`);
    if (l.sqm) bits.push(`${nummer(l.sqm)} m²`);
  }
  return bits.join(' · ');
}

/** Eén advertentie als rij: kleine foto links, de feiten rechts. */
function alertRow(l: AlertListing): string {
  const S = BRAND.site;
  const url = `${S}/property.html?id=${encodeURIComponent(String(l.id))}`;
  const specs = alertSpecs(l);
  const photo = l.img
    ? `<img src="${safeUrl(l.img)}" width="108" alt="" style="display:block;width:108px;height:78px;object-fit:cover;border-radius:8px;border:0">`
    : `<table role="presentation" cellpadding="0" cellspacing="0"><tr><td style="width:108px;height:78px;border-radius:8px;background:${BRAND.paper2}"></td></tr></table>`;
  return `<tr>
    <td style="width:120px;vertical-align:top;padding:12px 12px 12px 0"><a href="${url}" style="text-decoration:none">${photo}</a></td>
    <td style="vertical-align:top;padding:12px 0;border-bottom:1px solid ${BRAND.line}">
      <p style="margin:0;font-size:15px;font-weight:700;line-height:1.35"><a href="${url}" style="color:${BRAND.ink};text-decoration:none">${escOpt(l.title) || 'Untitled'}</a></p>
      ${l.area ? `<p style="margin:3px 0 0;font-size:13.5px;color:${BRAND.muted}">${esc(String(l.area))}</p>` : ''}
      <p style="margin:6px 0 0;font-size:15px;font-weight:800;color:${BRAND.green}">${alertPrice(l)}${l.verified ? ` <span style="font-size:12px;font-weight:700;color:${BRAND.muted}">· Verified title</span>` : ''}</p>
      ${specs ? `<p style="margin:4px 0 0;font-size:13px;color:${BRAND.muted}">${esc(specs)}</p>` : ''}
    </td></tr>`;
}

/** Naar de zoeker: wat er nieuw is op zijn bewaarde zoekopdrachten.
 *  Eén mail per persoon, met de zoekopdrachten eronder gegroepeerd — niet één
 *  mail per zoekopdracht, want dan krijgt iemand met vier zoekopdrachten vier
 *  mails over hetzelfde huis. */
export function savedSearchAlertEmail(a: SavedSearchAlertInput): string {
  const S = BRAND.site;
  const fname = a.name ? esc(String(a.name).trim().split(' ')[0]) : '';
  const n = a.total;
  const what = n === 1 ? 'one new property' : `${n} new properties`;
  const blocks = a.groups.map((g) => `
    <div style="margin:22px 0 0">
      ${sectionLabel(esc(g.label))}
      <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%">
        ${g.listings.map(alertRow).join('')}
      </table>
      ${g.more > 0
        ? `<p style="margin:10px 0 0;font-size:13.5px"><a href="${safeUrl(g.url)}" style="color:${BRAND.green};font-weight:700;text-decoration:none">See ${g.more} more like this →</a></p>`
        : `<p style="margin:10px 0 0;font-size:13.5px"><a href="${safeUrl(g.url)}" style="color:${BRAND.green};font-weight:700;text-decoration:none">Open this search →</a></p>`}
    </div>`).join('');

  return emailWrap({
    heading: fname ? `${fname}, ${what} for you` : `${what.charAt(0).toUpperCase()}${what.slice(1)} for you`,
    preheader: `New on MyKunda since we last wrote: ${what} matching your saved ${a.groups.length === 1 ? 'search' : 'searches'}.`,
    body: `<p style="margin:0 0 4px">These came online since our last email and match what you asked us to watch.</p>
      ${blocks}
      ${callout(`<p style="font-size:14px;color:${BRAND.ink};margin:0"><strong>Before you pay anything:</strong> ask for the title documents and have them checked. We never collect deposits or purchase money — that goes to your lawyer or notary. <a href="${S}/verify.html" style="color:${BRAND.green};font-weight:600">How an ownership check works</a></p>`, 'green')}`,
    cta: 'Open My MyKunda',
    ctaUrl: `${S}/dashboard.html#saved`,
    footer: 'You get this because you saved a search on mykunda.com and asked for alerts. One email at a time, never more than one a day.',
    unsubscribeUrl: `${S}/dashboard.html?alerts=off`,
  });
}

/* ---------- aflopende extra's (Boost, Verified) ---------- */

export interface ExpiryItem {
  listingId: string;
  title?: string;
  area?: string;
  /** 'boost' of 'verified' — de twee producten met een looptijd. */
  product: 'boost' | 'verified';
  /** 'soon' = loopt binnenkort af, 'ended' = is afgelopen. */
  phase: 'soon' | 'ended';
  /** De einddatum zelf, als ISO-string. */
  until: string;
  /** Hele dagen tot het einde; negatief als het al voorbij is. */
  days: number;
}
export interface PlanExpiryInput {
  name?: string;
  items: ExpiryItem[];
  unsubscribeUrl?: string;
}

const PRODUCT_WORD: Record<ExpiryItem['product'], string> = {
  boost: 'Boost',
  verified: 'Verified listing',
};

function expiryDate(iso: string): string {
  const d = new Date(iso);
  return isNaN(d.getTime())
    ? ''
    : d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });
}

/** Eén regel: welke advertentie, welk product, en wanneer het afloopt of afliep. */
function expiryRow(i: ExpiryItem): string {
  const url = `${BRAND.site}/property.html?id=${encodeURIComponent(String(i.listingId))}`;
  const when = i.phase === 'ended'
    ? `Ended ${expiryDate(i.until)}`
    : i.days <= 0
      ? `Ends today`
      : `Ends ${expiryDate(i.until)} — ${i.days} day${i.days === 1 ? '' : 's'} left`;
  const tone = i.phase === 'ended' ? BRAND.muted : BRAND.amber;
  return `<tr>
    <td style="padding:13px 0;border-bottom:1px solid ${BRAND.line}">
      <p style="margin:0;font-size:15px;font-weight:700;line-height:1.35"><a href="${url}" style="color:${BRAND.ink};text-decoration:none">${escOpt(i.title) || 'Your listing'}</a></p>
      ${i.area ? `<p style="margin:3px 0 0;font-size:13.5px;color:${BRAND.muted}">${esc(String(i.area))}</p>` : ''}
      <p style="margin:6px 0 0;font-size:14px;font-weight:700;color:${tone}">${esc(PRODUCT_WORD[i.product])} · ${esc(when)}</p>
    </td></tr>`;
}

/** Naar de aanbieder: zijn Boost of zijn Verified-periode loopt af of is af.
 *
 *  Dit is post over iets wat hij zelf gekocht heeft, en daarom geen mail die
 *  achter de marketingtoestemming zit — wie voor dertig dagen betaalt hoort te
 *  horen dat die dertig dagen om zijn. Hij draagt wél een afmeldlink, want er
 *  staat ook een verlengknop in, en dat maakt hem deels een aanbieding. */
export function planExpiryEmail(a: PlanExpiryInput): string {
  const S = BRAND.site;
  const fname = a.name ? esc(String(a.name).trim().split(' ')[0]) : '';
  const items = a.items;
  const ended = items.filter((i) => i.phase === 'ended');
  const soon = items.filter((i) => i.phase === 'soon');

  /* De kop zegt wat er aan de hand is. Bij precies één ding kan dat concreet;
     bij meer wordt het één zin die niet doet alsof het er één is. */
  let heading: string;
  if (items.length === 1) {
    const i = items[0];
    heading = i.phase === 'ended'
      ? `Your ${PRODUCT_WORD[i.product]} has ended`
      : i.days <= 0
        ? `Your ${PRODUCT_WORD[i.product]} ends today`
        : `Your ${PRODUCT_WORD[i.product]} ends in ${i.days} day${i.days === 1 ? '' : 's'}`;
  } else if (!soon.length) {
    heading = `${items.length} of your extras have ended`;
  } else if (!ended.length) {
    heading = `${items.length} of your extras are running out`;
  } else {
    heading = 'Some of your extras are running out';
  }
  if (fname) heading = `${fname}, ${heading.charAt(0).toLowerCase()}${heading.slice(1)}`;

  const rows = items.map(expiryRow).join('');

  /* Wat er feitelijk verandert als het afloopt, en niets meer dan dat.
     Geen uitspraken over aantallen kijkers of enquiries: die zijn nergens
     gemeten, dus die horen niet in een mail.

     De Verified-regel zegt met opzet NIET dat het vinkje eraf gaat. Dat gaat
     er namelijk niet af: apply_paid_plan() verlengt alleen verified_until, en
     is_verified_title zet een medewerker met de hand — niets zet hem terug.
     Schrijf hier dus niets over een badge die verdwijnt zolang dat niet zo is. */
  const gevolg: string[] = [];
  if (items.some((i) => i.product === 'boost')) {
    gevolg.push('A Boost puts your listing at the top of the search results in their normal order, and first on the homepage. When it ends the listing stays online exactly as it is — it simply takes its usual place in the results again.');
  }
  if (items.some((i) => i.product === 'verified')) {
    gevolg.push('A Verified check is paid for six months at a time. When those six months are up the listing stays exactly as it is; the check is simply no longer current, and a new one runs for another six months.');
  }

  return emailWrap({
    heading,
    /* De preheader is de regel naast het onderwerp in de inbox, dus hij moet
       kloppen met wat er in de mail staat — ook in aantal. */
    preheader: !soon.length
      ? (ended.length === 1
          ? 'An extra on your listing has run out. Nothing has been taken offline.'
          : `${ended.length} extras on your listings have run out. Nothing has been taken offline.`)
      : (items.length === 1
          ? 'An extra on your listing runs out shortly. Nothing will be taken offline.'
          : `${items.length} extras on your listings need a look. Nothing will be taken offline.`),
    body: `<p style="margin:0 0 4px">${ended.length && !soon.length
        ? 'This is what has run out on your side of MyKunda.'
        : 'This is what is running out on your side of MyKunda.'}</p>
      <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="margin:12px 0 0">${rows}</table>
      ${gevolg.map((g) => `<p style="margin:16px 0 0;font-size:14.5px;color:${BRAND.ink2};line-height:1.6">${g}</p>`).join('')}
      ${callout(`<p style="font-size:14px;color:${BRAND.ink};margin:0"><strong>Your listing is not going anywhere.</strong> Nothing is removed, hidden or changed when an extra ends. You only lose the extra.</p>`, 'green')}`,
    cta: ended.length ? 'See what it costs to renew' : 'See the plans',
    ctaUrl: `${S}/sell.html#pricing`,
    footer: 'You get this because you bought a Boost or a Verified check for a listing on mykunda.com. We write once when it is about to run out, and once when it has.',
    unsubscribeUrl: a.unsubscribeUrl,
  });
}

/* Eén bron voor de bankrekening, ook voor het (latente) bankblok in de bon. */
export { BANK, USD, BANK_DETAILS } from './bank.ts';

/* Listing templates live next door but import from this file. */
export {
  listingConfirmationEmail,
  listingBackofficeEmail,
  listingLiveEmail,
  listingRejectedEmail,
  listingArchivedEmail,
} from './email-listing.ts';
