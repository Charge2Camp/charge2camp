/** core.charge_point.access_type kommt roh aus OCM als englischer Enum-
 * Wert (public|restricted|private, siehe ingest/import_ocm.py parse_poi())
 * -- fuer die Anzeige uebersetzt statt roh durchgereicht. */
const ACCESS_TYPE_LABELS: Record<string, string> = {
  public: "Öffentlich",
  restricted: "Eingeschränkter Zugang",
  private: "Privat",
};

export function formatAccessType(accessType: string | null | undefined): string | null {
  if (!accessType) return null;
  return ACCESS_TYPE_LABELS[accessType] ?? accessType;
}
