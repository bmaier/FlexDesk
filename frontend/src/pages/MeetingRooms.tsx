import { useEffect, useState } from "react";
import { api, ApiError } from "../api/client";
import type { BookingOut, PropertyOut, SeatingOptionOut } from "../api/types";
import { Badge, Button, Card, Modal } from "../components/ui";
import { useAuth } from "../context/AuthContext";
import { DoubleBookingModal, type DoubleBookingDetail } from "../components/DoubleBookingModal";

interface MeetingRoomOut {
  id: number;
  room_number: string;
  name: string;
  capacity: number | null;
  approval_required: boolean;
  restricted_role_code: string | null;
  labels: string[];
  is_occupied_now: boolean;
}

interface RoomBookingSlot {
  booking_id: number;
  start_at: string;
  end_at: string;
  status: string;
  booked_for_name: string;
  booked_for_department: string | null;
  remark: string | null;
}

/** Flow 4 — Meetingraum-Buchung mit Genehmigungspflicht. */
export default function MeetingRooms() {
  const { hasRole, actingAsUserId } = useAuth();
  const [properties, setProperties] = useState<PropertyOut[]>([]);
  const [propertyId, setPropertyId] = useState<number | null>(null);
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [rooms, setRooms] = useState<MeetingRoomOut[]>([]);
  const [timelines, setTimelines] = useState<Record<number, RoomBookingSlot[]>>({});
  const [activeRoom, setActiveRoom] = useState<MeetingRoomOut | null>(null);
  const [seating, setSeating] = useState<SeatingOptionOut[]>([]);
  const [form, setForm] = useState({ startHour: 9, endHour: 10, seatingOptionId: "", remark: "" });
  const [state, setState] = useState<"idle" | "loading" | "done" | "error">("idle");
  const [error, setError] = useState<string | null>(null);
  const [doubleBooking, setDoubleBooking] = useState<DoubleBookingDetail | null>(null);

  useEffect(() => {
    api.get<PropertyOut[]>("/catalog/properties").then((props) => {
      setProperties(props);
      if (props.length) setPropertyId((current) => current ?? props[0].id);
    });
  }, []);

  function loadRooms() {
    if (!propertyId) return;
    api.get<MeetingRoomOut[]>(`/catalog/properties/${propertyId}/meeting-rooms`).then(async (rs) => {
      setRooms(rs);
      const entries = await Promise.all(
        rs.map((r) => api.get<RoomBookingSlot[]>(`/catalog/rooms/${r.id}/bookings?target_date=${date}`).then((slots) => [r.id, slots] as const)),
      );
      setTimelines(Object.fromEntries(entries));
    });
  }

  useEffect(loadRooms, [propertyId, date]);

  function openRoom(room: MeetingRoomOut) {
    setActiveRoom(room);
    setState("idle");
    setError(null);
    setForm({ startHour: 9, endHour: 10, seatingOptionId: "", remark: "" });
    api.get<SeatingOptionOut[]>(`/fm/rooms/${room.id}/seating-options`).then(setSeating).catch(() => setSeating([]));
  }

  async function submitBooking(override = false, reason?: string) {
    if (!activeRoom) return;
    setState("loading");
    setError(null);
    const start_at = `${date}T${String(form.startHour).padStart(2, "0")}:00:00`;
    const end_at = `${date}T${String(form.endHour).padStart(2, "0")}:00:00`;
    try {
      await api.post<BookingOut>("/bookings/rooms", {
        room_id: activeRoom.id,
        start_at,
        end_at,
        seating_option_id: form.seatingOptionId ? Number(form.seatingOptionId) : null,
        remark: hasRole("vm") ? form.remark || null : null,
        for_user_id: actingAsUserId ?? undefined,
        override_double_booking: override,
        double_booking_reason: reason,
      });
      setState("done");
      setDoubleBooking(null);
      loadRooms();
    } catch (e) {
      if (e instanceof ApiError && e.code === "DOUBLE_BOOKING_WARNING") {
        setState("idle");
        setDoubleBooking(e.extra as unknown as DoubleBookingDetail);
        return;
      }
      setState("error");
      if (e instanceof ApiError) setError(e.message);
    }
  }

  return (
    <div>
      <h1 className="text-3xl font-bold mb-1">Meetingräume</h1>
      <p className="text-on-surface-variant mb-4">Räume buchen oder — bei Genehmigungspflicht — anfragen.</p>

      <div className="flex flex-wrap gap-3 mb-6">
        <select
          value={propertyId ?? ""}
          onChange={(e) => setPropertyId(Number(e.target.value))}
          className="bg-surface-container-low rounded px-3 py-2 text-sm"
        >
          {properties.map((p) => (
            <option key={p.id} value={p.id}>{p.name}</option>
          ))}
        </select>
        <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="bg-surface-container-low rounded px-3 py-2 text-sm" />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {rooms.map((r) => {
          const notAuthorized = r.restricted_role_code && !hasRole(r.restricted_role_code, "fm");
          return (
            <Card key={r.id} data-testid={`meeting-room-${r.id}`} data-room-name={r.name} className={r.is_occupied_now ? "opacity-70" : ""}>
              <div className="flex justify-between items-start">
                <div>
                  <div className="font-semibold">{r.name}</div>
                  <div className="text-sm text-on-surface-variant">Raum {r.room_number} · max. {r.capacity ?? "—"} Personen</div>
                </div>
                {r.approval_required && <Badge tone="negative">Freigabe Req.</Badge>}
              </div>
              <div className="flex flex-wrap gap-1 mt-2">
                {r.labels.map((l) => (
                  <span key={l} className="text-xs px-2 py-0.5 rounded bg-surface-container text-on-surface-variant">{l}</span>
                ))}
              </div>
              <div className="mt-3 h-2 rounded-full bg-surface-container-highest overflow-hidden flex">
                {(timelines[r.id] ?? []).map((slot) => (
                  <div key={slot.booking_id} title={`${slot.start_at}–${slot.end_at} (${slot.booked_for_name})`} className="h-full bg-outline-variant" style={{ width: "20%" }} />
                ))}
              </div>
              <Button
                variant="accent"
                className="mt-4 w-full"
                disabled={!!notAuthorized || r.is_occupied_now}
                onClick={() => openRoom(r)}
              >
                {notAuthorized ? "Nicht berechtigt" : r.is_occupied_now ? "Besetzt" : r.approval_required ? "Anfragen" : "Buchen"}
              </Button>
            </Card>
          );
        })}
      </div>

      {activeRoom && (
        <Modal title={activeRoom.name} onClose={() => setActiveRoom(null)}>
          {state === "done" ? (
            <div className="p-3 rounded bg-tertiary-fixed/40 text-on-tertiary-fixed-variant text-sm">
              {activeRoom.approval_required ? "Anfrage gesendet — Status „Ausstehend“ in Meine Buchungen." : "Gebucht."}
            </div>
          ) : (
            <div className="space-y-3">
              {error && <div className="p-2 rounded bg-error-container text-on-error-container text-sm" role="alert">{error}</div>}
              <label className="block text-sm">
                Von
                <select value={form.startHour} onChange={(e) => setForm((f) => ({ ...f, startHour: Number(e.target.value) }))} className="w-full mt-1 bg-surface-container-low rounded px-3 py-2">
                  {Array.from({ length: 11 }, (_, i) => i + 8).map((h) => (
                    <option key={h} value={h}>{h}:00</option>
                  ))}
                </select>
              </label>
              <label className="block text-sm">
                Bis
                <select value={form.endHour} onChange={(e) => setForm((f) => ({ ...f, endHour: Number(e.target.value) }))} className="w-full mt-1 bg-surface-container-low rounded px-3 py-2">
                  {Array.from({ length: 11 }, (_, i) => i + 9).map((h) => (
                    <option key={h} value={h}>{h}:00</option>
                  ))}
                </select>
              </label>
              {seating.length > 0 && (
                <label className="block text-sm">
                  Bestuhlung
                  <select value={form.seatingOptionId} onChange={(e) => setForm((f) => ({ ...f, seatingOptionId: e.target.value }))} className="w-full mt-1 bg-surface-container-low rounded px-3 py-2">
                    <option value="">Standard</option>
                    {seating.filter((s) => !s.is_standard).map((s) => (
                      <option key={s.id} value={s.id}>{s.name} (+{s.changeover_days} Umbautag/e)</option>
                    ))}
                  </select>
                </label>
              )}
              {hasRole("vm") && (
                <label className="block text-sm">
                  Bemerkung (nur für VM sichtbar)
                  <input value={form.remark} onChange={(e) => setForm((f) => ({ ...f, remark: e.target.value }))} className="w-full mt-1 bg-surface-container-low rounded px-3 py-2" />
                </label>
              )}
              <Button variant="accent" className="w-full" loading={state === "loading"} onClick={() => submitBooking()}>
                {activeRoom.approval_required ? "Anfrage senden" : "Buchen"}
              </Button>
            </div>
          )}
        </Modal>
      )}

      {doubleBooking && (
        <DoubleBookingModal
          detail={doubleBooking}
          onClose={() => setDoubleBooking(null)}
          onCancelOther={async () => {
            await api.post(`/bookings/${doubleBooking.other_booking_id}/cancel`);
            await submitBooking();
          }}
          onOverride={async (reason) => {
            await submitBooking(true, reason);
          }}
        />
      )}
    </div>
  );
}
