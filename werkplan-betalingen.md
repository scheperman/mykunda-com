# MyKunda — Checkout & Betalingen: Werkplan naar Productie

> Opgesteld: 22 juni 2026 · Herzien: 8 augustus 2026
> Status: Checkout live-klaar (`checkout.html` + `modempay.js`), wacht op merchant-keys
> Payment gateway: **Modem Pay** (modempay.com) — CBG Reg No. 2025/C25067

---

## Huidige status

`checkout.html` (de pagina waar `list.html` naartoe stuurt) accepteert:
- **Mobile money** — Wave, Afrimoney (Africell), QMoney (QCell), APS Wallet
- **Kaart** — Visa / Mastercard met 3-D Secure, ook buitenlandse kaarten
- **Bankoverschrijving** — Guaranty Trust Bank (Gambia), met automatisch gegenereerde referentiecode
- Modem Pay SDK-wrapper (`modempay.js`) in sandbox-modus
- Escrow-waarschuwing: MyKunda int nooit aanbetalingen of koopsommen

De betaalmethoden zijn zichtbaar op de site: chips in de **footer van elke pagina**,
een blok **"How you can pay"** op `sell.html` onder de prijzen, en een
**"Accepted here"**-strip bovenaan de checkout.

### Correctie t.o.v. versie 1 van dit werkplan
**Orange Money is verwijderd** — Orange is geen operator in Gambia en die wallet
bestaat hier niet. Vervangen door Afrimoney (de juiste naam, stond als "Africell")
en APS Wallet. QMoney en Afrimoney hebben géén publieke self-serve API; dat is
precies waarom alles via de Modem Pay aggregator loopt en niet per wallet apart.

### Transactielimieten (ingebouwd in `modempay.js`)
| Wallet | Max per transactie | Gedrag boven limiet |
|---|---|---|
| Wave | GMD 100.000 | Foutmelding → verwijst naar bank of kaart |
| Afrimoney | GMD 50.000 | idem |
| QMoney | GMD 50.000 | idem |
| APS Wallet | GMD 50.000 | idem |

Verifieer deze bedragen bij Modem Pay tijdens onboarding — wallets passen hun
plafonds aan. Ze staan in `CONFIG.providers` in `modempay.js`.

---

## 🔴 Kritiek — zonder dit werken betalingen niet

