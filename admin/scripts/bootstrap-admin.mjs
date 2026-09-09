// Einmaliges Skript: setzt profiles.is_admin=true fuer eine bestehende
// E-Mail -- gegen die Produktions-Supabase-Instanz (Werte aus .env.local).
// Aufruf: node --env-file=.env.local scripts/bootstrap-admin.mjs <email>
import { createClient } from "@supabase/supabase-js";

const email = process.argv[2];
if (!email) {
  console.error("Usage: node scripts/bootstrap-admin.mjs <email>");
  process.exit(1);
}

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const { data, error } = await supabase.from("profiles").update({ is_admin: true }).eq("email", email).select("id, email");

if (error) {
  console.error("Fehler:", error.message);
  process.exit(1);
}

if (!data || data.length === 0) {
  console.error(`Kein profiles-Eintrag mit E-Mail "${email}" gefunden -- existiert bereits ein charge2camp-Account mit dieser Adresse?`);
  process.exit(1);
}

console.log(`is_admin=true gesetzt fuer: ${data.map((r) => r.email).join(", ")}`);
