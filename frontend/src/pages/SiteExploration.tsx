import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../api/client";
import type { PropertyOut } from "../api/types";
import { Card } from "../components/ui";
import { GermanyMap, projectLatLon } from "../components/GermanyMap";

/** Flow 2 (Einstieg) — Standort-Exploration: Liegenschaften nach Auslastung, Sprung in den Raumplan. */
export default function SiteExploration() {
  const [properties, setProperties] = useState<PropertyOut[]>([]);
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const navigate = useNavigate();

  useEffect(() => {
    api.get<PropertyOut[]>(`/catalog/properties?target_date=${date}`).then(setProperties);
  }, [date]);

  function markerColor(p: PropertyOut) {
    if (p.free_desks === 0) return "bg-error";
    if (p.occupancy_pct >= 80) return "bg-tertiary";
    return "bg-primary";
  }

  function openProperty(propertyId: number) {
    navigate(`/gezielte-buchung/${propertyId}?date=${date}`);
  }

  return (
    <div>
      <h1 className="text-3xl font-bold mb-1">Raumplan — Standort-Exploration</h1>
      <p className="text-on-surface-variant mb-4">Wählen Sie eine Liegenschaft, um deren Raumplan zu öffnen.</p>
      <div className="mb-6">
        <label className="text-sm text-on-surface-variant mr-2">Datum</label>
        <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="bg-surface-container-low rounded px-3 py-1.5 text-sm" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="space-y-3">
          {properties.map((p) => (
            <Card key={p.id} className="cursor-pointer hover:shadow-md" >
              <div className="flex justify-between items-start">
                <div>
                  <div className="font-semibold">{p.name}</div>
                  <div className="text-sm text-on-surface-variant">{p.address}</div>
                  <div className="text-sm mt-1">
                    <span className={p.free_desks === 0 ? "text-error font-semibold" : "text-tertiary-fixed-dim font-semibold"}>{p.free_desks} Frei</span>
                    <span className="text-on-surface-variant"> · Auslastung {p.occupancy_pct}%</span>
                  </div>
                  {(p.labels ?? []).length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-2">
                      {(p.labels ?? []).map((l) => (
                        <span key={l} className="text-xs px-2 py-0.5 rounded-full bg-secondary-container text-on-secondary-container">{l}</span>
                      ))}
                    </div>
                  )}
                </div>
                <button
                  onClick={() => openProperty(p.id)}
                  className="text-sm px-3 py-1.5 rounded bg-surface-container-high hover:bg-surface-container-highest"
                >
                  Raumplan öffnen
                </button>
              </div>
            </Card>
          ))}
        </div>

        <div className="relative bg-surface-container-low rounded-xl border border-outline-variant/30 min-h-[420px] overflow-hidden">
          <GermanyMap />
          {properties.map((p) => {
            const { x, y } = projectLatLon(p.lat, p.lon);
            const size = Math.max(24, Math.min(60, p.total_desks));
            return (
              <button
                key={p.id}
                type="button"
                onClick={() => openProperty(p.id)}
                aria-label={`Liegenschaft ${p.name}: ${p.free_desks} von ${p.total_desks} Desks frei, Auslastung ${p.occupancy_pct}%`}
                title={`${p.name} — ${p.free_desks} frei`}
                style={{ left: `${x}%`, top: `${y}%`, width: size, height: size, marginLeft: -size / 2, marginTop: -size / 2 }}
                className={`absolute rounded-full text-white text-xs font-semibold flex items-center justify-center shadow-md hover:scale-110 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-primary transition-transform ring-2 ring-white/70 ${markerColor(p)}`}
              >
                <span aria-hidden="true">{p.free_desks}</span>
              </button>
            );
          })}
          <div className="absolute bottom-2 right-2 bg-surface-container-lowest rounded p-2 text-xs shadow">
            <div><span className="inline-block w-2 h-2 rounded-full bg-primary mr-1" />&gt;20% frei</div>
            <div><span className="inline-block w-2 h-2 rounded-full bg-tertiary mr-1" />10–20% frei</div>
            <div><span className="inline-block w-2 h-2 rounded-full bg-error mr-1" />&lt;10% frei</div>
          </div>
        </div>
      </div>
    </div>
  );
}