### 1. Modem Pay merchant account
- Aanmelden op [modempay.com](https://modempay.com)
- KYC-documenten aanleveren (bedrijfsregistratie MyKunda (eenmanszaak), ID bestuurder)
- Je ontvangt een **Public Key** en **Secret Key** (productie)
- Kosten: geen maandelijks abonnement, alleen per transactie

### 2. Backend server (Node.js / Python / etc.)
De Secret Key mag **nooit** in de browser staan. Je hebt een server nodig die:
- Betalingen initieert richting de Modem Pay API (server-to-server)
- De Public Key naar de frontend stuurt
- Transactie-status bijhoudt

**Minimale endpoints:**

| Endpoint | Functie |
|---|---|
| `POST /api/payments/mobile-money` | Start mobile money collectie via Modem Pay |
| `POST /api/payments/card` | Start kaartbetaling (3D Secure redirect) |
| `POST /api/payments/bank-transfer` | Genereer bankreferentie |
| `GET /api/payments/:id/status` | Check transactiestatus |
| `POST /webhooks/modempay` | Ontvang webhook van Modem Pay |

### 3. Webhook endpoint
Modem Pay stuurt een POST naar jouw server wanneer een betaling slaagt/faalt.
- Webhook-URL registreren in Modem Pay dashboard
- Signature verifiëren (tegen fraude)
- Listing-status in database updaten

### 4. Database — `payments` tabel (Supabase / PostgreSQL)

| Kolom | Type | Doel |
|---|---|---|
| `id` | uuid | Primary key |
| `reference` | text | MK-xxxxxxxx |
| `listing_id` | uuid | Welke listing betaald wordt |
| `user_id` | uuid | Wie betaalt |
| `method` | text | mobile_money / card / bank |
| `provider` | text | wave / afrimoney / qmoney / aps |
| `amount` | decimal | Bedrag |
| `currency` | text | USD / GMD |
| `status` | text | pending → success / failed |
| `modempay_txn_id` | text | Modem Pay transaction ID |
| `created_at` | timestamp | Aanmaakdatum |
| `completed_at` | timestamp | Betaaldatum |

---

## 🟡 Belangrijk — voor goede werking

### 5. SMS-gateway
Voor echte SMS-bevestigingen:
- **Optie A:** Modem Pay's eigen notificatie-API (als beschikbaar)
- **Optie B:** Twilio SMS (~$0.05/SMS naar Gambia)
- **Optie C:** Lokale Gambiaanse SMS-provider (goedkoper)

### 6. WhatsApp Business API
- Aanmelden bij WhatsApp Business Platform (via Meta)
- Of via provider: Twilio WhatsApp / 360dialog
- Bericht-templates moeten worden goedgekeurd door Meta
- Kosten: ~$0.03–0.05 per conversation

### 7. E-mail transactional service
Voor ontvangstbewijzen per email:
- **Resend**, **Postmark** of **SendGrid** (gratis tier beschikbaar)
- HTML email-template voor het ontvangstbewijs

---

## 🟢 Nice-to-have — na lancering

### 8. Tarieven vergelijken vóór ondertekening
Vraag bij Modem Pay **én** bij Waychit (waychit.com — tweede aggregator met
vergelijkbare dekking) het tarief per rail op. Het verschil tussen 1,5% en 3% op
wallet-collecties bepaalt de marge op een listing van GMD 500. Beide hebben een
self-serve sandbox, dus je kunt ze naast elkaar testen.

### 9. Bankrekening & settlement
Alle rails settlen in GMD op één zakelijke rekening:

| Veld | Waarde |
|---|---|
| Bank | Guaranty Trust Bank (Gambia) Ltd |
| Rekeningnaam | EDWIN SCHEPERMAN T/A MYKUNDA.COM |
| Rekeningnummer | 005201300100074795 |
| Filiaal | Kairaba (code 201) |
| USD-route | Intermediary GTBank (UK) Ltd, SWIFT GTBIGB2L · beneficiary bank a/c 901 10015 002 5033 000 |
| SWIFT / BIC | GTBGGMGM (11-tekens: GTBGGMGMXXX) |
| Adres | 56 Kairaba Avenue, Fajara, KSMD, Banjul |

De gegevens staan sinds de overstap naar Waychit (22-08-2026) in twee edge functions:
`create-payment` (naar het scherm van de klant) en `send-payment-instructions`
(de mail met het rekeningnummer). Wijzigt de rekening, pas ze dan op BEIDE plekken
aan, plus de provider-waarde die bij een bankoverschrijving wordt weggeschreven.
`checkout.html` toont ze maar bewaart ze niet meer zelf; `modempay.js` is vervallen.
De checkout legt zelf uit dat Europese banken meestal de 8-tekencode willen en dat
je er drie X'en achter zet als het veld 11 tekens eist — scheelt supportvragen.
- Prijzen worden al currency-aware getoond via `CURRENCIES` in `app.js`

### 10. Retry & error handling
- Automatisch opnieuw proberen bij netwerk-timeouts
- Foutmeldingen in Wolof/Mandinka naast Engels

### 11. Admin dashboard
- Overzicht van alle betalingen + statussen
- Handmatige bankoverschrijving-matching
- Refund-mogelijkheid

---

## 📋 Actieplan (volgorde)

| # | Stap | Wie | Geschatte tijd |
|---|---|---|---|
| 1 | Modem Pay account aanmaken + KYC | Eigenaar | 1–2 dagen |
| 2 | Backend endpoints bouwen | Developer | 2–3 dagen |
| 3 | Database payments-tabel opzetten | Developer | ½ dag |
| 4 | Webhook + signature verificatie | Developer | ½ dag |
| 5 | `modempay.js` omzetten sandbox → productie | Developer | ½ dag |
| 6 | Testen in sandbox-omgeving | Eigenaar + developer | 1–2 dagen |
| 7 | SMS / WhatsApp / Email koppelen | Developer | 1–2 dagen |
| 8 | **Live gaan** 🚀 | Samen | 1 dag |

**Geschatte totaaltijd: 1–2 weken** met een developer.

---

## Bestanden in dit project

| Bestand | Beschrijving |
|---|---|
| `checkout.html` | **Live checkout** — hier linkt `list.html` naartoe |
| `checkout v3.html` | Alternatieve 3-staps flow (niet gekoppeld) |
| `checkout v2.html` | Oude versie |
| `modempay.js` | Modem Pay SDK-wrapper (sandbox + productie-comments) |
| `app.js` / `app.min.js` | `PAY_METHODS` + `payChipsHTML()` — één bron voor alle betaal-chips |
| `sell.html` | Sectie "How you can pay" onder de prijstabel |

---

## Modem Pay API referentie

- **Docs:** https://docs.modempay.com
- **Dashboard:** https://dashboard.modempay.com
- **Support:** Via GitHub issues of direct contact
- **Licentie:** Central Bank of The Gambia, Reg No. 2025/C25067
- **Pricing:** Geen setup/maandkosten, betaal per transactie
- **SDK:** REST API + TypeScript SDK + CLI + Sandbox
