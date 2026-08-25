/* ============================================================
   MyKunda — Admin console navigation
   One bar, identical on every backoffice page. Include after
   app.min.js and render into <div id="adminNav"></div>:

     document.getElementById('adminNav').innerHTML = adminNavHTML('review');

   Page-level navigation is this bar (text tabs, white).
   View switching INSIDE a page uses .vswitch pills (see below) —
   the two never look alike, so a click is always predictable.
   ============================================================ */

const ADMIN_SECTIONS = [
  ['review', 'Review &amp; leads', 'admin.html', '<path d="M4 6h16M4 12h16M4 18h10"/>'],
  /* 'titles' (title-verification.html) staat hier bewust NIET in sinds
     24-08-2026. Die pagina draait volledig op voorbeelddata en toont dus
     verzonnen openstaande controles in een live console. Het bestand
     blijft staan; zodra er een echte verificatiestroom achter zit, kan
     deze regel terug. Het toekennen van het Verified-badge gebeurt tot
     die tijd op de Orders-weergave in admin.html. */
  ['sales', 'Sales &amp; revenue', 'sales.html', '<path d="M5 20V11M12 20V5M19 20v-6"/><path d="M3 20h18"/>'],
  ['market', 'Market index', 'market.html', '<path d="M3 17l6-6 4 4 8-8"/><path d="M21 7v5h-5"/>'],
  ['sources', 'Sources', 'sources.html', '<path d="M12 3v18"/><path d="M5 8l7-5 7 5"/><circle cx="5" cy="11" r="2"/><circle cx="19" cy="11" r="2"/><path d="M5 13v3a3 3 0 003 3h8a3 3 0 003-3v-3"/>'],
  ['rates', 'Rates &amp; pricing', 'rates.html', '<circle cx="12" cy="12" r="9"/><path d="M15 9.5c-.6-1-1.8-1.5-3-1.5-1.7 0-3 .9-3 2.1 0 2.7 6 1.2 6 3.9 0 1.2-1.3 2.1-3 2.1-1.2 0-2.4-.5-3-1.5"/><path d="M12 6.2v11.6"/>']
];

