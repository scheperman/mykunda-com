# Instructie voor Claude AI — twee dingen die de verkoopadministratie nog nodig heeft

**Datum:** 24 augustus 2026
**Aanleiding:** in de admin console staat sinds vandaag een nieuwe pagina `sales.html` — Sales & revenue. Die telt alles uit de bestaande `payments`-tabel en berekent de providerkosten zelf.
**Wat Claude Design al gedaan heeft (niet jouw werk):** de pagina, de sommen, de grafiek, de CSV-export en de regel in `admin-nav.js`. Raak geen bestanden van mykunda.com aan — dat loopt uitsluitend via Claude Design.

De pagina werkt volledig zonder databasewijziging. Twee dingen kan hij niet, en die staan hieronder.

---

## Wat de pagina nu doet

- Leest `payments` (tot 2000 rijen) met `reference, status, method, plan_id, amount_minor, currency, customer_email, listing_id, metadata, created_at, paid_at, fulfilment_status, admin_note`.
- Rekent per betaling de providerkosten uit met een percentage per methode: **lokale wallets 3%**, **kaart 4,8%**, **bank transfer 0%** (die komt rechtstreeks op de Ecobank-rekening, daar zit geen provider tussen). Opgegeven door Edwin op 24-08-2026.
- Telt `succeeded` als verkocht, op de datum van `paid_at` (en anders `created_at`).
- Behandelt een `refunded` betaling zo: het bedrag verlaat de omzet, maar de fee blijft als kosten staan, omdat de provider die niet teruggeeft.
- `failed`, `cancelled` en `expired` kosten niets en staan alleen in hun eigen tabel.

---

## 1. De tarieven horen centraal te staan, niet in de browser

De drie percentages staan nu in `localStorage` van de browser waarin ze zijn ingevuld. Gevolgen: een tweede computer begint bij de standaardwaarden, en er is geen geschiedenis — verandert Waychit zijn tarief, dan worden alle oude maanden met het nieuwe percentage herrekend en klopt de vergelijking met vorig jaar niet meer.

Wat er nodig is:

- een plek waar deze tarieven één keer staan en door de console gelezen en gewijzigd kunnen worden;
- **met een ingangsdatum**, zodat een betaling van juni wordt gerekend tegen het tarief dat in juni gold. Dat is het hele punt: zonder datum is het geen administratie maar een momentopname;
- lezen mag voor een admin, wijzigen alleen via een admin-only RPC, in dezelfde geest als `set_payment_fulfilment`;
- de bestaande drie waarden als eerste regel, met ingangsdatum 1 januari 2026 zodat de huidige cijfers niet verschuiven.

Laat weten hoe de tabel of instelling heet en hoe je hem uitleest, dan sluit Claude Design de pagina erop aan.

## 2. Een refund is nu alles of niets

`payments.status` kan op `refunded` staan, maar nergens staat **hoeveel** er terug is gegaan, **wanneer** en **waarom**. Een gedeeltelijke terugbetaling — bijvoorbeeld een Full Ownership Check waarvan het bezoek niet is doorgegaan — is niet vast te leggen. De pagina moet daarom aannemen dat een refund het volledige bedrag was.

Wat er nodig is:

- per betaling: het terugbetaalde bedrag, de datum en een korte reden;
- een refund moet **optelbaar** zijn: twee keer deels terugbetalen komt voor;
- alleen te zetten via een admin-only RPC, met een controle dat het totaal het oorspronkelijke bedrag niet overschrijdt;
- de status van de betaling automatisch op `refunded` zetten zodra het volledige bedrag terug is, en er anders vanaf blijven — dan is het een deel-refund op een geslaagde betaling;
- niets weggooien: een refund is een gebeurtenis met een datum, geen correctie van het oorspronkelijke bedrag.

Denk mee over de vorm — een aparte regel per terugbetaling is waarschijnlijk zuiverder dan kolommen op `payments`, maar dat is jouw domein.

---

## Wat NIET moet gebeuren

1. **Geen bestandswijzigingen aan mykunda.com.** Geen HTML, CSS, scripts, meta-tags of `robots.txt`.
2. **Verander `amount_minor` nooit** bij een refund. Dat is wat er verkocht is; wat terugging is een aparte gebeurtenis.
3. **Verander de betekenis van `status` niet** en voeg er geen nieuwe waarden aan toe zonder het te melden — `sales.html` en `admin.html` sorteren erop.
4. **Raak `fulfilment_status` niet aan.** Dat is de werkvoortgang uit de Orders-weergave en staat los van het geld.
5. **Geen automatische refunds richting de provider.** De console legt vast wat er is gebeurd; het terugbetalen zelf doet Edwin bij Waychit of de bank.
6. **Reken de fee niet in de database uit.** Dat gebeurt op de pagina, uit de tarieventabel met ingangsdatum. Eén plek waar dat gebeurt is genoeg.

---

## Wat je terug moet melden

1. hoe de tarieven met ingangsdatum zijn opgeslagen en hoe de console ze leest;
2. de naam van de RPC om een tarief te wijzigen;
3. hoe een refund wordt vastgelegd en met welke RPC;
4. of de refundgegevens meekomen in dezelfde `payments`-select of een aparte query nodig hebben.
