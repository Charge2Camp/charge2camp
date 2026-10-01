import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { EV_SCORE_MIN_OPTIONS, RADIUS_KM_OPTIONS } from "@/lib/campsite-filters";
import { CAMPSITE_SUGGEST_MIN_QUERY_LENGTH, type CampsiteDestinationOption } from "@/lib/campsite-suggest";
import type { CampsiteSearchRow, CoreAmenity, Favorite } from "@/types/database";

/** Merkmalskatalog aus core.amenity (siehe Migration
 * 20260913000100_data_layer_seed_amenities) -- dynamisch statt hart codiert,
 * damit neue Merkmale nicht an zwei Stellen gepflegt werden muessen. */
export async function fetchAmenityCatalog(): Promise<CoreAmenity[]> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .schema("core")
    .from("amenity")
    .select("*")
    .order("category")
    .order("label_de");
  if (error) throw new Error(error.message);
  return (data as CoreAmenity[]) ?? [];
}

export interface CampsiteFilters {
  q?: string;
  country?: string;
  amenities: string[];
  /** "on_site" = Ladepunkt auf dem Platz, "ac_walk"/"dc_walk" = fusslaeufig
   * erreichbarer AC- bzw. DC-Ladepunkt (core.connector.current_type, siehe
   * Migration 20261025080000). Ersetzt das bisherige grobe "walking"
   * (fusslaeufig, ohne AC/DC-Unterscheidung) -- Nutzeranfrage. */
  charging?: "on_site" | "ac_walk" | "dc_walk";
  /** Mindest-EV-Score (core.campsite_search.ev_score, 0-100). 0/undefined =
   * kein Minimum. */
  evScoreMin?: number;
  /** Mindest-Community-Bewertung (core.campsite_search.rating_avg, 1-5
   * Sterne) -- "EV-Camping-Tauglichkeit" laut Nutzeranfrage, unabhaengig
   * vom ev_score (siehe Migration 20261025080000). */
  ratingMin?: number;
  /** Umkreissuche um einen per Adressfeld gewaehlten Ort (Nutzeranfrage) --
   * `label` nur fuer die Anzeige (Adressfeld-Text), die eigentliche Filterung
   * nutzt ausschliesslich latitude/longitude. Nur zusammen mit `radiusKm`
   * wirksam (siehe fetchCampsites). */
  near?: { latitude: number; longitude: number; label: string };
  radiusKm?: number;
}

export function parseCampsiteFilters(
  searchParams: Record<string, string | string[] | undefined>,
  amenityKeys: string[]
): CampsiteFilters {
  const get = (key: string) => {
    const v = searchParams[key];
    return Array.isArray(v) ? v[0] : v;
  };

  const chargingRaw = get("charging");
  const evScoreMinRaw = Number(get("evScoreMin"));
  const ratingMinRaw = Number(get("ratingMin"));

  const nearLatRaw = Number(get("near_lat"));
  const nearLonRaw = Number(get("near_lon"));
  const nearLabel = get("near_label")?.trim();
  const radiusKmRaw = Number(get("radius_km"));
  const near =
    Number.isFinite(nearLatRaw) && Number.isFinite(nearLonRaw) && nearLabel
      ? { latitude: nearLatRaw, longitude: nearLonRaw, label: nearLabel }
      : undefined;
  const radiusKm =
    near && Number.isFinite(radiusKmRaw) && (RADIUS_KM_OPTIONS as readonly number[]).includes(radiusKmRaw)
      ? radiusKmRaw
      : undefined;

  return {
    q: get("q")?.trim() || undefined,
    country: get("country") || undefined,
    amenities: amenityKeys.filter((key) => get(key) === "1"),
    charging:
      chargingRaw === "on_site" || chargingRaw === "ac_walk" || chargingRaw === "dc_walk"
        ? chargingRaw
        : undefined,
    evScoreMin:
      Number.isFinite(evScoreMinRaw) && (EV_SCORE_MIN_OPTIONS as readonly number[]).includes(evScoreMinRaw)
        ? evScoreMinRaw
        : undefined,
    ratingMin: Number.isFinite(ratingMinRaw) && ratingMinRaw >= 1 && ratingMinRaw <= 5 ? ratingMinRaw : undefined,
    near,
    radiusKm,
  };
}

