import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { api, getToken, setToken } from "../api/client";
import type { DemoUser } from "../api/types";

export interface ActingAs {
  delegateUserId: number; // wer agiert (der Vertreter/die Vertreterin, i.d.R. ich selbst)
  employeeUserId: number; // in wessen Namen agiert wird
  employeeName: string;
}

interface AuthContextValue {
  user: DemoUser | null;
  users: DemoUser[];
  loading: boolean;
  login: (userId: number) => Promise<void>;
  logout: () => void;
  hasRole: (...roles: string[]) => boolean;
  actingAs: ActingAs | null;
  actingAsUserId: number | null; // in wessen Namen agiert wird, sonst null (= ich selbst)
  setActingAs: (a: ActingAs | null) => void;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

const ACTING_AS_KEY = "deskshare_acting_as";

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<DemoUser | null>(null);
  const [users, setUsers] = useState<DemoUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [actingAs, setActingAsState] = useState<ActingAs | null>(() => {
    const raw = sessionStorage.getItem(ACTING_AS_KEY);
    return raw ? (JSON.parse(raw) as ActingAs) : null;
  });

  useEffect(() => {
    api
      .get<DemoUser[]>("/auth/users")
      .then(setUsers)
      .catch(() => setUsers([]));
  }, []);

  useEffect(() => {
    const token = getToken();
    if (!token) {
      setLoading(false);
      return;
    }
    api
      .get<DemoUser>("/auth/me")
      .then(setUser)
      .catch(() => setToken(null))
      .finally(() => setLoading(false));
  }, []);

  function setActingAs(a: ActingAs | null) {
    setActingAsState(a);
    if (a) sessionStorage.setItem(ACTING_AS_KEY, JSON.stringify(a));
    else sessionStorage.removeItem(ACTING_AS_KEY);
  }

  async function login(userId: number) {
    const res = await api.post<{ token: string; user: DemoUser }>("/auth/login", { user_id: userId });
    setToken(res.token);
    setUser(res.user);
    setActingAs(null);
  }

  function logout() {
    setToken(null);
    setUser(null);
    setActingAs(null);
  }

  function hasRole(...roles: string[]) {
    if (!user) return false;
    return roles.some((r) => user.roles.includes(r));
  }

  return (
    <AuthContext.Provider
      value={{ user, users, loading, login, logout, hasRole, actingAs, actingAsUserId: actingAs?.employeeUserId ?? null, setActingAs }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
