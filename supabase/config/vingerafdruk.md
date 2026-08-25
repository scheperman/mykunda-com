# Vingerafdruk van market_sources

Hoort bij `market_sources.json`. Als de database afwijkt van deze waarde, is de
snapshot verouderd.

**Peildatum:** 25 augustus 2026
**Bronnen:** 15
**Vingerafdruk:** `a0f911835c7f26555bc1281f2f963100`

## De query

```sql
select md5(string_agg(k, ';' order by k)) as totaal, count(*) as bronnen
from (
  select key || '|' ||
    md5(concat_ws('|',
      coalesce(parse->>'item',''), coalesce(parse->'list'->>0,''), coalesce(parse->>'pages',''),
      coalesce(parse->'fields'->>'sqm',''), coalesce(parse->'fields'->>'url',''),
      coalesce(parse->'fields'->>'beds',''), coalesce(parse->'fields'->>'price',''),
      coalesce(parse->'fields'->>'title',''))) || '|' ||
    md5(concat_ws('|',
      coalesce(name,''), coalesce(host,''), coalesce(url,''), coalesce(kind,''),
      coalesce(cadence,''), coalesce(adapter,''), coalesce(tos_note,''), coalesce(sort::text,''),
      case when active then 'true' else 'false' end,
      case when in_index then 'true' else 'false' end)) || '|' ||
    trust::text || '|' ||
    case when robots_ok is null then 'null' when robots_ok then 'true' else 'false' end as k
  from public.market_sources
) s;
```

Looptijdstatus (`last_ok_at`, `last_error`, `created_at`) zit er bewust niet in:
die verandert bij elke crawlrun en zou de vingerafdruk waardeloos maken.

## Als de waarde afwijkt

Iemand heeft de crawlerconfiguratie gewijzigd zonder `market_sources.json` bij
te werken. Herstel de koppeling zo:

1. haal de actuele configuratie op uit de tabel;
2. werk `market_sources.json` bij;
3. bereken de vingerafdruk opnieuw en zet hem hierboven;
4. noteer wat er veranderde onderaan `LEESMIJ.md`;
5. **werk ook de wekelijkse controletaak bij** — die draagt deze waarde in zijn
   opdracht mee, want een geplande taak begint zonder geheugen.

Stap 5 is de makkelijkste om te vergeten. Zonder die stap blijft de taak elke
week melden dat er iets afwijkt terwijl je het al hebt rechtgezet, en dan leer
je de melding negeren.
