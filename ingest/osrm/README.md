# OSRM-Fuß-Routing für die Campingplatz-↔-Ladepunkt-Verknüpfung

Für `build_links.py` (Auftrag C) — Luftlinie ist bei Campingplätzen
unbrauchbar (oft am Wasser, Fluss/Bahntrasse zwischen Platz und Ladepunkt
möglich), deshalb echte Gehstrecken über OSRM mit **Fuß-Profil** (nicht
Auto). Separat vom bestehenden Auto-Routing der App (öffentlicher
OSRM-Demo-Server, siehe `src/lib/providers/routing/osrm.ts`) — dieser
lokale Server dient ausschließlich der Datenschicht.

## Aufbau (einmalig pro Region)

Nutzt denselben Geofabrik-Extrakt wie die Campingplatz-Extraktion (siehe
[../osm/README.md](../osm/README.md)).

```bash
mkdir -p ingest/osrm/data
cp ingest/osm/data/nord-est-latest.osm.pbf ingest/osrm/data/

cd ingest/osrm
MSYS_NO_PATHCONV=1 docker run -t -v "$(pwd)/data:/data" osrm/osrm-backend \
    osrm-extract -p /opt/foot.lua /data/nord-est-latest.osm.pbf
MSYS_NO_PATHCONV=1 docker run -t -v "$(pwd)/data:/data" osrm/osrm-backend \
    osrm-partition /data/nord-est-latest.osrm
MSYS_NO_PATHCONV=1 docker run -t -v "$(pwd)/data:/data" osrm/osrm-backend \
    osrm-customize /data/nord-est-latest.osrm
```

`/opt/foot.lua` ist eines der Standard-Profile im offiziellen
`osrm/osrm-backend`-Image, kein eigenes Profil nötig.

## Server starten

```bash
MSYS_NO_PATHCONV=1 docker run -d --name charge2camp-osrm-foot -p 5001:5000 \
    -v "$(pwd)/data:/data" osrm/osrm-backend \
    osrm-routed --algorithm mld /data/nord-est-latest.osrm
```

Läuft dauerhaft im Hintergrund (Port 5001, um nicht mit einem eventuellen
Auto-Routing-OSRM auf 5000 zu kollidieren). Stoppen mit:

```bash
docker stop charge2camp-osrm-foot && docker rm charge2camp-osrm-foot
```

`build_links.py` erwartet den Server unter `http://localhost:5001`,
überschreibbar über `OSRM_FOOT_URL`.

## Test

```bash
curl "http://localhost:5001/table/v1/foot/11.68,43.98;11.69,43.99?annotations=distance,duration"
```
