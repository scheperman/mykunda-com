# Configuratie die alleen in de database leeft

`market_sources.json` is een momentopname van de tabel `public.market_sources`
in project `jejaerpqltqryqzjvbjp`, vastgelegd op 25-08-2026.

**Dit bestand stuurt niets aan.** De crawler leest zijn configuratie uit de
database, niet hieruit. Dit is er zodat je kunt zien wát er stond en wanneer
het veranderde — precies wat er ontbrak toen de paginering stilzwijgend niet
werkte.

## Wat er in staat

Per bron: naam, host, URL, soort, betrouwbaarheidsgewicht, of hij actief is en
meetelt in de index, frequentie, adapter, de robots-controle, de
gebruiksvoorwaardennotitie, en het volledige `parse`-blok met de reguliere
expressies.

Wat er bewust **niet** in staat: `last_ok_at`, `last_error` en `created_at`.
Dat is looptijdstatus, geen configuratie.

## Bijwerken

Verander je iets aan een bron, werk dit bestand dan in dezelfde commit bij.
Doe je dat niet, dan is de momentopname erger dan geen momentopname: dan denk
je dat je weet wat er draait.

## Controleren of het nog klopt

Vraag Claude met de Supabase-connector om de vingerafdrukken te vergelijken.
Aan de databasekant:

```sql
select key,
  md5(concat_ws('|',
    coalesce(parse->>'item',''), coalesce(parse->'list'->>0,''),
    coalesce(parse->>'pages',''), coalesce(parse->'fields'->>'sqm',''),
    coalesce(parse->'fields'->>'url',''), coalesce(parse->'fields'->>'beds',''),
    coalesce(parse->'fields'->>'price',''), coalesce(parse->'fields'->>'title','')
  )) as parse_vinger
from public.market_sources order by key;
```

Het script dat dezelfde vingerafdruk uit dit bestand berekent staat in
`..\..\..\MyKunda\design-export\_werkscripts\_vingerafdruk.py`.

Let op bij het schrijven van zo'n controlequery: `case when kolom then 'a' else
'b' end` geeft bij een NULL de **else**-tak, niet NULL. Gebruik
`case when kolom is null then ... end` als NULL een eigen betekenis heeft.
Die fout kostte hier een vals alarm.

## Wijzigingen sinds de laatste snapshot

- 25-08-2026: bij `gamrealty` een `list` toegevoegd met `?paged={page}`.
  Zonder die plaatshouder negeerde de crawler de instelling `pages: 4` en
  haalde hij alleen de eerste resultatenpagina op. Opbrengst ging van 6 naar 11.
