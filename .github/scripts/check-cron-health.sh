#!/usr/bin/env bash
# Prueft pg_cron-Jobs ueber core.cron_job_health (Migration 20261026230000) und
# beendet sich mit Fehlercode 1, wenn ein Job ungesund ist ODER die Abfrage selbst
# scheitert (Datenbank nicht erreichbar, falscher Schluessel, ...) -- ein Monitor, der
# schweigt, wenn er nichts erreicht, waere wertlos.
#
# Aufgerufen vom Workflow .github/workflows/cron-health.yml; lokal testbar:
#   SUPABASE_URL=http://127.0.0.1:54321 SUPABASE_SERVICE_ROLE_KEY=... \
#     CRON_HEALTH_JOBS="refresh-charge-point-map:35" bash .github/scripts/check-cron-health.sh
#
# CRON_HEALTH_JOBS: Leerzeichen-getrennte Liste "jobname:max_alter_in_minuten".
set -uo pipefail

: "${SUPABASE_URL:?SUPABASE_URL fehlt}"
: "${SUPABASE_SERVICE_ROLE_KEY:?SUPABASE_SERVICE_ROLE_KEY fehlt}"
JOBS="${CRON_HEALTH_JOBS:-refresh-charge-point-map:35}"

failures=0
summary=""

# GitHub-Annotationen vertragen keine Zeilenumbrueche/Prozentzeichen.
clean() { printf '%s' "$1" | tr '\r\n' '  ' | sed 's/%/%25/g'; }

for spec in $JOBS; do
  job="${spec%%:*}"
  max="${spec##*:}"
  if ! [[ "$max" =~ ^[0-9]+$ ]]; then
    echo "::error title=Cron-Check falsch konfiguriert::Ungueltige Angabe '$spec' (erwartet jobname:minuten)"
    failures=$((failures + 1))
    continue
  fi

  # Der Schluessel wird nie ausgegeben; -sS zeigt nur Fehler, --fail-with-body liefert den Fehlertext.
  if ! resp=$(curl -sS --fail-with-body --max-time 30 --retry 2 --retry-delay 3 \
      -X POST "${SUPABASE_URL%/}/rest/v1/rpc/cron_job_health" \
      -H "apikey: ${SUPABASE_SERVICE_ROLE_KEY}" \
      -H "Authorization: Bearer ${SUPABASE_SERVICE_ROLE_KEY}" \
      -H "Content-Profile: core" \
      -H "Content-Type: application/json" \
      -d "{\"p_jobname\":\"${job}\",\"p_max_age_minutes\":${max}}" 2>&1); then
    msg="$(clean "${resp:-keine Antwort}")"
    echo "::error title=Cron-Check nicht ausfuehrbar ($job)::Abfrage von core.cron_job_health fehlgeschlagen: ${msg:0:300}"
    summary+="| $job | ❌ Abfrage fehlgeschlagen | ${msg:0:120} |"$'\n'
    failures=$((failures + 1))
    continue
  fi

  # JSON mit Node auslesen (auf GitHub-Runnern und lokal vorhanden; jq nicht ueberall).
  # Die Funktion liefert ein Array mit einem Objekt; Ausgabe: healthy, reason, Alter, Fehlschlaege.
  parsed="$(printf '%s' "$resp" | node -e '
    let s = "";
    process.stdin.on("data", (d) => (s += d)).on("end", () => {
      try {
        const r = JSON.parse(s)[0] || {};
        const f = (v) => (v === null || v === undefined ? "-" : String(v).replace(/[\t\r\n]+/g, " "));
        console.log([f(r.healthy), f(r.reason), f(r.minutes_since_last_success), f(r.failed_in_last_10)].join("\t"));
      } catch (e) {
        console.log(["unlesbar", "Antwort nicht lesbar", "-", "-"].join("\t"));
      }
    });
  ' 2>/dev/null)"
  IFS=$'\t' read -r healthy reason age failed10 <<<"$parsed"

  if [ "$healthy" = "true" ]; then
    echo "OK    $job: letzter Erfolg vor ${age} min (Limit ${max}), Fehlschlaege in den letzten 10 Laeufen: ${failed10}"
    summary+="| $job | ✅ ok | letzter Erfolg vor ${age} min (Limit ${max}) |"$'\n'
  else
    reason_clean="$(clean "$reason")"
    echo "::error title=Cron-Job ungesund: $job::${reason_clean} (letzter Erfolg vor ${age} min, Limit ${max}; Fehlschlaege in den letzten 10 Laeufen: ${failed10})"
    summary+="| $job | ❌ ungesund | ${reason_clean:0:160} |"$'\n'
    failures=$((failures + 1))
  fi
done

if [ -n "${GITHUB_STEP_SUMMARY:-}" ]; then
  {
    echo "### Cron-Job-Gesundheit"
    echo ""
    echo "| Job | Status | Details |"
    echo "|---|---|---|"
    printf '%s' "$summary"
  } >> "$GITHUB_STEP_SUMMARY"
fi

if [ "$failures" -gt 0 ]; then
  echo "$failures Job(s) ungesund oder nicht pruefbar."
  exit 1
fi
echo "Alle geprueften Jobs gesund."
