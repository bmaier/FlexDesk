import { useEffect, useState } from "react";
import { api, ApiError } from "../api/client";
import type { BookingOut, QuickSuggestionOut } from "../api/types";
import { Button, Card, Badge } from "../components/ui";
import { DoubleBookingModal, type DoubleBookingDetail } from "../components/DoubleBookingModal";
import { useAuth } from "../context/AuthContext";

interface BookedInfo {
  id: number;
  resource_label: string;
  checkin_status: string | null;
  checkin_deadline: string | null;
}

/** Flow 1 — UJ-1: Herr Yilmaz bucht seinen Stammtisch in 5 Sekunden. */
export default function QuickBooking() {
  const { actingAsUserId } = useAuth();
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [data, setData] = useState<QuickSuggestionOut | null>(null);
  const [booked, setBooked] = useState<Record<number, BookedInfo>>({});
  const [status, setStatus] = useState<Record<number, "idle" | "loading" | "done" | "error">>({});
  const [error, setError] = useState<string | null>(null);
  const [announcement, setAnnouncement] = useState("");
  const [doubleBooking, setDoubleBooking] = useState<{ deskId: number; detail: DoubleBookingDetail } | null>(null);

  function load() {
    const forParam = actingAsUserId ? `&for_user_id=${actingAsUserId}` : "";
    api.get<QuickSuggestionOut>(`/bookings/quick-suggestion?target_date=${date}${forParam}`).then(setData);
  }

  useEffect(load, [date, actingAsUserId]);

  async function book(deskId: number, override = false, reason?: string) {
    setError(null);
    setStatus((s) => ({ ...s, [deskId]: "loading" }));
    try {
      const booking = await api.post<BookingOut>("/bookings/desks", {
        desk_id: deskId,
        date,
        day_part: "full",
        for_user_id: actingAsUserId ?? undefined,
        override_double_booking: override,
        double_booking_reason: reason,
      });
      setStatus((s) => ({ ...s, [deskId]: "done" }));
      setBooked((b) => ({ ...b, [deskId]: booking }));
      setAnnouncement(`${booking.resource_label} erfolgreich gebucht.`);
      setDoubleBooking(null);
    } catch (e) {
      if (e instanceof ApiError && e.code === "DOUBLE_BOOKING_WARNING") {
        setStatus((s) => ({ ...s, [deskId]: "idle" }));
        setDoubleBooking({ deskId, detail: e.extra as unknown as DoubleBookingDetail });
        return;
      }
      setStatus((s) => ({ ...s, [deskId]: "error" }));
      if (e instanceof ApiError) setError(e.message);
    }
  }

  async function checkin(deskId: number) {
    const info = booked[deskId];
    if (!info) return;
    const result = await api.post<{ status: string }>(`/bookings/${info.id}/checkin`);
    setBooked((b) => ({ ...b, [deskId]: { ...info, checkin_status: result.status } }));
  }

  if (!data) return <div className="text-on-surface-variant">Lädt…</div>;

  return (
    <div className="max-w-5xl">
      <div aria-live="polite" className="sr-only">{announcement}</div>
      <h1 className="text-3xl font-bold mb-1">Schnellbuchung</h1>
      <p className="text-on-surface-variant mb-4">Buchen Sie Ihren gewohnten Platz mit einem Klick.</p>

      <label className="block text-sm mb-6 max-w-xs">
        Datum
        <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="w-full mt-1 bg-surface-container-low rounded px-3 py-2" />
      </label>

      {error && <div className="mb-4 p-3 rounded bg-error-container text-on-error-container text-sm" role="alert">{error}</div>}

      {data.home_desk && (
        <div className="mb-8 p-6 rounded-xl bg-primary text-on-primary relative overflow-hidden">
          <div className="absolute -right-10 -top-10 w-48 h-48 rounded-full bg-tertiary-fixed/20 blur-2xl" />
          <div className="relative">
            <div className="text-sm uppercase tracking-widest opacity-80 mb-1">Gewohnter Platz</div>
            <div className="text-2xl font-bold mb-1">{data.home_desk.desk_number} · {data.home_desk.room_name}</div>
            <div className="opacity-80 mb-4">{data.home_desk.property_name}</div>
            {data.home_desk_available ? (
              <div className="flex items-center gap-3">
                <Button
                  variant="accent"
                  loading={status[data.home_desk.desk_id] === "loading"}
                  onClick={() => book(data.home_desk!.desk_id)}
                  disabled={status[data.home_desk.desk_id] === "done"}
                >
                  {status[data.home_desk.desk_id] === "done" ? "✓ Gebucht" : "Gewohnten Platz buchen"}
                </Button>
                {booked[data.home_desk.desk_id]?.checkin_status === "pending" && (
                  <Button variant="secondary" onClick={() => checkin(data.home_desk!.desk_id)}>Jetzt einchecken</Button>
                )}
                {booked[data.home_desk.desk_id]?.checkin_status === "done" && <Badge tone="positive">Eingecheckt</Badge>}
              </div>
            ) : (
              <Badge tone="negative">An diesem Tag bereits belegt</Badge>
            )}
          </div>
        </div>
      )}

      <h2 className="text-xl font-semibold mb-3">Empfehlungen für {new Date(date).toLocaleDateString("de-DE", { dateStyle: "medium" })}</h2>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {data.recommendations.map((d) => (
          <Card key={d.desk_id} className="hover:shadow-md transition-shadow">
            <div className="flex items-start justify-between">
              <div>
                <div className="font-semibold">{d.desk_number}</div>
                <div className="text-sm text-on-surface-variant">{d.room_name} · {d.property_name}</div>
              </div>
              {d.score > 0 && <Badge tone="positive">{d.score} Treffer</Badge>}
            </div>
            <div className="flex flex-wrap gap-1 mt-3">
              {d.labels.map((l) => (
                <span key={l} className="text-xs px-2 py-0.5 rounded bg-surface-container text-on-surface-variant">{l}</span>
              ))}
            </div>
            <Button
              variant="accent"
              className="mt-4 w-full"
              loading={status[d.desk_id] === "loading"}
              disabled={status[d.desk_id] === "done"}
              onClick={() => book(d.desk_id)}
            >
              {status[d.desk_id] === "done" ? "✓ Gebucht" : "Buchen"}
            </Button>
            {booked[d.desk_id]?.checkin_status === "pending" && (
              <Button variant="secondary" className="mt-2 w-full" onClick={() => checkin(d.desk_id)}>Jetzt einchecken</Button>
            )}
            {booked[d.desk_id]?.checkin_status === "done" && <div className="mt-2 text-center"><Badge tone="positive">Eingecheckt</Badge></div>}
          </Card>
        ))}
        {data.recommendations.length === 0 && <div className="text-on-surface-variant">Keine freien Alternativen gefunden.</div>}
      </div>

      {doubleBooking && (
        <DoubleBookingModal
          detail={doubleBooking.detail}
          onClose={() => setDoubleBooking(null)}
          onCancelOther={async () => {
            await api.post(`/bookings/${doubleBooking.detail.other_booking_id}/cancel`);
            await book(doubleBooking.deskId);
          }}
          onOverride={async (reason) => {
            await book(doubleBooking.deskId, true, reason);
          }}
        />
      )}
    </div>
  );
}
