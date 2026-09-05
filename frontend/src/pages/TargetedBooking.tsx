import { useEffect, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { api, ApiError } from "../api/client";
import type { BookingOut, BuildingNode, FloorDeskStatus, FloorNode, PropertyTree } from "../api/types";
import { Badge, Button } from "../components/ui";
import { DoubleBookingModal, type DoubleBookingDetail } from "../components/DoubleBookingModal";
import { useAuth } from "../context/AuthContext";
import { FloorplanCanvas, parseFloorplanLayout } from "../components/FloorplanCanvas";

const STATUS_COLOR: Record<string, string> = {
  available: "fill-white stroke-on-tertiary-fixed-variant",
  top_match: "fill-tertiary-container/30 stroke-tertiary-container",
  occupied: "fill-surface-container-highest stroke-outline-variant",
  locked: "fill-surface-container-highest stroke-error",
  zone_restricted: "fill-surface-container-highest stroke-outline",
  mine: "fill-primary-container stroke-primary",
};

const STATUS_LABEL: Record<string, string> = {
  available: "Verfügbar",
  top_match: "Top-Match",
  occupied: "Belegt",
  locked: "Gesperrt",
  zone_restricted: "Zonen-Kontingent",
  mine: "Meine Buchung",
};

/** Flow 2 — Gezielte Buchung per Präferenzen und Raumplan. */
export default function TargetedBooking() {
  const { propertyId } = useParams();
  const navigate = useNavigate();
  const { actingAsUserId } = useAuth();
  const [searchParams] = useSearchParams();
  const [tree, setTree] = useState<PropertyTree | null>(null);
  const [selectedFloor, setSelectedFloor] = useState<FloorNode | null>(null);
  const [expanded, setExpanded] = useState<Record<number, boolean>>({});
  const [statuses, setStatuses] = useState<FloorDeskStatus[]>([]);
  const [selectedDesk, setSelectedDesk] = useState<FloorDeskStatus | null>(null);
  const [date, setDate] = useState(() => searchParams.get("date") || new Date().toISOString().slice(0, 10));
  const [dayPart, setDayPart] = useState<"full" | "am" | "pm">("full");
  const [bookingState, setBookingState] = useState<"idle" | "loading" | "done" | "error">("idle");
  const [error, setError] = useState<string | null>(null);
  const [doubleBooking, setDoubleBooking] = useState<DoubleBookingDetail | null>(null);
  const [viewMode, setViewMode] = useState<"plan" | "list">("plan");

  useEffect(() => {
    if (!propertyId) return;
    api.get<PropertyTree>(`/catalog/properties/${propertyId}/tree`).then((t) => {
      setTree(t);
      const firstFloorWithRooms = t.buildings.flatMap((b) => b.floors).find((f) => f.rooms.some((r) => r.room_type === "desk_area"));
      if (firstFloorWithRooms) setSelectedFloor(firstFloorWithRooms);
      const initialExpanded: Record<number, boolean> = {};
      t.buildings.forEach((b) => (initialExpanded[b.id] = true));
      setExpanded(initialExpanded);
    });
  }, [propertyId]);

  function loadStatuses() {
    if (!selectedFloor) return;
    const forParam = actingAsUserId ? `&for_user_id=${actingAsUserId}` : "";
    api
      .get<FloorDeskStatus[]>(`/bookings/floors/${selectedFloor.id}/desk-status?target_date=${date}&day_part=${dayPart}${forParam}`)
      .then(setStatuses);
  }

  useEffect(loadStatuses, [selectedFloor, dayPart, date, actingAsUserId]);

  async function confirmBooking(override = false, reason?: string) {
    if (!selectedDesk) return;
    setBookingState("loading");
    setError(null);
    try {
      await api.post<BookingOut>("/bookings/desks", {
        desk_id: selectedDesk.desk_id,
        date,
        day_part: dayPart,
        for_user_id: actingAsUserId ?? undefined,
        override_double_booking: override,
        double_booking_reason: reason,
      });
      setBookingState("done");
      setDoubleBooking(null);
      loadStatuses();
    } catch (e) {
      if (e instanceof ApiError && e.code === "DOUBLE_BOOKING_WARNING") {
        setBookingState("idle");
        setDoubleBooking(e.extra as unknown as DoubleBookingDetail);
        return;
      }
      setBookingState("error");
      if (e instanceof ApiError) setError(e.message);
    }
  }

  async function cancelOwnBooking() {
    if (!selectedDesk?.own_booking_id) return;
    setBookingState("loading");
    await api.post(`/bookings/${selectedDesk.own_booking_id}/cancel`);
    setSelectedDesk(null);
    setBookingState("idle");
    loadStatuses();
  }

  if (!tree) return <div className="text-on-surface-variant">Lädt…</div>;

  const digitalLayout = parseFloorplanLayout(selectedFloor?.floorplan_layout);
  const showPlan = viewMode === "plan" && !!digitalLayout;

  return (
    <div>
      <button onClick={() => navigate("/gezielte-buchung")} className="text-sm text-primary mb-2">
        ← Zur Standort-Karte
      </button>
      <h1 className="text-2xl font-bold mb-1">
        {tree.name} {selectedFloor && `/ ${selectedFloor.name}`}
      </h1>
      {tree.labels.length > 0 && (
        <div className="flex flex-wrap gap-1 mb-2">
          {tree.labels.map((l) => (
            <span key={l} className="text-xs px-2 py-0.5 rounded-full bg-secondary-container text-on-secondary-container">{l}</span>
          ))}
        </div>
      )}
      <div className="flex flex-wrap items-center gap-3 mb-4">
        <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="bg-surface-container-low rounded px-3 py-1.5 text-sm" />
        <div className="flex gap-2">
          {(["full", "am", "pm"] as const).map((dp) => (
            <button
              key={dp}
              onClick={() => setDayPart(dp)}
              className={`px-3 py-1 rounded-full text-xs font-semibold ${dayPart === dp ? "bg-primary text-on-primary" : "bg-surface-container-high text-on-surface-variant"}`}
            >
              {dp === "full" ? "Ganztags" : dp === "am" ? "Vormittag" : "Nachmittag"}
            </button>
          ))}
        </div>
        {digitalLayout && (
          <div className="flex gap-1 bg-surface-container-low rounded p-1">
            <button onClick={() => setViewMode("plan")} className={`px-2 py-1 text-xs rounded ${viewMode === "plan" ? "bg-primary text-on-primary" : "text-on-surface-variant"}`}>Grundriss</button>
            <button onClick={() => setViewMode("list")} className={`px-2 py-1 text-xs rounded ${viewMode === "list" ? "bg-primary text-on-primary" : "text-on-surface-variant"}`}>Liste</button>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[280px_1fr] gap-6">
        <div className="bg-surface-container-low rounded-md p-3 border border-outline-variant/30 h-fit">
          {tree.buildings.map((b: BuildingNode) => (
            <div key={b.id} className="mb-2">
              <button
                onClick={() => setExpanded((e) => ({ ...e, [b.id]: !e[b.id] }))}
                className="w-full text-left font-semibold text-sm px-2 py-1 flex items-center gap-1"
              >
                <span className={`inline-block transition-transform ${expanded[b.id] ? "rotate-90" : ""}`}>›</span> {b.name}
                {b.labels.length > 0 && <span className="text-xs font-normal text-on-surface-variant">({b.labels.join(", ")})</span>}
              </button>
              {expanded[b.id] &&
                b.floors.map((f) => {
                  const deskAreaRooms = f.rooms.filter((r) => r.room_type === "desk_area");
                  const totalDesks = deskAreaRooms.reduce((sum, r) => sum + r.desks.length, 0);
                  if (totalDesks === 0) return null;
                  return (
                    <button
                      key={f.id}
                      onClick={() => setSelectedFloor(f)}
                      className={`w-full flex justify-between items-center px-3 py-1.5 ml-3 rounded text-sm ${
                        selectedFloor?.id === f.id ? "bg-primary-fixed text-on-primary-fixed-variant" : "hover:bg-surface-container-high"
                      }`}
                    >
                      <span>{f.name}</span>
                      <span className="text-xs px-2 py-0.5 rounded-full bg-surface-container">{totalDesks} Desks</span>
                    </button>
                  );
                })}
            </div>
          ))}
        </div>

        <div>
          {showPlan ? (
            <FloorplanCanvas layout={digitalLayout!} desks={statuses} onDeskClick={(desk) => (desk.status === "available" || desk.status === "top_match" || desk.status === "mine") && setSelectedDesk(desk)} />
          ) : (
            <div>
              <div className="text-sm text-on-surface-variant mb-3 flex items-center gap-2">
                <span>ℹ️</span> {digitalLayout ? "Listenansicht." : "Für diese Etage liegt noch kein digitalisierter Grundriss vor — Listenansicht."}
              </div>
              <div className="space-y-2">
                {statuses.map((s) => (
                  <button
                    key={s.desk_id}
                    disabled={s.status !== "available" && s.status !== "top_match" && s.status !== "mine"}
                    onClick={() => setSelectedDesk(s)}
                    className="w-full flex justify-between items-center p-3 rounded bg-surface-container-lowest border border-outline-variant/30 disabled:opacity-50 hover:shadow-sm text-left"
                  >
                    <span>
                      {s.desk_number} · {s.room_name}
                      {s.labels.length > 0 && <span className="text-xs text-on-surface-variant ml-2">{s.labels.join(", ")}</span>}
                    </span>
                    <Badge tone={s.status === "mine" ? "positive" : s.status === "occupied" || s.status === "locked" ? "neutral" : s.status === "zone_restricted" ? "negative" : "positive"}>
                      {s.zone_name ? `Zone: ${s.zone_name}` : STATUS_LABEL[s.status]}
                    </Badge>
                  </button>
                ))}
              </div>
            </div>
          )}
          <div className="flex gap-4 mt-3 text-xs text-on-surface-variant">
            <span>🟩 Verfügbar</span>
            <span>💚 Top-Match</span>
            <span>🟦 Meine Buchung</span>
            <span>⬜ Belegt</span>
            <span>🔒 Gesperrt</span>
          </div>
        </div>
      </div>

      {selectedDesk && (
        <div className="fixed inset-y-0 right-0 w-96 bg-surface shadow-xl border-l border-outline-variant/30 p-6 overflow-y-auto z-40">
          <button onClick={() => { setSelectedDesk(null); setBookingState("idle"); }} className="text-sm text-on-surface-variant mb-4">✕ Schließen</button>
          <h2 className="text-xl font-bold mb-1">{selectedDesk.desk_number}</h2>
          <div className="text-on-surface-variant mb-2">{selectedDesk.room_name}</div>
          {selectedDesk.labels.length > 0 && (
            <div className="flex flex-wrap gap-1 mb-4">
              {selectedDesk.labels.map((l) => (
                <span key={l} className="text-xs px-2 py-0.5 rounded-full bg-surface-container text-on-surface-variant">{l}</span>
              ))}
            </div>
          )}
          {selectedDesk.match_score > 0 && <Badge tone="positive">Top-Match — {selectedDesk.match_score} Präferenzen erfüllt</Badge>}
          {error && <div className="mt-3 p-2 rounded bg-error-container text-on-error-container text-sm" role="alert">{error}</div>}
          {selectedDesk.status === "mine" ? (
            <Button variant="destructive" className="mt-6 w-full" loading={bookingState === "loading"} onClick={cancelOwnBooking}>
              Buchung stornieren
            </Button>
          ) : bookingState === "done" ? (
            <div className="mt-6 p-3 rounded bg-tertiary-fixed/40 text-on-tertiary-fixed-variant text-sm">✓ Gebucht.</div>
          ) : (
            <Button variant="accent" className="mt-6 w-full" loading={bookingState === "loading"} onClick={() => confirmBooking()}>
              Jetzt verbindlich buchen
            </Button>
          )}
        </div>
      )}

      {doubleBooking && (
        <DoubleBookingModal
          detail={doubleBooking}
          onClose={() => setDoubleBooking(null)}
          onCancelOther={async () => {
            await api.post(`/bookings/${doubleBooking.other_booking_id}/cancel`);
            await confirmBooking();
          }}
          onOverride={async (reason) => {
            await confirmBooking(true, reason);
          }}
        />
      )}
    </div>
  );
}
