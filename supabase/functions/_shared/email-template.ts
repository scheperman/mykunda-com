// ============================================================
//  MyKunda — branded email system
//  Deployed copy for notify-signup: shared primitives + the two
//  account templates. The repo's full _shared/email-template.ts is
//  the source of truth; keep the two functions below in sync there.
// ============================================================

export const BRAND = {
  name: 'MyKunda',
  site: 'https://mykunda.com',
  logo: 'https://mykunda.com/images/mykunda-icon.png',
  email: 'info@mykunda.com',
  waNumber: '+220 228 2717',
  waLink: 'https://wa.me/2202282717',
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

export function esc(v: unknown): string {
  if (v === null || v === undefined) return '';
  return String(v)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

export function escOpt(v: unknown): string | undefined {
  if (v === null || v === undefined || String(v).trim() === '') return undefined;
  return esc(v);
}

export function escLines(v: unknown): string {
  return esc(v).replace(/\r?\n/g, '<br>');
}

export function safeUrl(v: unknown): string {
  const s = String(v ?? '').trim();
  return /^https?:\/\//i.test(s) ? esc(s) : '';
}

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

export function detailTable(rows: [string, unknown][], tone: 'paper' | 'amber' = 'paper'): string {
  const body = rows
    .filter(([, v]) => v !== null && v !== undefined && String(v).trim() !== '')
    .map(([k, v]) => `<tr><td style="padding:11px 16px;color:${BRAND.muted};font-weight:600;border-bottom:1px solid ${BRAND.line};width:120px;font-size:14px;vertical-align:top">${esc(k)}</td><td style="padding:11px 16px;color:${BRAND.ink};border-bottom:1px solid ${BRAND.line};font-size:14px;vertical-align:top">${v}</td></tr>`).join('');
  if (!body) return '';
  const bg = tone === 'amber' ? BRAND.amber50 : BRAND.paper;
  return `<table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="width:100%;border-collapse:collapse;background:${bg};border-radius:10px;margin:8px 0">${body}</table>`;
}

export function sectionLabel(text: string): string {
  return `<p style="font-size:12px;color:${BRAND.muted};font-weight:700;text-transform:uppercase;letter-spacing:.06em;margin:22px 0 6px">${esc(text)}</p>`;
}

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

export function emailWrap(opts: {
  heading: string;
  body: string;
  cta?: string;
  ctaUrl?: string;
  footer?: string;
  preheader?: string;
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
   ACCOUNT CREATED: welcome to the user + heads-up to the team
   ============================================================ */

function featureRow(icon: string, title: string, text: string, url: string): string {
  return `<tr>
    <td style="width:44px;vertical-align:top;padding:12px 0"><table role="presentation" cellpadding="0" cellspacing="0"><tr><td style="width:36px;height:36px;border-radius:9px;background:${BRAND.green50};color:${BRAND.green};font-size:17px;font-weight:800;text-align:center;line-height:36px">${icon}</td></tr></table></td>
    <td style="vertical-align:top;padding:12px 0 12px 12px;border-bottom:1px solid ${BRAND.line}">
      <p style="margin:0;font-size:15px;font-weight:700;color:${BRAND.ink}"><a href="${url}" style="color:${BRAND.ink};text-decoration:none">${title}</a></p>
      <p style="margin:3px 0 0;font-size:14px;color:${BRAND.muted};line-height:1.5">${text}</p>
    </td></tr>`;
}

export interface SignupInfo {
  id: string; name?: string; email: string; provider: string;
  consentContact: boolean; consentAt?: string; consentMarketing: boolean; createdAt?: string;
}

export function welcomeEmail(u: SignupInfo): string {
  const fname = u.name ? esc(String(u.name).trim().split(' ')[0]) : '';
  const S = BRAND.site;
  const marketing = !!u.consentMarketing;
  return emailWrap({
    heading: fname ? `Welcome to MyKunda, ${fname}` : 'Welcome to MyKunda',
    preheader: 'Your account is ready — here is what you can do now.',
    body: `<p style="margin:0 0 16px">Your account is ready. MyKunda is the property platform for The Gambia — built for buyers, renters, sellers and the diaspora, with local knowledge and professional standards. Here is what your account unlocks:</p>
      <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="margin:6px 0 4px">
        ${featureRow('♥', 'Save homes and searches', 'Keep favourites in one place and get an email when a matching property comes online.', `${S}/search.html`)}
        ${featureRow('⌂', 'List a property or plot — free', 'Publish a listing in a few minutes; add Verified or Managed later for a title check and full handling.', `${S}/list.html`)}
        ${featureRow('✓', 'Check ownership before you pay', 'Ask us to review title documents so you know what you are buying.', `${S}/verify.html`)}
        ${featureRow('%', 'Follow the market', 'Area guides, live prices and the MyKunda market index for the coast and upcountry.', `${S}/market.html`)}
      </table>
      ${callout(`<p style="font-size:14px;color:${BRAND.ink};margin:0"><strong>Good to know:</strong> MyKunda only ever charges listing and service fees. We never collect deposits, down payments or purchase money — those go to your lawyer or notary's escrow account. Anyone asking otherwise is not us.</p>`, 'green')}
      ${marketing ? `<p style="margin:16px 0 0;font-size:14px;color:${BRAND.muted}">You chose to receive new listings and area alerts by email — a handful a month at most, and you can switch them off any time from your dashboard.</p>` : ''}
      <div style="border-top:1px solid ${BRAND.line};margin-top:22px;padding-top:18px">
        <p style="font-size:14px;color:${BRAND.muted};margin:0">Questions? Reply to this email, or WhatsApp us at <a href="${BRAND.waLink}" style="color:${BRAND.green};font-weight:600">${BRAND.waNumber}</a> — office hours 9:00–18:00, Monday to Saturday.</p>
      </div>`,
    cta: 'Go to My MyKunda',
    ctaUrl: `${S}/dashboard.html`,
    footer: `You received this because an account was created on mykunda.com with this address${u.provider === 'google' ? ' via Google sign-in' : ''}. Not you? Reply to this email and we will remove it.`,
    unsubscribeUrl: marketing ? `${S}/dashboard.html?alerts=off` : undefined,
  });
}

export function signupBackofficeEmail(u: SignupInfo): string {
  const via = u.provider === 'google' ? 'Google' : 'Email code';
  const when = u.createdAt ? new Date(u.createdAt).toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Africa/Banjul' }) + ' (Banjul)' : undefined;
  const consent = u.consentContact
    ? `Yes${u.consentAt ? ' · ' + esc(new Date(u.consentAt).toLocaleString('en-GB',{dateStyle:'medium',timeStyle:'short',timeZone:'Africa/Banjul'})) : ''}`
    : `<span style="color:#C0392B;font-weight:700">Not recorded</span>`;
  return emailWrap({
    heading: 'New account created',
    preheader: `${u.name || u.email} just joined via ${via}.`,
    body: `<p style="margin:0 0 14px">Someone just created a MyKunda account. <strong>Reply to this email</strong> to reach them directly.</p>
      ${detailTable([
        ['Name', escOpt(u.name) || '—'],
        ['Email', `<a href="mailto:${esc(u.email)}" style="color:${BRAND.green};font-weight:600">${esc(u.email)}</a>`],
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
