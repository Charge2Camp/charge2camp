"""Bilder-Fetcher fuer Ladesaeulen (Auftrag "Ladesaeulen-Bilder", siehe
CLAUDE_CODE_AUFTRAG_LADESAEULEN_BILDER.md).

Befuellt core.charge_point_image aus zwei Quellen, in dieser Prioritaet:

  A) Wikimedia Commons -- ueber OSM-Tags `image=*` / `wikimedia_commons=File:*`
     auf Knoten/Wegen in der Naehe der Ladesaeule, aufgeloest ueber die
     Commons-API (Lizenz/Urheber aus extmetadata). Hoechste Konfidenz (85),
     da das Bild mit hoher Wahrscheinlichkeit tatsaechlich das Objekt zeigt.

  B) Mapillary Graph API -- Street-Level-Fotos im ~30 m-Umkreis, nach
     Blickrichtung gefiltert (nur Bilder, deren Kamera auch zur Ladesaeule
     zeigt). Konfidenz 60, max. 3 Bilder pro Ladesaeule.

ABWEICHUNG vom Auftragsdokument (nur Quelle A betroffen): Ladesaeulen in
diesem Projekt kommen ausschliesslich aus Open Charge Map
(raw.charge_point mit source='ocm', siehe import_ocm.py) -- es gibt kein
gespeichertes raw.osm_* fuer Ladesaeulen (nur fuer Campingplaetze, siehe
import_osm_campsites.py), aus dem sich `image=`/`wikimedia_commons=`-Tags
lesen liessen. Diese Tags werden deshalb LIVE per Overpass-API
(https://overpass-api.de/api/interpreter) im ~30 m-Umkreis jeder Ladesaeule
abgefragt statt aus einer lokalen Tabelle -- Ergebnis und Lizenzpruefung
ueber die Commons-API entsprechen danach exakt dem Auftrag.

enrich.* wird von diesem Skript nie gelesen (ausser fuer den
Immutability-Test) und nie geschrieben -- siehe enrich.charge_point_image_override,
das ausschliesslich manuell/ueber ein spaeteres Admin-Tool befuellt wird.

CLI:
    python fetch_charge_point_images.py --bbox <west,south,east,north> \\
        [--limit N] [--source commons|mapillary|all] [--dry-run] \\
        [--refresh-older-than 90d]

Env:
    DATABASE_URL              siehe common.py (Default: lokale Supabase-DB)
    MAPILLARY_ACCESS_TOKEN    erforderlich fuer --source mapillary/all,
                               niemals im Repo, nur als Env-Var
"""

from __future__ import annotations

import argparse
import math
import re
import time
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from html import unescape
from typing import Any, Iterable

import requests
from psycopg2.extras import RealDictCursor

from common import get_connection, import_run, setup_logging

OVERPASS_URL = "https://overpass-api.de/api/interpreter"
COMMONS_API_URL = "https://commons.wikimedia.org/w/api.php"
MAPILLARY_IMAGES_URL = "https://graph.mapillary.com/images"

USER_AGENT = "charge2camp-image-fetcher/1.0 (https://charge2camp.vercel.app)"

OSM_IMAGE_SEARCH_RADIUS_M = 30
MAPILLARY_SEARCH_RADIUS_M = 30
MAPILLARY_MAX_BEARING_DELTA_DEG = 50
MAPILLARY_MAX_IMAGES = 3

RATE_LIMIT_REQUESTS_PER_SECOND = 5
MAX_RETRIES = 3

CONFIDENCE_COMMONS = 85
CONFIDENCE_MAPILLARY = 60

CC_BY_SA_4_URL = "https://creativecommons.org/licenses/by-sa/4.0/"


# ---------------------------------------------------------------------------
# Geo-Hilfsfunktionen
# ---------------------------------------------------------------------------