const ADMIN_NAV_CSS = `
.anav{background:var(--white);border-bottom:1px solid var(--line);box-shadow:var(--sh-sm);position:relative;z-index:20}
.anav-in{max-width:1180px;margin:0 auto;padding:0 28px;display:flex;align-items:center;gap:18px}
.anav-home{display:flex;align-items:center;gap:9px;text-decoration:none;flex:none;padding:14px 0;border:none}
.anav-home .mark{width:26px;height:26px;border-radius:8px;background:var(--green-700);color:#fff;display:grid;place-items:center;flex:none}
.anav-home b{font-family:var(--serif);font-size:15px;font-weight:800;color:var(--ink);line-height:1.1;white-space:nowrap}
.anav-home span{display:block;font-size:10.5px;font-weight:700;letter-spacing:.09em;text-transform:uppercase;color:var(--amber-600);line-height:1.4;white-space:nowrap}
.anav-links{display:flex;gap:4px;flex:1;min-width:0;overflow-x:auto;scrollbar-width:none}
.anav-links::-webkit-scrollbar{display:none}
.anav-l{display:inline-flex;align-items:center;gap:7px;white-space:nowrap;padding:19px 12px 17px;font-size:14.5px;font-weight:700;color:var(--muted);text-decoration:none;border-bottom:3px solid transparent;transition:.15s}
.anav-l svg{opacity:.55;flex:none}
.anav-l:hover{color:var(--green-700)}
.anav-l:hover svg{opacity:.9}
.anav-l.on{color:var(--green-700);border-bottom-color:var(--green-700)}
.anav-l.on svg{opacity:1}
.anav-b{display:none;min-width:20px;height:20px;padding:0 6px;border-radius:99px;background:var(--amber-500);color:#fff;font-size:11.5px;font-weight:800;align-items:center;justify-content:center}
.anav-b.show{display:inline-flex}
.anav-l.on .anav-b{background:var(--green-700)}
.anav-right{display:flex;align-items:center;gap:14px;flex:none;padding:10px 0}
.anav-exit{display:inline-flex;align-items:center;gap:6px;font-size:13.5px;font-weight:700;color:var(--muted);text-decoration:none;white-space:nowrap}
.anav-exit:hover{color:var(--green-700)}
.mode-flag{display:inline-flex;align-items:center;gap:7px;height:30px;padding:0 13px;border-radius:var(--r-pill);font-size:12.5px;font-weight:700;white-space:nowrap}
.mode-flag:before{content:"";width:7px;height:7px;border-radius:50%;background:currentColor}
.mode-flag.live{background:var(--green-100);color:var(--green-700)}
.mode-flag.demo{background:var(--amber-50);color:var(--amber-600)}

/* View switching inside a page — deliberately unlike the bar above */
.vswitch{display:inline-flex;background:var(--white);border-radius:var(--r-pill);padding:4px;gap:3px;box-shadow:inset 0 0 0 1.5px var(--line);margin-bottom:22px;max-width:100%;overflow-x:auto;scrollbar-width:none}
.vswitch::-webkit-scrollbar{display:none}
.vbtn{display:inline-flex;align-items:center;gap:8px;white-space:nowrap;height:38px;padding:0 18px;border:none;border-radius:var(--r-pill);background:none;font-family:var(--sans);font-size:14px;font-weight:700;color:var(--ink-2);cursor:pointer;transition:.15s}
.vbtn:hover{color:var(--green-700)}
.vbtn.on{background:var(--green-700);color:#fff}
.vbtn .badge-count{display:inline-flex;align-items:center;justify-content:center;min-width:20px;height:20px;padding:0 6px;border-radius:99px;background:var(--paper-2);color:var(--ink-2);font-size:11.5px;font-weight:800}
.vbtn.on .badge-count{background:rgba(255,255,255,.22);color:#fff}
@media(max-width:1180px){.anav-home b{display:none}.anav-l svg{display:none}}
@media(max-width:1040px){.anav-in{flex-wrap:wrap}.anav-home{padding:12px 0 9px}.anav-right{margin-left:auto;padding:9px 0}.anav-links{order:3;flex-basis:100%;border-top:1px solid var(--line-2)}.anav-l{padding:13px 12px 10px}}
@media(max-width:820px){.anav-in{padding:0 16px;gap:12px}.anav-home span{display:none}}
@media(max-width:560px){.anav-right .anav-exit{display:none}.anav-l{padding:12px 11px 9px;font-size:14px}}
`;

function adminNavHTML(current) {
  if (!document.getElementById('adminNavCss')) {
    const s = document.createElement('style');
    s.id = 'adminNavCss'; s.textContent = ADMIN_NAV_CSS;
    document.head.appendChild(s);
  }
  const links = ADMIN_SECTIONS.map(function (s) {
    const on = s[0] === current;
    return '<a class="anav-l' + (on ? ' on' : '') + '" href="' + s[2] + '"' + (on ? ' aria-current="page"' : '') + '>' +
      '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' + s[3] + '</svg>' +
      s[1] + '<i class="anav-b" id="anavB-' + s[0] + '"></i></a>';
  }).join('');
  return '<div class="anav"><div class="anav-in">' +
    '<a class="anav-home" href="admin.html"><span class="mark"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="7" height="9"/><rect x="14" y="3" width="7" height="5"/><rect x="14" y="12" width="7" height="9"/><rect x="3" y="16" width="7" height="5"/></svg></span>' +
    '<span><b>MyKunda</b><span>Admin console</span></span></a>' +
    '<nav class="anav-links" aria-label="Admin sections">' + links + '</nav>' +
    '<div class="anav-right"><span class="mode-flag demo" id="modeFlag">Demo data</span>' +
    '<a class="anav-exit" href="index.html">View site<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M7 17L17 7M8 7h9v9"/></svg></a></div>' +
    '</div></div>';
}

/* Badge on a section link. Pass 0 or null to hide it. */
function adminNavCount(key, n) {
  const el = document.getElementById('anavB-' + key);
  if (!el) return;
  el.textContent = n || '';
  el.classList.toggle('show', !!n);
}

Object.assign(window, { adminNavHTML: adminNavHTML, adminNavCount: adminNavCount, ADMIN_SECTIONS: ADMIN_SECTIONS });