/** Liest aus core.campsite_search (Lesesicht mit Merkmalen + vorberechneter
 * Ladepunkt-Naehe/EV-Score, siehe Migration 20260913000200 und
 * 20261025080000) ueber core.search_campsites() (Migration 20261025190000).
 *
 * EU-Skalierungs-Audit 2026-10-01: die vorherige Fassung filterte die
 * Umkreissuche per Lat/Lon-Bounding-Box in SQL, danach `.order("name")
 * .limit(5000)` und ERST DANACH praezise per Haversine in JS -- bei aktuell
 * 3.706 Campingplaetzen unauffaellig, aber bei vollstaendigem europaweiten
 * Rollout (zehntausende Campingplaetze) haette eine dichte Region bei
 * grossem Radius mehr als 5000 Treffer INNERHALB der groben Box enthalten
 * koennen: die alphabetische Sortierung vor dem Limit haette dann echte,
 * naeher gelegene Treffer stillschweigend abschneiden koennen, noch bevor
 * die praezise Umkreispruefung ueberhaupt lief (identische Fehlerklasse wie
 * der am selben Tag behobene Ladepunkte-Bug). core.search_campsites()
 * filtert jetzt ALLE Kriterien (inkl. Umkreis per ST_DWithin auf
 * core.campsite.geom, GiST-indexgestuetzt) direkt in SQL, mit korrekter
 * Entfernungssortierung VOR dem Limit. */
export async function fetchCampsites(filters: CampsiteFilters): Promise<CampsiteSearchRow[]> {
  const supabase = createAdminClient();
  const { data, error } = await supabase.schema("core").rpc("search_campsites", {
    p_q: filters.q ?? null,
    p_country: filters.country ?? null,
    p_amenities: filters.amenities.length > 0 ? filters.amenities : null,
    p_charging: filters.charging ?? null,
    p_ev_score_min: filters.evScoreMin ?? null,
    p_rating_min: filters.ratingMin ?? null,
    p_near_lat: filters.near?.latitude ?? null,
    p_near_lon: filters.near?.longitude ?? null,
    p_radius_km: filters.near && filters.radiusKm ? filters.radiusKm : null,
  });
  if (error) throw new Error(error.message);
  return (data as CampsiteSearchRow[]) ?? [];
}

const SUGGEST_LIMIT = 8;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type CampsiteDestinationRow = { id: string; name: string; lat: number; lon: number };

function toDestinationOption(r: CampsiteDestinationRow): CampsiteDestinationOption {
  return { id: r.id, name: r.name, latitude: r.lat, longitude: r.lon };
}

/** LIKE-Metazeichen (% _ und der Escape-Backslash) sowie PostgREST's
 * "*"-Wildcard aus Nutzereingaben neutralisieren, damit "50%" oder "a_b"
 * woertlich gesucht werden statt als Muster. */
function escapeLikeTerm(term: string): string {
  const backslash = String.fromCharCode(92);
  return term
    .split("*")
    .join("")
    .split(backslash)
    .join(backslash + backslash)
    .replace(/[%_]/g, (c) => backslash + c);
}

/** Vorschlaege fuer Campingplatz-Namensfelder (Filter-Suche, Routenplaner-
 * Ziel): Name enthaelt `query`, Praefix-Treffer zuerst, hoechstens
 * SUGGEST_LIMIT. Serverseitig statt einer vorgeladenen Namensliste -- die
 * frueheren Listen (order by name limit 5000) verloren ab >5.000
 * Campingplaetzen (EU-Rollout) alle Namen jenseits des Alphabet-Endes und
 * wuerden mit jedem Land mehr Payload an den Client schicken. Nutzt den
 * Trigram-Index idx_cssearch_name_trgm (20261024260000) von
 * core.campsite_search. Rueckgabe samt Koordinaten, damit der Routenplaner
 * nicht erneut geocodieren muss (siehe routenplaner/actions.ts). */
