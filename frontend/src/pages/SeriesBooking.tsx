import { useEffect, useState } from "react";
import { api, ApiError } from "../api/client";
import type { PropertyOut, PropertyTree, SeriesOccurrencePreview, SeriesPreviewOut, SeriesResultOut } from "../api/types";
import { Button, Card } from "../components/ui";
import { useAuth } from "../context/AuthContext";

const WEEKDAYS = ["Mo", "Di", "Mi", "Do", "Fr", "Sa", "So"];

/** Flow 3 — Serienbuchung (FR-9/10): erst Vorschau mit Anpassungsmöglichkeit, dann buchen. */
export default function SeriesBooking() {
  const { actingAsUserId } = useAuth();
  const [properties, setProperties] = useState<PropertyOut[]>([]);
  const [propertyId, setPropertyId] = useState<number | null>(null);
  const [tree, setTree] = useState<PropertyTree | null>(null);
  const [kind, setKind] = useState<"desk" | "room">("desk");
  const [resourceId, setResourceId] = useState<number | null>(null);
  const [weekdays, setWeekdays] = useState<number[]>([0, 1]);
  const [interval, setInterval_] = useState("weekly");
  const [startDate, setStartDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [endDate, setEndDate] = useState(() => {
    const d = new Date();
    d.setMonth(d.getMonth() + 6);
    return d.toISOString().slice(0, 10);
  });
  const [preview, setPreview] = useState<SeriesOccurrencePreview[] | null>(null);
  const [excluded, setExcluded] = useState<Set<string>>(new Set());
  const [result, setResult] = useState<SeriesResultOut | null>(null);
  const [state, setState] = useState<"idle" | "loading" | "error">("idle");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api.get<PropertyOut[]>("/catalog/properties").then((props) => {
      setProperties(props);
      if (props.length) setPropertyId((current) => current ?? props[0].id);
    });
  }, []);

  useEffect(() => {
    if (!propertyId) return;
    api.get<PropertyTree>(`/catalog/properties/${propertyId}/tree`).then(setTree);
  }, [propertyId]);

  const resources = tree
    ? tree.buildings.flatMap((b) =>
        b.floors.flatMap((f) =>
          f.rooms
            .filter((r) => (kind === "desk" ? r.room_type === "desk_area" : r.room_type === "meeting"))
            .flatMap((r) => (kind === "desk" ? r.desks.map((d) => ({ id: d.id, label: `${d.desk_number} · ${r.name}` })) : [{ id: r.id, label: r.name }])),
        ),
      )
    : [];

  function toggleWeekday(d: number) {
    setWeekdays((w) => (w.includes(d) ? w.filter((x) => x !== d) : [...w, d].sort()));
  }

  function occKey(o: SeriesOccurrencePreview) {
    return `${o.date}-${o.resource_id}`;
  }

  async function loadPreview() {
    if (!resourceId) return;
    setState("loading");
    setError(null);
    try {
      const res = await api.post<SeriesPreviewOut>("/bookings/series/preview", {
        kind,
        resource_id: resourceId,
        weekdays,
        interval,
        start_date: startDate,
        end_date: endDate,
        for_user_id: actingAsUserId ?? undefined,
      });
      setPreview(res.occurrences);
      setExcluded(new Set(res.occurrences.filter((o) => !o.available).map(occKey)));
      setState("idle");
    } catch (e) {
      setState("error");
      if (e instanceof ApiError) setError(e.message);
    }
  }

  function toggleExcluded(o: SeriesOccurrencePreview) {
    setExcluded((s) => {
      const next = new Set(s);
      const key = occKey(o);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  async function confirm() {
    if (!preview) return;
    setState("loading");
    setError(null);
    try {
      const occurrences = preview.filter((o) => !excluded.has(occKey(o))).map((o) => ({ date: o.date, resource_id: o.resource_id }));
      const res = await api.post<SeriesResultOut>("/bookings/series", {
        kind,
        occurrences,
        interval,
        end_date: endDate,
        for_user_id: actingAsUserId ?? undefined,
      });
      setResult(res);
      setPreview(null);
      setState("idle");
    } catch (e) {
      setState("error");
      if (e instanceof ApiError) setError(e.message);
    }
  }

  function resetAll() {
    setResult(null);
    setPreview(null);
    setExcluded(new Set());
  }

  const includedCount = preview ? preview.filter((o) => !excluded.has(occKey(o))).length : 0;

  return (
    <div className="max-w-2xl">
      <h1 className="text-3xl font-bold mb-1">Serienbuchung</h1>
      <p className="text-on-surface-variant mb-6">Wiederkehrende Buchung nach Wochentagsmuster — erst Vorschau prüfen und anpassen, dann verbindlich buchen.</p>

      {result ? (
        <Card>
          <div className="text-lg font-semibold mb-2">
            {result.booked} Erfolgreich / {result.conflicts.length} Konflikte
          </div>
          {result.conflicts.length > 0 && (
            <ul className="text-sm space-y-1 mb-4">
              {result.conflicts.map((c, i) => (
                <li key={i} className="flex justify-between border-b border-outline-variant/20 py-1">
                  <span>{c.date}</span>
                  <span className="text-on-surface-variant">{c.reason}{c.alternative_desk_number ? ` (${c.alternative_desk_number})` : ""}</span>
                </li>
              ))}
            </ul>
          )}
          <Button variant="secondary" onClick={resetAll}>Neue Serie anlegen</Button>
        </Card>
      ) : preview ? (
        <Card>
          <div className="flex items-center justify-between mb-3">
            <div className="font-semibold">{includedCount} von {preview.length} Terminen ausgewählt</div>
            <button onClick={() => setPreview(null)} className="text-sm text-primary">← Muster ändern</button>
          </div>
          <p className="text-xs text-on-surface-variant mb-3">
            Konfliktbehaftete Tage sind vorab abgewählt (bei Desks ggf. mit Ersatzvorschlag). Sie können jeden Tag einzeln aus der Serie
            nehmen oder wieder hinzufügen, bevor Sie verbindlich buchen.
          </p>
          <div className="space-y-1 max-h-96 overflow-y-auto mb-4">
            {preview.map((o) => {
              const key = occKey(o);
              const isExcluded = excluded.has(key);
              return (
                <label key={key} className={`flex items-center gap-3 p-2 rounded text-sm ${isExcluded ? "opacity-50" : "bg-surface-container-low"}`}>
                  <input type="checkbox" checked={!isExcluded} onChange={() => toggleExcluded(o)} />
                  <span className="w-28 shrink-0 data-tabular">{new Date(o.date).toLocaleDateString("de-DE", { weekday: "short", day: "2-digit", month: "2-digit" })}</span>
                  <span className="flex-1">{o.resource_label}</span>
                  {o.labels.length > 0 && <span className="text-xs text-on-surface-variant">{o.labels.join(", ")}</span>}
                  {o.conflict_reason && <span className="text-xs text-error">{o.conflict_reason}</span>}
                </label>
              );
            })}
          </div>
          {error && <div className="p-2 rounded bg-error-container text-on-error-container text-sm mb-3" role="alert">{error}</div>}
          <Button variant="primary" loading={state === "loading"} disabled={includedCount === 0} onClick={confirm}>
            {includedCount} Termine verbindlich buchen
          </Button>
        </Card>
      ) : (
        <Card>
          <div className="space-y-4">
            <div className="flex gap-2">
              {(["desk", "room"] as const).map((k) => (
                <button
                  key={k}
                  onClick={() => { setKind(k); setResourceId(null); }}
                  className={`px-3 py-1.5 rounded-full text-sm font-semibold ${kind === k ? "bg-primary text-on-primary" : "bg-surface-container-high text-on-surface-variant"}`}
                >
                  {k === "desk" ? "Arbeitsplatz" : "Meetingraum"}
                </button>
              ))}
            </div>

            <label className="block text-sm">
              Liegenschaft
              <select value={propertyId ?? ""} onChange={(e) => setPropertyId(Number(e.target.value))} className="w-full mt-1 bg-surface-container-low rounded px-3 py-2">
                {properties.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </label>

            <label className="block text-sm">
              Ressource
              <select value={resourceId ?? ""} onChange={(e) => setResourceId(Number(e.target.value))} className="w-full mt-1 bg-surface-container-low rounded px-3 py-2">
                <option value="">Bitte wählen…</option>
                {resources.map((r) => <option key={r.id} value={r.id}>{r.label}</option>)}
              </select>
            </label>

            <div>
              <div className="text-sm mb-1">Wochentage wählen</div>
              <div className="flex gap-2">
                {WEEKDAYS.map((label, idx) => (
                  <button
                    key={label}
                    onClick={() => toggleWeekday(idx)}
                    className={`w-10 h-10 rounded font-semibold text-sm ${weekdays.includes(idx) ? "bg-primary text-on-primary" : "bg-surface-container-high text-on-surface-variant"}`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>

            <label className="block text-sm">
              Intervall
              <select value={interval} onChange={(e) => setInterval_(e.target.value)} className="w-full mt-1 bg-surface-container-low rounded px-3 py-2">
                <option value="weekly">Wöchentlich</option>
                <option value="biweekly">Zweiwöchentlich</option>
                <option value="monthly">Monatlich</option>
              </select>
            </label>

            <div className="grid grid-cols-2 gap-3">
              <label className="block text-sm">
                Startdatum
                <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="w-full mt-1 bg-surface-container-low rounded px-3 py-2" />
              </label>
              <label className="block text-sm">
                Enddatum
                <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="w-full mt-1 bg-surface-container-low rounded px-3 py-2" />
              </label>
            </div>

            {error && <div className="p-2 rounded bg-error-container text-on-error-container text-sm" role="alert">{error}</div>}

            <Button variant="primary" loading={state === "loading"} disabled={!resourceId || weekdays.length === 0} onClick={loadPreview}>
              Vorschau anzeigen
            </Button>
          </div>
        </Card>
      )}
    </div>
  );
}