def haversine_m(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    r = 6_371_000.0
    phi1, phi2 = math.radians(lat1), math.radians(lat2)
    dphi = math.radians(lat2 - lat1)
    dlambda = math.radians(lon2 - lon1)
    a = math.sin(dphi / 2) ** 2 + math.cos(phi1) * math.cos(phi2) * math.sin(dlambda / 2) ** 2
    return 2 * r * math.asin(math.sqrt(a))


def bearing_deg(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """Initialer Kurswinkel (0-360, 0=Nord) von Punkt 1 zu Punkt 2."""
    phi1, phi2 = math.radians(lat1), math.radians(lat2)
    dlambda = math.radians(lon2 - lon1)
    x = math.sin(dlambda) * math.cos(phi2)
    y = math.cos(phi1) * math.sin(phi2) - math.sin(phi1) * math.cos(phi2) * math.cos(dlambda)
    theta = math.atan2(x, y)
    return (math.degrees(theta) + 360) % 360


def angle_delta_deg(a: float, b: float) -> float:
    d = abs(a - b) % 360
    return d if d <= 180 else 360 - d


def meters_to_bbox(lat: float, lon: float, radius_m: float) -> tuple[float, float, float, float]:
    """(west, south, east, north) -- Box mit `radius_m` um (lat, lon)."""
    lat_delta = radius_m / 111_320
    lon_delta = radius_m / (111_320 * max(math.cos(math.radians(lat)), 0.01))
    return (lon - lon_delta, lat - lat_delta, lon + lon_delta, lat + lat_delta)


# ---------------------------------------------------------------------------
# Rate-Limiting + Retry (gemeinsam fuer alle drei APIs, siehe Auftrag §4)
# ---------------------------------------------------------------------------

class RateLimiter:
    def __init__(self, requests_per_second: float) -> None:
        self._min_interval = 1.0 / requests_per_second
        self._last_call: float | None = None

    def wait(self) -> None:
        now = time.monotonic()
        if self._last_call is not None:
            elapsed = now - self._last_call
            remaining = self._min_interval - elapsed
            if remaining > 0:
                time.sleep(remaining)
        self._last_call = time.monotonic()


_rate_limiter = RateLimiter(RATE_LIMIT_REQUESTS_PER_SECOND)


def http_get(url: str, *, params: dict | None = None, headers: dict | None = None, log) -> requests.Response | None:
    """GET mit gemeinsamem Rate-Limit + Exponential-Backoff-Retry (Auftrag
    §4: max. 5 req/s, Backoff bei 429, 3 Versuche). Gibt None zurueck, wenn
    alle Versuche fehlschlagen -- der Aufrufer behandelt das als "kein
    Treffer", das Skript bricht dafuer nicht komplett ab."""
    all_headers = {"User-Agent": USER_AGENT, **(headers or {})}
    for attempt in range(1, MAX_RETRIES + 1):
        _rate_limiter.wait()
        try:
            res = requests.get(url, params=params, headers=all_headers, timeout=20)
        except requests.RequestException as exc:
            log.warning("HTTP-Fehler (Versuch %d/%d) bei %s: %s", attempt, MAX_RETRIES, url, exc)
            time.sleep(2 ** attempt)
            continue

        if res.status_code == 429:
            retry_after = float(res.headers.get("Retry-After", 2 ** attempt))
            log.warning("HTTP 429 von %s -- warte %.1fs (Versuch %d/%d)", url, retry_after, attempt, MAX_RETRIES)
            time.sleep(retry_after)
            continue
        if res.status_code >= 500:
            log.warning("HTTP %d von %s (Versuch %d/%d)", res.status_code, url, attempt, MAX_RETRIES)
            time.sleep(2 ** attempt)
            continue
        if not res.ok:
            log.info("HTTP %d von %s -- kein Retry (kein 429/5xx)", res.status_code, url)
            return None
        return res

    log.warning("Alle %d Versuche fehlgeschlagen fuer %s", MAX_RETRIES, url)
    return None


# ---------------------------------------------------------------------------
# Datenmodell fuer eine gefundene, aufloesbare Bildkandidatin
# ---------------------------------------------------------------------------

@dataclass
class ImageCandidate:
    source: str  # 'wikimedia_commons' | 'mapillary'
    source_id: str
    url_full: str
    url_thumb: str
    width: int | None
    height: int | None
    captured_at: datetime | None
    distance_m: float | None
    bearing_delta: float | None
    license: str
    license_url: str | None
    attribution: str
    confidence: int
    sort_order: int


# ---------------------------------------------------------------------------
# Quelle A: Wikimedia Commons ueber OSM-Tags (live per Overpass, s. o.)
# ---------------------------------------------------------------------------

def _strip_html(value: str | None) -> str:
    if not value:
        return ""
    return unescape(re.sub(r"<[^>]+>", "", value)).strip()


def find_osm_image_tags(lat: float, lon: float, log) -> list[dict[str, Any]]:
    """Sucht Knoten/Wege im OSM_IMAGE_SEARCH_RADIUS_M-Umkreis mit `image`-
    oder `wikimedia_commons`-Tag. Gibt eine Liste roher OSM-Elemente
    (inkl. tags + center/lat/lon) zurueck."""
    query = f"""
    [out:json][timeout:25];
    (
      node(around:{OSM_IMAGE_SEARCH_RADIUS_M},{lat},{lon})["image"];
      node(around:{OSM_IMAGE_SEARCH_RADIUS_M},{lat},{lon})["wikimedia_commons"];
      way(around:{OSM_IMAGE_SEARCH_RADIUS_M},{lat},{lon})["image"];
      way(around:{OSM_IMAGE_SEARCH_RADIUS_M},{lat},{lon})["wikimedia_commons"];
    );
    out tags center;
    """.strip()
    res = http_get(OVERPASS_URL, params={"data": query}, log=log)
    if res is None:
        return []
    try:
        return res.json().get("elements", [])
    except ValueError:
        log.warning("Overpass-Antwort war kein gueltiges JSON.")
        return []


def _file_title_from_tags(tags: dict[str, str]) -> str | None:
    """Extrahiert einen "File:<name>"-Titel aus `wikimedia_commons` (falls
    im richtigen Format) oder `image` (falls es sich um eine Commons-
    File-Referenz statt einer externen URL handelt) -- externe Bild-URLs
    in `image=*`, die nicht auf Commons liegen, werden bewusst NICHT
    uebernommen (Auftrag verlangt nur lizenzkonforme Commons-Quellen)."""
    wc = tags.get("wikimedia_commons", "").strip()
    if wc.startswith("File:"):
        return wc
    img = tags.get("image", "").strip()
    if img.startswith("File:"):
        return img
    if "commons.wikimedia.org/wiki/File:" in img:
        return "File:" + img.split("File:", 1)[1]
    return None


def resolve_commons_file(file_title: str, log) -> dict[str, Any] | None:
    """Loest einen "File:<name>"-Titel ueber die Commons-API auf --
    zwingend LicenseShortName/Artist/LicenseUrl aus extmetadata (Auftrag
    §2, Quelle A)."""
    res = http_get(
        COMMONS_API_URL,
        params={
            "action": "query",
            "titles": file_title,
            "prop": "imageinfo",
            "iiprop": "url|extmetadata|size",
            "iiurlwidth": 1024,
            "format": "json",
        },
        log=log,
    )
    if res is None:
        return None
    try:
        pages = res.json()["query"]["pages"]
    except (ValueError, KeyError):
        log.warning("Unerwartete Commons-Antwort fuer %s.", file_title)
        return None

    page = next(iter(pages.values()), None)
    if not page or "imageinfo" not in page:
        log.info("Commons-Datei nicht gefunden/kein imageinfo: %s", file_title)
        return None

    info = page["imageinfo"][0]
    meta = info.get("extmetadata", {})
    license_short = meta.get("LicenseShortName", {}).get("value")
    license_url = meta.get("LicenseUrl", {}).get("value")
    artist = _strip_html(meta.get("Artist", {}).get("value"))

    if not license_short or not artist:
        log.info("Commons-Datei ohne vollstaendige Lizenzangaben verworfen: %s", file_title)
        return None

    return {
        "url_full": info.get("url"),
        "url_thumb": info.get("thumburl") or info.get("url"),
        "width": info.get("thumbwidth") or info.get("width"),
        "height": info.get("thumbheight") or info.get("height"),
        "license": license_short,
        "license_url": license_url,
        "attribution": artist,
    }


def fetch_commons_candidates(lat: float, lon: float, log) -> list[ImageCandidate]:
    elements = find_osm_image_tags(lat, lon, log)
    seen_titles: set[str] = set()
    candidates: list[tuple[float, dict[str, Any], str]] = []

    for el in elements:
        tags = el.get("tags", {})
        title = _file_title_from_tags(tags)
        if not title or title in seen_titles:
            continue
        seen_titles.add(title)
        el_lat = el.get("lat") or (el.get("center") or {}).get("lat")
        el_lon = el.get("lon") or (el.get("center") or {}).get("lon")
        distance_m = haversine_m(lat, lon, el_lat, el_lon) if el_lat and el_lon else None
        candidates.append((distance_m if distance_m is not None else 0.0, el, title))

    candidates.sort(key=lambda c: c[0])

    results: list[ImageCandidate] = []
    for order, (distance_m, _el, title) in enumerate(candidates):
        resolved = resolve_commons_file(title, log)
        if not resolved:
            continue
        results.append(
            ImageCandidate(
                source="wikimedia_commons",
                source_id=title,
                url_full=resolved["url_full"],
                url_thumb=resolved["url_thumb"],
                width=resolved["width"],
                height=resolved["height"],
                captured_at=None,
                distance_m=round(distance_m, 1) if distance_m else None,
                bearing_delta=None,
                license=resolved["license"],
                license_url=resolved["license_url"],
                attribution=resolved["attribution"],
                confidence=CONFIDENCE_COMMONS,
                sort_order=order,
            )
        )
    log.info("Commons: %d Tag-Treffer, %d aufgeloest fuer (%.5f, %.5f)", len(elements), len(results), lat, lon)
    return results


# ---------------------------------------------------------------------------
# Quelle B: Mapillary Graph API
# ---------------------------------------------------------------------------

def bearing_delta_to_station(img_lat: float, img_lon: float, compass_angle: float, station_lat: float, station_lon: float) -> float:
    """Winkeldifferenz zwischen der Blickrichtung der Kamera (compass_angle)
    und der Richtung von der Bildposition zur Ladesaeule -- 0 = Kamera
    zeigt exakt zur Ladesaeule, 180 = Kamera zeigt exakt weg. Eigene
    Funktion (statt inline in fetch_mapillary_candidates), damit der
    Bearing-Filter isoliert unit-testbar ist (Auftrag §7, Test 3)."""
    bearing_to_station = bearing_deg(img_lat, img_lon, station_lat, station_lon)
    return angle_delta_deg(compass_angle, bearing_to_station)


def is_within_bearing(
    img_lat: float,
    img_lon: float,
    compass_angle: float,
    station_lat: float,
    station_lon: float,
    max_delta: float = MAPILLARY_MAX_BEARING_DELTA_DEG,
) -> bool:
    return bearing_delta_to_station(img_lat, img_lon, compass_angle, station_lat, station_lon) <= max_delta


def fetch_mapillary_candidates(lat: float, lon: float, access_token: str, log) -> list[ImageCandidate]:
    west, south, east, north = meters_to_bbox(lat, lon, MAPILLARY_SEARCH_RADIUS_M)
    res = http_get(
        MAPILLARY_IMAGES_URL,
        params={
            "access_token": access_token,
            "bbox": f"{west},{south},{east},{north}",
            "fields": "id,thumb_1024_url,thumb_256_url,captured_at,compass_angle,computed_geometry,creator",
        },
        log=log,
    )
    if res is None:
        return []
    try:
        raw_items = res.json().get("data", [])
    except ValueError:
        log.warning("Unerwartete Mapillary-Antwort fuer (%.5f, %.5f).", lat, lon)
        return []

    scored: list[tuple[float, float, float, dict[str, Any]]] = []
    discarded_by_bearing = 0
    for item in raw_items:
        geom = item.get("computed_geometry")
        compass_angle = item.get("compass_angle")
        if not geom or geom.get("type") != "Point" or compass_angle is None:
            continue
        img_lon, img_lat = geom["coordinates"]
        distance_m = haversine_m(img_lat, img_lon, lat, lon)
        delta = bearing_delta_to_station(img_lat, img_lon, compass_angle, lat, lon)
        if delta > MAPILLARY_MAX_BEARING_DELTA_DEG:
            discarded_by_bearing += 1
            continue
        scored.append((distance_m, delta, item))

    # Ranking (Auftrag §2, Quelle B): kleinerer Abstand + kleinere
    # Winkeldifferenz + neueres captured_at = besser.
    def sort_key(entry: tuple[float, float, dict[str, Any]]):
        distance_m, delta, item = entry
        captured_at_ms = item.get("captured_at") or 0
        return (distance_m, delta, -captured_at_ms)

    scored.sort(key=sort_key)
    top = scored[:MAPILLARY_MAX_IMAGES]

    results: list[ImageCandidate] = []
    for order, (distance_m, delta, item) in enumerate(top):
        captured_at = None
        if item.get("captured_at"):
            captured_at = datetime.fromtimestamp(item["captured_at"] / 1000, tz=timezone.utc)
        creator = (item.get("creator") or {}).get("username")
        # Kein "©"-Praefix hier -- die Attribution wird im Frontend bereits
        # als "© {attribution} · {license}" zusammengesetzt (siehe
        # charge-point-gallery.tsx AttributionLine), ein zusaetzliches "©"
        # hier fuehrte zu einer doppelten Anzeige.
        attribution = f"{creator} (Mapillary)" if creator else "Mapillary contributor"
        results.append(
            ImageCandidate(
                source="mapillary",
                source_id=str(item["id"]),
                url_full=item.get("thumb_1024_url") or item.get("thumb_256_url"),
                url_thumb=item.get("thumb_256_url") or item.get("thumb_1024_url"),
                width=1024 if item.get("thumb_1024_url") else 256,
                height=None,
                captured_at=captured_at,
                distance_m=round(distance_m, 1),
                bearing_delta=round(delta, 1),
                license="CC BY-SA 4.0",
                license_url=CC_BY_SA_4_URL,
                attribution=attribution,
                confidence=CONFIDENCE_MAPILLARY,
                sort_order=order,
            )
        )
    log.info(
        "Mapillary: %d Rohtreffer, %d nach Blickrichtung verworfen, %d uebernommen fuer (%.5f, %.5f)",
        len(raw_items),
        discarded_by_bearing,
        len(results),
        lat,
        lon,
    )
    return results


# ---------------------------------------------------------------------------
# DB: Stationen laden, Refresh-Check, idempotenter Upsert
# ---------------------------------------------------------------------------

def fetch_stations(conn, bbox: tuple[float, float, float, float], limit: int | None) -> list[dict[str, Any]]:
    west, south, east, north = bbox
    sql = """
        select external_key, name, lat, lon
        from core.charge_point_geo
        where lon between %(west)s and %(east)s
          and lat between %(south)s and %(north)s
        order by external_key
    """
    if limit:
        sql += " limit %(limit)s"
    with conn.cursor(cursor_factory=RealDictCursor) as cur:
        cur.execute(sql, {"west": west, "south": south, "east": east, "north": north, "limit": limit})
        return cur.fetchall()


def last_fetched_at(conn, external_key: str, source: str) -> datetime | None:
    with conn.cursor() as cur:
        cur.execute(
            "select max(fetched_at) from core.charge_point_image where external_key = %s and source = %s",
            (external_key, source),
        )
        (value,) = cur.fetchone()
        return value


UPSERT_SQL = """
    insert into core.charge_point_image (
        external_key, source, source_id, url_full, url_thumb, width, height,
        captured_at, distance_m, bearing_delta, license, license_url,
        attribution, confidence, sort_order, fetched_at
    ) values (
        %(external_key)s, %(source)s, %(source_id)s, %(url_full)s, %(url_thumb)s,
        %(width)s, %(height)s, %(captured_at)s, %(distance_m)s, %(bearing_delta)s,
        %(license)s, %(license_url)s, %(attribution)s, %(confidence)s,
        %(sort_order)s, now()
    )
    on conflict (external_key, source, source_id) do update set
        url_full = excluded.url_full,
        url_thumb = excluded.url_thumb,
        width = excluded.width,
        height = excluded.height,
        captured_at = excluded.captured_at,
        distance_m = excluded.distance_m,
        bearing_delta = excluded.bearing_delta,
        license = excluded.license,
        license_url = excluded.license_url,
        attribution = excluded.attribution,
        confidence = excluded.confidence,
        sort_order = excluded.sort_order,
        fetched_at = now()
"""


def upsert_candidates(conn, external_key: str, candidates: Iterable[ImageCandidate], dry_run: bool, log) -> int:
    count = 0
    for c in candidates:
        count += 1
        if dry_run:
            log.info(
                "[dry-run] wuerde schreiben: %s source=%s source_id=%s confidence=%d",
                external_key,
                c.source,
                c.source_id,
                c.confidence,
            )
            continue
        with conn.cursor() as cur:
            cur.execute(
                UPSERT_SQL,
                {
                    "external_key": external_key,
                    "source": c.source,
                    "source_id": c.source_id,
                    "url_full": c.url_full,
                    "url_thumb": c.url_thumb,
                    "width": c.width,
                    "height": c.height,
                    "captured_at": c.captured_at,
                    "distance_m": c.distance_m,
                    "bearing_delta": c.bearing_delta,
                    "license": c.license,
                    "license_url": c.license_url,
                    "attribution": c.attribution,
                    "confidence": c.confidence,
                    "sort_order": c.sort_order,
                },
            )
    if not dry_run:
        conn.commit()
    return count


# ---------------------------------------------------------------------------
# CLI
# ---------------------------------------------------------------------------

def parse_refresh_older_than(value: str) -> timedelta:
    match = re.fullmatch(r"(\d+)([dh])", value.strip())
    if not match:
        raise argparse.ArgumentTypeError("Erwartet Format wie '90d' oder '12h'.")
    amount, unit = int(match.group(1)), match.group(2)
    return timedelta(days=amount) if unit == "d" else timedelta(hours=amount)


def parse_bbox(value: str) -> tuple[float, float, float, float]:
    parts = [p.strip() for p in value.split(",")]
    if len(parts) != 4:
        raise argparse.ArgumentTypeError("Erwartet 'west,south,east,north'.")
    west, south, east, north = (float(p) for p in parts)
    return west, south, east, north


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--bbox", required=True, type=parse_bbox, help="west,south,east,north")
    parser.add_argument("--limit", type=int, default=None)
    parser.add_argument("--source", choices=["commons", "mapillary", "all"], default="all")
    parser.add_argument("--dry-run", action="store_true")
    parser.add_argument("--refresh-older-than", type=parse_refresh_older_than, default=timedelta(days=90))
    args = parser.parse_args()

    log = setup_logging()

    mapillary_token = None
    if args.source in ("mapillary", "all"):
        import os

        mapillary_token = os.environ.get("MAPILLARY_ACCESS_TOKEN")
        if not mapillary_token:
            log.warning(
                "MAPILLARY_ACCESS_TOKEN nicht gesetzt -- Quelle 'mapillary' wird uebersprungen "
                "(kein Abbruch, siehe Auftrag §4)."
            )

    conn = get_connection()
    conn.autocommit = False

    scope = ",".join(f"{v:.4f}" for v in args.bbox)
    stats = {"commons_written": 0, "mapillary_written": 0, "stations_with_image": 0, "stations_seen": 0}

    with import_run(conn, source="charge_point_images", scope=scope) as (_run_id, state):
        stations = fetch_stations(conn, args.bbox, args.limit)
        log.info("Ladesaeulen im Bbox %s: %d", scope, len(stations))

        for station in stations:
            stats["stations_seen"] += 1
            external_key, lat, lon = station["external_key"], station["lat"], station["lon"]
            got_any = False

            if args.source in ("commons", "all"):
                last = last_fetched_at(conn, external_key, "wikimedia_commons")
                if last and datetime.now(timezone.utc) - last < args.refresh_older_than:
                    log.info("%s: Commons uebersprungen (zuletzt %s).", external_key, last)
                else:
                    candidates = fetch_commons_candidates(lat, lon, log)
                    written = upsert_candidates(conn, external_key, candidates, args.dry_run, log)
                    stats["commons_written"] += written
                    got_any = got_any or written > 0

            if args.source in ("mapillary", "all") and mapillary_token:
                last = last_fetched_at(conn, external_key, "mapillary")
                if last and datetime.now(timezone.utc) - last < args.refresh_older_than:
                    log.info("%s: Mapillary uebersprungen (zuletzt %s).", external_key, last)
                else:
                    candidates = fetch_mapillary_candidates(lat, lon, mapillary_token, log)
                    written = upsert_candidates(conn, external_key, candidates, args.dry_run, log)
                    stats["mapillary_written"] += written
                    got_any = got_any or written > 0

            if got_any:
                stats["stations_with_image"] += 1

        state["record_count"] = stats["commons_written"] + stats["mapillary_written"]

    coverage = (stats["stations_with_image"] / stats["stations_seen"] * 100) if stats["stations_seen"] else 0.0
    log.info(
        "Fertig. Stationen=%d, mit >=1 Bild=%d (%.1f%%), Commons geschrieben=%d, Mapillary geschrieben=%d, dry_run=%s",
        stats["stations_seen"],
        stats["stations_with_image"],
        coverage,
        stats["commons_written"],
        stats["mapillary_written"],
        args.dry_run,
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
