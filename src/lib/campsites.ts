import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { EV_SCORE_MIN_OPTIONS, RADIUS_KM_OPTIONS } from "@/lib/campsite-filters";
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

/** Alle Campingplatz-Namen (unabhaengig von aktiven Filtern) fuer die
 * Vorschlagsliste im Suchfeld -- siehe NameSuggestField. */
export async function fetchCampsiteNameOptions(): Promise<string[]> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .schema("core")
    .from("campsite")
    .select("name")
    .eq("is_active", true)
    .order("name")
    .limit(5000);
  if (error) throw new Error(error.message);
  return Array.from(new Set((data ?? []).map((row) => row.name).filter(Boolean)));
}

export interface CampsiteDestinationOption {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
}

/** Name + Koordinaten aller Campingplaetze, fuer die Ziel-Vorschlaege im
 * Routenplaner (AddressAutocomplete `localSuggestions`) -- die Koordinaten
 * sind bereits bekannt, kein erneutes Geocoding des Namens noetig (siehe
 * routenplaner/actions.ts). */
export async function fetchCampsiteDestinationOptions(): Promise<CampsiteDestinationOption[]> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .schema("core")
    .from("campsite_search")
    .select("id, name, lat, lon")
    .order("name")
    .limit(5000);
  if (error) throw new Error(error.message);
  return (data ?? []).map((r) => ({ id: r.id, name: r.name, latitude: r.lat, longitude: r.lon }));
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

/** Bekannte Laendercodes fuer den Land-Filter. */
export async function fetchCampsiteCountryOptions(): Promise<string[]> {
  const supabase = createAdminClient();
  const { data, error } = await supabase.schema("core").from("campsite").select("country_code").limit(5000);
  if (error) throw new Error(error.message);
  const countries = new Set<string>();
  for (const row of data ?? []) {
    if (row.country_code) countries.add(row.country_code);
  }
  return Array.from(countries).sort();
}
