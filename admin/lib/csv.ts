/**
 * Minimaler, aber RFC4180-tauglicher CSV-Parser (Anfuehrungszeichen,
 * Kommas/Zeilenumbrueche innerhalb von Feldern, "" als escapetes
 * Anfuehrungszeichen) -- bewusst ohne zusaetzliche npm-Abhaengigkeit, da
 * das Format hier vollstaendig selbst kontrolliert ist (siehe
 * ladestationen/massenupload: die Vorlage stammt aus dieser App selbst,
 * Nutzer bearbeiten sie i. d. R. in Excel/Google Sheets, die beide
 * Standard-CSV mit genau diesen Regeln exportieren).
 */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;
  // Normalisiert Windows-Zeilenenden, damit \r nicht als Teil des letzten
  // Feldes einer Zeile landet.
  const input = text.replace(/\r\n/g, "\n").replace(/\r/g, "\n");

  for (let i = 0; i < input.length; i++) {
    const char = input[i];

    if (inQuotes) {
      if (char === '"') {
        if (input[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += char;
      }
      continue;
    }

    if (char === '"') {
      inQuotes = true;
    } else if (char === ",") {
      row.push(field);
      field = "";
    } else if (char === "\n") {
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else {
      field += char;
    }
  }

  // Letztes Feld/letzte Zeile (falls die Datei nicht mit Zeilenumbruch endet).
  if (field.length > 0 || row.length > 0) {
    row.push(field);
    rows.push(row);
  }

  return rows.filter((r) => !(r.length === 1 && r[0].trim() === ""));
}

/** Parst CSV-Text mit Header-Zeile zu einer Liste von Objekten (Header ->
 * Zellenwert, getrimmt). Ueberzaehlige/fehlende Zellen je Zeile werden
 * tolerant behandelt (fehlend = leerer String). */
export function parseCsvWithHeader(text: string): Record<string, string>[] {
  const rows = parseCsv(text);
  if (rows.length === 0) return [];
  const header = rows[0].map((h) => h.trim());
  return rows.slice(1).map((row) => {
    const obj: Record<string, string> = {};
    header.forEach((key, i) => {
      obj[key] = (row[i] ?? "").trim();
    });
    return obj;
  });
}

function escapeCsvField(value: string): string {
  if (/[",\n]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

export function buildCsv(header: string[], rows: string[][]): string {
  const lines = [header, ...rows].map((row) => row.map(escapeCsvField).join(","));
  return lines.join("\r\n") + "\r\n";
}
