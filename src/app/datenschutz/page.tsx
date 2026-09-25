import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Datenschutzerklärung – charge2camp",
};

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h2 className="font-semibold">{title}</h2>
      <div className="mt-2 flex flex-col gap-2 text-sm text-black/70 dark:text-white/70">{children}</div>
    </section>
  );
}

// Oeffentlich ohne Login erreichbare Route (wie /impressum) -- Inhalt
// basiert auf dem tatsaechlichen technischen Verhalten der App (siehe
// docs/privacy.md fuer die technischen Grundlagen: RLS, Konto-Loeschung/
// -Export, Cookies). Kein Ersatz fuer eine rechtliche Pruefung vor dem
// kommerziellen Go-Live (siehe Hinweis am Seitenende) -- aber der
// Startpunkt dafuer, kein Blindflug.
export default function DatenschutzPage() {
  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-8 px-4 py-16">
      <h1 className="text-2xl font-semibold">Datenschutzerklärung</h1>
      <p className="text-xs text-text-muted">Stand: September 2026</p>

      <Section title="1. Verantwortlicher">
        <p>
          Sascha Panadero Fernández – charge2camp
          <br />
          Hauptstr. 15D, 85551 Kirchheim bei München, Deutschland
          <br />
          E-Mail:{" "}
          <a href="mailto:hello@charge2camp.com" className="text-route hover:underline">
            hello@charge2camp.com
          </a>
        </p>
      </Section>

      <Section title="2. Allgemeines zur Datenverarbeitung">
        <p>
          Wir verarbeiten personenbezogene Daten unserer Nutzer grundsätzlich nur, soweit dies zur
          Bereitstellung einer funktionsfähigen App sowie unserer Inhalte und Leistungen
          erforderlich ist (Grundsatz der Datensparsamkeit). Rechtsgrundlage ist regelmäßig Art. 6
          Abs. 1 lit. b DSGVO (Erfüllung eines Vertrags bzw. vorvertraglicher Maßnahmen, hier: die
          Nutzung deines Nutzerkontos), in einzelnen Fällen Art. 6 Abs. 1 lit. f DSGVO
          (berechtigtes Interesse, z. B. Fehler-Monitoring zur technischen Absicherung des
          Betriebs).
        </p>
      </Section>

      <Section title="3. Bereitstellung der App und Server-Log-Dateien">
        <p>
          Die App wird bei Vercel Inc. (bzw. dessen europäischer Konzerngesellschaft) gehostet.
          Beim Aufruf der App erhebt der Hosting-Provider technisch notwendige Server-Log-Daten
          (u. a. IP-Adresse, Datum/Uhrzeit, aufgerufene Seite, verwendeter Browser). Diese Daten
          sind zum sicheren und stabilen Betrieb der App erforderlich (Art. 6 Abs. 1 lit. f DSGVO)
          und werden nicht mit anderen Datenquellen zusammengeführt.
        </p>
      </Section>

      <Section title="4. Registrierung und Nutzerkonto">
        <p>
          Für die Nutzung der Kernfunktionen (Ladepunkt-/Campingplatzsuche, Routenplanung,
          Community) ist ein Nutzerkonto erforderlich. Bei der Registrierung erheben wir deine
          E-Mail-Adresse und dein Passwort. Passwörter werden ausschließlich von unserem
          Auth-Dienstleister Supabase gehasht gespeichert – wir selbst sehen und speichern dein
          Passwort zu keinem Zeitpunkt im Klartext.
        </p>
        <p>
          Optional kannst du weitere Angaben ergänzen (Fahrzeug-/Wohnwagendaten für die
          Anhängertauglichkeits-Auswertung, eine Zuhause-Adresse für die Kartenzentrierung,
          Favoriten, Bewertungen, gespeicherte Routen). Diese Angaben gehen über das für die
          Kernfunktion notwendige Minimum hinaus und sind freiwillig.
        </p>
      </Section>

      <Section title="5. Standortdaten">
        <p>
          Für die Kartenanzeige und Routenplanung kannst du der App Zugriff auf deinen
          Gerätestandort geben (Standortfreigabe deines Browsers/Betriebssystems). Dein aktueller
          Standort wird dabei nicht dauerhaft auf unseren Servern gespeichert, sondern nur für die
          jeweilige Anfrage (z. B. „Ladesäule in der Nähe“, Routenberechnung) verwendet.
        </p>
      </Section>

      <Section title="6. Kartendarstellung (OpenStreetMap)">
        <p>
          Die Kartenkacheln werden direkt von den Servern der OpenStreetMap Foundation
          (tile.openstreetmap.org) geladen. Dabei wird deine IP-Adresse an diesen Anbieter
          übermittelt, technisch bedingt durch die Auslieferung der Kartenbilder. Weitere
          Informationen:{" "}
          <a
            href="https://wiki.osmfoundation.org/wiki/Privacy_Policy"
            target="_blank"
            rel="noopener noreferrer"
            className="text-route hover:underline"
          >
            Datenschutzerklärung der OpenStreetMap Foundation
          </a>
          .
        </p>
      </Section>

      <Section title="7. Cookies">
        <p>
          Wir setzen ausschließlich technisch notwendige Cookies unseres Auth-Dienstleisters
          Supabase ein, um dich eingeloggt zu halten (Session-Cookies, Art. 6 Abs. 1 lit. f DSGVO
          bzw. § 25 Abs. 2 Nr. 2 TTDSG). Aktuell verwenden wir keine Analyse-, Marketing- oder
          Tracking-Cookies. Sollte sich das künftig ändern, wird vor deren Einsatz eine
          Einwilligung eingeholt und diese Erklärung entsprechend aktualisiert.
        </p>
      </Section>

      <Section title="8. Fehler-Monitoring (Sentry)">
        <p>
          Zur technischen Absicherung des Betriebs (Erkennung und Behebung von Programmfehlern)
          kann die App den Dienst Sentry (Functional Software, Inc.) einsetzen. Dabei werden im
          Fehlerfall technische Informationen verarbeitet, u. a. IP-Adresse, Browser-/
          Geräteinformationen und der Kontext des aufgetretenen Fehlers – keine Inhalte deiner
          Nutzerdaten. Rechtsgrundlage ist unser berechtigtes Interesse an einer funktionierenden,
          fehlerfreien App (Art. 6 Abs. 1 lit. f DSGVO).
        </p>
      </Section>

      <Section title="9. Empfänger / Auftragsverarbeiter">
        <p>
          Wir setzen folgende Auftragsverarbeiter ein, mit denen entsprechende Verträge zur
          Auftragsverarbeitung (Art. 28 DSGVO) bestehen bzw. abgeschlossen werden: Supabase Inc.
          (Datenbank, Authentifizierung), Vercel Inc. (Hosting), Functional Software, Inc.
          (Sentry, Fehler-Monitoring). Eine Übermittlung an Anbieter mit Sitz außerhalb der EU/des
          EWR erfolgt nur, soweit ein angemessenes Datenschutzniveau sichergestellt ist (z. B.
          durch EU-Standardvertragsklauseln).
        </p>
      </Section>

      <Section title="10. Speicherdauer">
        <p>
          Wir speichern personenbezogene Daten, solange dein Nutzerkonto besteht bzw. solange dies
          zur Erfüllung der jeweiligen Zwecke erforderlich ist. Nach Löschung deines Kontos werden
          deine Daten gemäß den technischen Löschroutinen entfernt (siehe Abschnitt 11).
          Gesetzliche Aufbewahrungspflichten bleiben unberührt.
        </p>
      </Section>

      <Section title="11. Deine Rechte">
        <p>
          Du hast jederzeit das Recht auf Auskunft (Art. 15 DSGVO), Berichtigung (Art. 16 DSGVO),
          Löschung (Art. 17 DSGVO), Einschränkung der Verarbeitung (Art. 18 DSGVO),
          Datenübertragbarkeit (Art. 20 DSGVO) sowie Widerspruch gegen die Verarbeitung (Art. 21
          DSGVO). Konkret in der App:
        </p>
        <ul className="list-disc pl-5">
          <li>
            <strong>Eigene Daten herunterladen:</strong> unter{" "}
            <Link href="/profil/daten" className="text-route hover:underline">
              Profil → Meine Daten
            </Link>{" "}
            → &bdquo;Meine Daten herunterladen&ldquo; (Profil, Fahrzeuge/Wohnwagen, Favoriten,
            Bewertungen, gespeicherte Routen als JSON-Datei).
          </li>
          <li>
            <strong>Konto löschen:</strong> ebenfalls unter Profil → Meine Daten → &bdquo;Konto
            löschen&ldquo;.
            Damit werden dein Konto sowie alle damit verknüpften Daten (Fahrzeuge, Wohnwagen,
            Favoriten, eigene Bewertungen, gespeicherte Routen) unwiderruflich entfernt.
          </li>
          <li>
            <strong>E-Mail-Adresse/Passwort ändern:</strong> ebenfalls unter Profil → Meine Daten.
          </li>
        </ul>
        <p>
          Für alle weiteren Anliegen erreichst du uns unter{" "}
          <a href="mailto:hello@charge2camp.com" className="text-route hover:underline">
            hello@charge2camp.com
          </a>
          .
        </p>
      </Section>

      <Section title="12. Beschwerderecht bei einer Aufsichtsbehörde">
        <p>
          Du hast das Recht, dich bei einer Datenschutz-Aufsichtsbehörde zu beschweren. Zuständig
          für uns ist das Bayerische Landesamt für Datenschutzaufsicht (BayLDA), Promenade 27,
          91522 Ansbach – du kannst dich aber auch an die Aufsichtsbehörde deines eigenen
          Wohnorts wenden.
        </p>
      </Section>

      <Section title="13. Änderungen dieser Datenschutzerklärung">
        <p>
          Wir passen diese Datenschutzerklärung an, sobald sich der Funktionsumfang der App oder
          die zugrunde liegende Rechtslage ändert. Es gilt jeweils die aktuell auf dieser Seite
          veröffentlichte Fassung.
        </p>
      </Section>

      <p className="text-xs text-text-muted">
        Diese Erklärung beschreibt den technischen Ist-Zustand der App (Stand siehe oben) und
        ersetzt keine anwaltliche Beratung. Siehe auch:{" "}
        <Link href="/impressum" className="text-route hover:underline">
          Impressum
        </Link>
        .
      </p>
    </div>
  );
}
