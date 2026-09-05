import { useEffect, useRef, useState } from "react";
import { api, ApiError } from "../api/client";
import type { PropertyTree } from "../api/types";
import { Button, Modal } from "../components/ui";

const FEATURES = ["Abhörschutz (Stufe 2)", "Biometrischer Zugang", "Getrenntes Netzwerk (BSI-Konform)", "Keine Fenster"];
const CATEGORIES = ["Personalangelegenheiten", "Sicherheitsrelevante Planung", "Disziplinarverfahren", "Vorbereitung Verschlusssache", "Sonstiges"];
const HOLD_DURATION_MS = 1500;

/** Flow 5 — Vertrauliche Raumblockierung (FR-16/17). Long-Press + barrierefreie Doppelbestätigung. */
export default function ConfidentialBlock() {
  const [rooms, setRooms] = useState<{ id: number; label: string }[]>([]);
  const [roomId, setRoomId] = useState<number | null>(null);
  const [features, setFeatures] = useState<string[]>(["Abhörschutz (Stufe 2)", "Biometrischer Zugang"]);
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [startHour, setStartHour] = useState(9);
  const [endHour, setEndHour] = useState(11);
  const [category, setCategory] = useState(CATEGORIES[0]);
  const [justification, setJustification] = useState("");
  const [fileReference, setFileReference] = useState("");
  const [confirmed, setConfirmed] = useState(false);
  const [progress, setProgress] = useState(0);
  const [state, setState] = useState<"idle" | "loading" | "done" | "error">("idle");
  const [error, setError] = useState<string | null>(null);
  const [showFallbackConfirm, setShowFallbackConfirm] = useState(false);
  const timer = useRef<number | null>(null);

  useEffect(() => {
    api.get<{ id: number; name: string }[]>("/catalog/properties").then(async (props) => {
      const trees = await Promise.all(props.map((p) => api.get<PropertyTree>(`/catalog/properties/${p.id}/tree`)));
      const allRooms = trees.flatMap((t) => t.buildings.flatMap((b) => b.floors.flatMap((f) => f.rooms.map((r) => ({ id: r.id, label: `${r.name} (${t.name})` })))));
      setRooms(allRooms);
      if (allRooms.length) setRoomId(allRooms[0].id);
    });
  }, []);

  function toggleFeature(f: string) {
    setFeatures((cur) => (cur.includes(f) ? cur.filter((x) => x !== f) : [...cur, f]));
  }

  const canSubmit = confirmed && justification.trim().length > 0 && roomId !== null;

  async function submit() {
    if (!roomId) return;
    setState("loading");
    setError(null);
    try {
      await api.post("/confidential", {
        room_id: roomId,
        start_at: `${date}T${String(startHour).padStart(2, "0")}:00:00`,
        end_at: `${date}T${String(endHour).padStart(2, "0")}:00:00`,
        category,
        justification,
        features,
        file_reference: fileReference || null,
      });
      setState("done");
      setConfirmed(false);
      setProgress(0);
    } catch (e) {
      setState("error");
      setProgress(0);
      if (e instanceof ApiError) setError(e.message);
    }
  }

  function startHold() {
    if (!canSubmit) return;
    const startedAt = Date.now();
    timer.current = window.setInterval(() => {
      const pct = Math.min(100, ((Date.now() - startedAt) / HOLD_DURATION_MS) * 100);
      setProgress(pct);
      if (pct >= 100) {
        stopHold();
        submit();
      }
    }, 50);
  }

  function stopHold() {
    if (timer.current) {
      window.clearInterval(timer.current);
      timer.current = null;
    }
    if (progress < 100) setProgress(0);
  }

  return (
    <div className="max-w-2xl">
      <div className="mb-4 px-3 py-1.5 inline-block rounded bg-error text-on-error text-xs font-bold tracking-wide">
        VS-NFD | NUR FÜR DEN DIENSTGEBRAUCH
      </div>
      <h1 className="text-3xl font-bold mb-1">Vertrauliche Raumblockierung</h1>
      <p className="text-on-surface-variant mb-6">Keine Freigabeprüfung — jede Blockierung wird in einem zugriffsbeschränkten Audit-Log erfasst.</p>

      {state === "done" ? (
        <div className="p-4 rounded bg-tertiary-fixed/40 text-on-tertiary-fixed-variant">✓ Abgeschlossen. Der Vorgang wurde protokolliert.</div>
      ) : (
        <div className="space-y-6">
          {error && <div className="p-3 rounded bg-error-container text-on-error-container text-sm" role="alert">{error}</div>}

          <div className="bg-surface-container rounded-lg p-5 shadow-sm">
            <div className="font-semibold mb-3 flex items-center gap-2"><span className="w-8 h-8 rounded-full bg-primary text-on-primary flex items-center justify-center text-sm">1</span> Raum &amp; Spezifikationen</div>
            <select value={roomId ?? ""} onChange={(e) => setRoomId(Number(e.target.value))} className="w-full bg-surface rounded px-3 py-2 mb-3">
              {rooms.map((r) => <option key={r.id} value={r.id}>{r.label}</option>)}
            </select>
            <div className="flex flex-wrap gap-2">
              {FEATURES.map((f) => (
                <button
                  key={f}
                  onClick={() => toggleFeature(f)}
                  className={`px-3 py-1.5 rounded-full text-xs font-semibold ${features.includes(f) ? "bg-primary text-on-primary" : "bg-surface-container-high text-on-surface-variant"}`}
                >
                  {f}
                </button>
              ))}
            </div>
          </div>

          <div className="bg-surface-container rounded-lg p-5 shadow-sm">
            <div className="font-semibold mb-3 flex items-center gap-2"><span className="w-8 h-8 rounded-full bg-primary text-on-primary flex items-center justify-center text-sm">2</span> Terminierung</div>
            <div className="grid grid-cols-3 gap-3">
              <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="bg-surface rounded px-3 py-2" />
              <select value={startHour} onChange={(e) => setStartHour(Number(e.target.value))} className="bg-surface rounded px-3 py-2">
                {Array.from({ length: 24 }, (_, h) => <option key={h} value={h}>{h}:00</option>)}
              </select>
              <select value={endHour} onChange={(e) => setEndHour(Number(e.target.value))} className="bg-surface rounded px-3 py-2">
                {Array.from({ length: 24 }, (_, h) => <option key={h} value={h}>{h}:00</option>)}
              </select>
            </div>
            <p className="text-xs text-on-surface-variant mt-2">Blockierung von max. 72 Stunden am Stück möglich.</p>
          </div>

          <div className="bg-surface-container rounded-lg p-5 shadow-sm">
            <div className="font-semibold mb-3 flex items-center gap-2"><span className="w-8 h-8 rounded-full bg-primary text-on-primary flex items-center justify-center text-sm">3</span> Begründung &amp; Autorisierung</div>
            <select value={category} onChange={(e) => setCategory(e.target.value)} className="w-full bg-surface rounded px-3 py-2 mb-3">
              {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
            <textarea value={justification} onChange={(e) => setJustification(e.target.value)} placeholder="Detaillierte Begründung (Pflichtfeld, wird protokolliert)…" className="w-full bg-surface rounded px-3 py-2 mb-3" rows={3} />
            <input value={fileReference} onChange={(e) => setFileReference(e.target.value)} placeholder="Aktenzeichen / Referenz (optional)" className="w-full bg-surface rounded px-3 py-2 mb-3" />
            <label className="flex items-start gap-2 text-sm">
              <input type="checkbox" checked={confirmed} onChange={(e) => setConfirmed(e.target.checked)} className="mt-1 w-5 h-5" />
              Ich bestätige die Notwendigkeit dieser Buchung und übernehme die formelle Verantwortung für die Blockierung.
            </label>
          </div>

          <div className="flex items-center gap-4">
            <button
              disabled={!canSubmit}
              onMouseDown={startHold}
              onMouseUp={stopHold}
              onMouseLeave={stopHold}
              onTouchStart={startHold}
              onTouchEnd={stopHold}
              className="relative overflow-hidden px-6 py-3 rounded bg-error text-on-error font-semibold disabled:opacity-50 select-none"
            >
              <span className="absolute inset-0 bg-white/20" style={{ width: `${progress}%` }} />
              <span className="relative">{state === "loading" ? "Verarbeite…" : "Halten zum Blockieren"}</span>
            </button>
            <button disabled={!canSubmit} onClick={() => setShowFallbackConfirm(true)} className="text-sm text-primary disabled:opacity-50">
              Alternative ohne Halten (Tastatur)
            </button>
          </div>
        </div>
      )}

      {showFallbackConfirm && (
        <Modal title="Blockierung bestätigen" onClose={() => setShowFallbackConfirm(false)}>
          <p className="text-sm mb-4">Diese Aktion umgeht Standardbuchungsregeln. Bitte bestätigen Sie explizit ein zweites Mal.</p>
          <Button
            variant="destructive"
            className="w-full"
            onClick={() => {
              setShowFallbackConfirm(false);
              submit();
            }}
          >
            Ja, jetzt blockieren
          </Button>
        </Modal>
      )}
    </div>
  );
}