export async function suggestCampsites(query: string): Promise<CampsiteDestinationOption[]> {
  // "*" ist PostgREST's LIKE-Wildcard und wird entfernt (siehe escapeLikeTerm);
  // erst NACH dem Entfernen auf die Mindestlaenge pruefen, sonst matcht z. B.
  // "***" als leeres Muster alles.
  const term = query.split("*").join("").trim();
  if (term.length < CAMPSITE_SUGGEST_MIN_QUERY_LENGTH) return [];
  const pattern = escapeLikeTerm(term);
  const supabase = createAdminClient();

  async function find(likePattern: string, limit: number): Promise<CampsiteDestinationRow[]> {
    const { data, error } = await supabase
      .schema("core")
      .from("campsite_search")
      .select("id, name, lat, lon")
      .ilike("name", likePattern)
      .order("name")
      .limit(limit);
    if (error) throw new Error(error.message);
    return (data ?? []) as CampsiteDestinationRow[];
  }

  // Praefix-Treffer zuerst (eigene Abfrage, damit sie nicht hinter beliebig
  // vielen alphabetisch frueheren Enthaelt-Treffern abgeschnitten werden),
  // danach -- nur falls noch Platz ist -- reine Enthaelt-Treffer.
  const prefixRows = await find(`${pattern}%`, SUGGEST_LIMIT);
  if (prefixRows.length >= SUGGEST_LIMIT) return prefixRows.map(toDestinationOption);
  const prefixIds = new Set(prefixRows.map((r) => r.id));
  const containsRows = (await find(`%${pattern}%`, SUGGEST_LIMIT + prefixRows.length)).filter(
    (r) => !prefixIds.has(r.id)
  );
  return [...prefixRows, ...containsRows].slice(0, SUGGEST_LIMIT).map(toDestinationOption);
}

/** Genau der Campingplatz mit diesem Namen -- zum Wiederherstellen der
 * Koordinaten einer gespeicherten Route (route-planner-form.tsx). Bei
 * mehreren gleichnamigen der alphabetisch/technisch erste. */
export async function fetchCampsiteDestinationByName(name: string): Promise<CampsiteDestinationOption | null> {
  const { data, error } = await createAdminClient()
    .schema("core")
    .from("campsite_search")
    .select("id, name, lat, lon")
    .eq("name", name)
    .limit(1);
  if (error) throw new Error(error.message);
  const row = (data ?? [])[0] as CampsiteDestinationRow | undefined;
  return row ? toDestinationOption(row) : null;
}

/** Ziel-Vorbelegung ueber `?destination_campsite_id=` (Button "Route hierher
 * planen", routenplaner/page.tsx). Ungueltige IDs (kein UUID-Format) liefern
 * null statt einen Datenbankfehler zu werfen. */
export async function fetchCampsiteDestinationById(id: string): Promise<CampsiteDestinationOption | null> {
  if (!UUID_RE.test(id)) return null;
  const { data, error } = await createAdminClient()
    .schema("core")
    .from("campsite_search")
    .select("id, name, lat, lon")
    .eq("id", id)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data ? toDestinationOption(data as CampsiteDestinationRow) : null;
}

/** Vom Nutzer gemerkte Campingplaetze mit vollen Merkmalen (core.campsite_search)
 * -- gezeigt statt der ungefilterten Gesamtliste, solange keine Filter aktiv
 * sind (siehe campingplaetze/page.tsx). Nicht angemeldet oder noch keine
 * Favoriten gemerkt: leere Liste, kein Fehler. */
export async function fetchFavoriteCampsites(userId: string): Promise<CampsiteSearchRow[]> {
  const supabase = await createClient();
  const { data: favorites } = await supabase
    .from("favorites")
    .select("*")
    .eq("user_id", userId)
    .eq("entity_type", "campsite");
  const campsiteIds = ((favorites as Favorite[]) ?? []).map((f) => f.entity_id);
  if (campsiteIds.length === 0) return [];

  const { data, error } = await createAdminClient()
    .schema("core")
    .from("campsite_search")
    .select("*")
    .in("id", campsiteIds);
  if (error) throw new Error(error.message);
  return (data as CampsiteSearchRow[]) ?? [];
}

/** Bekannte Laendercodes (nur aktive Campingplaetze) fuer den Land-Filter.
 * Eindeutige Werte kommen aus core.campsite_country_options()
 * (20261026110000) -- die frueher gelesenen ersten 5.000 Zeilen ohne
 * order by verloren ab >5.000 Campingplaetzen stillschweigend Laender. */
export async function fetchCampsiteCountryOptions(): Promise<string[]> {
  const supabase = createAdminClient();
  const { data, error } = await supabase.schema("core").rpc("campsite_country_options");
  if (error) throw new Error(error.message);
  return (data as string[]) ?? [];
}
