import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Impressum – charge2camp",
};

// Pflichtangaben nach § 5 DDG (Digitale-Dienste-Gesetz, vormals TMG) --
// bewusst als eigene, oeffentlich ohne Login erreichbare Route (nicht
// unter /profil/*), da das Impressum "leicht erkennbar, unmittelbar
// erreichbar und staendig verfuegbar" sein muss. Verlinkt aus SiteFooter
// (Desktop) sowie der Startseite und ProfileSidebar (Mobile, wo der
// Footer wegen der Bottom-Tab-Bar ausgeblendet bleibt, siehe dort).
export default function ImpressumPage() {
  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-8 px-4 py-16">
      <h1 className="text-2xl font-semibold">Impressum</h1>

      <section>
        <h2 className="font-semibold">Angaben gemäß § 5 DDG</h2>
        <p className="mt-2 text-sm text-black/70 dark:text-white/70">
          Sascha Panadero Fernández – charge2camp
          <br />
          Hauptstr. 15D
          <br />
          85551 Kirchheim bei München
          <br />
          Deutschland
        </p>
        <p className="mt-2 text-xs text-text-muted">Einzelunternehmen / Kleingewerbe</p>
      </section>

      <section>
        <h2 className="font-semibold">Kontakt</h2>
        <p className="mt-2 text-sm text-black/70 dark:text-white/70">
          E-Mail:{" "}
          <a href="mailto:hello@charge2camp.com" className="text-route hover:underline">
            hello@charge2camp.com
          </a>
        </p>
      </section>

      <section>
        <h2 className="font-semibold">Verantwortlich für den Inhalt nach § 18 Abs. 2 MStV</h2>
        <p className="mt-2 text-sm text-black/70 dark:text-white/70">
          Sascha Panadero Fernández (Anschrift wie oben)
        </p>
      </section>

      <section>
        <h2 className="font-semibold">Haftung für Inhalte</h2>
        <p className="mt-2 text-sm text-black/70 dark:text-white/70">
          Als Diensteanbieter sind wir gemäß § 7 Abs. 1 DDG für eigene Inhalte auf diesen Seiten
          nach den allgemeinen Gesetzen verantwortlich. Nach §§ 8 bis 10 DDG sind wir als
          Diensteanbieter jedoch nicht verpflichtet, übermittelte oder gespeicherte fremde
          Informationen zu überwachen oder nach Umständen zu forschen, die auf eine rechtswidrige
          Tätigkeit hinweisen. Verpflichtungen zur Entfernung oder Sperrung der Nutzung von
          Informationen nach den allgemeinen Gesetzen bleiben hiervon unberührt. Eine
          diesbezügliche Haftung ist jedoch erst ab dem Zeitpunkt der Kenntnis einer konkreten
          Rechtsverletzung möglich. Bei Bekanntwerden von entsprechenden Rechtsverletzungen werden
          wir diese Inhalte umgehend entfernen.
        </p>
      </section>

      <section>
        <h2 className="font-semibold">Haftung für Links</h2>
        <p className="mt-2 text-sm text-black/70 dark:text-white/70">
          Unser Angebot enthält Links zu externen Websites Dritter (u. a. OpenStreetMap, Open
          Charge Map, Ladestationsbetreiber, Campingplatz-Websites), auf deren Inhalte wir keinen
          Einfluss haben. Deshalb können wir für diese fremden Inhalte auch keine Gewähr
          übernehmen. Für die Inhalte der verlinkten Seiten ist stets der jeweilige Anbieter oder
          Betreiber der Seiten verantwortlich. Eine permanente inhaltliche Kontrolle der
          verlinkten Seiten ist ohne konkrete Anhaltspunkte einer Rechtsverletzung nicht zumutbar.
          Bei Bekanntwerden von Rechtsverletzungen werden wir derartige Links umgehend entfernen.
        </p>
      </section>

      <section>
        <h2 className="font-semibold">Urheberrecht</h2>
        <p className="mt-2 text-sm text-black/70 dark:text-white/70">
          Die durch die Betreiber erstellten Inhalte und Werke auf diesen Seiten unterliegen dem
          deutschen Urheberrecht. Kartendaten stammen von OpenStreetMap-Mitwirkenden (©
          OpenStreetMap contributors, ODbL) und Open Charge Map. Beiträge Dritter sind als solche
          gekennzeichnet.
        </p>
      </section>

      <p className="text-sm text-text-muted">
        Siehe auch: <Link href="/datenschutz" className="text-route hover:underline">Datenschutzerklärung</Link>
      </p>
    </div>
  );
}
