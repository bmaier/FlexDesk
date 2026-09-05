import { useEffect, useState } from "react";
import { api } from "../api/client";
import type { DemoUser, LabelOut, MyDelegateOut, PropertyOut } from "../api/types";
import { Button } from "../components/ui";
import { useAuth } from "../context/AuthContext";

interface PreferencesOut {
  label_ids: number[];
  home_property_id: number | null;
  klarname_opt_in: boolean;
  notification_channel: string;
}

export default function Preferences() {
  const { user, users } = useAuth();
  const [labels, setLabels] = useState<LabelOut[]>([]);
  const [properties, setProperties] = useState<PropertyOut[]>([]);
  const [prefs, setPrefs] = useState<PreferencesOut | null>(null);
  const [saved, setSaved] = useState(false);
  const [delegates, setDelegates] = useState<MyDelegateOut[]>([]);
  const [newDelegateId, setNewDelegateId] = useState<number | "">("");
  const [delegateError, setDelegateError] = useState<string | null>(null);

  useEffect(() => {
    api.get<LabelOut[]>("/catalog/labels?entity_type=desk").then(setLabels);
    api.get<PropertyOut[]>("/catalog/properties").then(setProperties);
    api.get<PreferencesOut>("/auth/preferences").then(setPrefs);
    loadDelegates();
  }, []);

  function loadDelegates() {
    api.get<MyDelegateOut[]>("/auth/my-delegates").then(setDelegates);
  }

  async function addDelegate() {
    if (!newDelegateId) return;
    setDelegateError(null);
    try {
      await api.post("/auth/my-delegates", { delegate_user_id: newDelegateId });
      setNewDelegateId("");
      loadDelegates();
    } catch (e) {
      setDelegateError(e instanceof Error ? e.message : "Fehler beim Hinzufügen.");
    }
  }

  async function removeDelegate(delegationId: number) {
    await api.del(`/auth/my-delegates/${delegationId}`);
    loadDelegates();
  }

  function toggleLabel(id: number) {
    if (!prefs) return;
    setSaved(false);
    setPrefs({ ...prefs, label_ids: prefs.label_ids.includes(id) ? prefs.label_ids.filter((x) => x !== id) : [...prefs.label_ids, id] });
  }

  async function save() {
    if (!prefs) return;
    await api.put("/auth/preferences", { label_ids: prefs.label_ids });
    await api.patch("/auth/account", {
      klarname_opt_in: prefs.klarname_opt_in,
      notification_channel: prefs.notification_channel,
      home_property_id: prefs.home_property_id,
    });
    setSaved(true);
  }

  if (!prefs) return <div className="text-on-surface-variant">Lädt…</div>;

  const delegateOptions = users.filter((u) => u.id !== user?.id && !delegates.some((d) => d.delegate_user_id === u.id));

  return (
    <div className="max-w-3xl">
      <h1 className="text-3xl font-bold mb-1">Meine Buchungspräferenzen</h1>
      <p className="text-on-surface-variant mb-6">Helfen uns, den idealen Desk für Sie zu finden — kein harter Filter, nur Ranking (FR-3).</p>

      <div className="grid grid-cols-1 lg:grid-cols-[2fr_1fr] gap-6">
        <div className="bg-surface-container-lowest rounded-md p-5 border border-outline-variant/30">
          <div className="font-semibold mb-3">Feste Präferenzen</div>
          <div className="flex flex-wrap gap-2">
            {labels.map((l) => (
              <button
                key={l.id}
                onClick={() => toggleLabel(l.id)}
                className={`px-3 py-1.5 rounded-full text-sm font-semibold ${prefs.label_ids.includes(l.id) ? "bg-primary text-on-primary" : "bg-surface-container-high text-on-surface-variant"}`}
              >
                {prefs.label_ids.includes(l.id) ? "✓ " : ""}{l.name}
              </button>
            ))}
          </div>
        </div>

        <div className="bg-surface-container-lowest rounded-md p-5 border border-outline-variant/30 space-y-4">
          <div>
            <div className="text-sm font-semibold mb-1">Standard-Standort</div>
            <select
              value={prefs.home_property_id ?? ""}
              onChange={(e) => setPrefs({ ...prefs, home_property_id: Number(e.target.value) })}
              className="w-full bg-surface-container-low rounded px-3 py-2 text-sm"
            >
              {properties.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={prefs.klarname_opt_in} onChange={(e) => setPrefs({ ...prefs, klarname_opt_in: e.target.checked })} />
            Klarnamen für andere sichtbar machen (FR-21)
          </label>
          <div>
            <div className="text-sm font-semibold mb-1">Benachrichtigungskanal</div>
            <select
              value={prefs.notification_channel}
              onChange={(e) => setPrefs({ ...prefs, notification_channel: e.target.value })}
              className="w-full bg-surface-container-low rounded px-3 py-2 text-sm"
            >
              <option value="inbox">Postkorb</option>
              <option value="email">E-Mail</option>
              <option value="both">Beides</option>
            </select>
          </div>
          <div className="text-xs text-on-surface-variant">Angemeldet als {user?.display_name} ({user?.idm_code})</div>
        </div>
      </div>

      <div className="mt-6 flex items-center gap-3">
        <Button variant="accent" onClick={save}>Präferenzen speichern</Button>
        {saved && <span className="text-sm text-tertiary-fixed-dim">Gespeichert.</span>}
      </div>

      <div className="mt-8 bg-surface-container-lowest rounded-md p-5 border border-outline-variant/30 max-w-xl">
        <div className="font-semibold mb-1">Meine Vertretungen</div>
        <p className="text-xs text-on-surface-variant mb-3">
          Diese Personen dürfen in Ihrem Namen buchen und stornieren (z.B. Team-Assistenz oder eine Kollegin/ein Kollege Ihrer Wahl) —
          unabhängig von der Linienorganisation.
        </p>
        <div className="space-y-1 mb-3">
          {delegates.map((d) => (
            <div key={d.delegation_id} className="flex items-center justify-between text-sm p-2 rounded bg-surface-container-low">
              <span>{d.delegate_name} {d.source === "line_org" && <span className="text-xs text-on-surface-variant">(Linienorganisation)</span>}</span>
              {d.source === "self_service" && <button onClick={() => removeDelegate(d.delegation_id)} className="text-error text-xs">Entfernen</button>}
            </div>
          ))}
          {delegates.length === 0 && <div className="text-xs text-on-surface-variant">Noch keine Vertretung hinterlegt.</div>}
        </div>
        {delegateError && <div className="p-2 rounded bg-error-container text-on-error-container text-xs mb-2" role="alert">{delegateError}</div>}
        <div className="flex gap-2">
          <select value={newDelegateId} onChange={(e) => setNewDelegateId(Number(e.target.value))} className="flex-1 bg-surface-container-low rounded px-2 py-1.5 text-sm">
            <option value="">Person wählen…</option>
            {delegateOptions.map((u: DemoUser) => <option key={u.id} value={u.id}>{u.display_name}</option>)}
          </select>
          <Button variant="secondary" disabled={!newDelegateId} onClick={addDelegate}>Als Vertretung hinzufügen</Button>
        </div>
      </div>
    </div>
  );
}
