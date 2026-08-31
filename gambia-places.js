// Comprehensive list of places in The Gambia
// Format: [name, region, lat, lng]
// Regions: Banjul, Kanifing, West Coast, North Bank, Lower River, Central River, Upper River
//
// PLAATSCONTROLE 30-08-2026: alle coordinaten gecontroleerd tegen OpenStreetMap
// (1.300+ plaatsen, nodes+ways via Overpass) en GeoNames (cities500); 75 regels
// gecorrigeerd, 31 regels zonder bron gemarkeerd met "niet onderbouwd".
// Details en bewijs per plaats: plaatscontrole-rapport 30-08-2026 (zie CLAUDE.md).
// Deze lijst is de ENIGE bron; GM_AREAS en AREA_COORDS in app.js worden
// hieruit gegenereerd gehouden (zelfde waarden) - niet los aanpassen.
//
// 30-08-2026 (2e ronde): de eigenaarslijst met de 31 niet-onderbouwde plaatsen
// is verwerkt: 15 punten/ankers aangeleverd of gekozen door de eigenaar,
// 2 namen gecorrigeerd (Kaiaf Niji -> Konti Kunda Niji, Basse Nding -> Banjul
// Nding), Bani en Bantanto verwijderd (keuze eigenaar), 12 bewust gehandhaafd
// zonder gazetteer-bron.
const GAMBIA_PLACES = [
  // ── Banjul LGA ──
  ['Banjul','Banjul',13.4554,-16.5757],

  // ── Kanifing LGA (Greater Banjul) ──
  ['Serrekunda','Kanifing',13.4388,-16.6748],
  ['Serekunda','Kanifing',13.4388,-16.6748],
  ['Bakau','Kanifing',13.4775,-16.6779],
  ['Fajara','Kanifing',13.469,-16.6914],
  ['Cape Point','Kanifing',13.4849,-16.6661],
  ['Kotu','Kanifing',13.4553,-16.7034],
  ['Kololi','West Coast',13.4404,-16.7156],
  ['Senegambia','West Coast',13.4431,-16.7198],
  ['Kanifing','Kanifing',13.4538,-16.6748],
  ['Faji Kunda','Kanifing',13.41778,-16.66667],
  ['Talinding','Kanifing',13.42558,-16.67261],
  ['Bundung','Kanifing',13.4251,-16.6774],
  ['Latri Kunda','Kanifing',13.4113,-16.674],  // = Latrikunda Sabiji (OSM-way), keuze eigenaar 30-08-2026
  ['Pipeline','Kanifing',13.463,-16.6841],
  ['Bakoteh','Kanifing',13.4334,-16.6985],
  ['Tabokoto','Kanifing',13.4066,-16.6658],
  ['New Jeshwang','Kanifing',13.4429,-16.6706],
  ['Old Jeshwang','Kanifing',13.4533,-16.6612],
  ['Dippa Kunda','Kanifing',13.4383,-16.6884],
  ['Ebou Town','Kanifing',13.4366,-16.668],
  ['Abuko','West Coast',13.4042,-16.6558],
  ['Churchills Town','Kanifing',13.4412,-16.6839],  // eigenaar 30-08-2026
  ['Sinchu Alagie','West Coast',13.37808,-16.68374],
  ['Ebo Town','Kanifing',13.4366,-16.668],
  ['Manjai Kunda','Kanifing',13.4422,-16.6981],
  ['Tallinding Kunjang','Kanifing',13.4259,-16.6722],

  // ── Brikama LGA (West Coast) ──
  ['Brikama','West Coast',13.2744,-16.6454],
  ['Bijilo','West Coast',13.4219,-16.7328],
  ['Brufut','West Coast',13.3813,-16.7517],
  ['Brusubi','West Coast',13.4073,-16.7306],
  ['Sukuta','West Coast',13.4148,-16.7076],
  ['Lamin','West Coast',13.3874,-16.6439],
  ['Sanyang','West Coast',13.2676,-16.7584],
  ['Kartong','West Coast',13.0913,-16.7597],
  ['Tanji','West Coast',13.3586,-16.7975],
  ['Batokunku','West Coast',13.3268,-16.7991],
  ['Gunjur','West Coast',13.176,-16.7599],
  ['Sambuya','West Coast',13.2092,-16.7575],  // eigenaar 30-08-2026
  ['Brufut Heights','West Coast',13.4,-16.759],  // eigenaar gehandhaafd 30-08-2026, geen gazetteer-bron
  ['Nema Kunku','West Coast',13.40461,-16.68401],
  ['Yundum','West Coast',13.3422,-16.6697],
  ['Banjulunding','West Coast',13.3765,-16.6531],
  ['Busumbala','West Coast',13.3334,-16.6667],
  ['Bwiam','West Coast',13.23528,-16.08639],
  ['Sibanor','West Coast',13.2059,-16.1935],
  ['Kafuta','West Coast',13.2014,-16.466],
  ['Somita','West Coast',13.20583,-16.30556],
  ['Marakissa','West Coast',13.2126,-16.6483],
  ['Pirang','West Coast',13.2725,-16.5353],
  ['Faraba Banta','West Coast',13.2667,-16.5167],
  ['Nyambai','West Coast',13.2794,-16.6541],
  ['Jambur','West Coast',13.3146,-16.7008],
  ['Tujereng','West Coast',13.3179,-16.7889],
  ['Ghana Town','West Coast',13.38444,-16.77111],
  ['Wellingara','West Coast',13.404,-16.674],
  ['Jabang','West Coast',13.3619,-16.7023],
  ['Sifoe','West Coast',13.18361,-16.6975],
  ['Old Yundum','West Coast',13.3625,-16.68611],
  ['Sinchu Baliya','West Coast',13.3966,-16.6744],  // eigenaar 30-08-2026
  ['Berending (Kombo)','West Coast',13.1402,-16.743],
  ['Kitty','West Coast',13.2279,-16.668],
  ['Mandinaba','West Coast',13.2804,-16.5899],
  ['Bonto','West Coast',13.2884,-16.5556],
  ['Darsilami','West Coast',13.1769,-16.6567],
  ['Mandina Ba','West Coast',13.2804,-16.5899],
  ['Kembujeh','West Coast',13.2844,-16.6055],  // OSM+GeoNames "Kaimbujae Nding", bevestigd eigenaar 30-08-2026
  ['Kerr Serign','West Coast',13.4325,-16.7203],
  ['Salagi','West Coast',13.393,-16.71],  // eigenaar 30-08-2026
  ['Farato','West Coast',13.3152,-16.6632],
  ['Mamuda','West Coast',13.3032,-16.7328],  // eigenaar gehandhaafd 30-08-2026, geen gazetteer-bron
  ['Latriya','West Coast',13.3,-16.711],  // eigenaar gehandhaafd 30-08-2026, geen gazetteer-bron
  ['Madiana','West Coast',13.3533,-16.7631],
  ['Tintinto','West Coast',13.29556,-16.78861],  // 31-08-2026: GeoNames 2411768 + census 2013 (Kombo South, 218 inw.). NIET de OSM-node op 13.3753,-16.73385 — die staat in Kombo North, is in 2017 uit luchtfoto's gezet en komt in geen gazetteer of census voor.
  ['Tranquil','West Coast',13.40306,-16.73806],  // 31-08-2026: GeoNames 2411757, daar gespeld "Trankill"; zo staat het ook in de census 2013 (Kombo North, 1.990 inw.). OSM-node "Tranquil" ligt 430 m noordelijker. Niet verwarren met GeoNames 2411756 "Tranquil" bij Darsilami (13.16917,-16.65861).
  ['Berefet','West Coast',13.2439,-16.3799],
  ['Bondali','West Coast',13.2347,-15.9142],
  ['Bakindick','North Bank',13.4554,-16.4514],
  ['Bambali','Lower River',13.4765,-15.3349],
  ['Bulok','West Coast',13.1767,-16.4158],
  ['Brifu','Upper River',13.5073,-13.9352],

  // ── Kerewan LGA (North Bank) ──
  ['Farafenni','North Bank',13.5721,-15.598],
  ['Barra','North Bank',13.4855,-16.543],
  ['Essau','North Bank',13.4858,-16.5262],
  ['Kerewan','North Bank',13.4936,-16.0891],
  ['Selikene','North Bank',13.48333,-15.96667],
  ['Albreda','North Bank',13.3345,-16.386],
  ['Juffureh','North Bank',13.33861,-16.3825],
  ['Illiassa','North Bank',13.5644,-15.7493],
  ['Sabach Sanjal','North Bank',13.5968,-15.444],  // anker Ngayen Sanjal (OSM), keuze eigenaar 30-08-2026
  ['Njau','Central River',13.7474,-15.2109],
  ['Brikama Ba','Central River',13.5376,-14.9275],
  ['Kuntair','North Bank',13.5344,-16.2224],
  ['No Kunda','North Bank',13.56667,-15.83333],
  ['Medina Serign Mass','North Bank',13.4913,-16.4105],
  ['Berending (Niumi)','North Bank',13.4909,-16.4613],

  // ── Mansakonko LGA (Lower River) ──
  ['Soma','Lower River',13.4446,-15.5355],
  ['Pakalinding','Lower River',13.4634,-15.5517],
  ['Mansa Konko','Lower River',13.4585,-15.534],
  ['Keneba','Lower River',13.32889,-16.015],
  ['Kwinella','Lower River',13.4,-15.8],
  ['Bureng','Lower River',13.41667,-15.28333],
  ['Jattaba','Lower River',13.2744,-15.827],
  ['Sankuia','Lower River',13.46667,-15.51667],
  ['Baro Kunda','Lower River',13.48333,-15.26667],
  ['Genieri','Lower River',13.4142,-15.6181],
  ['Karantaba','Lower River',13.43333,-15.51667],
  ['Jali','Lower River',13.35,-15.9667],
  ['Japineh','Lower River',13.423,-15.4212],
  ['Kaiaf','Lower River',13.4092,-15.6082],

  // ── Kuntaur LGA (Central River North) ──
  ['Kuntaur','Central River',13.6709,-14.8898],
  ['Kaur','Central River',13.7,-15.333],
  ['Wassu','Central River',13.69094,-14.87884],
  ['Brikama Ba (CRR)','Central River',13.5376,-14.9275],
  ['Njau (CRR)','Central River',13.7474,-15.2109],

  // ── Janjanbureh LGA (Central River South) ──
  ['Janjanbureh','Central River',13.5391,-14.7612],
  ['Bansang','Central River',13.4358,-14.6588],
  ['Kudang','Central River',13.6621,-15.0602],
  ['Brikamaba','Central River',13.5376,-14.9275],

  // ── Basse LGA (Upper River) ──
  ['Basse Santa Su','Upper River',13.31,-14.215],
  ['Basse','Upper River',13.31,-14.215],
  ['Gambissara','Upper River',13.2383,-14.3108],
  ['Garowol','Upper River',13.41667,-13.95],
  ['Sabi','Upper River',13.23333,-14.2],
  ['Baja Kunda','Upper River',13.46667,-14.05],
  ['Koina','Upper River',13.48333,-13.86667],
  ['Kulari','Upper River',13.4,-14.08333],
  ['Allunhari','Upper River',13.3167,-14.25],
  ['Fatoto','Upper River',13.3992,-13.891],
  ['Sudowol','Upper River',13.36667,-13.96667],
  ['Sandu','Upper River',13.3833,-14.4],  // anker hoofdplaats Diabugu (GeoNames), keuze eigenaar 30-08-2026
  ['Wuli','Upper River',13.4714,-14.0509],  // anker Baja Kunda (OSM), keuze eigenaar 30-08-2026
  ['Kantora','Upper River',13.3992,-13.891],  // anker Fatoto (OSM), keuze eigenaar 30-08-2026

  // ── Additional villages ──
  ['Badarri','Upper River',13.3414,-14.0956],
  ['Bakadaji','Upper River',13.3,-14.38333],
  ['Banni','Lower River',13.35,-15.58],  // eigenaar gehandhaafd 30-08-2026, geen gazetteer-bron
  ['Bantango Koto','Central River',13.55,-14.72],  // eigenaar gehandhaafd 30-08-2026, geen gazetteer-bron
  ['Bantunding','Upper River',13.4755,-14.0852],
  ['Banyakang','Central River',13.54,-14.65],  // eigenaar gehandhaafd 30-08-2026, geen gazetteer-bron
  ['Barajally','Central River',13.5852,-14.9461],
  ['Barrow Kunda','Upper River',13.4882,-14.1173],
  ['Barry Nabeh','West Coast',13.23,-16.45],  // eigenaar gehandhaafd 30-08-2026, geen gazetteer-bron
  ['Banjul Nding','West Coast',13.37333,-16.65722],  // GeoNames "Banjul NDing"; naam gecorrigeerd 30-08-2026 (was Basse Nding)
  ['Besang Dugu','Central River',13.52,-14.71],  // eigenaar gehandhaafd 30-08-2026, geen gazetteer-bron
  ['Bohum Kunda','Upper River',13.5556,-13.9506],
  ['Boro Dampha Kunda','Central River',13.53,-14.7],  // eigenaar gehandhaafd 30-08-2026, geen gazetteer-bron
  ['Boro Kanda Kassy','Upper River',13.4227,-14.0286],
  ['Busura Alieu','Upper River',13.3,-14.52],  // eigenaar gehandhaafd 30-08-2026, geen gazetteer-bron
  ['Jumangsarr','North Bank',13.5455,-15.7522],
  ['Jajari','North Bank',13.5762,-15.746],
  ['Bakindick Mandinka','North Bank',13.4554,-16.4514],
  ['Boro Modi Bane','Upper River',13.439,-14.0311],

  // ── Additional places (batch 2) ──
  ['Kuloro','West Coast',13.2806,-16.5781],
  ['Giboro Koto','West Coast',13.1761,-16.5752],
  ['Sotokoi','West Coast',13.2262,-16.5033],
  ['Faraba Sutu','West Coast',13.2044,-16.4824],
  ['Bessi Nding','West Coast',13.3,-16.5833],  // eigenaar gehandhaafd 30-08-2026, geen gazetteer-bron
  ['Tunjina','West Coast',13.2833,-16.5667],  // eigenaar gehandhaafd 30-08-2026, geen gazetteer-bron
  ['Folonko','West Coast',13.0908,-16.7617],  // eigenaar 30-08-2026, bij Kartong
  ['Jambanjelly','West Coast',13.2806,-16.7276],
  ['Kabafita','West Coast',13.275,-16.663],  // eigenaar 30-08-2026, bij Kabafita Forest Park
  ['Kalagi','West Coast',13.2466,-15.8379],
  ['Kansala','West Coast',13.2412,-16.1215],
  ['Bintang','West Coast',13.2508,-16.212],
  ['Kanilai','West Coast',13.1699,-16.0097],
  ['Sintet','West Coast',13.2398,-15.8129],
  ['Njaba Kunda','North Bank',13.5547,-15.9131],
  ['Medina Serigne Mass','North Bank',13.4913,-16.4105],
  ['Katchang','North Bank',13.5,-15.75],
  ['Jappineh','Lower River',13.423,-15.4212],
  ['Jareng','Central River',13.6223,-15.1911],
  ['Kunting','Central River',13.5275,-14.6697],
  ['Niani Sukuta','Central River',13.617,-14.9231],
  ['Sambang','Central River',13.5412,-15.3311],
  ['Demba Kunda','Upper River',13.25,-14.2667],
  ['Sutukoba','Upper River',13.4977,-14.0162],
  ['Diabugu','Upper River',13.3833,-14.4],
  ['Chamoi','Upper River',13.3189,-14.1657],  // OSM (Kantora), keuze eigenaar 30-08-2026

  // ── Additional important places (batch 3) ──
  ['Konti Kunda Niji','North Bank',13.56667,-15.78333],  // GeoNames; naam gecorrigeerd 30-08-2026 (was Kaiaf Niji)
  ['Fass','North Bank',13.5641,-16.4261],
  ['Jiffarong','Lower River',13.3008,-15.868],
  ['Dankunku','Central River',13.5693,-15.3252],
  ['Nianija','Central River',13.7833,-14.9333],  // anker Kass Wollof (GeoNames), keuze eigenaar 30-08-2026
  ['Basse Mansajang','Upper River',13.2959,-14.2095],
  ['Numuyel','Upper River',13.2759,-14.2946],
  ['Konteh Kunda','North Bank',13.5663,-15.7929],  // OSM "Konteh Kunda Niggi" (Baddibu), keuze eigenaar 30-08-2026
];

// Build a lookup map: name (lowercase) → {name, region, lat, lng}
const GAMBIA_PLACES_MAP = {};
GAMBIA_PLACES.forEach(([n,r,lat,lng]) => {
  GAMBIA_PLACES_MAP[n.toLowerCase()] = {name:n, region:r, lat, lng};
});
