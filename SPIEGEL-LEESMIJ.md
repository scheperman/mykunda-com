# Lokale spiegel van het MyKunda-project

Deze map is een **kopie**, geen werkplek.

## De regel

Claude Design is de enige bron van waarheid — zie `CLAUDE.md` in deze map en de
werkafspraken. Uploaden is eenrichtingsverkeer: er komt nooit iets van de server
of van deze pc terug naar het project.

Dus: **wijzig hier niets en upload hier niets vandaan.** Doe je dat wel, dan
loopt de Claude Design-kopie weg van wat er live staat, en wordt jouw wijziging
bij de eerstvolgende levering stil overschreven.

Waar deze map wél voor is: teruglezen, doorzoeken, vergelijken, en zien wat er
tussen twee exports is veranderd.

## Bijwerken

1. Exporteer het project uit Claude Design; de zip komt in `Downloads`.
2. Draai:

   ```
   node C:\Users\User\MyKunda\spiegel-bijwerken.mjs "C:\Users\User\Downloads\MyKunda.com.zip"
   ```

   Dat leegt de projectmap en pakt de zip er opnieuw in uit. Het leegmaken is
   nodig: zonder dat blijft een bestand dat in Claude Design is verwijderd hier
   staan, en ziet git die verwijdering niet.

3. Kijk wat er veranderd is:

   ```
   cd C:\Users\User\MyKunda\project
   git status
   git diff -I"\?v=[0-9]+"
   ```

   Die `-I` laat de regels weg waarin alleen het build-stempel is opgeschoven.
   Zonder die vlag zie je in élke pagina een wijziging en verdrinkt het echte
   nieuws erin.

4. Leg de nieuwe stand vast:

   ```
   git add -A
   git commit -m "Spiegel: export <datum>"
   ```

## Wat er niet in zit

`uploads/`, `archief/`, `screenshots/` en `scraps/` worden niet meegespiegeld —
samen ruim 165 MB aan originele foto's en oud materiaal. Heb je daar iets van
nodig, haal het uit de export-zip zelf.

Buiten de git-geschiedenis blijven verder `deploy/`, `app.min.js` en
`styles.min.css`. Die worden door `build.mjs` gegenereerd uit de bron die hier
wél in staat, en zouden bij elke build als volledig gewijzigd verschijnen. Op
schijf staan ze er gewoon.

## Eerste commit

`Spiegel: export Claude Design 2026-08-23 17:53` — 477 bestanden.
