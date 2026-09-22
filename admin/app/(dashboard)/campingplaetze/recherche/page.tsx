import { createServiceClient } from "@/lib/supabase/service";

interface ResearchQueueRow {
  external_key: string;
  name: string;
  website: string | null;
  country_code: string | null;
  city: string | null;
  reason: string;
  recheck_after: string | null;
}

export default async function ResearchQueuePage() {
  const supabase = createServiceClient();
  const { data, error } = await supabase.schema("core").rpc("research_queue");
  const rows = (data ?? []) as ResearchQueueRow[];

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-2xl font-semibold">Recherche-Warteschlange</h1>
        <p className="mt-1 text-sm text-text-muted">
          Campingplätze ohne oder mit veralteten Ladeinfos, aus core.research_queue() -- read-only Übersicht.
        </p>
      </div>

      {error && (
        <p className="rounded-md border border-status-down/40 bg-status-down/5 p-3 text-sm text-status-down">
          Warteschlange konnte nicht geladen werden: {error.message}
        </p>
      )}

      <div className="overflow-x-auto">
        <table className="min-w-full text-left text-sm">
          <thead>
            <tr className="border-b border-line text-text-muted">
              <th className="py-2 pr-4">Name</th>
              <th className="py-2 pr-4">Ort</th>
              <th className="py-2 pr-4">Website</th>
              <th className="py-2 pr-4">Grund</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.external_key} className="border-b border-line/50">
                <td className="py-2 pr-4">{row.name}</td>
                <td className="py-2 pr-4">{[row.city, row.country_code].filter(Boolean).join(", ")}</td>
                <td className="py-2 pr-4">
                  {row.website ? (
                    <a href={row.website} target="_blank" rel="noreferrer" className="text-route hover:underline">
                      Website
                    </a>
                  ) : (
                    "—"
                  )}
                </td>
                <td className="py-2 pr-4 text-text-muted">{row.reason}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {rows.length === 0 && <p className="mt-3 text-sm text-text-muted">Warteschlange ist leer.</p>}
      </div>
    </div>
  );
}
