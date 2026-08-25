# MyKunda-kaartstijlen

Twee eigen MapTiler-stijlen, opgebouwd uit de officiële v4-stijlen:

| bestand | wordt | vervangt in `app.js` |
| --- | --- | --- |
| `mykunda-streets.style.json` | **MyKunda Paper** — de kaartlaag | `MK_MAP.streets` (nu `streets-v4`) |
| `mykunda-hybrid.style.json` | **MyKunda Satellite** — de satellietlaag | `MK_MAP.satellite` (nu `hybrid-v4`) |

## Wat erin zit

**Engelse labels, met terugval.** Elk labelveld is omgezet naar
`coalesce(name:en, name)`. Heeft een plek geen Engelse naam — en dat komt in
Gambia vaak voor — dan blijft de lokale naam staan in plaats van dat het label
leeg valt. Dat laatste is precies wat er gebeurt als je in de Map Designer
"English" kiest zonder tweede naam.

**De kleuren uit `styles.css`.** `--map-land`, `--map-water`, `--map-park`,
`--map-road` en `--green-700` voor plaatsnamen. De omzetting houdt de
helderheid van de bronstijl vast en vervangt alleen kleurtoon en verzadiging;
daardoor blijft elke zoomtrap en elke wegenhiërarchie van MapTiler overeind.

**De Buildings-tileset.** De gebouwen uit Planet zijn eruit, die van de
Buildings-tileset erin — met `facade_color` waar die bekend is, een eigen rand,
en vanaf zoom 17 de naam van het pand. Op een woningsite is het gebouw het
onderwerp, niet de achtergrond. Op de satellietlaag alleen de omtrek, en pas
vanaf zoom 18: daaronder wordt het een waas over de luchtfoto.

## Opnieuw genereren

```
node maak-stijl.mjs streets-v4.style.json mykunda-streets.style.json
node maak-stijl.mjs hybrid-v4.style.json  mykunda-hybrid.style.json
```

De bronbestanden haal je op met:
`https://api.maptiler.com/maps/streets-v4/style.json?key=<sleutel>`
(met `Referer: https://mykunda.com/`, want de sleutel is domeingebonden).

**De sleutel staat in de bronregels van de stijl.** Roteer je de sleutel, dan
moet je de stijlen opnieuw genereren én opnieuw uploaden — anders wijst de
gepubliceerde stijl naar een sleutel die niet meer bestaat.

## Uploaden

1. [cloud.maptiler.com/maps/](https://cloud.maptiler.com/maps/) → de blauwe
   pijlknop rechtsboven → **Upload map**. Het formulier heeft vier velden:

   | veld | kaartlaag | satellietlaag |
   | --- | --- | --- |
   | Title | `MyKunda Paper` | `MyKunda Satellite` |
   | Description | *Kaartlaag mykunda.com — huisstijl, Engelse labels, Buildings* | *Satellietlaag mykunda.com — Engelse labels, gebouwomtrekken vanaf zoom 18* |
   | Label | `production` | `production` |
   | Rendering format | **WebP** | **WebP** |

   *Label* is niet meer dan een etiket (`production` / `test`) om je eigen
   kaarten uit elkaar te houden; het verandert niets aan het ID of aan de
   werking, en je kunt het later omzetten.

   *Rendering format* is de standaard waarin MapTiler de rastertegels van deze
   stijl klaarzet — een standaard, geen slot: alle drie de formaten blijven
   opvraagbaar. Houd hem toch gelijk aan `MK_MAP.satelliteFormat` en
   `MK_MAP.streetsFormat` in `app.js`, anders lees je later een verschil dat er
   niet is.

   **WebP voor allebei**, ook voor de luchtfoto. Dat gaat tegen de intuïtie in,
   want het bronbeeld is JPEG en WebP is dus een hercompressie. Gemeten boven
   Kololi, zoom 17 op @2x: 83 kB tegen 135 kB, PSNR 39 dB — naast elkaar gelegd
   geen zichtbaar verschil. Eenderde minder bytes weegt op 4G zwaarder.

   Dan het bestand erbij en **Create**. MapTiler controleert de stijl meteen en
   meldt het als er iets niet klopt.
2. Hetzelfde voor `mykunda-hybrid.style.json`.
3. Open elk van de twee en druk op **Save & Publish**. Zonder publiceren zijn
   ze niet via de Maps API te bereiken.
4. Noteer per stijl het ID (een UUID, zichtbaar bij **My maps**).
5. Die twee ID's in `app.js` zetten:

```js
window.MK_MAP = {
  key: '…',
  satellite: '<UUID van MyKunda Satellite>',
  streets:   '<UUID van MyKunda Paper>',
  …
```

6. `node build.mjs`, `deploy/` uploaden, Cloudflare leegmaken.

Verder niets: alle kaarten, de perceelfoto en de Static Maps volgen het ID.

## Twee dingen om te weten

**Publiceren werkt niet meteen door.** MapTiler geeft aan dat een wijziging tot
één à twee uur kan duren voordat hij overal doorkomt. Zie je na een aanpassing
nog de oude stijl, wacht dan even voordat je gaat zoeken.

**Bijstellen kan zonder deze bestanden.** Zodra de stijl in je account staat,
kun je hem in de Map Designer verder aanpassen — kleuren, lettergroottes, welke
labels bij welke zoom. Deze bestanden zijn het vertrekpunt, niet de enige weg
terug. Wil je de bijgestelde versie wél weer hier hebben: bij **My maps**, de
drie puntjes → **Download Style**.
