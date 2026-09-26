import Image from "next/image";
import {
  CAMPSITE_PIN_ICON_SRC,
  REVIEW_STATE_COLORS,
  REVIEW_STATE_LABELS,
  TRAILER_PIN_COLORS,
  TRAILER_PIN_ICON_SRC,
  TRAILER_PIN_LABELS,
  type ReviewState,
  type TrailerPinState,
} from "@/lib/trailer-verdict";
import { PERSONAL_COMPATIBILITY_LABELS, RIG_LENGTH_BUCKETS, type PersonalCompatibility } from "@/lib/scoring/trailer-compatibility";
import { EV_SCORE_WEIGHTS } from "@/lib/scoring/ev-camping-score";

// Reihenfolge der Kartenpins: von schlecht nach ideal (docs/design/
// brand-guide.md Abschnitt 7) -- dieselbe Skala wie auf der Karte, hier nur
// zusaetzlich mit einer erklaerenden Beschreibung pro Zustand.
const TRAILER_PIN_ORDER: TrailerPinState[] = ["drive_through", "ohne_abkoppeln", "bedingt_tauglich", "nicht_tauglich", "ungeprueft"];

const TRAILER_PIN_DESCRIPTIONS: Record<TrailerPinState, string> = {
  drive_through:
    "Der beste Fall: Du fährst mit dem Gespann einfach durch, ohne zu rangieren oder abzukoppeln.",
  ohne_abkoppeln:
    "Du kannst mit angekoppeltem Wohnwagen laden, musst dafür aber rangieren (kein Durchfahren möglich).",
  bedingt_tauglich:
    "Wahrscheinlich musst du den Wohnwagen abkoppeln und in der Nähe abstellen, bevor du zur Säule fährst -- z. B. weil der Platz für das ganze Gespann nicht reicht oder zu viele Säulen belegt sind.",
  nicht_tauglich:
    "Von der Community oder einem Admin bestätigt: Mit Wohnwagen hier nicht nutzbar.",
  ungeprueft:
    "Noch keine Angabe zur Anhängertauglichkeit vorhanden -- hilf mit und gib die erste Bewertung ab.",
};

// Dieselbe Skala wie ReviewStateBadge (Vertrauenswuerdigkeit der Angabe,
// unabhaengig von der Anhaengertauglichkeit selbst) -- hier zusaetzlich mit
// Erklaerung, WOHER die Angabe stammt.
const REVIEW_STATE_ORDER: ReviewState[] = ["verified", "community", "not_reviewed"];

const REVIEW_STATE_DESCRIPTIONS: Record<ReviewState, string> = {
  verified: "Von charge2camp kuratiert oder von einem Admin im Backend geprüft/korrigiert.",
  community: "Community-Mitglieder haben eine Meldung eingereicht, die von einem Admin durchgewunken wurde.",
  not_reviewed: "Es liegt noch keine Angabe zur Anhängertauglichkeit vor.",
};

const PERSONAL_COMPATIBILITY_ORDER: PersonalCompatibility[] = ["sehr_gut", "eingeschraenkt", "unklar", "nicht_geeignet", "keine_daten"];

const PERSONAL_COMPATIBILITY_DESCRIPTIONS: Record<PersonalCompatibility, string> = {
  sehr_gut:
    "Es liegen mindestens zwei passende Community-Bewertungen für deine Gespannlänge vor, überwiegend positiv (auch von größeren Gespannen übernommen, sofern positiv bewertet).",
  eingeschraenkt:
    "Community-Bewertungen für deine Gespannlänge sind gemischt oder überwiegend negativ -- vor Ort besser vorsichtig planen.",
  unklar: "Es gibt zwar Bewertungen zu diesem Ladepunkt, aber (noch) zu wenige speziell für deine Gespannlänge.",
  nicht_geeignet:
    "Mindestens 90% aller Bewertungen zu diesem Ladepunkt sagen „nicht anhängertauglich“ -- das gilt dann für jedes Gespann, unabhängig von deiner hinterlegten Länge.",
  keine_daten:
    "Entweder ist noch kein Wohnwagen in deinem Profil hinterlegt (siehe „Mein Gespann“), oder es liegen für diesen Ladepunkt noch gar keine Bewertungen vor.",
};

const REVIEW_CRITERIA = [
  {
    label: "Genug Platz",
    description: "Der Stellplatz ist groß genug für Zugfahrzeug + Wohnwagen zusammen.",
  },
  {
    label: "Freie Rangierfläche",
    description: "Genug Platz drumherum, um mit dem Gespann zu rangieren, ohne andere Fahrzeuge zu behindern.",
  },
  {
    label: "Kein Parkhaus/Schranke",
    description: "Keine Höhen- oder Breitenbeschränkung durch Parkhaus, Schranke oder Bordstein.",
  },
  {
    label: "Kabellänge ausreichend",
    description: "Das Ladekabel ist lang genug, um vom Kabelanschluss der Säule bis zur Ladebuchse des Zugfahrzeugs vorne am Gespann zu reichen.",
  },
];

