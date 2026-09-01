# Diffrapport blok "Lifestyle scores" — 2026-09-01

Benchmark: Senegambia — Affordability 14, Places to eat 100

Methode:
- **Affordability**: 100 × (ln(13333) − ln(prijs)) / (ln(13333) − ln(71)), met de vraagprijs voor grond per m² uit area-prices.json. Goedkoopste gemeten gebied 100, duurste 0.
- **Places to eat**: 100 × ln(1+n) / ln(1+95), met n = restaurants, cafés en bars binnen 2 km uit area-amenities.json. Geen ring waar n = 0: dat betekent niet gekarteerd.
- **removed**: Safety en Transport zijn verwijderd — geen bron, en elke score zou een eigen verzinsel zijn.

| gebied | was | wordt |
|---|---|---|
| **Bakau** | Affordability 32 · Safety 76 · Transport 82 · Dining 74 · Heritage 92 | Affordability 14 · Places to eat 72 · Heritage (geen getal) |
| **Bakoteh** | Affordability 46 · Safety 72 · Transport 84 · Dining 56 · Rental demand 88 | Affordability 33 · Places to eat 48 · Rental demand (geen getal) |
| **Banjul** | Affordability 40 · Safety 68 · Transport 80 · Dining 48 · Government & port 94 | Affordability 14 · Places to eat 54 · Government & port (geen getal) |
| **Bansang** | Affordability 88 · Safety 74 · Transport 36 · Dining 20 · Hospital 88 | Affordability 87 · Hospital (geen getal) |
| **Barra** | Affordability 77 · Safety 66 · Transport 44 · Dining 24 · Ferry gateway 88 | Affordability 71 · Ferry gateway (geen getal) |
| **Basse Santa Su** | Affordability 89 · Safety 72 · Transport 28 · Dining 24 · Regional market 92 | Affordability 81 · Places to eat 53 · Regional market (geen getal) |
| **Batokunku** | Affordability 49 · Safety 76 · Transport 46 · Dining 28 · Tranquillity 94 | Affordability 34 · Places to eat 15 · Tranquillity (geen getal) |
| **Bijilo** | Affordability 30 · Safety 87 · Transport 82 · Dining 84 · Green space 95 | Affordability 15 · Places to eat 59 · Green space (geen getal) |
| **Brikama** | Affordability 63 · Safety 72 · Transport 82 · Dining 44 · Craft heritage 94 | Affordability 48 · Places to eat 24 · Craft heritage (geen getal) |
| **Brufut** | Affordability 36 · Safety 82 · Transport 70 · Dining 58 · Growth 96 | Affordability 34 · Places to eat 24 · Growth (geen getal) |
| **Brusubi** | Affordability 39 · Safety 84 · Transport 78 · Dining 60 · New build quality 88 | Affordability 14 · Places to eat 65 · New build quality (geen getal) |
| **Busumbala** | Affordability 59 · Safety 74 · Transport 62 · Dining 32 · Plot size 92 | Affordability 33 · Places to eat 15 · Plot size (geen getal) |
| **Cape Point** | Affordability 22 · Safety 92 · Transport 72 · Dining 70 · Privacy 94 | Affordability 14 · Places to eat 48 · Privacy (geen getal) |
| **Essau** | Affordability 79 · Safety 70 · Transport 42 · Dining 22 · Senegal road 84 | Affordability 77 · Senegal road (geen getal) |
| **Fajara** | Affordability 27 · Safety 88 · Transport 84 · Dining 86 · Schools & clinics 94 | Affordability 0 · Places to eat 77 · Schools & clinics (geen getal) |
| **Farafenni** | Affordability 75 · Safety 70 · Transport 58 · Dining 30 · Cross-border trade 92 | Affordability 81 · Places to eat 35 · Cross-border trade (geen getal) |
| **Fatoto** | Affordability 94 · Safety 74 · Transport 18 · Dining 12 · Farmland 86 | Affordability 100 · Farmland (geen getal) |
| **Gambissara** | Affordability 90 · Safety 76 · Transport 26 · Dining 16 · Build standard 88 | Affordability 100 · Places to eat 24 · Build standard (geen getal) |
| **Gunjur** | Affordability 45 · Safety 74 · Transport 54 · Dining 38 · Nature reserve 90 | Affordability 57 · Places to eat 24 · Nature reserve (geen getal) |
| **Jabang** | Affordability 50 · Safety 74 · Transport 78 · Dining 36 · Growth 94 | Affordability 29 · Growth (geen getal) |
| **Janjanbureh** | Affordability 86 · Safety 76 · Transport 30 · Dining 22 · Heritage 90 | Affordability 77 · Places to eat 39 · Heritage (geen getal) |
| **Kartong** | Affordability 50 · Safety 76 · Transport 38 · Dining 30 · Eco-tourism 92 | Affordability 50 · Places to eat 24 · Eco-tourism (geen getal) |
| **Kerewan** | Affordability 84 · Safety 74 · Transport 34 · Dining 18 · Administration 82 | Affordability 81 · Places to eat 15 · Administration (geen getal) |
| **Kerr Serign** | Affordability 36 · Safety 90 · Transport 76 · Dining 62 · Quiet 88 | Affordability 14 · Places to eat 98 · Quiet (geen getal) |
| **Kololi** | Affordability 24 · Safety 82 · Transport 92 · Dining 90 · Beach access 97 | Affordability 14 · Places to eat 100 · Beach access (geen getal) |
| **Kotu** | Affordability 28 · Safety 84 · Transport 86 · Dining 82 · Birdlife 92 | Affordability 14 · Places to eat 89 · Birdlife (geen getal) |
| **Kuntaur** | Affordability 92 · Safety 76 · Transport 22 · Dining 14 · Wildlife 92 | Affordability 87 · Places to eat 24 · Wildlife (geen getal) |
| **Lamin** | Affordability 56 · Safety 76 · Transport 74 · Dining 40 · Creek setting 88 | Affordability 38 · Places to eat 15 · Creek setting (geen getal) |
| **Manjai Kunda** | Affordability 43 · Safety 76 · Transport 82 · Dining 58 · Walkability 84 | Affordability 33 · Places to eat 53 · Walkability (geen getal) |
| **Mansa Konko** | Affordability 85 · Safety 76 · Transport 52 · Dining 18 · Administration 82 | Affordability 87 · Places to eat 15 · Administration (geen getal) |
| **Nema Kunku** | Affordability 52 · Safety 70 · Transport 66 · Dining 38 · Plot turnover 92 | Affordability 33 · Places to eat 15 · Plot turnover (geen getal) |
| **Pipeline** | Affordability 31 · Safety 85 · Transport 80 · Dining 66 · Rental demand 90 | Affordability 33 · Places to eat 77 · Rental demand (geen getal) |
| **Sanyang** | Affordability 47 · Safety 71 · Transport 50 · Dining 40 · Beach 94 | Affordability 50 · Places to eat 15 · Beach (geen getal) |
| **Senegambia** | Affordability 23 · Safety 74 · Transport 96 · Dining 97 · Nightlife 95 | Affordability 14 · Places to eat 100 · Nightlife (geen getal) |
| **Serrekunda** | Affordability 52 · Safety 66 · Transport 90 · Dining 60 · Market & commerce 96 | Affordability 33 · Places to eat 43 · Market & commerce (geen getal) |
| **Sinchu Alagie** | Affordability 47 · Safety 80 · Transport 72 · Dining 44 · Build standard 86 | Affordability 33 · Build standard (geen getal) |
| **Soma** | Affordability 86 · Safety 72 · Transport 60 · Dining 26 · Crossroads 90 | Affordability 87 · Places to eat 24 · Crossroads (geen getal) |
| **Sukuta** | Affordability 48 · Safety 72 · Transport 80 · Dining 50 · Plot supply 86 | Affordability 33 · Places to eat 35 · Plot supply (geen getal) |
| **Tanji** | Affordability 49 · Safety 74 · Transport 56 · Dining 40 · Fish market 92 | Affordability 35 · Places to eat 30 · Fish market (geen getal) |
| **Tujereng** | Affordability 51 · Safety 76 · Transport 48 · Dining 26 · Tranquillity 92 | Affordability 34 · Places to eat 15 · Tranquillity (geen getal) |
| **Yundum** | Affordability 61 · Safety 72 · Transport 76 · Dining 34 · Airport access 96 | Affordability 38 · Places to eat 15 · Airport access (geen getal) |
