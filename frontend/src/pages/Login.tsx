import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

/** FR: Login ist simuliert (kein echtes IDM) — Auswahl eines Demo-Kontos ersetzt den Keycloak-Redirect. */
export default function Login() {
  const { users, login } = useAuth();
  const navigate = useNavigate();

  async function handleLogin(userId: number) {
    await login(userId);
    navigate("/schnellbuchung");
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <div className="w-full max-w-2xl">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-primary">DeskSharing BAMF</h1>
          <p className="text-on-surface-variant mt-2">
            Demo-Anmeldung — kein echtes IDM. Wählen Sie ein Konto, um sich anzumelden.
          </p>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {users.map((u) => (
            <button
              key={u.id}
              onClick={() => handleLogin(u.id)}
              className="text-left bg-surface-container-lowest rounded-md shadow-sm border border-outline-variant/40 p-4 hover:shadow-md hover:-translate-y-0.5 transition-transform"
            >
              <div className="font-semibold text-on-surface">{u.display_name}</div>
              <div className="text-sm text-on-surface-variant">{u.department ?? "—"}</div>
              <div className="mt-2 flex flex-wrap gap-1">
                {u.roles.map((r) => (
                  <span key={r} className="text-xs px-2 py-0.5 rounded-full bg-secondary-container text-on-secondary-container">
                    {r}
                  </span>
                ))}
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
