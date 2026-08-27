/* ============================================================
   MyKunda — waarderingsmodel
   ------------------------------------------------------------
   Eén bron voor elke waardebepaling op de site. sell.html en
   list.html rekenen allebei hierdoor; nergens anders staat een
   tarief of een opslag.

   Rekenwijze: grond en opstal worden apart gewaardeerd en
   opgeteld. Dat is de methode voor markten zonder betrouwbaar
   transactieregister, en Gambia is er daar één van — er bestaat
   geen publieke bron met gerealiseerde verkoopprijzen. Alles
   hieronder komt dus uit vraagprijzen, en het model zegt dat ook.

   Interne eenheid is EUR (net als CURRENCIES in app.js);
   omrekenen naar de weergavevaluta doet convert() daar.

   HERIJKEN: elk blok hieronder draagt een `herijkt`-datum. De
   betrouwbaarheidsscore zakt naarmate die datum ouder wordt, en
   boven de twaalf maanden zegt de tool het uit zichzelf.
   ============================================================ */
(function (root) {
'use strict';

/* ============================================================
   1 · GRONDTARIEVEN — EUR per m²
   ------------------------------------------------------------
   HERIJKT 26-08-2026 op een veel bredere basis dan de vorige
   ronde. Toen stonden hier veertien gebieden met twee of drie
   waarnemingen; nu zesendertig, met samen ruim honderdnegentig
   geprijsde kavelaanbiedingen.

   Waar het bewijs vandaan komt:
     · Facebook Marketplace en Facebook-groepen, peildatum
       25-08-2026, 1.102 advertenties binnen 100 km van Sukuta
       waarvan 918 met een bruikbaar bedrag. Dit is de enige
       GEDATEERDE bron voor Gambia, en de enige die het gewone
       particuliere aanbod bereikt in plaats van het makelaars-
       en expatsegment. 95 daarvan noemen zowel prijs als maat.
     · Songhai Properties, AccessGambia, Holprop en GamRealty
       (gezien 26-08-2026), samen nog eens ongeveer 95 kavels.

   De twee vinden elkaar opvallend goed: Farato D1.701 tegen
   Songhai's D1.250–1.625, Brikama D906 tegen D800–1.500, Kitty
   D875 tegen D875, Brusubi D5.833 tegen D4.800–7.000. Voor deze
   markt is dat zeldzaam. Het tarief hieronder is het naar aantal
   waarnemingen gewogen gemiddelde van beide medianen.

   Opschonen was nodig en niet triviaal: verkopers vullen het
   prijsveld slordig in (D650 voor een kavel van D650.000), en een
   flink deel zet er een telefoonnummer in. Bedragen zijn per
   categorie teruggeschaald tegen een plausibele band, rijen
   waarvan het bedrag overeenkomt met een cijferreeks in de eigen
   tekst zijn eruit, dubbele plaatsingen ook, en alles buiten
   D200–25.000 per m² is als onleesbaar weggegooid.

   Drie klassen, en de klasse bepaalt de bandbreedte:
     WAARGENOMEN  drie of meer waarnemingen → mediaan
     HALF         één of twee → aanwijzing, bredere band
     ZONE         geen → zonefactor op de oude tabel

   LET OP bij het lezen van deze getallen: dit zijn medianen van
   het GEWONE geadverteerde aanbod, en dat is precies wat de
   referentiekavel in blok 3 beschrijft. Ze zijn niet naar een
   betere specificatie teruggerekend. Een advertentie die niets
   over titel, weg of stroom zegt, krijgt in het model dan ook
   nul punten — het tarief geldt zoals het hier staat.
   ============================================================ */
var LAND_HERIJKT = '2026-08-26';

/* Waargenomen: n ≥ 3. `gmd` staat erbij omdat de Gambiaanse markt
   in dalasi denkt en dat het getal is dat je met een advertentie
   kunt vergelijken; `eur` is dezelfde waarde gedeeld door 85,74
   (CBG, 25-08-2026) en is wat het model rekent. */
var LAND_OBSERVED = {
  'fajara':     { eur:  155.5, n:  5, gmd: 13333 },
  'kerr serign':{ eur:   92.2, n:  3, gmd:  7905 },
  'brusubi':    { eur:   75.3, n:  4, gmd:  6458 },
  'bijilo':     { eur:   70.0, n: 13, gmd:  6000 },
  'jabang':     { eur:   33.8, n:  9, gmd:  2894 },
  'salagi':     { eur:   28.1, n:  4, gmd:  2408 },
  'sukuta':     { eur:   27.1, n:  8, gmd:  2326 },
  'brufut':     { eur:   26.6, n:  7, gmd:  2282 },
  'tujereng':   { eur:   26.6, n: 11, gmd:  2280 },
  'tanji':      { eur:   25.2, n:  5, gmd:  2163 },
  'yundum':     { eur:   21.5, n:  5, gmd:  1844 },
  'lamin':      { eur:   21.4, n:  9, gmd:  1833 },
  'busumbala':  { eur:   20.2, n:  4, gmd:  1728 },
  'farato':     { eur:   19.1, n: 13, gmd:  1640 },
  'jambur':     { eur:   18.8, n:  4, gmd:  1612 },
  'brikama':    { eur:   12.3, n:  7, gmd:  1053 },
  'sanyang':    { eur:   11.3, n: 14, gmd:   972 },
  'mamuda':     { eur:   10.5, n:  5, gmd:   896 },
  'kitty':      { eur:   10.2, n:  6, gmd:   875 },
  'gunjur':     { eur:    8.0, n:  7, gmd:   682 },
  'sifoe':      { eur:    7.3, n:  3, gmd:   625 }
};

/* Eén of twee waarnemingen: een aanwijzing, geen mediaan. Eén
   kavel is geen markt — het is de mening van één verkoper over
   zijn eigen grond. confidence() rekent daar zwaar op af. */
var LAND_HALF = {
  'cape point':    { eur:  194.4, n:  1, gmd: 16667 },
  'banjul':        { eur:  145.8, n:  1, gmd: 12500 },
  'bakoteh':       { eur:  123.0, n:  1, gmd: 10549 },
  'kotu':          { eur:  116.3, n:  1, gmd:  9971 },
  'kololi':        { eur:  102.6, n:  4, gmd:  8800 },   /* 27-08-2026: +2 Songhai-kavels met maat */
  'brufut heights':{ eur:   42.3, n:  2, gmd:  3625 },
  'ghana town':    { eur:   29.2, n:  1, gmd:  2500 },
  'madiana':       { eur:   15.5, n:  1, gmd:  1333 },
  'jambanjelly':   { eur:   14.0, n:  1, gmd:  1202 },
  'jalanbang':     { eur:   12.7, n:  1, gmd:  1087 },
  'kartong':       { eur:    8.7, n:  2, gmd:   742 },
  'bafuloto':      { eur:    8.4, n:  1, gmd:   722 },
  'faraba':        { eur:    5.7, n:  1, gmd:   488 },
  'pirang':        { eur:    2.9, n:  1, gmd:   246 },
  'farafenni':     { eur:    1.1, n:  1, gmd:    93 }
};

/* Zonefactor voor gebieden zonder eigen waarneming, toegepast op
   de oude portaaltabel in valuation-areas.js. De factor is de
   mediaan van waargenomen ÷ oude tabel, en alleen berekend over
   gebieden met n ≥ 3 — anders bepaalt één advertentie de hele
   provincie.

   De vorige ronde had coast 0,45 / kombo 1,05 / greater 0,70. Dat
   verschuift flink, en in beide richtingen: de kust was minder
   overschat dan gedacht, het Kombo-binnenland en Groot-Banjul
   juist structureel te laag. */
var LAND_ZONE = {
  coast:     0.88,  /* 7 gebieden met n≥3: bijilo, fajara, brufut, tanji,
                       sanyang, tujereng, gunjur                          */
  kombo:     1.43,  /* 8 gebieden: brusubi, kerr serign, sukuta, lamin,
                       jabang, yundum, busumbala, brikama                 */
  greater:   1.40,  /* alleen banjul en bakoteh, elk één waarneming; de
                       ruwe uitkomst was 2,1 maar dat is te veel gewicht
                       voor twee losse kavels, dus bewust getemperd       */
  upcountry: 0.55   /* één waarneming (Farafenni, €1,09/m²) die op 0,27
                       wees; ook hier bewust halverwege gelaten           */
};

var ZONE_OF = {
  coast: ['kololi','senegambia','bijilo','cape point','fajara','bakau','kotu',
          'brufut heights','brufut','tanji','batokunku','sanyang','tujereng',
          'gunjur','kartong','kartung','ghana town','jambanjelly','folonko'],
  kombo: ['brusubi','kerr serign','sukuta','lamin','jabang','yundum','old yundum',
          'busumbala','brikama','sinchu alagie','sinchu baliya','nema kunku',
          'banjulunding','wellingara','farato','abuko','kembujeh','madiana',
          'kuloro','giboro koto','sotokoi','faraba sutu','bessi nding','jambur',
          'marakissa','kafuta','sifoe','mandinaba','bonto','kitty','nyambai',
          'faraba banta','pirang','bulok','kalagi','somita','sibanor','darsilami',
          'salagi','mamuda','jalanbang','bafuloto','kunkujang','daranka'],
  greater: ['banjul','serrekunda','serekunda','kanifing','bakoteh','bundung',
            'talinding','tallinding kunjang','latri kunda','faji kunda','pipeline',
            'tabokoto','new jeshwang','old jeshwang','dippa kunda','ebou town',
            'ebo town','manjai kunda','churchills town','kabafita']
};

function zoneFor(key) {
  for (var z in ZONE_OF) { if (ZONE_OF[z].indexOf(key) > -1) return z; }
  return 'upcountry';
}

/* ============================================================
   2 · BOUWKOSTEN — EUR per bebouwde m², nieuwbouw
   ------------------------------------------------------------
   Geen enkele bron geeft een Gambiaans tarief per m² dat je kunt
   overnemen; Shreeji Development schrijft in juli 2026 letterlijk
   dat dat tarief niet bestaat. Daarom van onderaf opgebouwd uit
   de Gambiaanse materiaalprijzen (AccessGambia, 7 januari 2026)
   met gepubliceerde hoeveelheden uit echte bestekken.

   De ruwbouw per m² vloer rekent uit:
     2,05 m² muur per m² vloer  · 10 blokken per m² muur
     0,20 zak cement metselspecie en 0,22 zak pleister per m² muur
     0,13 m³ funderingsbeton en 0,14 m³ vloerplaat per m² vloer
     9,5 kg wapening per m² vloer
   Bij D550 per zak cement, D845 per m³ zand en D55 per kg staal
   geeft dat D3.400 – D5.200 aan ruwbouwmateriaal per m².
   Met arbeid (+50% op materiaal), de gepubliceerde verdeling
   ruwbouw 38% van de harde bouwsom, en 20% aannemersopslag komt
   daar EUR 163 – EUR 321 per m² uit.

   Drie onafhankelijke lijnen komen daarmee op hetzelfde uit:
     · deze opbouw van onderaf          EUR 163 – 321
     · mykunda.com/guide-building-...   EUR 300 standaard, 500+ hoog
     · enormousbuildings.com            USD 300 – 700 = EUR 254 – 594
   De afwerkingsgraad — tegels of cementvloer, aluminium of stalen
   ramen, airco of niet — zit in de 62% die de opbouw niet zelf
   berekent. Vandaar één vraag aan de gebruiker in plaats van een
   aanname.

   Deze drie getallen zijn afgeleid, niet waargenomen. De
   opstalwaarde scoort daarom nooit hoger dan 'redelijk'; zie
   confidence(). Komt er een Gambiaanse offerte op tafel, dan is
   dit blok de enige plek die verandert.
   ============================================================ */
var BUILD_HERIJKT = '2026-08-26';
var BUILD_COST = {
  basic:    200,  /* betonblok, cementvloer of eenvoudige tegel, stalen ramen,
                     golfplaat, geen airco — onderkant van de eigen opbouw     */
  standard: 300,  /* tegelvloer, hor, plafond, boiler — komt overeen met de
                     eigen gids en met de onderkant van de gepubliceerde band  */
  high:     500   /* aluminium schuifpuien, airco, ingebouwde keuken, plafonds */
};
/* Wat de opstal draagt maar niet in EUR/m² vloer zit. Afgeschreven
   investeringen: een zwembad kost in Sanyang hetzelfde als in Kololi. */
var BUILD_EXTRA = {
  pool:        14000,  /* 8×4 m met pomp en filter                      */
  solar:        4500,  /* paneel, omvormer, accu — huishoudformaat      */
  generator:    1800,  /* 5–7 kVA met kast                              */
  borehole:     3200,  /* boring, pomp en tank                          */
  wallPerM:        55, /* ommuring per strekkende meter, 2 m hoog       */
  furnishedPct:  0.05, /* volledig gemeubileerd, op de opstalwaarde     */
  semiPct:       0.02
};

/* Afschrijving: betonblokbouw met golfplaat gaat lang mee en de
   grond draagt het grootste deel van de waarde. 1,5% per jaar met
   een bodem van 60% restwaarde — een huis van veertig jaar oud op
   een goede kavel is in Gambia geen afgeschreven huis. */
function depreciation(yearBuilt, condition) {
  var now = new Date().getUTCFullYear();
  var age = yearBuilt ? Math.max(0, now - (+yearBuilt)) : 12;   /* onbekend → 12 jaar */
  var d = Math.min(0.40, age * 0.015);
  if (condition === 'new') d = 0;
  if (condition === 'renovation') d = Math.min(0.55, d + 0.22);
  return d;
}

/* ============================================================
   3 · KENMERKEN — procentpunten, niet vermenigvuldigers
   ------------------------------------------------------------
   Tien vermenigvuldigers achter elkaar kunnen vóór demping tot
   +200% oplopen; daarna corrigeerden een demping van 0,75 en een
   plafond dat weer terug. Drie mechanismen die elkaars werk
   overdoen en die je aan geen klant uitlegt.

   Optellen is stabieler en leest als een checklist: "jouw kavel
   scoort +18%". De harde grens onderaan doet wat de demping deed,
   op één plek en zichtbaar.

   REFERENTIEKAVEL — het nulpunt van deze tabel, en tegelijk de
   kavel waar elk tarief in LAND_OBSERVED bij hoort:
       alkalo-titel · lateriet weg · stroom aanwezig · water in de
       straat · deels omheind · ontbost · regelmatige vorm · geen
       hoek · geen overstromingsrisico · landinwaarts · geen uitzicht
   Dat is de gewone Gambiaanse bouwkavel. Elke waarneming is naar
   die specificatie teruggerekend vóór hij tarief werd; anders tel
   je de stroomaansluiting twee keer — één keer in de vraagprijs
   waar het tarief uit komt, en nog eens als plusje erbovenop. De
   eerste zelftest liep daar op vast: Brusubi kwam 67% te hoog uit.
   Wijzig je hieronder een getal, herijk dan ook de tarieven.
   ============================================================ */
var LAND_PTS = {
  title:  { freehold: 10, leasehold: 8, sublease: 5, alkalalo: 0, unclear: -25 },
  road:   { tarmac: 12, laterite: 0, none: -20 },
  elec:   { present: 0, nearby: -6, none: -14 },
  water:  { nawec: 4, borehole: 2, nearby: 0, none: -10 },
  fence:  { full: 8, partial: 0, none: -6 },
  cleared:{ cleared: 0, partial: -4, bush: -9 },
  corner: { yes: 5, no: 0 },
  shape:  { regular: 0, irregular: -7 },
  flood:  { no: 0, low: -8, high: -22 },
  beach:  { beachfront: 45, walking: 12, inland: 0 },
  view:   { ocean: 10, garden: 3, none: 0 }
};
var LAND_CAP = { down: -45, up: 60 };

/* De opstal krijgt zijn eigen, veel kortere lijst: alles wat met
   de locatie te maken heeft zit al in de grondwaarde, en alles wat
   geld kost staat in BUILD_EXTRA. Wat overblijft is de plattegrond. */
var BUILD_PTS = {
  floors: { '1': 0, '2': 4, '3': 6 },
  baths:  { '1': -3, '2': 0, '3': 3, '4': 6 },
  security: { gated: 4, wall: 0, none: -3 }
};
var BUILD_CAP = { down: -20, up: 20 };

/* ============================================================
   4 · HUUR — twee markten, niet één
   ------------------------------------------------------------
   HERIJKT 27-08-2026. Hieronder stond tot die datum 1,95%, en de
   toelichting erbij zei dat dat een verlaging was van 3,0-5,5%
   "omdat de gemeten huren dat niet ondersteunden". Die meting
   deugde niet, en de verlaging dus ook niet.

   Wat er misging: de 98 huuradvertenties waar dat op rustte,
   hadden geen leesbare periode. De aanname was dat een Gambiaanse
   huur een JAARhuur is. Dat klopt voor makelaarsadvertenties,
   maar niet voor het lokale aanbod op Facebook, waar in maanden
   wordt geadverteerd en in zes- of twaalfmaandsvoorschotten wordt
   betaald. Maandbedragen en jaarbedragen stonden in één kolom.
   De verdeling was daardoor tweetoppig — een cluster rond
   D5.000-13.000 en een rond D150.000-450.000, met een leeg dal
   ertussen — en de mediaan landde in dat dal. Vandaar D163.000
   per jaar, en vandaar 1,95%.

   Nu: 45 advertenties waarvan periode én woningtype wél te lezen
   zijn, per gebied gepaard met de vraagprijs van een woning in
   datzelfde gebied. Binnen het gebied paren is essentieel — een
   lokale huur tegen een expat-vraagprijs afzetten is precies hoe
   je weer op 2% uitkomt.

   Uitkomst over 13 gebieden: mediaan 2,68%, gewogen naar aantal
   advertenties 2,86%, spreiding 1,5% (Bakau) tot 4,7% (Bakoteh).
   Het middenniveau hieronder staat daarom op 2,7% voor een
   gewone woning. Dat ligt tussen de oude 1,95% en de nog oudere
   3,0-5,5% in, en het is voor het eerst een getal dat uit twee
   los gemeten grootheden komt.

   Blijft staan: het zijn gepaarde vraagprijzen van VERSCHILLENDE
   objecten, geen gerealiseerde rendementen. De orde van grootte
   is hard, de tweede decimaal niet.

   Kopen is in Gambia vooral een weddenschap op grond, niet een
   inkomensstrategie. Een Gambiaans schatkistpapier op 364 dagen
   deed 9,45% in augustus 2026 — ruim boven elk van deze cijfers.
   ============================================================ */
var RENT_HERIJKT = '2026-08-27';

/* ---- het portaalniveau ----
   Dezelfde kavel wordt in dalasi anders geprijsd dan in euro's.
   Dat is geen ruis maar een tweede markt, en een verkoper die op
   diaspora mikt heeft er wat aan.

   Eerst geprobeerd als één vermenigvuldiger op de modelwaarde.
   Dat viel af: over negen objecten waarvoor allebei de prijzen
   bestaan loopt de verhouding van 0,90 tot 2,41 — een mediaan van
   1,7 zegt daar niets zinnigs mee. Eén getal zou een precisie
   suggereren die er niet is.

   Dus alleen waar het portaalniveau werkelijk is waargenomen, per
   gebied, in EUR/m². Geen waarneming betekent: niets tonen. Deze
   tarieven staan naast het hoofdgetal, nooit erin.
   Bron: GamRealty grondgids maart 2026 en Holprop, 26-08-2026. */
var PORTAL_RATE = {
  'kololi':        [80, 289],  'senegambia':     [130, 314],
  'bijilo':        [40, 277],  'brufut heights': [40, 120],
  'brufut':        [25,  70],  'sukuta':         [43,  45],
  'tanji':         [15,  35],  'sanyang':        [10,  38],
  'tujereng':      [ 8,  40],  'gunjur':         [ 8,  20],
  'kartong':       [ 8,  20],  'kartung':        [ 8,  20]
};
var RENT_YIELD = {
  /* Gemeten: mediaan 2,68% over 13 gebieden waar huur en vraagprijs
     allebei los zijn waargenomen, met 2,7% als middenniveau voor een
     gewone woning. De spreiding tussen woningtypen is nog steeds niet
     waargenomen — daarvoor zijn het te weinig objecten — maar de
     ordening (appartement boven villa, bedrijfsruimte bovenaan) is in
     elke markt hetzelfde en blijft dus staan, om het gemeten niveau
     heen geschaald. De residentiële typen blijven binnen de 1,5-4,7%
     die we per gebied werkelijk zien; lodge en bedrijfsruimte staan
     daarboven omdat het een andere activaklasse is. */
  local:  { villa: 0.022, house: 0.027, apartment: 0.032, townhouse: 0.027,
            compound: 0.025, penthouse: 0.032, lodge: 0.043, commercial: 0.055 },
  /* Gemeubileerd, in euro's of dollars, aan buitenlanders. In
     Fajara staat een lokale driekamerwoning op D175.000 per jaar
     en een gemeubileerde villa in dezelfde straat op EUR 18.000
     tot 38.000 — een factor negen. Over de hele waarneming ligt
     de verhouding tussen 2,5 en 4. Drie is het midden en het
     enige getal dat we kunnen verdedigen; het staat naast het
     hoofdgetal, nooit erin.
     Getoetst op 27-08-2026 met de herijkte lokale huren: Kololi
     lokaal D350.000 per jaar tegen GamRealty $13.000 (D964.000)
     en Global Properties $12.000 (D890.000) geeft 2,5 tot 2,8.
     Ongewijzigd gelaten — de Fajara-factor negen blijkt vooral
     een ongewoon goedkope lokale advertentie. */
  expatMultiple: 3.0
};

root.MK_VAL_CONFIG = {
  LAND_OBSERVED: LAND_OBSERVED, LAND_HALF: LAND_HALF, LAND_ZONE: LAND_ZONE,
  BUILD_COST: BUILD_COST, BUILD_EXTRA: BUILD_EXTRA, LAND_PTS: LAND_PTS,
  BUILD_PTS: BUILD_PTS, RENT_YIELD: RENT_YIELD, PORTAL_RATE: PORTAL_RATE,
  herijkt: { land: LAND_HERIJKT, build: BUILD_HERIJKT, rent: RENT_HERIJKT },
  zoneFor: zoneFor, depreciation: depreciation,
  LAND_CAP: LAND_CAP, BUILD_CAP: BUILD_CAP
};

})(typeof window !== 'undefined' ? window : globalThis);

