import { useEffect, useState } from "react";
import { api, ApiError } from "../api/client";
import type { DepartmentOut, PropertyOut, PropertyTree, UserAdminOut } from "../api/types";
import { Badge, Button, Card, Modal } from "../components/ui";

type MasterDataTab = "departments" | "users" | "properties" | "rooms";

const ALL_ROLES = [
  { id: "user", label: "Benutzer (Standard)" },
  { id: "fm", label: "Facility Management (FM)" },
  { id: "vm", label: "Veranstaltungsmanagement (VM)" },
  { id: "raumverantwortlicher", label: "Raumverantwortlicher" },
  { id: "vsnfd", label: "VS-NfD Berechtigter" },
  { id: "service", label: "Service / Wirtschaftsdienst" },
];

export default function MasterData() {
  const [tab, setTab] = useState<MasterDataTab>("departments");

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold mb-1">Zentrale Stammdatenverwaltung</h1>
        <p className="text-on-surface-variant">
          Organisationseinheiten, Kostenstellen, Benutzerkonten und Gebäudestrukturen zentral verwalten und konfigurieren.
        </p>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 border-b border-outline-variant/30">
        <button
          type="button"
          onClick={() => setTab("departments")}
          className={`px-4 py-2.5 text-sm font-semibold border-b-2 -mb-px transition-colors ${
            tab === "departments"
              ? "border-primary text-primary"
              : "border-transparent text-on-surface-variant hover:text-on-surface"
          }`}
        >
          🏢 Organisationseinheiten & Kostenstellen
        </button>
        <button
          type="button"
          onClick={() => setTab("users")}
          className={`px-4 py-2.5 text-sm font-semibold border-b-2 -mb-px transition-colors ${
            tab === "users"
              ? "border-primary text-primary"
              : "border-transparent text-on-surface-variant hover:text-on-surface"
          }`}
        >
          👤 Personen & Benutzer ({tab === "users" ? "Aktiv" : "Verwaltung"})
        </button>
        <button
          type="button"
          onClick={() => setTab("properties")}
          className={`px-4 py-2.5 text-sm font-semibold border-b-2 -mb-px transition-colors ${
            tab === "properties"
              ? "border-primary text-primary"
              : "border-transparent text-on-surface-variant hover:text-on-surface"
          }`}
        >
          📍 Liegenschaften & Gebäude
        </button>
        <button
          type="button"
          onClick={() => setTab("rooms")}
          className={`px-4 py-2.5 text-sm font-semibold border-b-2 -mb-px transition-colors ${
            tab === "rooms"
              ? "border-primary text-primary"
              : "border-transparent text-on-surface-variant hover:text-on-surface"
          }`}
        >
          🏛 Räume & Bestuhlungs-Status
        </button>
      </div>

      {tab === "departments" && <DepartmentsManager />}
      {tab === "users" && <UsersManager />}
      {tab === "properties" && <PropertiesOverview />}
      {tab === "rooms" && <RoomsOverview />}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Tab 1: Organisationseinheiten & Kostenstellen
// ---------------------------------------------------------------------------

function DepartmentsManager() {
  const [departments, setDepartments] = useState<DepartmentOut[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [editingDept, setEditingDept] = useState<DepartmentOut | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Formular-State
  const [formCode, setFormCode] = useState("");
  const [formName, setFormName] = useState("");
  const [formCostCenter, setFormCostCenter] = useState("");
  const [formParentId, setFormParentId] = useState<number | "">("");

  function loadDepartments() {
    setLoading(true);
    api
      .get<DepartmentOut[]>("/catalog/departments")
      .then((data) => {
        setDepartments(data);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }

  useEffect(loadDepartments, []);

  function openCreate() {
    setIsCreating(true);
    setEditingDept(null);
    setFormCode("");
    setFormName("");
    setFormCostCenter("");
    setFormParentId("");
    setError(null);
  }

  function openEdit(dept: DepartmentOut) {
    setEditingDept(dept);
    setIsCreating(false);
    setFormCode(dept.code);
    setFormName(dept.name);
    setFormCostCenter(dept.cost_center || "");
    setFormParentId(dept.parent_id ?? "");
    setError(null);
  }

  async function handleSave() {
    setError(null);
    if (!formCode.trim() || !formName.trim()) {
      setError("Code und Name der Organisationseinheit sind Pflichtfelder.");
      return;
    }

    try {
      if (isCreating) {
        await api.post("/fm/departments", {
          code: formCode.trim(),
          name: formName.trim(),
          cost_center: formCostCenter.trim() || null,
          parent_id: formParentId ? Number(formParentId) : null,
        });
        setMessage(`Organisationseinheit „${formName}“ erfolgreich angelegt.`);
      } else if (editingDept) {
        await api.patch(`/fm/departments/${editingDept.id}`, {
          code: formCode.trim(),
          name: formName.trim(),
          cost_center: formCostCenter.trim() || null,
          parent_id: formParentId ? Number(formParentId) : null,
        });
        setMessage(`Organisationseinheit „${formName}“ erfolgreich aktualisiert.`);
      }
      setIsCreating(false);
      setEditingDept(null);
      loadDepartments();
    } catch (e) {
      if (e instanceof ApiError) setError(e.message);
      else setError("Fehler beim Speichern der Organisationseinheit.");
    }
  }

  async function handleDelete(dept: DepartmentOut) {
    if (!window.confirm(`Möchten Sie die Organisationseinheit „${dept.name} (${dept.code})“ wirklich löschen?`)) {
      return;
    }
    try {
      await api.del(`/fm/departments/${dept.id}`);
      setMessage(`Organisationseinheit „${dept.name}“ gelöscht.`);
      loadDepartments();
    } catch (e) {
      if (e instanceof ApiError) setError(e.message);
      else setError("Fehler beim Löschen der Organisationseinheit.");
    }
  }

  const filtered = departments.filter((d) => {
    const q = search.toLowerCase();
    return (
      d.code.toLowerCase().includes(q) ||
      d.name.toLowerCase().includes(q) ||
      (d.cost_center && d.cost_center.toLowerCase().includes(q))
    );
  });

  return (
    <div className="space-y-4">
      {message && (
        <div className="p-3 rounded bg-tertiary-fixed/40 text-on-tertiary-fixed-variant text-sm flex items-center justify-between">
          <span>{message}</span>
          <button type="button" onClick={() => setMessage(null)} className="font-bold">✕</button>
        </div>
      )}
      {error && (
        <div className="p-3 rounded bg-error-container text-on-error-container text-sm flex items-center justify-between">
          <span>{error}</span>
          <button type="button" onClick={() => setError(null)} className="font-bold">✕</button>
        </div>
      )}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="🔍 Organisationseinheit oder Kostenstelle suchen…"
            className="w-80 bg-surface-container-low rounded px-3 py-2 text-sm border border-outline-variant/30"
          />
          <span className="text-xs text-on-surface-variant">
            {filtered.length} von {departments.length} Einheiten
          </span>
        </div>
        <Button variant="primary" onClick={openCreate}>
          ➕ Neue Organisationseinheit anlegen
        </Button>
      </div>

      <div className="bg-surface-container-low rounded-md border border-outline-variant/30 overflow-hidden">
        <table className="w-full text-left text-sm">
          <thead className="bg-surface border-b border-outline-variant/30 text-xs font-semibold text-on-surface-variant uppercase tracking-wider">
            <tr>
              <th className="px-4 py-3">Code / Kürzel</th>
              <th className="px-4 py-3">Bezeichnung der Einheit</th>
              <th className="px-4 py-3">Kostenstelle (Standard)</th>
              <th className="px-4 py-3">Übergeordnete Einheit</th>
              <th className="px-4 py-3 text-right">Aktionen</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-outline-variant/20">
            {loading ? (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-on-surface-variant">Lade Organisationseinheiten…</td>
              </tr>
            ) : filtered.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-on-surface-variant">Keine passenden Organisationseinheiten gefunden.</td>
              </tr>
            ) : (
              filtered.map((d) => {
                const parent = departments.find((p) => p.id === d.parent_id);
                return (
                  <tr key={d.id} className="hover:bg-surface/50 transition-colors">
                    <td className="px-4 py-3 font-mono font-semibold text-primary">{d.code}</td>
                    <td className="px-4 py-3 font-medium">{d.name}</td>
                    <td className="px-4 py-3">
                      {d.cost_center ? (
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-mono font-medium bg-secondary-container text-on-secondary-container">
                          💳 {d.cost_center}
                        </span>
                      ) : (
                        <span className="text-xs text-on-surface-variant italic">Keine KST hinterlegt</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-xs text-on-surface-variant">
                      {parent ? `${parent.name} (${parent.code})` : "— (Hauptabteilung / Leitung)"}
                    </td>
                    <td className="px-4 py-3 text-right space-x-2">
                      <button
                        type="button"
                        onClick={() => openEdit(d)}
                        className="px-2.5 py-1 text-xs font-semibold rounded bg-surface hover:bg-surface-container border border-outline-variant/30 text-on-surface"
                      >
                        ✏️ Bearbeiten
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDelete(d)}
                        className="px-2.5 py-1 text-xs font-semibold rounded bg-error-container/40 hover:bg-error-container text-error"
                      >
                        🗑 Löschen
                      </button>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Modal für Erstellen / Bearbeiten */}
      {(isCreating || editingDept) && (
        <Modal
          title={isCreating ? "Neue Organisationseinheit anlegen" : `Organisationseinheit „${editingDept?.name}“ bearbeiten`}
          onClose={() => {
            setIsCreating(false);
            setEditingDept(null);
          }}
        >
          <div className="space-y-4">
            {error && <div className="p-2.5 rounded bg-error-container text-on-error-container text-xs">{error}</div>}

            <label className="block text-xs font-medium">
              Kürzel / Code *
              <input
                value={formCode}
                onChange={(e) => setFormCode(e.target.value)}
                placeholder="z.B. ABT-1, REF-11, IZAM..."
                className="w-full mt-1 bg-surface-container-low rounded px-3 py-2 text-sm border border-outline-variant/30 font-mono"
              />
            </label>

            <label className="block text-xs font-medium">
              Vollständige Bezeichnung der Einheit *
              <input
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
                placeholder="z.B. Referat 11 – Personalwesen & Organisation"
                className="w-full mt-1 bg-surface-container-low rounded px-3 py-2 text-sm border border-outline-variant/30"
              />
            </label>

            <label className="block text-xs font-medium">
              Zugeordnete Kostenstelle (Default für Buchungen & Catering)
              <input
                value={formCostCenter}
                onChange={(e) => setFormCostCenter(e.target.value)}
                placeholder="z.B. KST-1100-PERS, KST-6200-IZAM..."
                className="w-full mt-1 bg-surface-container-low rounded px-3 py-2 text-sm border border-outline-variant/30 font-mono"
              />
              <span className="text-[11px] text-on-surface-variant block mt-1">
                Wird als Standard-Verrechnungskonto bei Meetingraum-Buchungen und Catering-Bestellungen dieser Einheit herangezogen.
              </span>
            </label>

            <label className="block text-xs font-medium">
              Übergeordnete Organisationseinheit
              <select
                value={formParentId}
                onChange={(e) => setFormParentId(e.target.value ? Number(e.target.value) : "")}
                className="w-full mt-1 bg-surface-container-low rounded px-3 py-2 text-sm border border-outline-variant/30"
              >
                <option value="">Keine (Oberste Leitungsebene)</option>
                {departments
                  .filter((d) => (editingDept ? d.id !== editingDept.id : true))
                  .map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.code} · {d.name} {d.cost_center ? `(${d.cost_center})` : ""}
                    </option>
                  ))}
              </select>
            </label>

            <div className="pt-2 flex justify-end gap-2">
              <Button
                variant="secondary"
                onClick={() => {
                  setIsCreating(false);
                  setEditingDept(null);
                }}
              >
                Abbrechen
              </Button>
              <Button variant="primary" onClick={handleSave}>
                {isCreating ? "Organisationseinheit anlegen" : "Änderungen speichern"}
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Tab 2: Personen & Benutzer (Kostenstellen & Rollen)
// ---------------------------------------------------------------------------

function UsersManager() {
  const [users, setUsers] = useState<UserAdminOut[]>([]);
  const [departments, setDepartments] = useState<DepartmentOut[]>([]);
  const [properties, setProperties] = useState<PropertyOut[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [editingUser, setEditingUser] = useState<UserAdminOut | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Formular-State
  const [formDeptId, setFormDeptId] = useState<number | "">("");
  const [formCostCenter, setFormCostCenter] = useState("");
  const [formHomePropertyId, setFormHomePropertyId] = useState<number | "">("");
  const [formRoles, setFormRoles] = useState<string[]>([]);

  function loadData() {
    setLoading(true);
    Promise.all([
      api.get<UserAdminOut[]>("/fm/users"),
      api.get<DepartmentOut[]>("/catalog/departments"),
      api.get<PropertyOut[]>("/catalog/properties"),
    ])
      .then(([u, d, p]) => {
        setUsers(u);
        setDepartments(d);
        setProperties(p);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }

  useEffect(loadData, []);

  function openEdit(u: UserAdminOut) {
    setEditingUser(u);
    setFormDeptId(u.department_id ?? "");
    setFormCostCenter(u.cost_center || "");
    setFormHomePropertyId(u.home_property_id ?? "");
    setFormRoles([...u.roles]);
    setError(null);
  }

  function toggleRole(roleId: string) {
    setFormRoles((curr) =>
      curr.includes(roleId) ? curr.filter((r) => r !== roleId) : [...curr, roleId]
    );
  }

  async function handleSave() {
    if (!editingUser) return;
    setError(null);
    try {
      await api.patch(`/fm/users/${editingUser.id}`, {
        department_id: formDeptId ? Number(formDeptId) : null,
        clear_department: formDeptId === "",
        cost_center: formCostCenter.trim() || null,
        home_property_id: formHomePropertyId ? Number(formHomePropertyId) : null,
        clear_home_property: formHomePropertyId === "",
        roles: formRoles,
      });
      setMessage(`Benutzerdaten für „${editingUser.display_name}“ erfolgreich aktualisiert.`);
      setEditingUser(null);
      loadData();
    } catch (e) {
      if (e instanceof ApiError) setError(e.message);
      else setError("Fehler beim Speichern der Benutzerdaten.");
    }
  }

  const filtered = users.filter((u) => {
    const q = search.toLowerCase();
    return (
      u.display_name.toLowerCase().includes(q) ||
      u.idm_code.toLowerCase().includes(q) ||
      u.email.toLowerCase().includes(q) ||
      (u.department_name && u.department_name.toLowerCase().includes(q)) ||
      (u.effective_cost_center && u.effective_cost_center.toLowerCase().includes(q))
    );
  });

  return (
    <div className="space-y-4">
      {message && (
        <div className="p-3 rounded bg-tertiary-fixed/40 text-on-tertiary-fixed-variant text-sm flex items-center justify-between">
          <span>{message}</span>
          <button type="button" onClick={() => setMessage(null)} className="font-bold">✕</button>
        </div>
      )}
      {error && (
        <div className="p-3 rounded bg-error-container text-on-error-container text-sm flex items-center justify-between">
          <span>{error}</span>
          <button type="button" onClick={() => setError(null)} className="font-bold">✕</button>
        </div>
      )}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="🔍 Name, IDM-Code, Abteilung oder Kostenstelle suchen…"
            className="w-88 bg-surface-container-low rounded px-3 py-2 text-sm border border-outline-variant/30"
          />
          <span className="text-xs text-on-surface-variant">
            {filtered.length} von {users.length} Personen
          </span>
        </div>
      </div>

      <div className="bg-surface-container-low rounded-md border border-outline-variant/30 overflow-hidden">
        <table className="w-full text-left text-sm">
          <thead className="bg-surface border-b border-outline-variant/30 text-xs font-semibold text-on-surface-variant uppercase tracking-wider">
            <tr>
              <th className="px-4 py-3">IDM-Kürzel</th>
              <th className="px-4 py-3">Name / E-Mail</th>
              <th className="px-4 py-3">Organisationseinheit</th>
              <th className="px-4 py-3">Persönliche / Effektive KST</th>
              <th className="px-4 py-3">Rollen</th>
              <th className="px-4 py-3 text-right">Aktionen</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-outline-variant/20">
            {loading ? (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-on-surface-variant">Lade Benutzerkonten…</td>
              </tr>
            ) : filtered.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-on-surface-variant">Keine Personen gefunden.</td>
              </tr>
            ) : (
              filtered.map((u) => (
                <tr key={u.id} className="hover:bg-surface/50 transition-colors">
                  <td className="px-4 py-3 font-mono text-xs font-semibold text-primary">{u.idm_code}</td>
                  <td className="px-4 py-3">
                    <div className="font-semibold text-on-surface">{u.display_name}</div>
                    <div className="text-xs text-on-surface-variant">{u.email}</div>
                  </td>
                  <td className="px-4 py-3 text-xs">
                    {u.department_name ? (
                      <span className="font-medium">{u.department_name}</span>
                    ) : (
                      <span className="text-on-surface-variant italic">Nicht zugeordnet</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-xs">
                    {u.effective_cost_center ? (
                      <div className="flex items-center gap-1.5">
                        <span className="font-mono font-medium px-2 py-0.5 rounded bg-secondary-container text-on-secondary-container">
                          💳 {u.effective_cost_center}
                        </span>
                        {u.cost_center ? (
                          <span className="text-[10px] text-primary" title="Individuelle Kostenstelle überschreibt Abteilung">(Individuell)</span>
                        ) : (
                          <span className="text-[10px] text-on-surface-variant" title="Geerbt von der Organisationseinheit">(Abteilung)</span>
                        )}
                      </div>
                    ) : (
                      <span className="text-on-surface-variant italic">Keine KST</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-1">
                      {u.roles.map((r) => (
                        <span key={r} className="px-2 py-0.5 rounded text-[11px] bg-surface-container text-on-surface font-medium">
                          {r}
                        </span>
                      ))}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button
                      type="button"
                      onClick={() => openEdit(u)}
                      className="px-2.5 py-1 text-xs font-semibold rounded bg-surface hover:bg-surface-container border border-outline-variant/30 text-on-surface"
                    >
                      ✏️ Bearbeiten
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Modal: Benutzer bearbeiten */}
      {editingUser && (
        <Modal title={`Benutzer „${editingUser.display_name}“ bearbeiten`} onClose={() => setEditingUser(null)}>
          <div className="space-y-4">
            {error && <div className="p-2.5 rounded bg-error-container text-on-error-container text-xs">{error}</div>}

            <div className="p-3 rounded bg-surface-container-low border border-outline-variant/20 text-xs space-y-1">
              <div className="font-semibold text-on-surface">{editingUser.display_name} ({editingUser.idm_code})</div>
              <div className="text-on-surface-variant">{editingUser.email}</div>
            </div>

            <label className="block text-xs font-medium">
              Organisationseinheit / Abteilung
              <select
                value={formDeptId}
                onChange={(e) => setFormDeptId(e.target.value ? Number(e.target.value) : "")}
                className="w-full mt-1 bg-surface-container-low rounded px-3 py-2 text-sm border border-outline-variant/30"
              >
                <option value="">Keine Abteilung zugeordnet</option>
                {departments.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.code} · {d.name} {d.cost_center ? `(${d.cost_center})` : ""}
                  </option>
                ))}
              </select>
            </label>

            <label className="block text-xs font-medium">
              Individuelle Kostenstelle (überschreibt Abteilungs-KST)
              <input
                value={formCostCenter}
                onChange={(e) => setFormCostCenter(e.target.value)}
                placeholder="Optional: z.B. KST-SONDER-99 (leer lassen = Standard der Abteilung)"
                className="w-full mt-1 bg-surface-container-low rounded px-3 py-2 text-sm border border-outline-variant/30 font-mono"
              />
              <span className="text-[11px] text-on-surface-variant block mt-1">
                Wird dieses Feld leer gelassen, greift automatisch die Kostenstelle der zugeordneten Organisationseinheit.
              </span>
            </label>

            <label className="block text-xs font-medium">
              Heimat-Liegenschaft (Stammsitz)
              <select
                value={formHomePropertyId}
                onChange={(e) => setFormHomePropertyId(e.target.value ? Number(e.target.value) : "")}
                className="w-full mt-1 bg-surface-container-low rounded px-3 py-2 text-sm border border-outline-variant/30"
              >
                <option value="">Keine Stamm-Liegenschaft</option>
                {properties.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </label>

            <div className="space-y-2 pt-2 border-t border-outline-variant/30">
              <div className="text-xs font-semibold uppercase tracking-wider text-on-surface-variant">Rollen & Berechtigungen</div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {ALL_ROLES.map((r) => {
                  const checked = formRoles.includes(r.id);
                  return (
                    <label key={r.id} className="flex items-center gap-2 p-2 rounded bg-surface border border-outline-variant/30 text-xs cursor-pointer">
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => toggleRole(r.id)}
                        className="rounded text-primary"
                      />
                      <span className={checked ? "font-semibold text-primary" : "text-on-surface"}>{r.label}</span>
                    </label>
                  );
                })}
              </div>
            </div>

            <div className="pt-2 flex justify-end gap-2">
              <Button variant="secondary" onClick={() => setEditingUser(null)}>
                Abbrechen
              </Button>
              <Button variant="primary" onClick={handleSave}>
                Speichern
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Tab 3: Liegenschaften & Gebäude
// ---------------------------------------------------------------------------

function PropertiesOverview() {
  const [properties, setProperties] = useState<PropertyOut[]>([]);
  const [trees, setTrees] = useState<Record<number, PropertyTree>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get<PropertyOut[]>("/catalog/properties").then(async (props) => {
      setProperties(props);
      const treeEntries = await Promise.all(
        props.map((p) =>
          api
            .get<PropertyTree>(`/catalog/properties/${p.id}/tree`)
            .then((tree) => [p.id, tree] as const)
            .catch(() => [p.id, null] as const),
        ),
      );
      const map: Record<number, PropertyTree> = {};
      for (const [id, tree] of treeEntries) {
        if (tree) map[id] = tree;
      }
      setTrees(map);
      setLoading(false);
    });
  }, []);

  if (loading) {
    return <div className="p-8 text-center text-on-surface-variant">Lade Liegenschaften und Gebäudestruktur…</div>;
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <div className="text-sm text-on-surface-variant">
          Übersicht aller erfassten Liegenschaften, Gebäude und Etagen.
        </div>
        <a
          href="/facility-management"
          className="px-3 py-1.5 rounded text-xs font-semibold bg-primary text-on-primary shadow-sm hover:brightness-105 inline-flex items-center gap-1.5"
        >
          🏗 Im Facility Management bearbeiten ↗
        </a>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {properties.map((p) => {
          const tree = trees[p.id];
          const buildings = tree?.buildings ?? [];
          const allFloors = buildings.flatMap((b) => b.floors);
          const allRooms = allFloors.flatMap((f) => f.rooms);
          const meetingRooms = allRooms.filter((r) => r.room_type === "meeting");
          const desks = allRooms.flatMap((r) => r.desks);

          return (
            <Card key={p.id} className="space-y-3">
              <div className="flex justify-between items-start">
                <div>
                  <h3 className="font-bold text-lg text-on-surface">{p.name}</h3>
                  <div className="text-xs text-on-surface-variant">{p.address}</div>
                </div>
                <Badge tone="positive">Aktiv</Badge>
              </div>

              <div className="grid grid-cols-4 gap-2 pt-2 border-t border-outline-variant/20 text-center">
                <div className="p-2 rounded bg-surface border border-outline-variant/20">
                  <div className="text-lg font-bold text-primary">{buildings.length}</div>
                  <div className="text-[10px] text-on-surface-variant">Gebäude</div>
                </div>
                <div className="p-2 rounded bg-surface border border-outline-variant/20">
                  <div className="text-lg font-bold text-primary">{allFloors.length}</div>
                  <div className="text-[10px] text-on-surface-variant">Etagen</div>
                </div>
                <div className="p-2 rounded bg-surface border border-outline-variant/20">
                  <div className="text-lg font-bold text-primary">{meetingRooms.length}</div>
                  <div className="text-[10px] text-on-surface-variant">Meetingräume</div>
                </div>
                <div className="p-2 rounded bg-surface border border-outline-variant/20">
                  <div className="text-lg font-bold text-primary">{desks.length}</div>
                  <div className="text-[10px] text-on-surface-variant">Desks</div>
                </div>
              </div>

              <div className="space-y-1.5 pt-2">
                <div className="text-xs font-semibold text-on-surface-variant">Gebäude & Etagen:</div>
                <div className="space-y-1">
                  {buildings.map((b) => (
                    <div key={b.id} className="text-xs p-2 rounded bg-surface-container flex justify-between items-center">
                      <span className="font-medium">{b.name}</span>
                      <span className="text-on-surface-variant text-[11px]">
                        {b.floors.length} Etagen ({b.floors.map((f) => f.name).join(", ")})
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </Card>
          );
        })}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Tab 4: Räume & Bestuhlungs-Status
// ---------------------------------------------------------------------------

function RoomsOverview() {
  const [properties, setProperties] = useState<PropertyOut[]>([]);
  const [selectedPropId, setSelectedPropId] = useState<number | null>(null);
  const [rooms, setRooms] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    api.get<PropertyOut[]>("/catalog/properties").then((props) => {
      setProperties(props);
      if (props.length > 0) setSelectedPropId(props[0].id);
    });
  }, []);

  useEffect(() => {
    if (!selectedPropId) return;
    setLoading(true);
    api.get<PropertyTree>(`/catalog/properties/${selectedPropId}/tree`).then((tree) => {
      const allRooms = tree.buildings.flatMap((b) =>
        b.floors.flatMap((f) =>
          f.rooms.map((r) => ({
            ...r,
            buildingName: b.name,
            floorName: f.name,
            floorHasLayout: !!f.floorplan_layout,
          })),
        ),
      );
      setRooms(allRooms);
      setLoading(false);
    });
  }, [selectedPropId]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <label className="text-xs font-medium">
          Liegenschaft filtern:
          <select
            value={selectedPropId ?? ""}
            onChange={(e) => setSelectedPropId(Number(e.target.value))}
            className="block mt-1 bg-surface-container-low rounded px-3 py-2 text-sm border border-outline-variant/30"
          >
            {properties.map((p) => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
        </label>
        <a
          href="/facility-management"
          className="px-3 py-1.5 rounded text-xs font-semibold bg-primary text-on-primary shadow-sm hover:brightness-105"
        >
          🎨 Zum Grundriss- & Bestuhlungs-Designer ↗
        </a>
      </div>

      <div className="bg-surface-container-low rounded-md border border-outline-variant/30 overflow-hidden">
        <table className="w-full text-left text-sm">
          <thead className="bg-surface border-b border-outline-variant/30 text-xs font-semibold text-on-surface-variant uppercase tracking-wider">
            <tr>
              <th className="px-4 py-3">Raumnummer</th>
              <th className="px-4 py-3">Raumname</th>
              <th className="px-4 py-3">Typ</th>
              <th className="px-4 py-3">Gebäude / Etage</th>
              <th className="px-4 py-3">Kapazität / Bestuhlung</th>
              <th className="px-4 py-3">Genehmigung</th>
              <th className="px-4 py-3">Grundriss</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-outline-variant/20">
            {loading ? (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-on-surface-variant">Lade Räume…</td>
              </tr>
            ) : rooms.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-on-surface-variant">Keine Räume hinterlegt.</td>
              </tr>
            ) : (
              rooms.map((r) => (
                <tr key={r.id} className="hover:bg-surface/50 transition-colors">
                  <td className="px-4 py-3 font-mono font-semibold text-primary">{r.room_number}</td>
                  <td className="px-4 py-3 font-medium">{r.name}</td>
                  <td className="px-4 py-3 text-xs">
                    {r.room_type === "meeting" ? (
                      <span className="px-2 py-0.5 rounded bg-blue-100 dark:bg-blue-950 text-blue-800 dark:text-blue-300 font-semibold">
                        🏛 Meetingraum
                      </span>
                    ) : (
                      <span className="px-2 py-0.5 rounded bg-surface-container text-on-surface font-medium">
                        💼 Desk-Bereich
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-xs text-on-surface-variant">
                    {r.buildingName} / {r.floorName}
                  </td>
                  <td className="px-4 py-3 text-xs">
                    {r.room_type === "meeting" ? (
                      <span>
                        <b>{r.capacity ?? "—"}</b> Personen · {r.seating_layout || "Konferenztisch"}
                      </span>
                    ) : (
                      <span>{r.desks?.length ?? 0} Desks</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-xs">
                    {r.approval_required ? (
                      <span className="text-amber-600 font-semibold">⚠️ Genehmigungspflichtig</span>
                    ) : (
                      <span className="text-emerald-600 font-medium">Freie Direktbuchung</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-xs">
                    {r.floorHasLayout ? (
                      <span className="text-primary font-semibold">🗺️ Im Grundriss verknüpft</span>
                    ) : (
                      <span className="text-on-surface-variant italic">Noch nicht platziert</span>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
