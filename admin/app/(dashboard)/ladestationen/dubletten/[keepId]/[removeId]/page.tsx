import Link from "next/link";
import { notFound } from "next/navigation";
import { createServiceClient } from "@/lib/supabase/service";
import type { ChargePoint, Connector } from "@/lib/types";
import { mergeChargePoints } from "./actions";
import { dismissChargePointDuplicate } from "../../actions";

function FieldRow({
  label,
  name,
  a,
  b,
  aValue,
  bValue,
}: {
  label: string;
  name: string;
  a: string; // radio button value for A's option
  b: string;
  aValue: React.ReactNode;
  bValue: React.ReactNode;
}) {
  // Default: nicht-leeren Wert vorauswählen, bei beiden leer/gleich A.
  const preferB = (!a || a.trim() === "") && !!b && b.trim() !== "";
  return (
    <div className="grid grid-cols-1 gap-2 border-b border-line/50 py-2 sm:grid-cols-[140px_1fr_1fr] sm:items-center">
      <p className="text-sm font-medium text-text-muted">{label}</p>
      <label className={`flex items-center gap-2 rounded-md border p-2 text-sm ${!preferB ? "border-action" : "border-line"}`}>
        <input type="radio" name={`field_${name}`} value={a} defaultChecked={!preferB} />
        <span className="truncate">{aValue || <span className="text-text-muted">– leer –</span>}</span>
      </label>
      <label className={`flex items-center gap-2 rounded-md border p-2 text-sm ${preferB ? "border-action" : "border-line"}`}>
        <input type="radio" name={`field_${name}`} value={b} defaultChecked={preferB} />
        <span className="truncate">{bValue || <span className="text-text-muted">– leer –</span>}</span>
      </label>
    </div>
  );
}

