# Opschoning deploy/ — 17 augustus 2026

`deploy/` bevat nu alleen bestanden die de live site echt opvraagt. Alles wat
hieronder weg is, staat nog wél in de projectroot — het hoort alleen niet op de server.

## Verwijderd uit deploy/

| Bestand | Waarom |
|---|---|
| `checkout v2.html`, `checkout v3.html` | concepten, nergens naartoe gelinkt, spaties in de naam |
| `app.js`, `styles.css` | alle 74 pagina's laden `app.min.js` / `styles.min.css`; deze werden alleen door de twee concepten gebruikt |
| `modempay.js` | alleen door `checkout v3.html` geladen, niet door de live `checkout.html` |
| `home.html` | `.htaccess` regel 108 stuurt `/home.html` 301 naar `/` — het bestand werd nooit geserveerd |
| `neighborhood.html` | `.htaccess` regel 95 stuurt 301 naar `/kololi.html` — idem |
| `verified-badge.svg` | geen enkele verwijzing in HTML, CSS of JS |
| `vercel.json` | Vercel-config; de site draait op Apache met `.htaccess` |
| `LEES-MIJ.txt` | intern document — staat nu in de root als `deploy-pakket-LEES-MIJ.txt` |
| `images/banjul-port.webp` | nergens gebruikt |
| `images/tanji2.webp`, `images/tanji2-mob.webp` | nergens gebruikt |

## Gecontroleerd en bewust behouden

- `404.html` — `ErrorDocument 404` in `.htaccess`
- `_headers`, `_redirects` — inert op Apache, maar de enige kopie van die regels buiten `.htaccess`
- `images/og/` — 40 JPG's, alle 1200×630, alle gebruikt
- `fonts/` (2), `vendor/` (5 + 5 leaflet-afbeeldingen) — alle gebruikt

## Let op

Een FTP-upload verwijdert niets op de server. Wat daar al staat van deze lijst,
blijft staan tot je het handmatig weghaalt. Alleen `checkout v2.html`,
`checkout v3.html`, `app.js`, `styles.css` en `modempay.js` zijn het waard om
handmatig te verwijderen: de eerste twee zijn indexeerbare conceptpagina's.