const EV_SCORE_FACTORS: Array<{ label: string; weight: number }> = [
  { label: "Ladepunkt direkt auf dem Platz", weight: EV_SCORE_WEIGHTS.onSite },
  { label: "Ladeleistung vor Ort", weight: EV_SCORE_WEIGHTS.power },
  { label: "Anzahl Ladepunkte auf dem Platz", weight: EV_SCORE_WEIGHTS.pointCount },
  { label: "Nähe zum nächsten Schnelllader", weight: EV_SCORE_WEIGHTS.fastChargerProximity },
  { label: "Community-Bewertungen", weight: EV_SCORE_WEIGHTS.communityRating },
  { label: "Aktualität der Daten", weight: EV_SCORE_WEIGHTS.dataFreshness },
];

function SectionHeading({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <div>
      <h2 className="text-lg font-semibold">{title}</h2>
      {subtitle && <p className="mt-1 text-sm text-text-muted">{subtitle}</p>}
    </div>
  );
}

// Bewusst OHNE Login-Pflicht (anders als der Rest des Produkts, s.
// require-user.ts): rein referenzieller Inhalt ohne jeden Account-Bezug
// (keine Nutzerdaten, keine DB-Abfrage) -- lag zuvor unter /profil/legende
// und war dadurch trotz fehlendem Account-Bezug login-pflichtig, ein
// dokumentierter IA-Bruch (UX-05.5, docs/design/ux-problems.md). Bleibt
// zusaetzlich in der Profil-Navigation verlinkt (profile-sidebar.tsx,
// profile-sub-nav.tsx, profil/page.tsx), jetzt aber auch ohne Login direkt
// unter /legende erreichbar.
export default function LegendePage() {
  return (
    <div className="flex flex-col gap-10">
      <section>
        <h2 className="text-lg font-semibold">Symbole &amp; Begriffe</h2>
        <p className="mt-2 text-sm text-text-muted">
          Diese Übersicht erklärt alle Symbole, Farben und Begriffe, die dir in charge2camp
          begegnen -- vor allem rund ums Laden mit Wohnwagen im Schlepp. So verstehst du auf
          einen Blick, worauf es bei einem Ladepunkt ankommt, bevor du hinfährst.
        </p>
      </section>

      <section className="flex flex-col gap-4">
        <SectionHeading
          title="Ladepunkt-Pins auf der Karte"
          subtitle="Eine Skala von schlecht nach ideal -- die wichtigste Farbe/Symbol-Kombination der App."
        />
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {TRAILER_PIN_ORDER.map((state) => (
            <div
              key={state}
              className="flex items-start gap-3 rounded-lg border border-line p-3"
            >
              <Image src={TRAILER_PIN_ICON_SRC[state]} alt="" width={36} height={44} className="mt-0.5 shrink-0" />
              <div>
                <p className="flex items-center gap-2 font-medium">
                  <span
                    className="inline-block h-2.5 w-2.5 shrink-0 rounded-full"
                    style={{ backgroundColor: TRAILER_PIN_COLORS[state] }}
                  />
                  {TRAILER_PIN_LABELS[state]}
                </p>
                <p className="mt-1 text-sm text-text-muted">{TRAILER_PIN_DESCRIPTIONS[state]}</p>
              </div>
            </div>
          ))}

          <div className="flex items-start gap-3 rounded-lg border border-line p-3">
            <Image src={CAMPSITE_PIN_ICON_SRC} alt="" width={36} height={44} className="mt-0.5 shrink-0" />
            <div>
              <p className="font-medium">Campingplatz</p>
              <p className="mt-1 text-sm text-text-muted">
                Bewusst andersfarbig (dunkelgrün mit Zelt) -- auf derselben Karte klar von den
                Ladepunkt-Pins unterscheidbar.
              </p>
            </div>
          </div>
        </div>
      </section>

      <section className="flex flex-col gap-4">
        <SectionHeading
          title="Wie verlässlich ist die Angabe?"
          subtitle="Unabhängig von der Anhängertauglichkeit selbst: Woher stammt die Information, und wie geprüft ist sie?"
        />
        <div className="flex flex-col gap-3">
          {REVIEW_STATE_ORDER.map((state) => (
            <div key={state} className="flex items-start gap-3 rounded-lg border border-line p-3">
              <span
                className="mt-0.5 inline-block shrink-0 rounded-full px-2 py-0.5 text-xs text-white"
                style={{ backgroundColor: REVIEW_STATE_COLORS[state] }}
              >
                {REVIEW_STATE_LABELS[state]}
              </span>
              <p className="text-sm text-text-muted">{REVIEW_STATE_DESCRIPTIONS[state]}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="flex flex-col gap-4">
        <SectionHeading
          title="„Für dein Gespann: ...“"
          subtitle="Eine persönliche Einschätzung speziell für die Länge deines eigenen Gespanns (Zugfahrzeug + Wohnwagen aus „Mein Gespann“)."
        />
        <div className="flex flex-col gap-3">
          {PERSONAL_COMPATIBILITY_ORDER.map((state) => (
            <div
              key={state}
              className="rounded-lg border border-route/30 bg-route/5 p-3 text-sm font-medium text-route"
            >
              {PERSONAL_COMPATIBILITY_LABELS[state]}
              <p className="mt-1 text-sm font-normal text-text-muted">
                {PERSONAL_COMPATIBILITY_DESCRIPTIONS[state]}
              </p>
            </div>
          ))}
        </div>
      </section>

      <section className="flex flex-col gap-4">
        <SectionHeading
          title="Eignung nach Gespannlänge"
          subtitle="Auf jeder Ladepunkt-Detailseite: wie die Community den Ladepunkt in verschiedenen Längenklassen einschätzt."
        />
        <p className="text-sm text-text-muted">
          Bewertungen werden in fünf Längenklassen einsortiert:{" "}
          {RIG_LENGTH_BUCKETS.map((b) => b.label).join(" · ")}. Eine positive Bewertung eines
          größeren Gespanns zählt automatisch auch für alle kürzeren Klassen mit -- wer mit 13 m
          durchkommt, passt erst recht mit 9 m. Negative Bewertungen werden dagegen nie vererbt.
        </p>
      </section>

      <section className="flex flex-col gap-4">
        <SectionHeading
          title="EV-Camping-Score"
          subtitle="0-100 Punkte auf jeder Campingplatz-Detailseite -- wie EV-freundlich ist der Platz insgesamt?"
        />
        <ul className="flex flex-col gap-2 text-sm">
          {EV_SCORE_FACTORS.map((f) => (
            <li key={f.label} className="flex items-center justify-between gap-3 rounded-md border border-line px-3 py-2">
              <span>{f.label}</span>
              <span className="shrink-0 font-medium text-route">bis zu {f.weight} Punkte</span>
            </li>
          ))}
        </ul>
      </section>

      <section className="flex flex-col gap-4">
        <SectionHeading
          title="Bewertungs-Kriterien für Ladepunkte"
          subtitle="Diese vier Punkte fragt charge2camp bei jeder Ladepunkt-Bewertung ab -- sie entscheiden meist über An- oder Abkoppeln."
        />
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {REVIEW_CRITERIA.map((c) => (
            <div key={c.label} className="rounded-lg border border-line p-3">
              <p className="flex items-center gap-1.5 font-medium">
                <span className="text-route">✓</span> {c.label}
              </p>
              <p className="mt-1 text-sm text-text-muted">{c.description}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="flex flex-col gap-4">
        <SectionHeading title="Weitere Symbole" />
        <div className="flex flex-col gap-3">
          <div className="flex items-start gap-3 rounded-lg border border-line p-3">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-md border border-line-strong text-xl leading-none">
              <span className="text-error">♥</span>
            </span>
            <p className="mt-1.5 text-sm text-text-muted">
              Favorit -- zum Merken eines Ladepunkts oder Campingplatzes (♡ = nicht gemerkt, ♥ =
              gemerkt). Zu finden unter „Favoriten“ in deinem Profil.
            </p>
          </div>
          <div className="flex items-start gap-3 rounded-lg border border-warning/30 bg-warning/5 p-3">
            <span className="text-xl">⚠</span>
            <p className="text-sm text-text-muted">
              „Laut Quelle aktuell nicht betriebsbereit gemeldet“ -- die zuletzt bekannte
              Betriebsstatus-Meldung der Datenquelle. Kein Live-Status: Vor Ort kann sich das
              geändert haben.
            </p>
          </div>
        </div>
      </section>

      <section className="rounded-lg border border-route/30 bg-route/5 p-4">
        <h2 className="text-lg font-semibold text-route">Gut zu wissen fürs Laden mit Wohnwagen</h2>
        <ul className="mt-3 flex flex-col gap-2 text-sm">
          {[
            "Anhängertauglichkeit hat bei charge2camp immer Vorrang vor einem minimal kürzeren Umweg -- lieber etwas weiter fahren als am Ziel nicht rangieren können.",
            "Bewertungen von Nutzern mit ähnlicher Gespannlänge wie deiner sind am aussagekräftigsten -- die „Eignung nach Gespannlänge“-Tabelle zeigt dir genau diese.",
            "„Nur abgekoppelt erreichbar“ bedeutet: Du brauchst in der Nähe einen Platz, um den Wohnwagen kurz abzustellen, bevor du zur Säule fährst.",
            "Trag dein Gespann unter „Mein Gespann“ ein -- nur so kann dir charge2camp eine persönliche Einschätzung („Für dein Gespann: ...“) je Ladepunkt anzeigen.",
            "Je mehr Bewertungen die Community abgibt, desto verlässlicher werden die Einschätzungen für alle -- nach jedem Ladestopp lohnt sich eine kurze Bewertung.",
          ].map((tip) => (
            <li key={tip} className="flex gap-2">
              <span className="mt-0.5 shrink-0 text-route">●</span>
              <span>{tip}</span>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
