/**
 * Duenner Meilisearch-Adapter fuer den Suchindex 'campsites' (Auftrag D/E,
 * siehe CLAUDE_CODE_AUFTRAG.md Abschnitt 9/10). Nur Server-seitig verwendet
 * (Route Handlers) -- MEILI_MASTER_KEY darf nie an den Browser gelangen.
 *
 * Bewusst ein schlanker fetch()-Wrapper statt des offiziellen JS-SDKs: die
 * Route Handler brauchen nur `search`, kein eigenes npm-Paket noetig
 * (Kostenoptimierungs-Prinzip, siehe CLAUDE.md).
 */

const MEILISEARCH_URL = process.env.MEILISEARCH_URL ?? "http://127.0.0.1:7700";
const MEILI_MASTER_KEY = process.env.MEILI_MASTER_KEY;

export interface MeiliSearchParams {
  q?: string;
  filter?: string[];
  facets?: string[];
  sort?: string[];
  limit?: number;
  offset?: number;
}

export interface MeiliSearchResult<T> {
  hits: T[];
  estimatedTotalHits: number;
  facetDistribution?: Record<string, Record<string, number>>;
}

export async function searchIndex<T>(
  indexName: string,
  params: MeiliSearchParams
): Promise<MeiliSearchResult<T>> {
  const response = await fetch(`${MEILISEARCH_URL}/indexes/${indexName}/search`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(MEILI_MASTER_KEY ? { Authorization: `Bearer ${MEILI_MASTER_KEY}` } : {}),
    },
    body: JSON.stringify(params),
  });
  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    throw new Error(`Meilisearch-Anfrage fehlgeschlagen (${response.status}): ${detail}`);
  }
  return response.json();
}
