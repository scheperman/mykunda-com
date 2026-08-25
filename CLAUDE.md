# Werkafspraken MyKunda

## Eén bron van waarheid
Dit project is de enige plek waar bestanden van mykunda.com worden gewijzigd.
Op de live server wordt **nooit** rechtstreeks een bestand aangepast — niet met de
bestandsbeheerder van de host, niet in een online editor, niet handmatig via FTP.

Elke wijziging loopt via deze route:

1. de aanpassing wordt hier in het project gemaakt (root = de actuele versie);
2. het bestand wordt gespiegeld naar `deploy/`, de complete uploadklare site;
3. Edwin uploadt het via FTP naar de webroot, met overschrijven aan.

## Waarom
Uploaden is eenrichtingsverkeer: een upload overschrijft het serverbestand ongeacht
de datum, en er komt nooit iets terug naar het project. Een correctie die alleen op
de server staat, gaat bij de eerstvolgende upload stil verloren.

## Gevolgen voor Claude
- Houd `deploy/` gelijk aan de root-bestanden na elke wijziging aan een sitebestand.
- Interne documenten (handleidingen, bouwplannen, prompts, e-mailvoorbeelden) horen
  **niet** in `deploy/`.
- Noem bij elke levering expliciet welke bestanden geüpload moeten worden.
- Is er tóch iets rechtstreeks op de server gewijzigd: eerst dat bestand in het
  project verwerken, pas daarna opnieuw uploaden.
