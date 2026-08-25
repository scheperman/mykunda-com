# Instructie voor Claude Design: LinkedIn toevoegen aan social-blok

## Wat moet er gebeuren
Voeg een LinkedIn-link toe aan de "Follow MyKunda"-social-nav in de footer, ná WhatsApp.
LinkedIn-URL: `https://www.linkedin.com/company/mykunda`

Dit blok staat identiek op alle publieke pagina's (footer met `<nav class="footer-social">`,
sectie `<div class="fb-social">`) — dat zijn alle ~60 content-pagina's (home, buy, rent, sell,
verify, guides, search, market, about, faq, contact, alle plaatsgidsen Banjul t/m Fatoto,
juridische pagina's, enz.). `admin.html`, `dashboard.html`, `messages.html` en `list.html`
hebben dit blok niet — die blijf je met rust laten, precies zoals bij de Open Graph-tags.

Daarnaast wordt dezelfde social-lijst dynamisch opgebouwd in `app.js` (en de gebouwde
`app.min.js`) via de functie `socialLinks()`. Die array voedt zowel de client-side footer-render
als het `sameAs`-veld in de JSON-LD Organization-structured-data. Eén wijziging daar werkt overal
door waar de site die functie gebruikt.

## De wijziging zelf

### 1. `app.js` (en de bijbehorende build `app.min.js`)
Bestaande code:
```js
function socialLinks(){return [
  ['Facebook','https://www.facebook.com/mykundagambia',_FB_ICON,'#1877F2'],
  ['Instagram','https://www.instagram.com/mykundagambia/',_IG_ICON,'#E1306C'],
  ['Threads','https://www.threads.com/@mykundagambia',_TH_ICON,'#111111'],
  ['WhatsApp',waLink('Hello MyKunda! I have a question about property in The Gambia.'),_WA_ICON,'#25D366'],
];}
```
Vervangen door (nieuwe regel toegevoegd vóór WhatsApp, LinkedIn-icoon en kleur erbij):
```js
const _LI_ICON='<svg viewBox="0 0 24 24" fill="currentColor"><path d="M6.94 8.5H3.56V20.5H6.94V8.5Z"/><path d="M5.25 7.03C4.15 7.03 3.25 6.12 3.25 5.02C3.25 3.91 4.15 3 5.25 3C6.36 3 7.25 3.91 7.25 5.02C7.25 6.12 6.36 7.03 5.25 7.03Z"/><path d="M20.75 20.5H17.38V14.6C17.38 13.14 17.35 11.27 15.35 11.27C13.32 11.27 13.01 12.85 13.01 14.5V20.5H9.63V8.5H12.87V10.02H12.92C13.37 9.17 14.46 8.28 16.08 8.28C19.5 8.28 20.75 10.55 20.75 13.87V20.5Z"/></svg>';
function socialLinks(){return [
  ['Facebook','https://www.facebook.com/mykundagambia',_FB_ICON,'#1877F2'],
  ['Instagram','https://www.instagram.com/mykundagambia/',_IG_ICON,'#E1306C'],
  ['Threads','https://www.threads.com/@mykundagambia',_TH_ICON,'#111111'],
  ['LinkedIn','https://www.linkedin.com/company/mykunda',_LI_ICON,'#0A66C2'],
  ['WhatsApp',waLink('Hello MyKunda! I have a question about property in The Gambia.'),_WA_ICON,'#25D366'],
];}
```
Plaats de `const _LI_ICON=...` regel bij de andere icon-constants (naast `_TH_ICON`/`_FB_ICON`),
niet per se direct boven de functie — waar dat in de bestandsstructuur logisch aansluit.

Let op: `socialLinks()` heeft ook `.filter(s=>s[0]!=='WhatsApp')` voor de JSON-LD `sameAs`-lijst
(regel met `"sameAs":socialLinks().filter(...)`). Die filter hoeft niet aangepast: LinkedIn komt
er automatisch bij, alleen WhatsApp blijft eruit. Dat is gewenst — LinkedIn hoort thuis in `sameAs`.

### 2. Alle statische HTML-pagina's met het footer-social-blok
Elke pagina heeft dezelfde `<nav class="footer-social">` met vier vaste `<a>`-tags
(Facebook, Instagram, Threads, WhatsApp), direct gevolgd door `</nav>`. Voeg de LinkedIn-link
toe vóór de sluitende `</nav>`, na de WhatsApp-link — dus onmiddellijk vóór het eerstvolgende
`</nav>` dat volgt op de WhatsApp-`<a>`:

```html
<a href="https://www.linkedin.com/company/mykunda" rel="me noopener" target="_blank" aria-label="LinkedIn" title="LinkedIn" style="--sc:#0A66C2"><svg viewBox="0 0 24 24" fill="currentColor"><path d="M6.94 8.5H3.56V20.5H6.94V8.5Z"/><path d="M5.25 7.03C4.15 7.03 3.25 6.12 3.25 5.02C3.25 3.91 4.15 3 5.25 3C6.36 3 7.25 3.91 7.25 5.02C7.25 6.12 6.36 7.03 5.25 7.03Z"/><path d="M20.75 20.5H17.38V14.6C17.38 13.14 17.35 11.27 15.35 11.27C13.32 11.27 13.01 12.85 13.01 14.5V20.5H9.63V8.5H12.87V10.02H12.92C13.37 9.17 14.46 8.28 16.08 8.28C19.5 8.28 20.75 10.55 20.75 13.87V20.5Z"/></svg><span>LinkedIn</span></a>
```

Dit is een simpele find-and-replace over alle betrokken bestanden: zoek de bestaande
WhatsApp-`<a>...</a>` binnen `<nav class="footer-social">` en plak de LinkedIn-`<a>` er
direct achter, vóór `</nav>`. Doe dit consistent op elke pagina die het blok bevat.

## Wat er niet moet gebeuren
- **Geen andere social-kanalen toevoegen of wijzigen.** Alleen LinkedIn erbij; Facebook,
  Instagram, Threads en WhatsApp blijven ongewijzigd — inclusief hun volgorde, kleuren en iconen.
- **Niet de volgorde omgooien.** LinkedIn komt na Threads en vóór WhatsApp, zowel in de
  `socialLinks()`-array als in de statische HTML — WhatsApp hoort logisch als laatste te blijven
  staan (het is het directe contactkanaal, geen "follow"-kanaal).
- **`admin.html`, `dashboard.html`, `messages.html`, `list.html` niet aanraken** — die hebben
  geen social-footer en moeten dat ook niet krijgen.
- **Geen Open Graph-tags, `fb:app_id`, of andere meta-tags aanpassen.** Die staan los van deze
  wijziging en zijn al gecontroleerd in orde.
- **Geen nieuw kleurenschema of iconenstijl verzinnen** voor het social-blok — het LinkedIn-icoon
  moet in dezelfde stijl (`fill="currentColor"`, `viewBox="0 0 24 24"`) en dezelfde markup-vorm
  (`--sc:` CSS-variabele voor de hover-kleur, `<span>`-tekstlabel) als de andere iconen worden
  toegevoegd, niet in een eigen stijl.
- **Robots.txt, sitemap of Cloudflare-instellingen niet aanraken** — dit is een puur visuele/
  content-wijziging aan de footer, geen infrastructuurwijziging.

## Controle achteraf
- Op elke pagina met een footer staat nu een vijfde icoon in "Follow MyKunda": LinkedIn, tussen
  Threads en WhatsApp, met dezelfde hover/stijl-opmaak als de rest.
- De link `https://www.linkedin.com/company/mykunda` opent in een nieuw tabblad (`target="_blank"`)
  en heeft `rel="me noopener"`, net als Facebook/Instagram/Threads.
- In de JSON-LD Organization-data (`sameAs`) op pagina's die `socialLinks()` gebruiken staat de
  LinkedIn-URL nu ook tussen de andere kanalen, zonder WhatsApp.
- Steekproef op 2-3 uiteenlopende paginatypes (bijv. home, een plaatsgids, contact) om te
  bevestigen dat het blok er overal identiek en correct bij staat.

## Achtergrond
MyKunda heeft nu een LinkedIn-bedrijfspagina (`linkedin.com/company/mykunda`) die nog nergens
op de site wordt genoemd. Het social-blok in de footer is de centrale plek waar alle
kanalen waarop bezoekers MyKunda kunnen volgen bij elkaar staan — LinkedIn hoort daar nu ook
in thuis, naast Facebook, Instagram, Threads en WhatsApp.
