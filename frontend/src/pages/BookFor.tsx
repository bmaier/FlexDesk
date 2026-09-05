import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../api/client";
import type { Delegation } from "../api/types";
import { EmptyState } from "../components/ui";
import { useAuth } from "../context/AuthContext";

/** "Im Namen von agieren" (FR-11/12) — Vertretungsperson wählen; alle nachfolgenden Aktionen
 * (Schnellbuchung, Raumplan, Meetingräume, Serienbuchung, Meine Buchungen inkl. Stornierung)
 * werden dann für diese Person ausgeführt, deutlich sichtbar über das Banner oben. */
export default function BookFor() {
  const { actingAs, setActingAs } = useAuth();
  const [delegations, setDelegations] = useState<Delegation[]>([]);
  const navigate = useNavigate();

  useEffect(() => {
    api.get<Delegation[]>("/auth/delegations").then(setDelegations);
  }, []);

  function select(d: Delegation) {
    setActingAs({ delegateUserId: 0, employeeUserId: d.employee_id, employeeName: d.employee_name });
    navigate("/schnellbuchung");
  }

  return (
    <div className="max-w-2xl">
      <h1 className="text-3xl font-bold mb-1">Im Namen von agieren</h1>
      <p className="text-on-surface-variant mb-6">
        Wählen Sie eine Person, für die Sie berechtigt sind zu handeln. Danach werden Buchungen, Stornierungen und
        Serienbuchungen in der gesamten App in deren Namen ausgeführt — deutlich erkennbar am Banner oben, bis Sie
        wieder zu sich selbst zurückwechseln.
      </p>

      {actingAs && (
        <div className="p-4 rounded bg-tertiary-fixed/40 text-on-tertiary-fixed-variant mb-4 flex items-center justify-between">
          <span>Sie agieren aktuell im Namen von <strong>{actingAs.employeeName}</strong>.</span>
          <button onClick={() => setActingAs(null)} className="text-sm underline">Zurück zu mir selbst</button>
        </div>
      )}

      {delegations.length === 0 ? (
        <EmptyState title="Keine Vertretungsberechtigung" description="Für Sie ist aktuell keine Vertretungsberechtigung hinterlegt. Personen können Sie unter „Meine Präferenzen“ als Vertretung eintragen." />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {delegations.map((d) => (
            <button
              key={d.employee_id}
              onClick={() => select(d)}
              className={`p-4 rounded border text-left hover:shadow-sm ${
                actingAs?.employeeUserId === d.employee_id ? "border-primary bg-primary-container/30" : "border-outline-variant/30 bg-surface-container-lowest"
              }`}
            >
              <div className="font-semibold">{d.employee_name}</div>
              <div className="text-xs text-on-surface-variant">{d.source === "line_org" ? "Linienorganisation" : "Self-Service-Delegation"}</div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