/* ============================================================
   5 · DE REKENMACHINE
   ------------------------------------------------------------
   Pure functies, geen DOM. sell.html en list.html geven een
   object in en krijgen een object terug; het tekenen doen zij.
   Dat maakt de zelftest mogelijk: valuation-selftest.html voert
   hier geankerde gevallen doorheen en zet de uitkomst naast de
   waargenomen prijs.

   LAND_BASE — de tarieventabel per gebied zoals die in sell.html
   stond — wordt van buiten meegegeven (valuation-areas.js), zodat
   de data los staat van het model en met de hand bij te werken is
   zonder het rekenwerk aan te raken.
   ============================================================ */
(function (root) {
'use strict';
var C = root.MK_VAL_CONFIG;

function norm(s) { return String(s == null ? '' : s).toLowerCase().trim(); }
/* De onderbouwing is wat de klant leest; daar hoort geen sleutel in te staan. */
function titel(s) { return String(s || '').replace(/(^|[\s-])([a-z])/g, function (m, a, b) { return a + b.toUpperCase(); }); }
var FINISH_EN = { basic: 'simple', standard: 'standard', high: 'high' };

/* Welk gebied bedoelt iemand? Langste sleutel eerst, zodat
   "brufut heights" niet als "brufut" wordt gelezen. */
function matchArea(locStr, base) {
  var s = norm(locStr), keys = Object.keys(base || {}).sort(function (a, b) { return b.length - a.length; });
  for (var i = 0; i < keys.length; i++) { if (s.indexOf(keys[i]) > -1) return keys[i]; }
  return null;
}

/* Het grondtarief plus de herkomst ervan. De herkomst is geen
   voetnoot: hij bepaalt verderop de bandbreedte. */
function landRate(areaKey, base) {
  var k = norm(areaKey);
  if (C.LAND_OBSERVED[k]) {
    return { eur: C.LAND_OBSERVED[k].eur, src: 'observed', n: C.LAND_OBSERVED[k].n,
             note: C.LAND_OBSERVED[k].n + ' local plot listings in ' + titel(areaKey) };
  }
  if (C.LAND_HALF[k]) {
    var hn = C.LAND_HALF[k].n || 1;
    return { eur: C.LAND_HALF[k].eur, src: 'half', n: hn,
             note: hn + (hn === 1 ? ' observation' : ' observations') + ' in ' + titel(areaKey) +
                   ' \u2014 an indication, not a market average' };
  }
  var was = base && base[k];
  if (was == null) return { eur: null, src: 'none', n: 0, note: 'area not recognised' };
  var z = C.zoneFor(k), f = C.LAND_ZONE[z];
  return { eur: Math.round(was * f * 10) / 10, src: 'zone', n: 0,
           note: 'no observations \u2014 regional rate for ' + z + ' (\u00d7' + f + ')' };
}

/* Grote kavels doen een lager gemiddelde per m²: er zijn minder
   kopers voor 2.000 m² dan voor de 400–500 m² die de Gambiaanse
   markt als standaardkavel verhandelt. Het knikpunt ligt daarom
   op 600 m², de bovenkant van die cluster. */
function effLand(sqm) {
  if (sqm <= 600) return sqm;
  if (sqm <= 2000) return 600 + (sqm - 600) * 0.90;
  if (sqm <= 5000) return 600 + 1400 * 0.90 + (sqm - 2000) * 0.78;
  /* Boven de halve hectare is het geen bouwkavel meer maar bulkgrond, en
     die wordt per m² veel goedkeuper verhandeld. Waargenomen 26-08-2026:
     Sifoe 2 ha op 0,70 van het lokale kaveltarief, Mamuda 0,64 ha op 0,61,
     Songhai's Gunjur van 1 km² op een fractie daarvan. De marginale 0,40
     hierboven is de voorzichtige kant van die waarnemingen. */
  return 600 + 1400 * 0.90 + 3000 * 0.78 + (sqm - 5000) * 0.40;
}
/* Bij gebouwen speelt hetzelfde: de tweede honderd vierkante meter
   brengt minder op dan de eerste. */
function effBuilt(sqm) {
  if (sqm <= 150) return sqm;
  if (sqm <= 300) return 150 + (sqm - 150) * 0.90;
  return 150 + 150 * 0.90 + (sqm - 300) * 0.80;
}

function points(table, key, val) {
  var t = table[key]; if (!t) return 0;
  var v = t[norm(val)];
  return typeof v === 'number' ? v : 0;
}

function sumPoints(table, cap, input, fields) {
  var total = 0, hit = [];
  fields.forEach(function (f) {
    var p = points(table, f, input[f]);
    if (p) { total += p; hit.push({ field: f, value: input[f], pts: p }); }
  });
  var capped = Math.max(cap.down, Math.min(cap.up, total));
  return { raw: total, pts: capped, capped: capped !== total, hit: hit };
}

/* ---- betrouwbaarheid ----
   Vier ingrediënten, en het model scoort zichzelf nooit hoger dan
   zijn zwakste. Het cijfer stuurt de bandbreedte; er is geen vaste
   ±20% meer. */
function confidence(parts) {
  var s = 100, why = [];
  /* Twee waarnemingen zijn geen markt. De eerste versie gaf daar
     'sterk onderbouwd' bij — een label dat meer belooft dan er
     ligt, juist bij de gebieden waar we het minst weten. 'Sterk'
     is nu gereserveerd voor gebieden met acht of meer
     waarnemingen: precies de drempel waarop laag 3 het van de
     vaste tabel overneemt. Vandaag haalt geen enkel gebied dat.
     Dat is de bedoeling: het label heeft ergens om te groeien. */
  if (parts.landSrc === 'observed') {
    var n = parts.landN || 0;
    if (n >= 8) { /* geen aftrek */ }
    else if (n >= 4) { s -= 12; why.push(n + ' observations in this area'); }
    else { s -= 26; why.push('only ' + n + ' observations in this area \u2014 too few for a median to carry weight'); }
  }
  else if (parts.landSrc === 'half') { s -= 38; why.push((parts.landN || 1) + ' observation' + ((parts.landN || 1) === 1 ? '' : 's') + ' in this area \u2014 one plot is not a market'); }
  else if (parts.landSrc === 'zone') { s -= 52; why.push('no observations in this area \u2014 rate derived from the wider region'); }
  else { s -= 60; why.push('area not recognised'); }

  /* Elke prijs waar dit model op staat is een VRAAGprijs. Voor
     Gambia bestaat geen publieke bron met wat er werkelijk is
     betaald, dus hoe groot het gat is tussen vragen en krijgen
     weten we niet — alleen dat het er is, en dat het één kant op
     wijst. Dat kost iedereen punten, altijd. */
  s -= 6;
  why.push('based on asking prices \u2014 no one publishes what property actually sells for in The Gambia');

  var missing = parts.missing || 0;
  if (missing) { s -= Math.min(20, missing * 4); why.push(missing + (missing === 1 ? ' field' : ' fields') + ' left blank'); }

  var months = parts.ageMonths || 0;
  if (months > 12) { s -= Math.min(15, (months - 12) * 1.5); why.push('rates last recalibrated ' + Math.round(months) + ' months ago'); }

  /* De opstalwaarde staat op afgeleide bouwkosten, niet op
     waargenomen offertes. Zolang dat zo is kan een woning niet
     'sterk onderbouwd' heten — een kavel wel. */
  if (parts.hasBuilding) { s = Math.min(s, 74); why.push('build cost derived from material prices, not from builders\u2019 quotes'); }

  if (parts.methodGap != null && parts.methodGap > 0.25) {
    s -= 12; why.push('the two methods disagree by ' + Math.round(parts.methodGap * 100) + '%');
  }
  s = Math.max(10, Math.min(100, Math.round(s)));
  var label = s >= 75 ? 'strong' : s >= 50 ? 'fair' : 'indicative';
  /* De band was 0,12 tot 0,38 en dat was te krap. Gemeten op 45
     kavelaanbiedingen in gebieden met vier of meer waarnemingen valt maar
     64% van het aanbod binnen ±18% van de gebiedsmediaan; ±35% vangt 78%
     en ±45% vangt 89%. Een band die zegt dat hij de markt dekt, moet dat
     dan ook doen. Onderstaande ladder plus de opwaartse verruiming van
     1,25 hieronder komt op ongeveer vier op de vijf. */
  var band  = s >= 85 ? 0.22 : s >= 70 ? 0.30 : s >= 55 ? 0.38 : s >= 40 ? 0.45 : 0.52;
  return { score: s, label: label, band: band, reasons: why };
}

function monthsSince(iso) {
  var d = new Date(iso + 'T00:00:00Z');
  return (Date.now() - d.getTime()) / (1000 * 60 * 60 * 24 * 30.44);
}

/* Wat er in dit gebied op de internationale portalen wordt
   gevraagd — alleen als dat daar ook echt is waargenomen. */
function portalLevel(areaKey, plot, built, isLand) {
  var pr = C.PORTAL_RATE[norm(areaKey)];
  if (pr == null || !isLand || !plot) return null;
  var e = effLand(plot);
  return { area: titel(areaKey), rateLow: pr[0], rateHigh: pr[1],
           low: Math.round(e * pr[0]), high: Math.round(e * pr[1]),
           note: 'international portals ask EUR ' + pr[0] + '\u2013' + pr[1] + ' per m\u00b2 for plots in ' + titel(areaKey) };
}

/* ---- de hoofdfunctie ---- */
function value(input, opts) {
  opts = opts || {};
  var base = opts.LAND_BASE || {};
  var lines = [];
  var areaKey = matchArea(input.area, base) || norm(input.area);
  var isLand = norm(input.type) === 'land';
  var isApt  = norm(input.type) === 'apartment' || norm(input.type) === 'penthouse';

  /* --- grond --- */
  var lr = landRate(areaKey, base);

  /* Kennen we het gebied niet, dan is er geen tarief en dus geen
     waarde. Een nul tonen zou een antwoord suggereren; dit is er
     geen. De eerste browsertest liet zien wat er anders gebeurt:
     "Bansang" gaf EUR 0 met het label 'redelijk onderbouwd'. */
  if (lr.eur == null) {
    return { ok: false, reason: 'unknown-area', area: input.area,
             confidence: { score: 0, label: 'indicative', band: 0.38,
                           reasons: ['this area is not in the rate table'] },
             lines: [] };
  }
  var plot = +input.plotSqm || 0;
  var landPts = sumPoints(C.LAND_PTS, C.LAND_CAP, input,
    ['title', 'road', 'elec', 'water', 'fence', 'cleared', 'corner', 'shape', 'flood', 'beach', 'view']);
  var landRateAdj = lr.eur == null ? null : lr.eur * (1 + landPts.pts / 100);
  var landValue = 0;
  if (!isApt && plot > 0 && landRateAdj != null) {
    landValue = effLand(plot) * landRateAdj;
    lines.push({ k: 'Land rate, ' + titel(input.area || areaKey), v: landRateAdj, unit: '/m²', note: lr.note });
    landPts.hit.forEach(function (h) { lines.push({ k: h.field, v: h.pts, unit: 'pt', note: String(h.value) }); });
    if (landPts.capped) lines.push({ k: 'Capped at +' + C.LAND_CAP.up + '%', v: null, note: 'features added up to ' + landPts.raw + '%' });
    if (plot > 600) lines.push({ k: 'Large plot, tapered rate', v: null, note: plot + ' m\u00b2 priced as ' + Math.round(effLand(plot)) + ' m\u00b2' });
    lines.push({ k: 'Land value', v: landValue, strong: true });
  }

  /* --- opstal --- */
  var built = +input.builtSqm || 0;
  var buildValue = 0, rebuild = 0, unitCost = 0;
  if (!isLand && built > 0) {
    var finish = norm(input.finish) || 'standard';
    unitCost = C.BUILD_COST[finish] || C.BUILD_COST.standard;
    var bp = sumPoints(C.BUILD_PTS, C.BUILD_CAP, input, ['floors', 'baths', 'security']);
    var gross = effBuilt(built) * unitCost * (1 + bp.pts / 100);
    var dep = C.depreciation(input.yearBuilt, norm(input.condition));
    buildValue = gross * (1 - dep);

    var extra = 0;
    if (norm(input.pool) === 'yes') extra += C.BUILD_EXTRA.pool;
    if (norm(input.solar) === 'solar' || norm(input.solar) === 'both') extra += C.BUILD_EXTRA.solar;
    if (norm(input.solar) === 'generator' || norm(input.solar) === 'both') extra += C.BUILD_EXTRA.generator;
    if (norm(input.water) === 'borehole' || norm(input.water) === 'both') extra += C.BUILD_EXTRA.borehole;
    if (plot > 0 && norm(input.fence) === 'full') extra += Math.sqrt(plot) * 4 * C.BUILD_EXTRA.wallPerM;
    var extraDep = extra * (1 - dep * 0.6);          /* voorzieningen slijten trager dan het casco */
    var furn = norm(input.furnished) === 'furnished' ? C.BUILD_EXTRA.furnishedPct
             : norm(input.furnished) === 'semi' ? C.BUILD_EXTRA.semiPct : 0;
    buildValue = (buildValue + extraDep) * (1 + furn);
    rebuild = effBuilt(built) * unitCost + extra;

    lines.push({ k: 'Build cost, ' + (FINISH_EN[finish] || finish) + ' finish', v: unitCost, unit: '/m\u00b2', note: 'derived from Gambian material prices, Jan 2026' });
    bp.hit.forEach(function (h) { lines.push({ k: h.field, v: h.pts, unit: 'pt', note: String(h.value) }); });
    if (dep) lines.push({ k: 'Depreciation', v: -Math.round(dep * 100), unit: '%', note: input.yearBuilt ? 'built ' + input.yearBuilt : 'year unknown \u2014 12 years assumed' });
    if (extra) lines.push({ k: 'Fixtures', v: extraDep, note: 'valued at depreciated build cost, not as a percentage of the location' });
    lines.push({ k: 'Building value', v: buildValue, strong: true });
  }

  /* Appartement: de kavel is niet toe te wijzen aan één unit, dus
     geen grondwaarde. Wat overblijft is de opstal plus de locatie,
     en die locatie moet dan wél in het tarief zitten. */
  if (isApt && lr.eur != null && built > 0) {
    var locUplift = built * lr.eur * 1.6;    /* aandeel in de grondwaarde van het gebouw */
    buildValue += locUplift;
    lines.push({ k: 'Location share', v: locUplift, note: 'a flat has no plot of its own \u2014 the land is carried per built m\u00b2' });
  }

  var mid = landValue + buildValue;

  /* --- huur en rendement --- */
  var y = C.RENT_YIELD.local[norm(input.type)] || C.RENT_YIELD.local.house;
  var rentLocal = mid * y / 12;
  var rentExpat = rentLocal * C.RENT_YIELD.expatMultiple;

  /* --- betrouwbaarheid en band --- */
  var wanted = isLand ? ['title', 'road', 'elec', 'water', 'fence', 'cleared', 'flood', 'beach']
                      : ['condition', 'yearBuilt', 'finish', 'floors', 'baths', 'water', 'security', 'beach'];
  var missing = wanted.filter(function (f) { return input[f] == null || input[f] === ''; }).length;
  var conf = confidence({
    landSrc: (isApt && !plot) ? 'observed' : lr.src, landN: lr.n,
    missing: missing, hasBuilding: !isLand && built > 0,
    ageMonths: monthsSince(C.herijkt.land),
    methodGap: opts.methodGap
  });

  var step = mid >= 200000 ? 5000 : mid >= 50000 ? 1000 : 500;
  var rnd = function (v) { return Math.round(v / step) * step; };

  return {
    ok: true,
    mid: Math.round(mid),
    low: rnd(mid * (1 - conf.band)),
    high: rnd(mid * (1 + conf.band * 1.25)),   /* opwaarts iets ruimer: vraagprijzen kennen geen plafond */
    land: Math.round(landValue),
    build: Math.round(buildValue),
    rebuild: Math.round(rebuild),
    landRate: landRateAdj, landRateSrc: lr,
    buildUnit: unitCost,
    landPts: landPts.pts,
    rent: { local: Math.round(rentLocal), expat: Math.round(rentExpat), grossYield: y },
    portal: portalLevel(areaKey, plot, built, isLand),
    confidence: conf,
    lines: lines
  };
}

root.MK_VAL = { value: value, landRate: landRate, matchArea: matchArea,
                effLand: effLand, effBuilt: effBuilt, confidence: confidence };

})(typeof window !== 'undefined' ? window : globalThis);
