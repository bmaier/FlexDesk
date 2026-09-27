import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { useEffect, useRef, useState } from "react";
import { useAuth } from "../context/AuthContext";
import { api } from "../api/client";
import type { NotificationOut, SearchResult } from "../api/types";
import { ErrorBoundary } from "./ErrorBoundary";

function NavItem({ to, label }: { to: string; label: string }) {
  return (
    <NavLink
      to={to}
      className={({ isActive }) =>
        `block px-3 py-2 rounded text-sm font-medium transition-colors ${
          isActive ? "bg-secondary-container text-on-primary-fixed-variant font-semibold shadow-sm" : "text-on-surface-variant hover:bg-surface-container-high"
        }`
      }
    >
      {label}
    </NavLink>
  );
}

function SectionLabel({ children }: { children: string }) {
  return <div className="px-3 pt-4 pb-1 text-xs font-semibold tracking-widest uppercase text-on-surface-variant">{children}</div>;
}

export default function Layout() {
  const { user, hasRole, logout, actingAs, setActingAs } = useAuth();
  const navigate = useNavigate();
  const [notifications, setNotifications] = useState<NotificationOut[]>([]);
  const [showNotifications, setShowNotifications] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [showResults, setShowResults] = useState(false);
  const searchRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const load = () => api.get<NotificationOut[]>("/notifications").then(setNotifications).catch(() => {});
    load();
    const interval = setInterval(load, 10000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) setShowResults(false);
    }
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, []);

  async function onSearch(q: string) {
    setQuery(q);
    if (q.length < 2) {
      setResults([]);
      return;
    }
    const r = await api.get<SearchResult[]>(`/search?q=${encodeURIComponent(q)}`);
    setResults(r);
    setShowResults(true);
  }

  const unreadCount = notifications.filter((n) => !n.read).length;
  const canApprove = hasRole("fm", "raumverantwortlicher");
  const canManageFM = hasRole("fm");
  const canBlockConfidential = hasRole("vsnfd");

  return (
    <div className="min-h-screen flex">
      <a href="#main-content" className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-50 focus:bg-primary focus:text-on-primary focus:px-4 focus:py-2 focus:rounded">
        Zum Hauptinhalt springen
      </a>
      <aside className="w-72 shrink-0 bg-surface-container-low border-r border-outline-variant/30 flex flex-col">
        <div className="h-16 flex items-center px-4 border-b border-outline-variant/30">
          <span className="font-bold text-primary">DeskSharing</span>
          <span className="ml-1 font-bold text-tertiary-fixed-dim">Ihre Organisation</span>
        </div>
        <nav className="flex-1 overflow-y-auto px-2 pb-4">
          <SectionLabel>Arbeitsplatz</SectionLabel>
          <div className="space-y-1">
            <NavItem to="/schnellbuchung" label="Schnellbuchung" />
            <NavItem to="/gezielte-buchung" label="Raumplan" />
            <NavItem to="/meetingraeume" label="Meetingräume" />
            <NavItem to="/serienbuchung" label="Serienbuchung" />
            <NavItem to="/meine-buchungen" label="Meine Buchungen" />
            <NavItem to="/wer-sitzt-wo" label="Wer sitzt wo?" />
          </div>

          {(canApprove || canManageFM || canBlockConfidential) && (
            <>
              <SectionLabel>Verwaltung</SectionLabel>
              <div className="space-y-1">
                {canApprove && <NavItem to="/genehmigungscenter" label="Genehmigungscenter" />}
                {canManageFM && <NavItem to="/facility-management" label="Facility-Management" />}
                {canManageFM && <NavItem to="/stammdaten" label="Stammdaten & Kostenstellen" />}
                {canBlockConfidential && <NavItem to="/vertrauliche-raumblockierung" label="Vertrauliche Raumblockierung" />}
              </div>
            </>
          )}

          <SectionLabel>Spezialfunktionen</SectionLabel>
          <div className="space-y-1">
            <NavItem to="/buchen-fuer" label="Im Namen von agieren" />
            <NavItem to="/meine-praeferenzen" label="Meine Präferenzen" />
          </div>

          <SectionLabel>Rechtliches & Hilfe</SectionLabel>
          <div className="space-y-1">
            <NavItem to="/barrierefreiheit" label="♿ Barrierefreiheit (BITV)" />
          </div>
        </nav>
        <div className="p-3 border-t border-outline-variant/30 flex items-center gap-2">
          <div className="w-10 h-10 rounded-full bg-primary-container text-on-primary-container flex items-center justify-center font-semibold">
            {user?.display_name?.slice(0, 1) ?? "?"}
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-sm font-semibold truncate">{user?.display_name}</div>
            <div className="text-xs text-on-surface-variant truncate">{user?.roles.join(", ")}</div>
          </div>
          <button
            onClick={() => {
              logout();
              navigate("/login");
            }}
            className="text-xs text-on-surface-variant hover:text-primary"
            title="Abmelden / Rolle wechseln"
          >
            Wechseln
          </button>
        </div>
      </aside>

      <div className="flex-1 flex flex-col min-w-0">
        {actingAs && (
          <div className="bg-tertiary text-on-tertiary px-6 py-2 flex items-center justify-between gap-4 text-sm font-semibold" role="status">
            <span>⚠️ Sie agieren gerade im Namen von <strong>{actingAs.employeeName}</strong> — alle Buchungen/Stornierungen erfolgen in deren Namen.</span>
            <button onClick={() => setActingAs(null)} className="underline hover:no-underline shrink-0">
              Zurück zu mir selbst
            </button>
          </div>
        )}
        <header className="h-16 border-b border-outline-variant/30 bg-surface/80 backdrop-blur-md flex items-center gap-4 px-6">
          <div className="relative flex-1 max-w-md" ref={searchRef}>
            <input
              value={query}
              onChange={(e) => onSearch(e.target.value)}
              onFocus={() => query.length >= 2 && setShowResults(true)}
              placeholder="Suche nach Desk, Team oder Raum..."
              className="w-full bg-surface-container-low rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-focus-ring"
              aria-label="Globale Suche"
            />
            {showResults && results.length > 0 && (
              <div className="absolute mt-1 w-full bg-surface-container-lowest shadow-xl rounded border border-outline-variant/40 max-h-80 overflow-y-auto z-20">
                {results.map((r) => (
                  <div key={`${r.type}-${r.id}`} className="px-3 py-2 text-sm border-b border-outline-variant/20 last:border-0">
                    <span className="text-xs uppercase text-on-surface-variant mr-2">{r.type}</span>
                    <span className="font-medium">{r.label}</span>
                    {r.sublabel && <span className="text-on-surface-variant"> · {r.sublabel}</span>}
                  </div>
                ))}
              </div>
            )}
          </div>
          <div className="relative">
            <button
              onClick={() => setShowNotifications((s) => !s)}
              className="relative w-10 h-10 rounded-full hover:bg-surface-container-high flex items-center justify-center"
              aria-label="Benachrichtigungen"
            >
              🔔
              {unreadCount > 0 && (
                <span className="absolute -top-0.5 -right-0.5 bg-error text-on-error text-[10px] rounded-full w-4 h-4 flex items-center justify-center">
                  {unreadCount}
                </span>
              )}
            </button>
            {showNotifications && (
              <div className="absolute right-0 mt-2 w-80 bg-surface-container-lowest shadow-xl rounded-lg border border-outline-variant/40 z-20 max-h-96 overflow-y-auto">
                <div className="px-4 py-2 font-semibold border-b border-outline-variant/30">Benachrichtigungen</div>
                {notifications.length === 0 && <div className="px-4 py-3 text-sm text-on-surface-variant">Keine Benachrichtigungen.</div>}
                {notifications.map((n) => (
                  <button
                    key={n.id}
                    onClick={() => {
                      api.post(`/notifications/${n.id}/read`).then(() => {
                        setNotifications((prev) => prev.map((p) => (p.id === n.id ? { ...p, read: true } : p)));
                      });
                    }}
                    className={`w-full text-left px-4 py-3 text-sm border-b border-outline-variant/20 last:border-0 hover:bg-surface-container-low ${!n.read ? "bg-secondary-container/20" : ""}`}
                  >
                    <div>{n.message}</div>
                    <div className="text-xs text-on-surface-variant mt-1">{new Date(n.created_at).toLocaleString("de-DE")}</div>
                  </button>
                ))}
              </div>
            )}
          </div>
        </header>
        <main id="main-content" tabIndex={-1} className="flex-1 overflow-y-auto p-6">
          <ErrorBoundary>
            <Outlet />
          </ErrorBoundary>
        </main>
      </div>
    </div>
  );
}
