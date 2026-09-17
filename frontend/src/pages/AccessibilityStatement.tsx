import { useState } from "react";
import { Button, Card } from "../components/ui";

/**
 * Erklärung zur Barrierefreiheit gemäß § 7 BITV 2.0 und § 12b BGG
 * Inklusive Feedback-Mechanismus, Schlichtungsverfahren und Abschnitten in Leichter Sprache & DGS.
 */
export default function AccessibilityStatement() {
  const [activeTab, setActiveTab] = useState<"standard" | "easy_language" | "sign_language">("standard");
  const [feedbackSent, setFeedbackSent] = useState(false);
  const [feedbackText, setFeedbackText] = useState("");
  const [contactEmail, setContactEmail] = useState("");

  function handleSubmitFeedback(e: React.FormEvent) {
    e.preventDefault();
    if (!feedbackText.trim()) return;
    setFeedbackSent(true);
    setFeedbackText("");
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Kopfbereich */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-outline-variant/30 pb-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-on-surface">
            Erklärung zur Barrierefreiheit
          </h1>
          <p className="text-sm text-on-surface-variant mt-1">
            DeskSharing BAMF — Bundesamt für Migration und Flüchtlinge
          </p>
        </div>

        {/* Sprachmodi-Umschalter (BITV 2.0 § 4) */}
        <div role="tablist" aria-label="Sprachvariante wählen" className="flex gap-1.5 bg-surface-container-low p-1 rounded-lg border border-outline-variant/30">
          <button
            role="tab"
            aria-selected={activeTab === "standard"}
            onClick={() => setActiveTab("standard")}
            className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary ${
              activeTab === "standard" ? "bg-primary text-on-primary shadow-sm" : "text-on-surface-variant hover:text-on-surface"
            }`}
          >
            Alltagssprache
          </button>
          <button
            role="tab"
            aria-selected={activeTab === "easy_language"}
            onClick={() => setActiveTab("easy_language")}
            className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary ${
              activeTab === "easy_language" ? "bg-primary text-on-primary shadow-sm" : "text-on-surface-variant hover:text-on-surface"
            }`}
          >
            🔍 Leichte Sprache
          </button>
          <button
            role="tab"
            aria-selected={activeTab === "sign_language"}
            onClick={() => setActiveTab("sign_language")}
            className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary ${
              activeTab === "sign_language" ? "bg-primary text-on-primary shadow-sm" : "text-on-surface-variant hover:text-on-surface"
            }`}
          >
            👐 Gebärdensprache (DGS)
          </button>
        </div>
      </div>

      {/* 1. STANDARDSCHRIFTLICHES DOKUMENT */}
      {activeTab === "standard" && (
        <div className="space-y-6 text-sm text-on-surface leading-relaxed">
          <Card className="space-y-3">
            <h2 className="text-lg font-bold text-on-surface">Stand der Vereinbarkeit mit den Anforderungen</h2>
            <p>
              Das Bundesamt für Migration und Flüchtlinge (BAMF) ist bemüht, seine Webanwendung <strong>DeskSharing BAMF</strong> im Einklang mit den nationalen Rechtsvorschriften zur Umsetzung der Richtlinie (EU) 2016/2102 des Europäischen Parlaments und des Rates barrierefrei zugänglich zu machen.
            </p>
            <p>
              Diese Erklärung zur Barrierefreiheit gilt für die Webanwendung <em>DeskSharing BAMF</em>.
            </p>
            <div className="p-3 rounded bg-surface-container border border-outline-variant/30 font-medium">
              Konformitätsstatus: <strong>Weitgehend vereinbar</strong> mit den Anforderungen der <strong>BITV 2.0 (Barrierefreie-Informationstechnik-Verordnung)</strong> und der europäischen Norm <strong>EN 301 549 (WCAG 2.1 Konformitätsstufe AA)</strong>.
            </div>
          </Card>

          <Card className="space-y-3">
            <h2 className="text-lg font-bold text-on-surface">Zwei-Sinne-Prinzip & Barrierefreier Raumplan</h2>
            <p>
              Die Anwendung ermöglicht die flexible Buchung von Arbeitsplätzen und Besprechungsräumen. Gemäß den Prinzipien universellen Designs stehen zwei gleichwertige Zugangswege zur Verfügung:
            </p>
            <ul className="list-disc pl-5 space-y-2 text-on-surface">
              <li>
                <strong>Grafischer interaktiver Raumplan (SVG-Barrierefreiheit):</strong> Der visuelle Grundriss ist für Tastaturbedienung erschlossen. Alle Räume und Schreibtische können per <kbd className="px-1.5 py-0.5 bg-surface-container rounded border border-outline-variant/40 text-xs">Tab</kbd> angesteuert und mit <kbd className="px-1.5 py-0.5 bg-surface-container rounded border border-outline-variant/40 text-xs">Eingabetaste</kbd> ausgewählt werden. Zustände (frei, belegt, gesperrt, Zone) sind nach dem Zwei-Kanal-Prinzip sowohl farblich als auch mit deutlichen Symbolen (<span aria-hidden="true">✓, ★, 🔒, 👤, 🏷️</span>) unterscheidbar (WCAG 1.4.1).
              </li>
              <li>
                <strong>Vollwertige Listenansicht (Dual-Mode):</strong> Über die Umschaltung auf die <em>📋 Listenansicht</em> steht jederzeit eine semantisch gegliederte tabellarische Textalternative bereit, die von Screenreadern optimal interpretiert werden kann und denselben Funktionsumfang (Filter, Details, Buchung) aufweist.
              </li>
            </ul>
          </Card>

          <Card className="space-y-3">
            <h2 className="text-lg font-bold text-on-surface">Nicht barrierefreie Inhalte</h2>
            <p>
              Trotz sorgfältiger Entwicklung sind folgende Teilbereiche noch nicht vollständig barrierefrei:
            </p>
            <ul className="list-disc pl-5 space-y-1 text-on-surface">
              <li>
                <strong>Grafischer Grundriss-Designer (Facility Management):</strong> Das freie Zeichnen und Ziehen von Raumgrenzen und Wandelementen auf der Leinwand erfordert derzeit eine Maus- bzw. Zeigerinteraktion. <em>Barrierefreie Alternative:</em> Alle Liegenschaften, Etagen, Räume und Desks können vollständig über die tabellarischen Formulare im Reiter „Stammdaten“ erfasst und konfiguriert werden.
              </li>
            </ul>
            <p className="text-xs text-on-surface-variant">
              Wir arbeiten kontinuierlich an der Optimierung und Weiterentwicklung dieser Funktionen.
            </p>
          </Card>

          <Card className="space-y-3">
            <h2 className="text-lg font-bold text-on-surface">Feedback-Mechanismus und Barrieren melden</h2>
            <p>
              Sind Ihnen Barrieren beim Zugang zu Inhalten von DeskSharing BAMF aufgefallen? Oder haben Sie Fragen zur Umsetzung der Barrierefreiheit?
            </p>
            <p>
              Sie können uns Mängel bezüglich der Einhaltung der Barrierefreiheitsanforderungen mitteilen:
            </p>

            {feedbackSent ? (
              <div className="p-4 rounded-lg bg-tertiary-fixed/30 text-on-tertiary-fixed-variant border border-tertiary-fixed flex items-center gap-2" role="status">
                <span className="text-xl">✅</span>
                <span>Vielen Dank für Ihre Rückmeldung! Unser Barrierefreiheits-Team wird Ihr Anliegen prüfen.</span>
              </div>
            ) : (
              <form onSubmit={handleSubmitFeedback} className="space-y-3 pt-2">
                <div>
                  <label htmlFor="fb-email" className="block text-xs font-semibold text-on-surface-variant mb-1">
                    Ihre E-Mail-Adresse (optional für Rückfragen):
                  </label>
                  <input
                    id="fb-email"
                    type="email"
                    value={contactEmail}
                    onChange={(e) => setContactEmail(e.target.value)}
                    placeholder="name@bamf.bund.de"
                    className="w-full max-w-md bg-surface-container-low rounded px-3 py-2 text-sm border border-outline-variant/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                  />
                </div>
                <div>
                  <label htmlFor="fb-text" className="block text-xs font-semibold text-on-surface-variant mb-1">
                    Beschreibung der Barriere: <span className="text-error">*</span>
                  </label>
                  <textarea
                    id="fb-text"
                    required
                    rows={3}
                    value={feedbackText}
                    onChange={(e) => setFeedbackText(e.target.value)}
                    placeholder="Wo und welches Problem ist aufgetreten? (z.B. Tastaturbedienung, Screenreader-Ansage, Kontrast)..."
                    className="w-full bg-surface-container-low rounded px-3 py-2 text-sm border border-outline-variant/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                  />
                </div>
                <Button type="submit" variant="primary">
                  Barriere melden
                </Button>
              </form>
            )}
          </Card>

          <Card className="space-y-3">
            <h2 className="text-lg font-bold text-on-surface">Schlichtungsverfahren (§ 16 BGG)</h2>
            <p>
              Sollte auf Ihre Anfrage oder Meldung innerhalb von vier Wochen keine zufriedenstellende Antwort eingehen, können Sie bei der Schlichtungsstelle nach dem Behindertengleichstellungsgesetz (BGG) einen Antrag auf Einleitung eines Schlichtungsverfahrens stellen.
            </p>
            <div className="p-3 rounded bg-surface-container text-xs space-y-1">
              <div className="font-semibold">Schlichtungsstelle nach dem Behindertengleichstellungsgesetz bei dem Beauftragten der Bundesregierung für die Belange von Menschen mit Behinderungen</div>
              <div>Mauerstraße 53, 10117 Berlin</div>
              <div>Telefon: +49 (0)30 18 527-2805</div>
              <div>E-Mail: <a href="mailto:info@schlichtungsstelle-bgg.de" className="text-primary hover:underline">info@schlichtungsstelle-bgg.de</a></div>
              <div>Internet: <a href="https://www.schlichtungsstelle-bgg.de" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">www.schlichtungsstelle-bgg.de</a></div>
            </div>
          </Card>

          <div className="text-xs text-on-surface-variant pt-2">
            Erklärung erstellt am: 10. September 2026. Zuletzt überprüft am: 10. September 2026.
          </div>
        </div>
      )}

      {/* 2. LEICHTE SPRACHE */}
      {activeTab === "easy_language" && (
        <Card className="space-y-4 text-base leading-relaxed text-on-surface">
          <div className="flex items-center gap-3 border-b border-outline-variant/30 pb-3">
            <span className="text-3xl" aria-hidden="true">📖</span>
            <h2 className="text-xl font-bold">Erklärung in Leichter Sprache</h2>
          </div>
          <p className="font-semibold text-lg">
            Herzlich willkommen bei DeskSharing BAMF!
          </p>
          <p>
            DeskSharing ist ein englisches Wort. Es bedeutet: Man teilt sich Schreibtische bei der Arbeit.
          </p>
          <p>
            Mit dieser Internet-Seite können Sie:
          </p>
          <ul className="list-disc pl-6 space-y-1">
            <li>Einen Schreibtisch für einen Tag buchen.</li>
            <li>Einen Raum für eine Besprechung (Meeting) buchen.</li>
            <li>Sehen, welche Tische frei oder belegt sind.</li>
          </ul>

          <h3 className="text-base font-bold pt-2">Wie kann ich die Seite bedienen?</h3>
          <ul className="list-disc pl-6 space-y-1">
            <li><strong>Mit der Maus:</strong> Sie können auf die Zeichnung vom Raum klicken.</li>
            <li><strong>Mit der Tastatur:</strong> Sie können mit der Tab-Taste von Tisch zu Tisch springen und mit der Enter-Taste wählen.</li>
            <li><strong>Mit der Liste:</strong> Wenn Sie die Zeichnung nicht sehen möchten, klicken Sie oben auf „Liste”. Dann stehen alle Tische untereinander geschrieben.</li>
          </ul>

          <h3 className="text-base font-bold pt-2">Haben Sie ein Problem gefunden?</h3>
          <p>
            Wenn Sie etwas auf dieser Seite nicht gut bedienen können, sagen Sie uns bitte Bescheid. Wir helfen Ihnen gerne!
          </p>
        </Card>
      )}

      {/* 3. GEBÄRDENSPRACHE (DGS) */}
      {activeTab === "sign_language" && (
        <Card className="space-y-4 text-sm text-on-surface">
          <div className="flex items-center gap-3 border-b border-outline-variant/30 pb-3">
            <span className="text-3xl" aria-hidden="true">👐</span>
            <h2 className="text-xl font-bold">Deutsche Gebärdensprache (DGS)</h2>
          </div>
          <p>
            In diesem Bereich stellen wir Ihnen Informationen zur Nutzung der Webanwendung <em>DeskSharing BAMF</em> und zur Barrierefreiheit in Deutscher Gebärdensprache zur Verfügung.
          </p>
          <div className="p-8 rounded-xl bg-surface-container flex flex-col items-center justify-center text-center space-y-3 border border-outline-variant/30">
            <div className="w-16 h-16 rounded-full bg-primary/10 text-primary flex items-center justify-center text-3xl" aria-hidden="true">
              🎬
            </div>
            <div className="font-semibold text-base">Video-Informationen zur Anwendung</div>
            <p className="text-xs text-on-surface-variant max-w-md">
              Das Video erklärt den Aufbau des Systems, die Buchung eines Arbeitsplatzes über den Grundriss oder die Liste sowie Ihre Rechte nach dem Behindertengleichstellungsgesetz.
            </p>
            <div className="text-xs text-primary font-medium px-3 py-1.5 rounded bg-primary/10 border border-primary/20">
              DGS-Video im Bundes-Portal bereitgestellt
            </div>
          </div>
        </Card>
      )}
    </div>
  );
}
