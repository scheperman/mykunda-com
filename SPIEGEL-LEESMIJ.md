# Deze map is de bron — geen spiegel meer

**Vervangt de oude `SPIEGEL-LEESMIJ.md` (25-08-2026).** Die tekst beschreef de
omgekeerde situatie en is niet meer waar.

## Wat er veranderd is

Tot 25 augustus 2026 was deze map een **kopie** van het Claude Design-project van
`edwinscheperman@gmail.com`. Sindsdien is de ontwikkeling verhuisd naar
`admin@mykunda.com` en heeft **deze git-repo de rol van bron overgenomen**.

Deze map is dus geen spiegel: hier wordt gewerkt. Zie `CLAUDE.md` voor de leverroute.

## Draai `spiegel-bijwerken.mjs` niet meer

Dat script staat in de map hierboven en **leegt deze map** voordat het een
Design-export uitpakt. Er komen geen exports meer. Draaien betekent nu alleen: werk
kwijtraken, in één keer, zonder waarschuwing.

Verwijder het script of hernoem het naar `spiegel-bijwerken.mjs.NIET-DRAAIEN` zodra je
er toch bij bent.

## Wat wel klopte en blijft gelden

Uploaden is eenrichtingsverkeer. Een upload overschrijft het serverbestand ongeacht de
datum, en er komt nooit iets van de server terug. Op de live server wordt daarom
**nooit** rechtstreeks een bestand aangepast — niet met de bestandsbeheerder van de
host, niet in een online editor, niet handmatig via FTP.

Is er tóch iets rechtstreeks op de server gewijzigd: eerst dat bestand hier verwerken,
pas daarna opnieuw uploaden.

## Ontwerpwerk in Claude Design

Visueel werk — nieuwe pagina's, componenten, huisstijl — kan in Claude Design onder
`admin@mykunda.com`. Wat daar ontstaat komt via deze map de site in, niet andersom.
Claude Design levert bestanden op en noemt waar ze in de root horen; plaatsen, bouwen,
uploaden en committen doe je hier.

## Wat niet in git zit

`uploads/`, `archief/`, `screenshots/` en `scraps/` — samen ruim 165 MB originele
foto's en oud materiaal. Verder blijven `deploy/`, `app.min.js` en `styles.min.css`
buiten de geschiedenis: die worden door `build.mjs` gegenereerd en zouden bij elke
build als volledig gewijzigd verschijnen. Op schijf staan ze er gewoon.

## Vergelijken

```
cd C:\Users\User\MyKunda\project
git status
git diff -I"\?v=[0-9]+"
```

Die `-I` laat de regels weg waarin alleen het build-stempel is opgeschoven. Zonder die
vlag zie je in élke pagina een wijziging en verdrinkt het echte nieuws erin.
