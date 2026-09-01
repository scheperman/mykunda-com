/* ============================================================
   MyKunda — email preview runner
   Loads the two shared template modules straight from the
   project, strips the module syntax, transpiles the TypeScript
   in the browser and renders every mail with sample data.
   No copy of the templates lives here, so the preview cannot
   drift from what Resend actually sends.
   ============================================================ */
(function () {
  var OUT = document.getElementById('out');

  function stripModule(src) {
    return src
      .replace(/^\s*import[\s\S]*?from\s+['"][^'"]+['"];?[ \t]*$/gm, '')
      .replace(/^\s*export\s*\{[^}]*\}\s*from\s+['"][^'"]+['"];?[ \t]*$/gm, '')
      .replace(/^export\s+/gm, '');
  }

  var EXPORTS = ['emailWrap', 'toText', 'leadNotificationEmail', 'leadAutoReplyEmail',
    'viewingNotificationEmail', 'viewingConfirmationEmail', 'viewingSlotsEmail',
    'paymentReceiptEmail', 'paymentBackofficeEmail', 'authLinkEmail',
    'emailEventAlertEmail', 'whatsappAutoReply',
    'listingConfirmationEmail', 'listingBackofficeEmail'];

  function fail(msg) {
    OUT.innerHTML = '<div class="err"><b>Templates konden niet geladen worden.</b><br>' + msg + '</div>';
  }

  Promise.all([
    fetch('edge-functions/_shared/email-template.ts', { cache: 'reload' }).then(function (r) { return r.ok ? r.text() : Promise.reject('email-template.ts: HTTP ' + r.status); }),
    fetch('edge-functions/_shared/email-listing.ts', { cache: 'reload' }).then(function (r) { return r.ok ? r.text() : Promise.reject('email-listing.ts: HTTP ' + r.status); })
  ]).then(function (parts) {
    var code = stripModule(parts[0]) + '\n\n' + stripModule(parts[1]);
    var js = Babel.transform(code, { presets: ['typescript'], filename: 'templates.ts', sourceType: 'script' }).code;
    var T = new Function(js + '\n;return {' + EXPORTS.join(',') + '};')();
    render(T);
  }).catch(function (e) { fail(String(e && e.message ? e.message : e)); });

  /* ---------- sample data ---------- */

  var GROUPS = [
    {
      id: 'formulieren', title: 'Formulieren op de site',
      desc: 'Elk formulier stuurt twee mails: een melding naar het team met reply-to op de bezoeker, en een bevestiging naar de bezoeker zelf.',
      items: function (T) {
        var contact = { source: 'contact', name: 'Fatou Njie', email: 'fatou.njie@gmail.com', phone: '+220 700 1234', message: 'Good afternoon,\n\nI saw the villa in Brufut and would like to know whether the title has been checked.\n\nKind regards,\nFatou', payload: { subject: 'Question about a property' } };
        var valuation = { source: 'valuation', name: 'Modou Ceesay', email: 'modou@example.com', phone: '+220 388 9021', area: 'Bijilo', message: 'Valuation: villa, 4bed/3bath, good condition', payload: { type: 'Villa', sqm: 240, estimate_low: 82000, estimate_high: 96000, raw_location: 'Bijilo, near the golf course' } };
        return [
          { name: 'Contactformulier — melding aan het team', to: 'info@mykunda.com', kind: 'team', trigger: 'Bezoeker verstuurt het formulier op /contact.html', subject: '[MyKunda] New contact message — Fatou Njie', html: T.leadNotificationEmail(contact) },
          { name: 'Contactformulier — bevestiging aan de bezoeker', to: 'de bezoeker', trigger: 'Zelfde moment, direct na de teammail', subject: 'Thank you for contacting MyKunda', html: T.leadAutoReplyEmail(contact) },
          { name: 'Waardebepaling — bevestiging met de schatting', to: 'de aanvrager', trigger: 'Waardebepaling huis of grond op /sell.html', subject: 'Your valuation request — MyKunda', html: T.leadAutoReplyEmail(valuation) },
          { name: 'Waardebepaling — melding aan het team', to: 'info@mykunda.com', kind: 'team', trigger: 'Zelfde moment; de schatting staat in het amberblok', subject: '[MyKunda] New valuation request — Modou Ceesay', html: T.leadNotificationEmail(valuation) },
          { name: 'Gratis adviesgesprek — bevestiging', to: 'de aanvrager', trigger: 'Adviesgesprek boeken op /sell.html', subject: 'Your free consultation is booked — MyKunda', html: T.leadAutoReplyEmail({ source: 'consultation', name: 'Awa Jallow' }) },
          { name: 'Nieuwsbrief / area alert — bevestiging', to: 'de inschrijver', trigger: 'Inschrijving in de footer', subject: 'Your area alert is set up — MyKunda', badge: 'met afmeldlink', html: T.leadAutoReplyEmail({ source: 'area_alert', name: 'Sirra Touray' }) },
          { name: 'Bericht aan een agent — bevestiging', to: 'de afzender', trigger: 'Formulier op /agent.html', subject: 'Your message is with the agent — MyKunda', badge: 'nieuw gekoppeld', html: T.leadAutoReplyEmail({ source: 'agent_message', name: 'Lamin Sanneh' }) }
        ];
      }
    },
    {
      id: 'bezichtigingen', title: 'Bezichtigingen',
      desc: 'Een bezichtigingsaanvraag raakt drie momenten: de aanvraag, de bevestiging aan de koper en de tijden die de verkoper voorstelt.',
      items: function (T) {
        var v = { buyer_name: 'Ebrima Bah', title: 'Beachfront villa with pool', area: 'Kotu', requested_slot: '2026-08-22T15:00:00Z', buyer_email: 'ebrima.bah@outlook.com', buyer_phone: '+220 705 4412' };
        return [
          { name: 'Bezichtiging aangevraagd — melding aan verkoper/team', to: 'info@mykunda.com', kind: 'team', trigger: 'Koper vraagt een bezichtiging aan', subject: '[MyKunda] New viewing request — Beachfront villa with pool', html: T.viewingNotificationEmail(v) },
          { name: 'Bezichtiging aangevraagd — bevestiging aan de koper', to: 'de koper', trigger: 'Zelfde moment', subject: 'Your viewing request — Beachfront villa with pool', badge: 'nieuw', html: T.viewingConfirmationEmail(v) },
          { name: 'Tijden voorgesteld — mail aan de koper', to: 'de koper', trigger: 'Verkoper stelt tijden voor in het dashboard', subject: 'New viewing times for Beachfront villa with pool — MyKunda', html: T.viewingSlotsEmail({ title: 'Beachfront villa with pool', proposed_slots: ['2026-08-22T15:00:00Z', '2026-08-23T10:30:00Z', '2026-08-24T17:00:00Z'] }) }
        ];
      }
    },
    {
      id: 'advertenties', title: 'Advertenties',
      desc: 'Wie een woning of perceel plaatst, krijgt zijn volledige advertentie terug ter controle. De backoffice krijgt dezelfde gegevens plus de contactgegevens van de verkoper.',
      items: function (T) {
        var listing = {
          id: 'a91f2c', title: 'Four-bedroom villa with borehole', area: 'Brusubi', price: 4750000, deal: 'sale', cat: 'villa',
          beds: 4, baths: 3, sqm: 260, plot: 600, plan: 'verified', name: 'Ousman Darboe', email: 'ousman.darboe@gmail.com', phone: '+220 992 7781',
          plus: '7C3W+5H Brusubi', condition: 'good', floors: '2', beach: 'walking', view: 'garden', security: 'gated', furnished: 'semi',
          water: 'both', power: 'solar', yearBuilt: '2019', availDate: '1 October 2026', docType: 'Freehold title deed', status: 'In review',
          features: ['Swimming pool', 'Air conditioning', 'Fitted kitchen'], customFeats: 'Mango trees, guest annex',
          highlights: 'Quiet corner plot two streets from the tarmac road, with a borehole that has never run dry.',
          nearby: [{ place: 'Brusubi Turntable', dist: '1.2 km' }, { place: 'Bijilo Forest Park', dist: '4 km' }, { place: 'Banjul airport', dist: '17 km' }]
        };
        return [
          { name: 'Advertentie geplaatst — bevestiging aan de verkoper', to: 'de verkoper', trigger: 'Advertentie afgerond op /list.html', subject: 'Your listing is confirmed — Four-bedroom villa with borehole', html: T.listingConfirmationEmail(listing) },
          { name: 'Advertentie geplaatst — melding aan de backoffice', to: 'info@mykunda.com', kind: 'team', trigger: 'Zelfde moment; bij Verified en Managed met actieblok', subject: '[MyKunda] New Verified listing: Four-bedroom villa with borehole — Brusubi', html: T.listingBackofficeEmail(listing) }
        ];
      }
    },
    {
      id: 'betalingen', title: 'Betalingen',
      desc: 'Nieuw. Tot nu toe leverde een afgeronde betaling niets op papier: de klant zag een scherm dat hij kon wegklikken en het team hoorde er niets over.',
      items: function (T) {
        var paid = { name: 'Ousman Darboe', email: 'ousman.darboe@gmail.com', plan: 'Verified listing', planNote: 'Verified badge goes live once the check is complete', reference: 'MK-48120735', amount: '$99', method: 'Wave mobile money', date: '2026-08-14T11:20:00Z' };
        var bank = { name: 'Isatou Faal', email: 'isatou.faal@gmail.com', plan: 'Managed service', planNote: 'First instalment of two — the balance is due at completion', reference: 'MK-LZ8Q2K3AB', amount: 'D 15,000', method: 'Bank transfer · Guaranty Trust Bank (Gambia)', awaitingTransfer: true, bank: { name: 'Guaranty Trust Bank (Gambia) Ltd · MyKunda', account: '0052 0130 0100 0747 95', swift: 'GTBGGMGM' }, date: '2026-08-14T09:05:00Z' };
        return [
          { name: 'Betaling gelukt — bon aan de klant', to: 'de klant', trigger: 'Mobile money of kaartbetaling afgerond op /checkout.html', subject: 'Your receipt — Verified listing — MyKunda', badge: 'nieuw', html: T.paymentReceiptEmail(paid) },
          { name: 'Bankoverschrijving geregistreerd — instructies aan de klant', to: 'de klant', trigger: 'Klant kiest bankoverschrijving', subject: 'Your payment reference MK-LZ8Q2K3AB — MyKunda', badge: 'nieuw', html: T.paymentReceiptEmail(bank) },
          { name: 'Betaling — melding aan de backoffice', to: 'info@mykunda.com', kind: 'team', trigger: 'Elke afgeronde bestelling', subject: '[MyKunda] Payment received — Verified listing · MK-48120735', badge: 'nieuw', html: T.paymentBackofficeEmail(paid) }
        ];
      }
    },
    {
      id: 'account', title: 'Account',
      desc: 'Verstuurd vanaf noreply@mykunda.com met een link naar mykunda.com — niet naar supabase.co.',
      items: function (T) {
        var link = 'https://mykunda.com/auth.html?token_hash=6f2c1b9ae4&type=recovery';
        return [
          { name: 'Wachtwoord vergeten', to: 'de gebruiker', trigger: 'Aanvraag op /auth.html', subject: 'Reset your password — MyKunda', html: T.authLinkEmail({ type: 'recovery', link: link }) },
          { name: 'Inloglink zonder wachtwoord', to: 'de gebruiker', trigger: 'Magic link', subject: 'Your sign-in link — MyKunda', html: T.authLinkEmail({ type: 'magiclink', link: link.replace('recovery', 'magiclink') }) },
          { name: 'E-mailadres bevestigen', to: 'de nieuwe gebruiker', trigger: 'Registratie, zodra e-mailbevestiging aanstaat', subject: 'Confirm your email — MyKunda', html: T.authLinkEmail({ type: 'signup', link: link.replace('recovery', 'signup') }) }
        ];
      }
    },
    {
      id: 'intern', title: 'Interne signalen',
      desc: 'Resend meldt elke bounce en spamklacht terug aan de site. Die melding komt als mail binnen, zodat een afzender die stilvalt niet ongemerkt blijft.',
      items: function (T) {
        return [
          { name: 'Mail kwam niet aan', to: 'info@mykunda.com', kind: 'team', trigger: 'Resend-webhook: email.bounced', subject: 'Email bounced — MyKunda', html: T.emailEventAlertEmail({ type: 'email.bounced', recipient: 'buyer@example.com', subject: 'Your viewing request — MyKunda', reason: 'Recipient address does not exist (550 5.1.1)', emailId: 'b3f1c9e2' }) },
          { name: 'Ontvanger meldde spam', to: 'info@mykunda.com', kind: 'team', trigger: 'Resend-webhook: email.complained', subject: 'Recipient marked this as spam — MyKunda', html: T.emailEventAlertEmail({ type: 'email.complained', recipient: 'someone@gmail.com', subject: 'Your area alert is set up — MyKunda', reason: 'Feedback loop report', emailId: 'a77d0421' }) }
        ];
      }
    },
    {
      id: 'whatsapp', title: 'WhatsApp',
      desc: 'Het enige kanaal zonder e-mail. Wie ons via WhatsApp aanschrijft kreeg tot nu toe niets terug — en het team kreeg de melding evenmin, want de koppeling met de meldingsfunctie was verkeerd aangesloten.',
      items: function (T) {
        return [
          { name: 'Automatisch antwoord op WhatsApp', to: 'de afzender', trigger: 'Binnenkomend WhatsApp-bericht op +220 272 0268', subject: 'Platte tekst — WhatsApp kent geen opmaak', badge: 'nieuw', wa: T.whatsappAutoReply('Fatou Njie') },
          { name: 'WhatsApp-bericht — melding aan het team', to: 'info@mykunda.com', kind: 'team', trigger: 'Zelfde moment; het bericht wordt ook een lead', subject: '[MyKunda] New WhatsApp message — Fatou Njie', badge: 'hersteld', html: T.leadNotificationEmail({ source: 'whatsapp_inbound', name: 'Fatou Njie', phone: '+220 700 1234', message: 'Hello, is the plot in Sanyang still available?' }) }
        ];
      }
    }
  ];

  /* ---------- render ---------- */

  function esc(s) {
    return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  function render(T) {
    var html = '';
    GROUPS.forEach(function (g) {
      html += '<section class="grp" id="' + g.id + '"><h2>' + g.title + '</h2><p class="gd">' + g.desc + '</p>';
      g.items(T).forEach(function (it, i) {
        var id = g.id + '-' + i;
        html += '<article class="card">' +
          '<div class="chead"><div class="t"><h3>' + esc(it.name) + '</h3><div class="trig">' + esc(it.trigger) + '</div></div>' +
          '<div class="meta">' +
          (it.badge ? '<span class="pill new">' + esc(it.badge) + '</span>' : '') +
          '<span class="pill' + (it.kind === 'team' ? ' team' : '') + '">Aan: ' + esc(it.to) + '</span>' +
          '</div></div>' +
          '<div class="subj"><span class="lbl">Onderwerp</span><b>' + esc(it.subject) + '</b></div>';
        if (it.wa) {
          html += '<div class="wa"><div class="bub">' + esc(it.wa) + '</div></div>';
        } else {
          html += '<div class="frame"><iframe id="f-' + id + '" sandbox="allow-same-origin" title="' + esc(it.name) + '"></iframe></div>' +
            '<div class="tools"><button type="button" data-txt="t-' + id + '">Platte tekst tonen</button></div>' +
            '<pre class="txt" id="t-' + id + '">' + esc(T.toText(it.html)) + '</pre>';
        }
        html += '</article>';
      });
      html += '</section>';
    });
    OUT.innerHTML = html;

    // fill the iframes after they exist in the DOM
    GROUPS.forEach(function (g) {
      g.items(T).forEach(function (it, i) {
        if (it.wa) return;
        var f = document.getElementById('f-' + g.id + '-' + i);
        if (!f) return;
        f.addEventListener('load', function () {
          try {
            var d = f.contentDocument;
            f.style.height = Math.max(320, d.documentElement.scrollHeight) + 'px';
            setTimeout(function () { f.style.height = Math.max(320, d.documentElement.scrollHeight) + 'px'; }, 400);
          } catch (e) { f.style.height = '900px'; }
        });
        f.srcdoc = it.html;
      });
    });

    OUT.addEventListener('click', function (e) {
      var b = e.target.closest('button[data-txt]');
      if (!b) return;
      var pre = document.getElementById(b.dataset.txt);
      pre.classList.toggle('on');
      b.textContent = pre.classList.contains('on') ? 'Platte tekst verbergen' : 'Platte tekst tonen';
    });
  }
})();
