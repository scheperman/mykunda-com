/* ============================================================
   MyKunda — admin guard
   Load on every backoffice page, right after admin-nav.js:

     <script src="admin-guard.js?v=1"></script>

   Doet drie dingen:
   1. Niet ingelogd  → schermt de pagina af met een inlogscherm.
   2. Wel ingelogd, geen adminrol → schermt af MET de reden erbij
      (welk account, welke rol) en de SQL om het te herstellen.
      Zonder dit toont de pagina gewoon lege tabellen, omdat RLS
      de data stilzwijgend wegfiltert — dat leest als "kapot".
   3. Wel admin → doet niets, en zet de statusvlag rechtsboven
      in de consolebalk op "Live data".

   Draait de backend niet (backendReady() === false), dan blijft
   de pagina open: dat is de demo-modus voor lokaal werken.

   De guard werkt ALLEEN op mykunda.com. In een ontwerp- of
   voorbeeldomgeving is er geen sessie om te vinden (die omgeving
   heeft zijn eigen, lege browseropslag), dus daar zou de guard
   altijd blokkeren. Op zo'n host schakelt hij de pagina in plaats
   daarvan naar demodata, zodat de volledige console zichtbaar is.
   ============================================================ */
(function () {
  /* ---- Is dit de echte site? ---- */
  var IS_PROD = /(^|\.)mykunda\.com$/i.test(location.hostname);

  if (!IS_PROD) {
    /* Voorbeeldomgeving: geen inlog mogelijk, dus geen guard.
       backendReady() uitzetten voordat het paginascript draait,
       zodat elke sectie zijn eigen demodata toont in plaats van
       lege lijsten (de database geeft zonder sessie niets terug). */
    window.backendReady = function () { return false; };

    var paint = function () {
      var flag = document.getElementById('modeFlag');
      if (flag) { flag.className = 'mode-flag demo'; flag.textContent = 'Voorbeeld \u00b7 demodata'; }
      var note = document.getElementById('demoNote');
      if (note) {
        note.style.display = '';
        note.innerHTML = '<b>Voorbeeldweergave.</b> Inloggen kan hier niet, dus de console toont voorbeelddata om de opbouw te laten zien. Op <b>mykunda.com</b> zelf werkt dezelfde pagina met je echte listings, leads en cijfers.';
      }
    };
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', paint);
    else paint();
    return;
  }

  var CSS = `
.agrd{position:fixed;inset:0;z-index:9999;background:var(--paper,#FAF8F3);display:grid;place-items:center;padding:24px;font-family:var(--sans,sans-serif)}
.agrd-card{max-width:560px;width:100%;background:var(--white,#fff);border:1px solid var(--line,#E5E1D6);border-radius:var(--r-lg,18px);box-shadow:var(--sh-lg,0 18px 50px rgba(24,32,29,.13));padding:34px 34px 30px}
.agrd-ic{width:42px;height:42px;border-radius:12px;display:grid;place-items:center;background:var(--amber-50,#FDF0EE);color:var(--amber-600,#CE1126);margin-bottom:18px}
.agrd h1{font-family:var(--serif,sans-serif);font-size:23px;font-weight:800;color:var(--ink,#18201D);margin:0 0 9px;line-height:1.25}
.agrd p{font-size:15px;line-height:1.6;color:var(--muted,#5C6B64);margin:0 0 14px}
.agrd b{color:var(--ink,#18201D)}
.agrd-who{display:flex;flex-wrap:wrap;gap:8px;margin:0 0 18px}
.agrd-who span{display:inline-flex;align-items:center;gap:7px;font-size:12.5px;font-weight:700;padding:6px 11px;border-radius:999px;background:var(--paper-2,#F3F0E8);color:var(--ink-2,#384640);border:1px solid var(--line,#E5E1D6)}
.agrd-who span i{font-style:normal;color:var(--muted-2,#8A958E);font-weight:600}
.agrd-sql{background:var(--green-900,#0E2E25);color:#D8E6DF;border-radius:12px;padding:15px 16px;font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:12.5px;line-height:1.65;white-space:pre-wrap;word-break:break-word;margin:0 0 8px;position:relative}
.agrd-copy{position:absolute;top:10px;right:10px;background:rgba(255,255,255,.13);color:#fff;border:0;border-radius:7px;padding:5px 10px;font-size:11.5px;font-weight:700;cursor:pointer;font-family:inherit}
.agrd-copy:hover{background:rgba(255,255,255,.24)}
.agrd-note{font-size:13px;color:var(--muted-2,#8A958E);margin:0 0 22px}
.agrd-btns{display:flex;flex-wrap:wrap;gap:10px}
.agrd-btns a,.agrd-btns button{display:inline-flex;align-items:center;gap:8px;padding:12px 20px;border-radius:999px;font-size:14.5px;font-weight:700;text-decoration:none;cursor:pointer;border:1px solid transparent;font-family:inherit}
.agrd-pri{background:var(--green-700,#15463A);color:#fff}
.agrd-pri:hover{background:var(--green-600,#1C5848)}
.agrd-sec{background:var(--white,#fff);color:var(--ink,#18201D);border-color:var(--line,#E5E1D6)}
.agrd-sec:hover{background:var(--paper-2,#F3F0E8)}
@media(max-width:520px){.agrd-card{padding:26px 22px 24px}.agrd h1{font-size:20px}}
`;

  function el(html) { var d = document.createElement('div'); d.innerHTML = html; return d.firstElementChild; }

  function block(opts) {
    if (!document.getElementById('agrdCSS')) {
      var s = document.createElement('style'); s.id = 'agrdCSS'; s.textContent = CSS;
      document.head.appendChild(s);
    }
    var sql = opts.sql
      ? '<div class="agrd-sql"><button class="agrd-copy" type="button">Kopieer</button>' + opts.sql + '</div><p class="agrd-note">' + opts.sqlNote + '</p>'
      : '';
    var who = opts.who ? '<div class="agrd-who">' + opts.who + '</div>' : '';
    var n = el('<div class="agrd"><div class="agrd-card">' +
      '<div class="agrd-ic"><svg width="21" height="21" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M12 3l7 3v6c0 4.4-2.9 7.9-7 9-4.1-1.1-7-4.6-7-9V6z"/><path d="M12 9v4"/><path d="M12 16.5v.01"/></svg></div>' +
      '<h1>' + opts.title + '</h1>' +
      '<p>' + opts.body + '</p>' + who + sql +
      '<div class="agrd-btns">' + opts.buttons + '</div>' +
      '</div></div>');
    document.body.appendChild(n);
    var c = n.querySelector('.agrd-copy');
    if (c) c.addEventListener('click', function () {
      var t = n.querySelector('.agrd-sql').textContent.replace(/^Kopieer/, '').trim();
      navigator.clipboard.writeText(t).then(function () {
        c.textContent = 'Gekopieerd'; setTimeout(function () { c.textContent = 'Kopieer'; }, 1800);
      });
    });
  }

  function run() {
    /* Backend uit → demo-modus, pagina blijft open. */
    if (typeof backendReady !== 'function' || !backendReady()) return;
    if (typeof currentProfile !== 'function') return;

    var here = location.pathname.split('/').pop() || 'admin.html';

    currentProfile().then(function (p) {
      if (p && p.role === 'admin') {
        var flag = document.getElementById('modeFlag');
        if (flag) { flag.textContent = 'Live data'; flag.classList.remove('demo'); }
        return;
      }

      if (!p) {
        /* Geen sessie, of wel een sessie zonder profielrij. */
        (typeof currentUser === 'function' ? currentUser() : Promise.resolve(null)).then(function (u) {
          if (!u) {
            block({
              title: 'Log in om de console te gebruiken',
              body: 'De backoffice is alleen bereikbaar met een MyKunda-account dat de adminrol heeft.',
              buttons: '<a class="agrd-pri" href="auth.html?next=' + encodeURIComponent(here) + '">Inloggen</a>' +
                       '<a class="agrd-sec" href="index.html">Naar de site</a>'
            });
          } else {
            block({
              title: 'Je account heeft nog geen profiel',
              body: 'Je bent ingelogd, maar er staat geen rij voor je in de <b>profiles</b>-tabel. Dat gebeurt bij accounts die zijn aangemaakt vóór de signup-trigger bestond. Zonder profielrij is er geen rol, en filtert de database alle backoffice-data weg.',
              who: '<span><i>Ingelogd als</i>' + (u.email || u.id) + '</span><span><i>Profiel</i>ontbreekt</span>',
              sql: "insert into public.profiles (id, email, role)\nvalues ('" + u.id + "', '" + (u.email || '') + "', 'admin')\non conflict (id) do update set role = 'admin';",
              sqlNote: 'Draai dit in Supabase → SQL Editor, log daarna uit en weer in.',
              buttons: '<button class="agrd-pri" type="button" onclick="location.reload()">Opnieuw proberen</button>' +
                       '<a class="agrd-sec" href="index.html">Naar de site</a>'
            });
          }
        });
        return;
      }

      /* Wel een profiel, verkeerde rol. */
      block({
        title: 'Dit account is geen admin',
        body: 'Je bent ingelogd, maar je rol is <b>' + (p.role || 'onbekend') + '</b>. De backoffice-pagina\'s laden dan wel, maar de database geeft geen enkele rij terug — daarom zie je lege lijsten in plaats van een foutmelding.',
        who: '<span><i>Ingelogd als</i>' + (p.email || p.id) + '</span><span><i>Rol</i>' + (p.role || '—') + '</span>',
        sql: "update public.profiles set role = 'admin'\nwhere id = '" + p.id + "';",
        sqlNote: 'Draai dit in Supabase → SQL Editor. Log daarna uit en weer in — de adminvlag wordt in je browser gecachet.',
        buttons: '<button class="agrd-pri" type="button" onclick="location.reload()">Opnieuw proberen</button>' +
                 '<a class="agrd-sec" href="index.html">Naar de site</a>'
      });
    }).catch(function () { });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', run);
  else run();
})();
