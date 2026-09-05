# Prompt voor Claude in Chrome — aanbod onroerend goed en grond in Gambia verzamelen

Gebruik: open Chrome, log zelf in op Facebook/Instagram, open het zijpaneel van Claude in Chrome en plak de tekst hieronder. Blijf erbij; de opdracht stopt zichzelf bij elke melding van Meta.

---

Je werkt in mijn eigen, ingelogde Chrome-browser en verzamelt vastgoed- en grondaanbod in Gambia als marktbewijs voor de prijsindex van mykunda.com. Je gedraagt je als een lezer, niet als een crawler.

## Spelregels (gaan vóór alles)

1. Je gebruikt uitsluitend de gewone webpagina's in dit tabblad. Geen API-aanroepen, geen scripts die pagina's ophalen, geen tweede tabblad, geen tabbladen tegelijk, geen wijzigingen aan account, cookies, IP of user-agent.
2. Je leest alleen wat ik als ingelogde gebruiker gewoon te zien krijg: openbare Marketplace-advertenties, openbare pagina's, en groepen waar ik lid van ben. Je opent geen profielen, geen berichten, geen vriendenlijsten en je stuurt niemand een bericht.
3. Leestempo: één advertentie tegelijk. Na elke geopende advertentie wacht je 8–15 seconden, na elke 25 advertenties 2 minuten. Maximaal 120 advertenties per sessie en maximaal 45 minuten; daarna stop je en rapporteer je, ook als er meer aanbod is.
4. Toont Facebook of Instagram een controle, captcha, "Je gaat te snel", "tijdelijk geblokkeerd", een inlogscherm of welke waarschuwing dan ook: stop onmiddellijk, doe geen enkele poging om door te gaan of eromheen te werken, en meld mij letterlijk wat er stond. Ik beslis dan zelf.
5. Je slaat alleen op wat in de advertentie zelf staat. Naam van de verkoper zoals getoond bij de advertentie mag (nodig om dubbele posts te herkennen); een telefoonnummer alleen als het in de advertentietekst staat. Niets uit profielen, niets uit reacties van anderen.
6. Je verzint niets. Ontbreekt een veld, laat het leeg. Een prijs zonder bedrag ("DM for price", "negotiable") wordt een lege `price_value` met de letterlijke tekst in `price_as_listed`.

## Waar je kijkt, in deze volgorde

A. **Facebook Marketplace** — categorie Property (Property for sale, Property rentals), locatie ingesteld op The Gambia (Serrekunda/Banjul, straal maximaal), gesorteerd op nieuwste. Zoektermen, elk apart: `land for sale`, `plot`, `compound`, `house for sale`, `apartment`, `rent`, `Brusubi`, `Bijilo`, `Brufut`, `Sanyang`, `Tujereng`, `Kololi`, `Kotu`, `Fajara`, `Brikama`, `Yundum`, `Sukuta`, `Lamin`.
B. **Facebook-groepen** waar ik lid van ben en die vastgoed in Gambia als onderwerp hebben: alleen de posts van de laatste 30 dagen.
C. **Instagram** — de zoekpagina op deze hashtags: `#gambiaproperty`, `#gambiarealestate`, `#landforsalegambia`, `#gambialand`, `#propertygambia`, `#gambiahomes`. Alleen posts met een prijs of een duidelijke locatie; onder een post lees je alleen het bijschrift, geen reacties.

Overslaan: aanbod buiten Gambia (Senegal, Ghana, "Gambia" in een andere betekenis), advertenties zonder locatie én zonder prijs, dubbele posts van dezelfde advertentie (zelfde URL of dezelfde tekst+verkoper) en alles ouder dan 90 dagen.

## Wat je vastlegt

Per advertentie één regel. Kolommen, exact in deze volgorde en met deze namen:

```
seen_date, source, url, group_or_hashtag, posted_date, seller, deal, category, location_text, area_guess, price_as_listed, price_value, currency, size_text, size_sqm, bedrooms, title_status_text, contact_in_text, photo_count, description
```

- `source`: `facebook_marketplace`, `facebook_group` of `instagram`.
- `deal`: `Koop`, `Huur` of `Onbekend`.
- `category`: `Grond / perceel`, `Huis / compound`, `Appartement`, `Bedrijfsruimte` of `Overig`.
- `price_as_listed`: letterlijk zoals getoond, bijvoorbeeld `D2.5M`, `GMD 700,000`, `€45,000`, `DM for price`.
- `price_value`: alleen cijfers in de valuta van de advertentie; `D2.5M` wordt `2500000`. Bij "per month"/"per year" zet je dat in `price_as_listed` en niet in het bedrag.
- `currency`: `GMD`, `EUR`, `GBP` of `USD`; leeg als het niet uit de advertentie blijkt.
- `size_text` letterlijk (`20x25`, `500 sqm`, `1 acre`); `size_sqm` alleen als het rekenkundig zeker is (20x25 m = 500; 1 acre = 4047; "plot" zonder maat = leeg).
- `title_status_text`: letterlijke woorden over papieren, zoals `lease document`, `freehold`, `customary`, `transfer`, `alkalo`; anders leeg.
- `contact_in_text`: telefoonnummer alleen als het letterlijk in de tekst staat.
- `description`: de volledige advertentietekst, aanhalingstekens verdubbeld, regeleinden vervangen door een spatie.

Kolommen `url`, `deal`, `seller`, `category`, `currency`, `description`, `price_value` en `price_as_listed` moeten precies deze namen houden; de import van MyKunda leest die.

## Hoe je het aanlevert

- Geef na elke 25 advertenties een CSV-blok (komma's als scheidingsteken, UTF-8, kopregel alleen in het eerste blok) in het gesprek, zodat ik het meteen kan bewaren. Ik plak de blokken samen in één bestand `facebook-aanbod-JJJJ-MM-DD.csv`.
- Sluit af met een kort verslag: aantal gelezen, aantal opgeslagen, aantal overgeslagen met reden, waar je gestopt bent (zoekterm, groep of hashtag en hoe ver), en of Meta iets heeft gemeld.
- Als ik "ga door" zeg, begin je een nieuwe sessie met dezelfde regels vanaf het punt waar je gestopt bent, met een pauze van minimaal een uur na de vorige sessie.