export default async function MergeChargePointsPage({
  params,
  searchParams,
}: {
  params: Promise<{ keepId: string; removeId: string }>;
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const { keepId, removeId } = await params;
  // Filter/Seite der aufrufenden Dubletten-Liste (siehe ../page.tsx) --
  // wird unten unveraendert als Hidden-Feld durchgereicht, damit man nach
  // dem Zusammenfuehren/Ablehnen wieder dort landet, statt bei Seite 1 ohne
  // Filter (Nutzerfeedback).
  const rawSearchParams = await searchParams;
  const returnQuery = new URLSearchParams(
    Object.fromEntries(Object.entries(rawSearchParams).filter(([, v]) => v !== undefined) as [string, string][])
  ).toString();
  const supabase = createServiceClient();

  const [{ data: aRow }, { data: bRow }] = await Promise.all([
    supabase.schema("core").from("charge_point").select("*").eq("id", keepId).maybeSingle(),
    supabase.schema("core").from("charge_point").select("*").eq("id", removeId).maybeSingle(),
  ]);
  if (!aRow || !bRow) notFound();
  const a = aRow as ChargePoint;
  const b = bRow as ChargePoint;

  const [{ data: aConn }, { data: bConn }, { data: aGeo }, { data: bGeo }] = await Promise.all([
    supabase.schema("core").from("connector").select("*").eq("charge_point_id", a.id),
    supabase.schema("core").from("connector").select("*").eq("charge_point_id", b.id),
    supabase.schema("core").from("charge_point_geo_admin").select("lat, lon").eq("id", a.id).maybeSingle(),
    supabase.schema("core").from("charge_point_geo_admin").select("lat, lon").eq("id", b.id).maybeSingle(),
  ]);
  const aConnectors = (aConn ?? []) as Connector[];
  const bConnectors = (bConn ?? []) as Connector[];

  return (
    <div className="flex max-w-3xl flex-col gap-6">
      <div>
        <Link href={`/ladestationen/dubletten?${returnQuery}`} className="text-sm text-text-muted hover:underline">
          ← Dubletten
        </Link>
        <h1 className="mt-1 text-2xl font-semibold">Ladepunkte zusammenführen</h1>
        <p className="mt-1 text-sm text-text-muted">
          Wähle, welcher Datensatz erhalten bleibt, und pro Feld welcher Wert übernommen wird. Anschlüsse beider
          Stationen werden automatisch zusammengeführt (Dopplungen zusammengefasst), Bewertungen/Favoriten/
          Anhängertauglichkeit werden auf den erhaltenen Datensatz umgehängt. Der andere Datensatz wird danach
          gelöscht.
        </p>
      </div>

      <form action={mergeChargePoints} className="flex flex-col gap-4">
        <input type="hidden" name="a_id" value={a.id} />
        <input type="hidden" name="b_id" value={b.id} />
        <input type="hidden" name="return_query" value={returnQuery} />

        <div className="rounded-md border border-line bg-card p-3">
          <p className="mb-2 text-sm font-medium">Datensatz, der bestehen bleibt (ID/external_key)</p>
          <div className="flex flex-col gap-2 sm:flex-row">
            <label className="flex flex-1 items-center gap-2 rounded-md border border-line p-2 text-sm">
              <input type="radio" name="survivor_id" value={a.id} defaultChecked />A: {a.external_key} ({a.source})
            </label>
            <label className="flex flex-1 items-center gap-2 rounded-md border border-line p-2 text-sm">
              <input type="radio" name="survivor_id" value={b.id} />B: {b.external_key} ({b.source})
            </label>
          </div>
        </div>

        <div className="rounded-md border border-line p-3">
          <div className="grid grid-cols-1 gap-2 pb-2 sm:grid-cols-[140px_1fr_1fr]">
            <span />
            <span className="text-xs font-semibold uppercase text-text-muted">A ({a.source})</span>
            <span className="text-xs font-semibold uppercase text-text-muted">B ({b.source})</span>
          </div>
          <FieldRow label="Name" name="name" a={a.name ?? ""} b={b.name ?? ""} aValue={a.name} bValue={b.name} />
          <FieldRow label="Betreiber" name="operator" a={a.operator ?? ""} b={b.operator ?? ""} aValue={a.operator} bValue={b.operator} />
          <FieldRow label="Netzwerk" name="network" a={a.network ?? ""} b={b.network ?? ""} aValue={a.network} bValue={b.network} />
          <FieldRow label="Adresse" name="address" a={a.address ?? ""} b={b.address ?? ""} aValue={a.address} bValue={b.address} />
          <FieldRow label="PLZ" name="postcode" a={a.postcode ?? ""} b={b.postcode ?? ""} aValue={a.postcode} bValue={b.postcode} />
          <FieldRow label="Stadt" name="city" a={a.city ?? ""} b={b.city ?? ""} aValue={a.city} bValue={b.city} />
          <FieldRow
            label="Land (ISO2)"
            name="country_code"
            a={a.country_code ?? ""}
            b={b.country_code ?? ""}
            aValue={a.country_code}
            bValue={b.country_code}
          />
          <FieldRow
            label="Zugang"
            name="access_type"
            a={a.access_type ?? ""}
            b={b.access_type ?? ""}
            aValue={a.access_type}
            bValue={b.access_type}
          />
          <FieldRow
            label="Betriebsbereit"
            name="is_operational"
            a={a.is_operational ? "1" : "0"}
            b={b.is_operational ? "1" : "0"}
            aValue={a.is_operational ? "ja" : "nein"}
            bValue={b.is_operational ? "ja" : "nein"}
          />
          <div className="grid grid-cols-1 gap-2 py-2 sm:grid-cols-[140px_1fr_1fr]">
            <p className="text-sm font-medium text-text-muted">Koordinaten</p>
            <p className="text-sm">{aGeo ? `${aGeo.lat}, ${aGeo.lon}` : "–"}</p>
            <p className="text-sm">{bGeo ? `${bGeo.lat}, ${bGeo.lon}` : "–"}</p>
          </div>
          <div className="grid grid-cols-1 gap-2 py-2 sm:grid-cols-[140px_1fr_1fr]">
            <p className="text-sm font-medium text-text-muted">Anschlüsse</p>
            <p className="text-sm">{aConnectors.map((c) => `${c.standard ?? "?"} ${c.power_kw ?? "?"}kW×${c.quantity}`).join(", ") || "–"}</p>
            <p className="text-sm">{bConnectors.map((c) => `${c.standard ?? "?"} ${c.power_kw ?? "?"}kW×${c.quantity}`).join(", ") || "–"}</p>
          </div>
        </div>

        <p className="text-xs text-text-muted">
          Hinweis: Die Koordinaten des gewählten Zieldatensatzes bleiben unverändert (Anschlüsse wandern
          unabhängig von der Feldauswahl in den erhaltenen Datensatz). Willst du stattdessen die Koordinaten der
          anderen Station übernehmen, ändere das nach dem Zusammenführen auf der Detailseite.
        </p>

        <div className="flex gap-2">
          <button type="submit" className="min-h-11 rounded-md bg-action px-4 text-sm font-medium hover:bg-action-hover">
            Zusammenführen
          </button>
        </div>
      </form>

      <form action={dismissChargePointDuplicate.bind(null, a.external_key, b.external_key, returnQuery)}>
        <button type="submit" className="min-h-11 rounded-md border border-line px-4 text-sm font-medium hover:bg-line/20">
          Keine Dublette – getrennt lassen
        </button>
      </form>
    </div>
  );
}
