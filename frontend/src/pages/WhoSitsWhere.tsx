import { useEffect, useState } from "react";
import { api } from "../api/client";
import type { PresenceEntry } from "../api/types";
import { EmptyState } from "../components/ui";

export default function WhoSitsWhere() {
  const [query, setQuery] = useState("");
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [entries, setEntries] = useState<PresenceEntry[]>([]);
  const [revealed, setRevealed] = useState<Record<string, string>>({});

  function load() {
    const params = new URLSearchParams({ target_date: date });
    if (query) params.set("q", query);
    api.get<PresenceEntry[]>(`/presence?${params.toString()}`).then(setEntries);
  }

  useEffect(load, [query, date]);

  async function reveal(idmCode: string) {
    const res = await api.get<{ display_name: string }>(`/presence/reveal/${idmCode}`);
    setRevealed((r) => ({ ...r, [idmCode]: res.display_name }));
  }

  const isToday = date === new Date().toISOString().slice(0, 10);

  return (
    <div>
      <h1 className="text-3xl font-bold mb-1">Wer sitzt wo?</h1>
      <p className="text-on-surface-variant mb-6">Pseudonymisierte Anwesenheitsübersicht — Klarname nur nach bewusstem Klick.</p>

      <div className="flex flex-wrap gap-3 mb-6">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Name, Abteilung, Team…"
          className="flex-1 min-w-[240px] bg-surface-container-low rounded px-3 py-2"
        />
        <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="bg-surface-container-low rounded px-3 py-2" />
        {!isToday && (
          <button onClick={() => setDate(new Date().toISOString().slice(0, 10))} className="text-sm text-primary">
            Heute
          </button>
        )}
      </div>

      {entries.length === 0 && (
        <EmptyState
          title="Keine Kolleg:innen gefunden"
          description={query ? `Für „${query}“ liegen keine Treffer vor.` : `Für den ${new Date(date).toLocaleDateString("de-DE")} ist niemand als anwesend erfasst.`}
        />
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {entries.map((e) => (
          <div key={e.booking_id} className="p-4 rounded bg-surface-container-lowest border border-outline-variant/30">
            <div className="font-semibold">{e.display_name ?? revealed[e.idm_code] ?? e.idm_code}</div>
            {!e.display_name && !revealed[e.idm_code] && (
              <button onClick={() => reveal(e.idm_code)} className="text-xs text-primary mt-0.5">Klarname anzeigen</button>
            )}
            <div className="text-sm text-on-surface-variant mt-1">{e.department}</div>
            <div className="text-sm text-on-surface-variant">{e.desk_number} · {e.room_name}</div>
            <div className="text-xs text-on-surface-variant">{e.building_name} · {e.property_name}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
