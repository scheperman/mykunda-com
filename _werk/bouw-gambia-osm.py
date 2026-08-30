#!/usr/bin/env python3
"""
bouw-gambia-osm.py — bouwt gambia-osm.json, het eigen straten- en plekkenregister.

WAAROM DIT BESTAAT
  Mapbox' geocoder kent Gambia op straatniveau niet. Gemeten op 30-08-2026, live
  op mykunda.com tegen de Geocoding v6 en de Search Box API, beide met country=gm:

      "Palma Rima Road"        -> 1 treffer: Paima, West Coast Division (45 km ernaast)
      "Kairaba Avenue"         -> 0 treffers
      "Bertil Harding Highway" -> 0 treffers
      "Coco Ocean"             -> 0 treffers
      "Senegambia Strip"       -> 0 treffers

  Een verkoper die op de List-pagina zijn eigen straat intikt, kreeg dus
  "not a recognised area" en een kaart die bleef staan. OpenStreetMap kent die
  namen wel, dus halen we ze daar eenmalig op en zetten ze op onze eigen server.
  Geen live afhankelijkheid van een dienst die vandaag gratis is, en het werkt
  ook als het netwerk hapert.

DRAAIEN (Linux/macOS, of Windows onder WSL — pyosmium is er niet voor kale Windows)
  pip install osmium
  curl -o gambia-latest.osm.pbf https://download.openstreetmap.fr/extracts/africa/gambia-latest.osm.pbf
  python3 bouw-gambia-osm.py gambia-latest.osm.pbf > ../gambia-osm.json

  Daarna `node build.mjs` draaien: gambia-osm.json staat in VERSIONED, dus de
  stempel verschuift en elke bezoeker haalt het nieuwe bestand op.

LICENTIE VAN DE DATA
  OpenStreetMap-bijdragers, ODbL 1.0. De site vermeldt OSM al in de
  kaartattributie; dit register valt onder dezelfde vermelding.
"""
import sys, json, collections, os, datetime
import osmium

POI_RULES = [
    ('tourism', {'hotel','guest_house','resort','apartment','hostel','motel','attraction','museum','camp_site'}),
    ('amenity', {'school','college','university','hospital','clinic','doctors','pharmacy','bank','fuel','marketplace',
                 'place_of_worship','restaurant','bar','cafe','police','fire_station','post_office','townhall',
                 'bus_station','ferry_terminal'}),
    ('shop',    {'supermarket','mall','department_store','hardware','doityourself'}),
    ('leisure', {'sports_centre','stadium','golf_course','marina'}),
    ('natural', {'beach'}),
    ('aeroway', {'aerodrome'}),
    ('office',  {'government','estate_agent'}),
    ('landuse', {'industrial'}),
]
# Kruispuntmeubilair draagt soms een naam en hoort niet in een adreslijst thuis.
HIGHWAY_SKIP = {'bus_stop','crossing','traffic_signals','street_lamp','turning_circle'}
PLACE_KINDS = {'city','town','village','hamlet','suburb','neighbourhood','quarter','locality','island'}
# Ruime doos om Gambia; het extract is al geknipt, dit vangt de randgevallen.
BOX = (12.9, 14.0, -17.2, -13.6)


class Harvest(osmium.SimpleHandler):
    def __init__(self):
        super().__init__()
        self.items = []

    def kind(self, t):
        if 'highway' in t and t['highway'] not in HIGHWAY_SKIP:
            return 'street'
        if t.get('place') in PLACE_KINDS:
            return 'place'
        for k, vs in POI_RULES:
            if t.get(k) in vs:
                return 'poi'
        return None

    def add(self, t, lat, lng):
        name = t.get('name')
        if not name:
            return
        k = self.kind(t)
        if not k:
            return
        if not (BOX[0] <= lat <= BOX[1] and BOX[2] <= lng <= BOX[3]):
            return
        self.items.append({'n': name.strip(), 'lat': round(lat, 5), 'lng': round(lng, 5), 'k': k})

    def node(self, n):
        if n.location.valid():
            self.add(dict(n.tags), n.location.lat, n.location.lon)

    def way(self, w):
        t = dict(w.tags)
        if 'name' not in t:
            return
        try:
            pts = [(nd.location.lat, nd.location.lon) for nd in w.nodes if nd.location.valid()]
        except Exception:
            return
        if not pts:
            return
        if t.get('highway'):
            # Het midden van de lijn, niet het begin: bij een straat van twee
            # kilometer is het begin een willekeurige hoek, het midden de straat.
            lat, lng = pts[len(pts) // 2]
        else:
            lat = sum(p[0] for p in pts) / len(pts)
            lng = sum(p[1] for p in pts) / len(pts)
        self.add(t, lat, lng)


def main(path):
    h = Harvest()
    h.apply_file(path, locations=True)

    # Eén naam kan uit tientallen stukken bestaan (een straat is in OSM geknipt bij
    # elk kruispunt). Stukken die bij elkaar liggen worden één regel; ligt dezelfde
    # naam ergens anders in het land, dan blijft dat een eigen regel.
    groups = collections.defaultdict(list)
    for i in h.items:
        groups[(i['n'].lower(), i['k'])].append(i)

    rows = []
    for (_, k), g in groups.items():
        tol = 0.06 if k == 'street' else 0.02      # ~6 km voor een straat, ~2 km voor de rest
        clusters = []
        for i in g:
            for c in clusters:
                if abs(c[0]['lat'] - i['lat']) < tol and abs(c[0]['lng'] - i['lng']) < tol:
                    c.append(i)
                    break
            else:
                clusters.append([i])
        for c in clusters:
            rows.append({
                'n': c[0]['n'],
                'lat': round(sum(x['lat'] for x in c) / len(c), 5),
                'lng': round(sum(x['lng'] for x in c) / len(c), 5),
                'k': k,
            })

    rows.sort(key=lambda r: r['n'].lower())
    kinds = ['street', 'place', 'poi']
    doc = {
        'format': 1,
        'source': 'OpenStreetMap contributors (ODbL 1.0) — %s, opgehaald %s'
                  % (os.path.basename(path), datetime.date.today().isoformat()),
        'kinds': kinds,
        'items': [[r['n'], r['lat'], r['lng'], kinds.index(r['k'])] for r in rows],
    }
    sys.stdout.write(json.dumps(doc, ensure_ascii=False, separators=(',', ':')))
    sys.stderr.write('%d namen (%s)\n' % (len(rows), dict(collections.Counter(r['k'] for r in rows))))


if __name__ == '__main__':
    if len(sys.argv) < 2:
        sys.exit('gebruik: bouw-gambia-osm.py <gambia-latest.osm.pbf>  > ../gambia-osm.json')
    main(sys.argv[1])
