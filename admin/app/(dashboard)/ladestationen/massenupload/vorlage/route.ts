import { requireAdmin } from "@/lib/require-admin";
import { buildCsv } from "@/lib/csv";

const HEADER = [
  "external_key",
  "name",
  "operator",
  "address",
  "city",
  "country_code",
  "access_type",
  "max_power_kw",
  "is_operational",
  "trailer_verdict",
  "drive_through",
  "maneuvering_space",
  "pull_in_length_m",
  "notes",
];

const EXAMPLE_ROW = [
  "osm:node/123456789",
  "",
  "",
  "",
  "",
  "",
  "",
  "",
  "",
  "yes",
  "1",
  "ample",
  "8",
  "Beispiel: nur Anhängertauglichkeit wird gesetzt, alle anderen Felder bleiben unverändert",
];

/** Route Handler statt Page, deshalb greift requireAdmin() aus dem
 * (dashboard)-Layout NICHT automatisch (Layouts wrappen nur Pages) --
 * hier explizit aufgerufen. */
export async function GET() {
  await requireAdmin();

  const csv = buildCsv(HEADER, [EXAMPLE_ROW]);

  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": 'attachment; filename="ladestationen-vorlage.csv"',
    },
  });
}
