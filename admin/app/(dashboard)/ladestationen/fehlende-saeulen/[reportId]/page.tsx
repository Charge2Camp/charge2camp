import Link from "next/link";
import { notFound } from "next/navigation";
import { createServiceClient } from "@/lib/supabase/service";
import { ChargePointForm } from "@/components/charge-point-form";
import type { MissingStationReport } from "@/lib/types";
import { approveMissingStationReport } from "./actions";

export default async function MissingStationReportReviewPage({ params }: { params: Promise<{ reportId: string }> }) {
  const { reportId } = await params;
  const supabase = createServiceClient();

  const { data: report } = await supabase
    .schema("enrich")
    .from("missing_station_report")
    .select("*")
    .eq("id", reportId)
    .maybeSingle();
  if (!report || (report as MissingStationReport).status !== "pending") notFound();
  const r = report as MissingStationReport;

  return (
    <div className="flex max-w-2xl flex-col gap-6">
      <div>
        <Link href="/ladestationen/fehlende-saeulen" className="text-sm text-text-muted hover:underline">
          ← Fehlende Säulen
        </Link>
        <h1 className="mt-1 text-2xl font-semibold">Meldung prüfen &amp; einpflegen</h1>
      </div>

      <div className="flex flex-col gap-2 rounded-md border border-line bg-card p-3 text-sm">
        <div className="flex items-center justify-between gap-3">
          <p className="font-medium">Vom Nutzer geteilter Link</p>
          <a
            href={r.google_maps_url}
            target="_blank"
            rel="noreferrer"
            className="min-h-11 whitespace-nowrap rounded-md border border-line px-3 py-2 text-sm font-medium leading-none hover:bg-line/20"
          >
            In Google Maps öffnen
          </a>
        </div>
        <p className="text-text-muted">
          {r.extracted_latitude != null && r.extracted_longitude != null
            ? `Koordinaten automatisch erkannt: ${r.extracted_latitude}, ${r.extracted_longitude} (unten vorausgefüllt, prüfen/anpassen).`
            : "Keine Koordinaten automatisch erkannt -- bitte im geöffneten Link nachsehen und unten manuell eintragen."}
        </p>
        {(r.extracted_street || r.extracted_city) && (
          <p className="text-text-muted">
            Adresse (Reverse-Geocoding, unten vorausgefüllt):{" "}
            {[r.extracted_street, r.extracted_postcode, r.extracted_city].filter(Boolean).join(", ")}
          </p>
        )}
        {r.extracted_name && (
          <p className="text-text-muted">
            Name/Betreiber-Hinweis aus dem Link: <span className="font-medium">{r.extracted_name}</span> -- nicht
            automatisch übernommen (unklar, ob Stationsname oder Betreiber), bitte unten passend eintragen.
          </p>
        )}
        {r.notes && (
          <p>
            <span className="font-medium">Notiz des Nutzers:</span> {r.notes}
          </p>
        )}
      </div>

      <ChargePointForm
        action={approveMissingStationReport.bind(null, r.id)}
        defaultValues={{
          latitude: r.extracted_latitude,
          longitude: r.extracted_longitude,
          address: r.extracted_street,
          postcode: r.extracted_postcode,
          city: r.extracted_city,
          countryCode: r.extracted_country_code,
        }}
        submitLabel="Direkt einpflegen"
      />
    </div>
  );
}
