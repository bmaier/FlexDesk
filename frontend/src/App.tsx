import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { AuthProvider, useAuth } from "./context/AuthContext";
import Layout from "./components/Layout";
import Login from "./pages/Login";
import QuickBooking from "./pages/QuickBooking";
import SiteExploration from "./pages/SiteExploration";
import TargetedBooking from "./pages/TargetedBooking";
import MeetingRooms from "./pages/MeetingRooms";
import SeriesBooking from "./pages/SeriesBooking";
import MyBookings from "./pages/MyBookings";
import WhoSitsWhere from "./pages/WhoSitsWhere";
import Approvals from "./pages/Approvals";
import FacilityManagement from "./pages/FacilityManagement";
import ConfidentialBlock from "./pages/ConfidentialBlock";
import BookFor from "./pages/BookFor";
import Preferences from "./pages/Preferences";
import type { ReactNode } from "react";

function RequireAuth({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) return <div className="p-8 text-on-surface-variant">Anmeldung wird verarbeitet…</div>;
  if (!user) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

function RequireRole({ roles, children }: { roles: string[]; children: ReactNode }) {
  const { hasRole } = useAuth();
  if (!hasRole(...roles)) {
    return (
      <div className="max-w-md mx-auto text-center py-16">
        <div className="w-20 h-20 mx-auto rounded-full bg-error-container flex items-center justify-center text-3xl mb-4">⛔</div>
        <div className="text-xl font-bold">Kein Zugriff</div>
        <div className="text-on-surface-variant mt-2 text-sm">Für diesen Bereich fehlt Ihnen die erforderliche Rolle.</div>
      </div>
    );
  }
  return <>{children}</>;
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route
            path="/"
            element={
              <RequireAuth>
                <Layout />
              </RequireAuth>
            }
          >
            <Route index element={<Navigate to="/schnellbuchung" replace />} />
            <Route path="schnellbuchung" element={<QuickBooking />} />
            <Route path="gezielte-buchung" element={<SiteExploration />} />
            <Route path="gezielte-buchung/:propertyId" element={<TargetedBooking />} />
            <Route path="meetingraeume" element={<MeetingRooms />} />
            <Route path="serienbuchung" element={<SeriesBooking />} />
            <Route path="meine-buchungen" element={<MyBookings />} />
            <Route path="wer-sitzt-wo" element={<WhoSitsWhere />} />
            <Route
              path="genehmigungscenter"
              element={
                <RequireRole roles={["fm", "raumverantwortlicher"]}>
                  <Approvals />
                </RequireRole>
              }
            />
            <Route
              path="facility-management"
              element={
                <RequireRole roles={["fm"]}>
                  <FacilityManagement />
                </RequireRole>
              }
            />
            <Route
              path="vertrauliche-raumblockierung"
              element={
                <RequireRole roles={["vsnfd"]}>
                  <ConfidentialBlock />
                </RequireRole>
              }
            />
            <Route path="buchen-fuer" element={<BookFor />} />
            <Route path="meine-praeferenzen" element={<Preferences />} />
          </Route>
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}
