# Instructie voor Claude AI — serverkant voor de uitgebreide ownership-intake

**Datum:** 24 augustus 2026
**Aanleiding:** het voorstel `voorstel-ownership-identificatie.html` in het Claude Design-project. Daarin is besloten dat de aanvraag voor een Ownership Verification veel meer over het pand vastlegt, en dat de documentfoto's ná de betaling geüpload worden.
**Wat Claude Design zelf doet (niet jouw werk):** het formulier op `verify.html`, de poortwachter, het grotere `intake`-object, de upload-pagina zelf, de weergave in `admin.html`, en de FAQ-tekst over restitutie. Raak die bestanden niet aan — alle bestandswijzigingen aan mykunda.com lopen uitsluitend via Claude Design.

Dit stuk gaat over de vier dingen die alleen aan de serverkant kunnen.

---

## 1. De snoeigrens op `intake` in `create-payment` verruimen

Versie 22 accepteert `intake` en snoeit hem op lengte. Dat object wordt nu drie tot vier keer zo groot: naast de huidige velden komen er regio, district, dorp, coördinaten of Plus Code, tenure-route, documentnummers, de naam en hoedanigheid van de verkoper, de aangrenzende percelen, wat er al betaald is, en de uitkomst van de poortwachter.

Wat er nodig is:

- de grens zo zetten dat een volledig ingevuld formulier er ongeschonden door komt — reken op enkele kilobytes JSON, niet op honderden bytes;
- blijven snoeien op een harde bovengrens, want het object komt uit de browser;
- de bestaande beperking handhaven dat `intake` alleen wordt bewaard bij `doc_check` en `ownership_check`;
- **geen** validatie op de individuele velden. De vorm van het formulier gaat de komende weken nog schuiven; een server die velden weigert die hij niet kent, breekt dan stil. Bewaren wat er komt, binnen de lengtegrens, is hier het juiste gedrag.

Laat weten welke grens je hebt gezet, dan houdt Claude Design het formulier daaronder.

---

## 2. Een Storage-bucket voor de documentfoto's

De koper uploadt na de betaling foto's of scans van de stukken die hij is voorgehouden: sketch plans, leases, kwitanties, WhatsApp-schermafbeeldingen. Dat zijn de gevoeligste bestanden op het platform — ze horen bij iemand anders' eigendom en soms bij een lopend conflict.

Wat er nodig is:

- een **niet-publieke** bucket, apart van de listingfoto's;
- bestanden gegroepeerd per betaling, met de `MK-`referentie in het pad;
- alleen lezen via een kortlopende, ondertekende URL — nooit een open pad;
- de backoffice kan alles lezen; een ingelogde gebruiker uitsluitend de bestanden van zijn eigen betalingen;
- een grens op bestandsgrootte en op de toegestane typen (afbeeldingen en PDF), zodat de bucket geen algemene opslag wordt;
- een bewaartermijn die bij het privacybeleid past — noem wat je instelt, dan werkt Claude Design het privacybeleid bij als dat nodig is.

---

## 3. Een endpoint dat een upload aan een betaling koppelt

De upload-pagina krijgt niets anders mee dan de `MK-`referentie uit de URL. Dat is een referentie die in een e-mail staat en dus gedeeld kan worden, dus de server moet zelf vaststellen of deze gebruiker hier mag uploaden.

Wat het endpoint moet doen:

- de referentie omzetten naar de betaling en **controleren dat die betaling van de ingelogde gebruiker is**; zo niet, weigeren zonder te verklappen of de referentie bestaat;
- alleen uploads toestaan bij `doc_check` en `ownership_check`;
- weigeren als de betaling geannuleerd of verlopen is;
- een aantal bestanden per betaling toestaan dat ruim genoeg is voor een compleet dossier, met een harde bovengrens;
- teruggeven wat er nu bij de betaling hoort, zodat de pagina kan tonen wat al binnen is en de koper niet twee keer hetzelfde stuurt;
- de bestandsnamen en het aantal ook wegschrijven bij de betaling, zodat de backoffice in `admin.html` ziet dát er stukken zijn zonder de bucket te hoeven openen.

Laat de naam van het endpoint en de vorm van het verzoek en het antwoord weten, dan bouwt Claude Design de pagina daarop.

**Belangrijk:** het uploaden mag niet verplicht zijn om de check te laten starten. Een koper die niets heeft, of die alles al per WhatsApp had gestuurd, moet gewoon door kunnen.

---

## 4. Melding aan de backoffice zodra de stukken binnen zijn

Nu komt er een melding bij de betaling. De stukken komen later, en daar zit het echte startsignaal van het werk.

- één melding aan de backoffice zodra de eerste upload bij een betaling binnen is, met de `MK-`referentie en het aantal bestanden;
- niet één melding per bestand — iemand die zes foto's stuurt, stuurt ze binnen een minuut;
- naar hetzelfde adres als de betalingsmeldingen, in dezelfde vorm;
- de koper krijgt een korte bevestiging op het adres dat in `payments.customer_email` staat. Dat is bewust dat veld en niet het accountadres — bij een ownership check is de koper vaak niet de accounthouder.

---

## Wat NIET moet gebeuren

1. **Geen bestandswijzigingen aan mykunda.com.** Geen HTML, geen CSS, geen scripts, geen `robots.txt`, geen meta-tags. Dat loopt allemaal via Claude Design. Zie de werkafspraken in dat project.
2. **Raak de prijslogica niet aan.** De browser stuurt geen bedrag mee en de server haalt de prijs uit `listing_plans`. Dat is een beveiligingsmaatregel.
3. **Raak de plan-id's niet aan.** `doc_check` en `ownership_check` blijven zoals ze zijn; `verified` blijft de band zelf kiezen.
4. **Verander de doorgifte van `contact_email` niet.** Die is vandaag gebouwd en werkt: het ingevulde adres komt in `payments.customer_email`, het accountadres in `metadata.account_email`.
5. **Geen validatie die onbekende intake-velden weggooit.** Zie punt 1 hierboven.
6. **Geen publieke leesrechten op de bucket**, ook niet tijdelijk om iets te testen.

---

## Wat je terug moet melden

Vier dingen, dan kan Claude Design verder:

1. de nieuwe lengtegrens op `intake`;
2. de naam van de bucket en de padstructuur;
3. de naam van het upload-endpoint, met de vorm van verzoek en antwoord;
4. de bewaartermijn die je op de bestanden hebt gezet.
