import { useEffect, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { api, ApiError } from "../api/client";
import type {
  BookingOut,
  BuildingNode,
  DepartmentOut,
  FloorDeskStatus,
  FloorNode,
  MeetingRoomOut,
  PropertyTree,
  RoomNode,
  SeatingOptionOut,
} from "../api/types";
import { Badge, Button, Card, Modal } from "../components/ui";
import { DoubleBookingModal, type DoubleBookingDetail } from "../components/DoubleBookingModal";
import { useAuth } from "../context/AuthContext";
import {
  FloorplanCanvas,
  type FloorplanLayout,
  generateDeskAreaLayout,
  generateMeetingRoomLayout,
  parseFloorplanLayout,
} from "../components/FloorplanCanvas";

const STATUS_LABEL: Record<string, string> = {
  available: "Verfügbar",
  top_match: "Top-Match",
  occupied: "Belegt",
  locked: "Gesperrt",
  zone_restricted: "Zonen-Kontingent",
  mine: "Meine Buchung",
};

/** Flow 2 — Gezielte Buchung per Präferenzen, Raumplan & hierarchischer Navigation. */
export default function TargetedBooking() {
  const { propertyId } = useParams();
  const navigate = useNavigate();
  const { user, hasRole, actingAsUserId } = useAuth();
  const [searchParams] = useSearchParams();

  const [tree, setTree] = useState<PropertyTree | null>(null);
  const [selectedFloor, setSelectedFloor] = useState<FloorNode | null>(null);
  const [selectedRoom, setSelectedRoom] = useState<RoomNode | null>(null);

  const [expandedBuildings, setExpandedBuildings] = useState<Record<number, boolean>>({});
  const [expandedFloors, setExpandedFloors] = useState<Record<number, boolean>>({});

  const [statuses, setStatuses] = useState<FloorDeskStatus[]>([]);
  const [meetingRooms, setMeetingRooms] = useState<MeetingRoomOut[]>([]);
  const [selectedDesk, setSelectedDesk] = useState<FloorDeskStatus | null>(null);

  // Raum-Innenlayout für gewählten Raum
  const [roomInteriorLayout, setRoomInteriorLayout] = useState<FloorplanLayout | null>(null);

  const [date, setDate] = useState(() => searchParams.get("date") || new Date().toISOString().slice(0, 10));
  const [dayPart, setDayPart] = useState<"full" | "am" | "pm">("full");
  const [viewMode, setViewMode] = useState<"plan" | "list">("plan");

  const [bookingState, setBookingState] = useState<"idle" | "loading" | "done" | "error">("idle");
  const [error, setError] = useState<string | null>(null);
  const [doubleBooking, setDoubleBooking] = useState<DoubleBookingDetail | null>(null);

  // Meetingraum-Buchung Modal State
  const [activeMeetingRoom, setActiveMeetingRoom] = useState<MeetingRoomOut | null>(null);
  const [meetingLayout, setMeetingLayout] = useState<FloorplanLayout | null>(null);
  const [seatingOptions, setSeatingOptions] = useState<SeatingOptionOut[]>([]);
  const [departments, setDepartments] = useState<DepartmentOut[]>([]);
  const [meetingForm, setMeetingForm] = useState({ startHour: 9, endHour: 10, seatingOptionId: "", remark: "" });
  const [hasCatering, setHasCatering] = useState(false);
  const [cateringNotes, setCateringNotes] = useState("");
  const [billingMode, setBillingMode] = useState<"own" | "foreign">("own");
  const [foreignDeptId, setForeignDeptId] = useState<number | "">("");
  const [foreignCostCenter, setForeignCostCenter] = useState("");
  const [costCenterWarningAcknowledged, setCostCenterWarningAcknowledged] = useState(false);
  const [meetingBookingState, setMeetingBookingState] = useState<"idle" | "loading" | "done" | "error">("idle");
  const [meetingError, setMeetingError] = useState<string | null>(null);

  // 1. Lade Liegenschafts-Baum & Abteilungen
  useEffect(() => {
    if (!propertyId) return;
    api.get<PropertyTree>(`/catalog/properties/${propertyId}/tree`).then((t) => {
      setTree(t);
      const allFloors = t.buildings.flatMap((b) => b.floors);
      const firstFloor = allFloors.find((f) => f.rooms.length > 0) ?? allFloors[0] ?? null;
      if (firstFloor) {
        setSelectedFloor(firstFloor);
        setExpandedFloors({ [firstFloor.id]: true });
      }
      const initialB: Record<number, boolean> = {};
      t.buildings.forEach((b) => (initialB[b.id] = true));
      setExpandedBuildings(initialB);
    });
    api.get<DepartmentOut[]>("/catalog/departments").then(setDepartments).catch(() => setDepartments([]));
  }, [propertyId]);

  // 2. Lade Meetingräume der Liegenschaft für Live-Verfügbarkeit
  useEffect(() => {
    if (!propertyId) return;
    api.get<MeetingRoomOut[]>(`/catalog/properties/${propertyId}/meeting-rooms`).then(setMeetingRooms).catch(() => setMeetingRooms([]));
  }, [propertyId, date]);

  // 3. Lade Desk-Status für die aktive Etage
  function loadStatuses() {
    if (!selectedFloor) return;
    const forParam = actingAsUserId ? `&for_user_id=${actingAsUserId}` : "";
    api
      .get<FloorDeskStatus[]>(`/bookings/floors/${selectedFloor.id}/desk-status?target_date=${date}&day_part=${dayPart}${forParam}`)
      .then(setStatuses)
      .catch(() => setStatuses([]));
  }

  useEffect(loadStatuses, [selectedFloor, dayPart, date, actingAsUserId]);

  // 4. Lade individuelles Raum-Innenlayout wenn ein Büroraum selektiert ist
  useEffect(() => {
    if (!selectedRoom) {
      setRoomInteriorLayout(null);
      return;
    }
    if (selectedRoom.room_type === "desk_area") {
      api
        .get<{ layout: string | null; seating_layout: string | null }>(`/catalog/rooms/${selectedRoom.id}/floorplan-layout`)
        .then((res) => {
          const parsed = parseFloorplanLayout(res.layout);
          if (parsed && parsed.objects.length > 0) {
            setRoomInteriorLayout(parsed);
          } else {
            // Automatische ergonomische Anordnung als Vorlage
            setRoomInteriorLayout({ objects: generateDeskAreaLayout(selectedRoom.desks) });
          }
        })
        .catch(() => {
          setRoomInteriorLayout({ objects: generateDeskAreaLayout(selectedRoom.desks) });
        });
    }
  }, [selectedRoom]);

  // Desk buchen
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

  // Meetingraum öffnen & buchen
  function openMeetingRoom(room: MeetingRoomOut) {
    setActiveMeetingRoom(room);
    setMeetingBookingState("idle");
    setMeetingError(null);
    setMeetingForm({ startHour: 9, endHour: 10, seatingOptionId: "", remark: "" });
    setHasCatering(false);
    setCateringNotes("");
    setBillingMode("own");
    setForeignDeptId("");
    setForeignCostCenter("");
    setCostCenterWarningAcknowledged(false);

    api.get<SeatingOptionOut[]>(`/fm/rooms/${room.id}/seating-options`).then(setSeatingOptions).catch(() => setSeatingOptions([]));

    api
      .get<{ layout: string | null; seating_layout: string | null }>(`/catalog/rooms/${room.id}/floorplan-layout`)
      .then((res) => {
        const parsed = parseFloorplanLayout(res.layout);
        if (parsed && parsed.objects.length > 0) {
          setMeetingLayout(parsed);
        } else {
          setMeetingLayout({ objects: generateMeetingRoomLayout(room.capacity || 10, res.seating_layout || "boardroom") });
        }
      })
      .catch(() => {
        setMeetingLayout({ objects: generateMeetingRoomLayout(room.capacity || 10, "boardroom") });
      });
  }

  async function submitMeetingBooking(override = false, reason?: string) {
    if (!activeMeetingRoom) return;

    if (hasCatering && billingMode === "foreign") {
      if (!foreignDeptId) {
        setMeetingError("Bitte wählen Sie die zu belastende Organisationseinheit aus.");
        return;
      }
      if (!costCenterWarningAcknowledged) {
        setMeetingError("Bitte bestätigen Sie den Hinweis zur Weiterbelastung an die Fremdkostenstelle.");
        return;
      }
    }

    setMeetingBookingState("loading");
    setMeetingError(null);

    const start_at = `${date}T${String(meetingForm.startHour).padStart(2, "0")}:00:00`;
    const end_at = `${date}T${String(meetingForm.endHour).padStart(2, "0")}:00:00`;
    const selectedForeignDept = departments.find((d) => d.id === Number(foreignDeptId));

    try {
      await api.post<BookingOut>("/bookings/rooms", {
        room_id: activeMeetingRoom.id,
        start_at,
        end_at,
        seating_option_id: meetingForm.seatingOptionId ? Number(meetingForm.seatingOptionId) : null,
        remark: hasRole("vm") ? meetingForm.remark || null : null,
        for_user_id: actingAsUserId ?? undefined,
        override_double_booking: override,
        double_booking_reason: reason,
        has_catering: hasCatering,
        catering_notes: hasCatering ? cateringNotes || null : null,
        billing_department_id:
          hasCatering && billingMode === "foreign" && foreignDeptId
            ? Number(foreignDeptId)
            : (user?.department_id ?? null),
        cost_center: hasCatering
          ? billingMode === "foreign"
            ? foreignCostCenter || selectedForeignDept?.cost_center || null
            : (user?.cost_center ?? null)
          : null,
        cost_center_warning_acknowledged:
          hasCatering && billingMode === "foreign" ? costCenterWarningAcknowledged : false,
      });
      setMeetingBookingState("done");
      setDoubleBooking(null);
      if (propertyId) {
        api.get<MeetingRoomOut[]>(`/catalog/properties/${propertyId}/meeting-rooms`).then(setMeetingRooms).catch(() => {});
      }
    } catch (e) {
      if (e instanceof ApiError && e.code === "DOUBLE_BOOKING_WARNING") {
        setMeetingBookingState("idle");
        setDoubleBooking(e.extra as unknown as DoubleBookingDetail);
        return;
      }
      setMeetingBookingState("error");
      if (e instanceof ApiError) setMeetingError(e.message);
    }
  }

  if (!tree) {
    return (
      <div className="p-12 text-center text-on-surface-variant">
        <div className="text-3xl mb-3 animate-pulse">🏢</div>
        <p className="font-medium">Lade Liegenschafts- und Raumplan-Daten...</p>
      </div>
    );
  }

  const currentBuilding = tree.buildings.find((b) => b.floors.some((f) => f.id === selectedFloor?.id));
  const floorLayout = parseFloorplanLayout(selectedFloor?.floorplan_layout || (selectedFloor as any)?.layout);
  const isRoomActive = !!selectedRoom;
  const activeLayout = isRoomActive && selectedRoom.room_type === "desk_area"
    ? (roomInteriorLayout || { objects: generateDeskAreaLayout(selectedRoom.desks) })
    : floorLayout;
  const hasLayout = !!(activeLayout && activeLayout.objects && activeLayout.objects.length > 0);
  const showPlan = viewMode === "plan" && hasLayout;

  const roomDesks = selectedRoom ? statuses.filter((s) => s.room_id === selectedRoom.id) : statuses;
  const floorMeetingRooms = selectedFloor ? selectedFloor.rooms.filter((r) => r.room_type === "meeting") : [];
  const floorDeskRooms = selectedFloor ? selectedFloor.rooms.filter((r) => r.room_type === "desk_area") : [];

  function handleDeskClick(desk: FloorDeskStatus) {
    if (desk.status === "available" || desk.status === "top_match" || desk.status === "mine") {
      setSelectedDesk(desk);
      setBookingState("idle");
      setError(null);
    }
  }

  function handleRoomClick(roomId: number, roomType: "meeting" | "desk_area") {
    if (roomType === "meeting") {
      let mr = meetingRooms.find((m) => m.id === roomId);
      if (!mr && selectedFloor) {
        const fr = selectedFloor.rooms.find((r) => r.id === roomId);
        if (fr) {
          mr = {
            id: fr.id,
            room_number: fr.room_number,
            name: fr.name,
            capacity: fr.capacity,
            approval_required: fr.approval_required,
            restricted_role_code: fr.restricted_role_code,
            labels: fr.labels,
            is_occupied_now: false,
          };
        }
      }
      if (mr) {
        openMeetingRoom(mr);
      } else {
        api
          .get<MeetingRoomOut>(`/catalog/rooms/${roomId}`)
          .then((fetched) => openMeetingRoom(fetched))
          .catch(() => {});
      }
    } else {
      let rn = selectedFloor?.rooms.find((r) => r.id === roomId);
      if (!rn && tree) {
        for (const b of tree.buildings) {
          for (const f of b.floors) {
            const found = f.rooms.find((r) => r.id === roomId);
            if (found) {
              rn = found;
              setSelectedFloor(f);
              break;
            }
          }
          if (rn) break;
        }
      }
      if (rn) {
        setSelectedRoom(rn);
        setViewMode("plan");
        // Sofort Layout bereitstellen, damit kein Flackern auf Listenmodus entsteht
        setRoomInteriorLayout({ objects: generateDeskAreaLayout(rn.desks) });
      }
    }
  }

  function handleMeetingRoomClick(room: MeetingRoomOut) {
    openMeetingRoom(room);
  }

  return (
    <div>
      {/* Breadcrumb & Navigation Bar */}
      <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
        <div className="flex flex-wrap items-center gap-1.5 text-sm">
          <button
            onClick={() => navigate("/gezielte-buchung")}
            className="text-primary hover:underline font-medium flex items-center gap-1"
          >
            ← Standort-Karte
          </button>
          <span className="text-on-surface-variant">/</span>
          <span className="font-semibold text-on-surface">{tree.name}</span>
          {currentBuilding && (
            <>
              <span className="text-on-surface-variant">/</span>
              <span className="text-on-surface-variant">{currentBuilding.name}</span>
            </>
          )}
          {selectedFloor && (
            <>
              <span className="text-on-surface-variant">/</span>
              <button
                onClick={() => setSelectedRoom(null)}
                className={`font-medium ${!selectedRoom ? "text-primary font-bold" : "text-on-surface hover:underline"}`}
              >
                {selectedFloor.name}
              </button>
            </>
          )}
          {selectedRoom && (
            <>
              <span className="text-on-surface-variant">/</span>
              <span className="px-2 py-0.5 rounded bg-primary/10 text-primary font-semibold flex items-center gap-1">
                {selectedRoom.room_type === "meeting" ? "🏛️" : "💼"} {selectedRoom.name} ({selectedRoom.room_number})
              </span>
            </>
          )}
        </div>

        {selectedRoom && (
          <button
            onClick={() => setSelectedRoom(null)}
            className="text-xs px-2.5 py-1 rounded border border-outline-variant bg-surface-container-low hover:bg-surface-container text-on-surface flex items-center gap-1"
          >
            ← Zurück zur Etagenübersicht ({selectedFloor?.name})
          </button>
        )}
      </div>

      {/* Filterleiste: Datum, Tageszeit, Ansichtsmodus */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4 bg-surface-container-lowest p-3 rounded-lg border border-outline-variant/30">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2">
            <label className="text-xs font-semibold text-on-surface-variant">Datum:</label>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="bg-surface-container-low rounded px-2.5 py-1 text-sm border border-outline-variant/50"
            />
          </div>
          <div className="flex gap-1.5">
            {(["full", "am", "pm"] as const).map((dp) => (
              <button
                key={dp}
                onClick={() => setDayPart(dp)}
                className={`px-3 py-1 rounded-full text-xs font-semibold transition-colors ${
                  dayPart === dp ? "bg-primary text-on-primary shadow-sm" : "bg-surface-container text-on-surface-variant hover:bg-surface-container-high"
                }`}
              >
                {dp === "full" ? "Ganztags" : dp === "am" ? "Vormittag" : "Nachmittag"}
              </button>
            ))}
          </div>
        </div>

        <div className="flex items-center gap-2">
          {hasLayout && (
            <div className="flex gap-1 bg-surface-container-low rounded p-1 border border-outline-variant/40">
              <button
                onClick={() => setViewMode("plan")}
                className={`px-3 py-1 text-xs font-semibold rounded flex items-center gap-1 ${
                  viewMode === "plan" ? "bg-primary text-on-primary shadow-sm" : "text-on-surface-variant hover:text-on-surface"
                }`}
              >
                🗺️ Grundriss
              </button>
              <button
                onClick={() => setViewMode("list")}
                className={`px-3 py-1 text-xs font-semibold rounded flex items-center gap-1 ${
                  viewMode === "list" ? "bg-primary text-on-primary shadow-sm" : "text-on-surface-variant hover:text-on-surface"
                }`}
              >
                📋 Liste
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Hauptbereich: Links hierarchischer Baum, Rechts Grundriss oder Liste */}
      <div className="grid grid-cols-1 lg:grid-cols-[300px_1fr] gap-6">
        {/* Linke Sidebar: Liegenschaft -> Gebäude -> Etage -> Räume */}
        <div className="bg-surface-container-low rounded-xl p-3 border border-outline-variant/30 h-fit space-y-2">
          <div className="text-xs font-bold uppercase tracking-wider text-on-surface-variant px-2 py-1">
            Hierarchie & Navigation
          </div>

          {tree.buildings.map((b: BuildingNode) => {
            const isBExpanded = expandedBuildings[b.id] ?? true;
            return (
              <div key={b.id} className="border-b border-outline-variant/20 last:border-0 pb-2">
                <button
                  onClick={() => setExpandedBuildings((prev) => ({ ...prev, [b.id]: !isBExpanded }))}
                  className="w-full text-left font-bold text-sm px-2 py-1.5 flex items-center justify-between rounded hover:bg-surface-container-high"
                >
                  <span className="flex items-center gap-1.5">
                    <span className={`inline-block text-xs transition-transform ${isBExpanded ? "rotate-90" : ""}`}>▶</span>
                    🏢 {b.name}
                  </span>
                  <span className="text-xs font-normal text-on-surface-variant">{b.floors.length} Etagen</span>
                </button>

                {isBExpanded && (
                  <div className="pl-3 mt-1 space-y-1">
                    {b.floors.map((f) => {
                      const isSelectedF = selectedFloor?.id === f.id;
                      const isFExpanded = expandedFloors[f.id] ?? isSelectedF;
                      const totalDesks = f.rooms.reduce((sum, r) => sum + r.desks.length, 0);

                      return (
                        <div key={f.id} className="rounded-lg overflow-hidden">
                          <div
                            className={`flex items-center justify-between px-2 py-1.5 rounded text-sm transition-colors ${
                              isSelectedF && !selectedRoom
                                ? "bg-primary-fixed text-on-primary-fixed-variant font-semibold"
                                : isSelectedF
                                ? "bg-surface-container-high font-medium text-on-surface"
                                : "hover:bg-surface-container text-on-surface"
                            }`}
                          >
                            <button
                              onClick={() => {
                                setSelectedFloor(f);
                                setSelectedRoom(null);
                              }}
                              className="flex-1 text-left flex items-center gap-1.5"
                            >
                              <span>📐 {f.name}</span>
                            </button>
                            <div className="flex items-center gap-1">
                              <span className="text-xs px-1.5 py-0.5 rounded bg-surface-container-lowest text-on-surface-variant">
                                {totalDesks} Desks
                              </span>
                              {f.rooms.length > 0 && (
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setExpandedFloors((prev) => ({ ...prev, [f.id]: !isFExpanded }));
                                  }}
                                  className="text-xs p-1 text-on-surface-variant hover:text-on-surface"
                                  title="Räume anzeigen"
                                >
                                  {isFExpanded ? "▲" : "▼"}
                                </button>
                              )}
                            </div>
                          </div>

                          {/* Räume unter dieser Etage */}
                          {isFExpanded && f.rooms.length > 0 && (
                            <div className="pl-4 py-1 space-y-0.5 border-l border-outline-variant/30 ml-3">
                              {f.rooms.map((r) => {
                                const isRoomActiveItem = selectedRoom?.id === r.id;
                                const isMeeting = r.room_type === "meeting";

                                return (
                                  <button
                                    key={r.id}
                                    onClick={() => {
                                      setSelectedFloor(f);
                                      setSelectedRoom(r);
                                      if (isMeeting) {
                                        const mr = meetingRooms.find((m) => m.id === r.id) || {
                                          id: r.id,
                                          room_number: r.room_number,
                                          name: r.name,
                                          capacity: r.capacity,
                                          approval_required: r.approval_required,
                                          restricted_role_code: r.restricted_role_code,
                                          labels: r.labels,
                                          is_occupied_now: false,
                                        };
                                        openMeetingRoom(mr);
                                      }
                                    }}
                                    className={`w-full flex items-center justify-between px-2 py-1 rounded text-xs text-left transition-colors ${
                                      isRoomActiveItem
                                        ? "bg-primary text-on-primary font-semibold shadow-sm"
                                        : "hover:bg-surface-container text-on-surface-variant hover:text-on-surface"
                                    }`}
                                  >
                                    <span className="flex items-center gap-1 truncate">
                                      <span>{isMeeting ? "🏛️" : "💼"}</span>
                                      <span className="truncate">{r.name}</span>
                                    </span>
                                    <span
                                      className={`text-[10px] px-1 rounded ${
                                        isRoomActiveItem ? "bg-white/20 text-white" : "bg-surface-container-high"
                                      }`}
                                    >
                                      {isMeeting ? `bis ${r.capacity || "?"} P.` : `${r.desks.length} D.`}
                                    </span>
                                  </button>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Rechter Hauptbereich: Grundriss oder Liste */}
        <div>
          {/* Detail-Header wenn ein Raum ausgewählt ist */}
          {selectedRoom && (
            <div className="mb-3 p-3 rounded-lg bg-surface-container-low border border-outline-variant/30 flex flex-wrap items-center justify-between gap-2">
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-xl">{selectedRoom.room_type === "meeting" ? "🏛️" : "💼"}</span>
                  <span className="font-bold text-base text-on-surface">
                    {selectedRoom.name} ({selectedRoom.room_number})
                  </span>
                  <Badge tone={selectedRoom.room_type === "meeting" ? "neutral" : "positive"}>
                    {selectedRoom.room_type === "meeting" ? "Meetingraum" : "Büroraum"}
                  </Badge>
                </div>
                {selectedRoom.labels.length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-1">
                    {selectedRoom.labels.map((l) => (
                      <span key={l} className="text-[11px] px-1.5 py-0.5 rounded bg-surface-container text-on-surface-variant">
                        {l}
                      </span>
                    ))}
                  </div>
                )}
              </div>

              <div className="flex items-center gap-2">
                {selectedRoom.room_type === "desk_area" ? (
                  <span className="text-xs font-semibold px-2 py-1 rounded bg-secondary-container text-on-secondary-container">
                    {roomDesks.filter((d) => d.status === "available" || d.status === "top_match").length} von {roomDesks.length} Desks frei
                  </span>
                ) : (
                  <Button
                    className="px-3 py-1 text-xs"
                    variant="accent"
                    onClick={() => {
                      const mr = meetingRooms.find((m) => m.id === selectedRoom.id) || {
                        id: selectedRoom.id,
                        room_number: selectedRoom.room_number,
                        name: selectedRoom.name,
                        capacity: selectedRoom.capacity,
                        approval_required: selectedRoom.approval_required,
                        restricted_role_code: selectedRoom.restricted_role_code,
                        labels: selectedRoom.labels,
                        is_occupied_now: false,
                      };
                      openMeetingRoom(mr);
                    }}
                  >
                    📅 Jetzt buchen
                  </Button>
                )}
              </div>
            </div>
          )}

          {/* Anzeige-Weiche: Plan vs Liste */}
          {showPlan ? (
            <div>
              {selectedRoom && (
                <div className="flex flex-wrap items-center justify-between gap-3 p-3 mb-3 rounded-xl bg-primary/10 border border-primary/20 text-sm">
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setSelectedRoom(null)}
                      className="font-bold text-primary hover:bg-primary/20 flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-surface border border-primary/30 shadow-sm transition-all text-xs sm:text-sm"
                    >
                      ← Zurück zum Etagen-Grundriss ({selectedFloor?.name})
                    </button>
                    <span className="font-semibold text-on-surface flex items-center gap-1">
                      {selectedRoom.room_type === "meeting" ? "🏛️" : "💼"} {selectedRoom.name} ({selectedRoom.room_number})
                    </span>
                  </div>
                  <div className="flex items-center gap-2 text-xs">
                    <span className="text-on-surface-variant">Raum wechseln:</span>
                    <select
                      value={selectedRoom.id}
                      onChange={(e) => {
                        const targetId = Number(e.target.value);
                        const nextRoom = selectedFloor?.rooms.find((r) => r.id === targetId);
                        if (nextRoom) {
                          setSelectedRoom(nextRoom);
                          if (nextRoom.room_type === "desk_area") {
                            setRoomInteriorLayout({ objects: generateDeskAreaLayout(nextRoom.desks) });
                          }
                        }
                      }}
                      className="bg-surface rounded px-2.5 py-1 text-xs border border-outline-variant/40 font-medium text-on-surface"
                    >
                      {selectedFloor?.rooms.map((r) => (
                        <option key={r.id} value={r.id}>
                          {r.room_type === "meeting" ? "🏛️" : "💼"} {r.name} ({r.room_number})
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              )}
              <FloorplanCanvas
                layout={activeLayout!}
                desks={roomDesks}
                meetingRooms={meetingRooms}
                onDeskClick={handleDeskClick}
                onRoomClick={handleRoomClick}
                onMeetingRoomClick={handleMeetingRoomClick}
                onBackToFloor={selectedRoom ? () => setSelectedRoom(null) : undefined}
                renderFallbackDesks={!selectedFloor?.floorplan_layout && !selectedRoom}
              />
              {!selectedRoom && (
                <div className="mt-2.5 p-2 rounded bg-surface-container-low text-xs text-on-surface-variant flex items-center gap-2 border border-outline-variant/30">
                  <span>💡</span>
                  <span>
                    <strong>Tipp:</strong> Klicke direkt auf einen <strong>Büroraum (💼)</strong>, um dessen Grundriss mit allen Desks zu öffnen. Klicke auf einen <strong>Meetingraum (🏛️)</strong>, um Bestuhlung und Catering zu buchen.
                  </span>
                </div>
              )}
            </div>
          ) : (
            <div>
              <div className="text-xs text-on-surface-variant mb-3 flex items-center gap-1.5">
                <span>ℹ️</span>
                <span>
                  {selectedRoom
                    ? `Listenansicht für Raum „${selectedRoom.name}”.`
                    : hasLayout
                    ? "Listenansicht aller Räume auf dieser Etage."
                    : "Für diese Ebene liegt noch kein Grundriss vor — strukturierte Listenansicht."}
                </span>
              </div>

              {/* Wenn ein einzelner Büroraum gewählt ist, liste seine Desks */}
              {selectedRoom ? (
                <div className="space-y-2">
                  {roomDesks.length === 0 ? (
                    <div className="p-6 text-center text-sm text-on-surface-variant bg-surface-container-lowest rounded border border-outline-variant/30">
                      In diesem Raum sind noch keine Desks angelegt.
                    </div>
                  ) : (
                    roomDesks.map((s) => (
                      <button
                        key={s.desk_id}
                        disabled={s.status !== "available" && s.status !== "top_match" && s.status !== "mine"}
                        onClick={() => handleDeskClick(s)}
                        className="w-full flex justify-between items-center p-3 rounded bg-surface-container-lowest border border-outline-variant/30 disabled:opacity-50 hover:shadow-sm text-left transition-all"
                      >
                        <div>
                          <span className="font-semibold text-sm">{s.desk_number}</span>
                          {s.labels.length > 0 && (
                            <span className="text-xs text-on-surface-variant ml-2">({s.labels.join(", ")})</span>
                          )}
                          {s.match_score > 0 && (
                            <span className="ml-2 text-xs text-tertiary-fixed-dim font-medium">★ Top-Match</span>
                          )}
                        </div>
                        <Badge
                          tone={
                            s.status === "mine"
                              ? "positive"
                              : s.status === "occupied" || s.status === "locked"
                              ? "neutral"
                              : s.status === "zone_restricted"
                              ? "negative"
                              : "positive"
                          }
                        >
                          {s.zone_name ? `Zone: ${s.zone_name}` : STATUS_LABEL[s.status]}
                        </Badge>
                      </button>
                    ))
                  )}
                </div>
              ) : (
                /* Etagen-Ebene: Gruppierte Raum-Karten */
                <div className="space-y-6">
                  {/* Büroräume */}
                  {floorDeskRooms.length > 0 && (
                    <div>
                      <h3 className="text-sm font-bold text-on-surface uppercase tracking-wider mb-2 flex items-center gap-1.5">
                        <span>💼</span> Büroräume & Arbeitsplatz-Bereiche ({floorDeskRooms.length})
                      </h3>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        {floorDeskRooms.map((r) => {
                          const rDesks = statuses.filter((s) => s.room_id === r.id);
                          const freeCount = rDesks.filter((d) => d.status === "available" || d.status === "top_match").length;

                          return (
                            <Card key={r.id} className="p-3 border border-outline-variant/40 hover:shadow-md transition-shadow">
                              <div className="flex justify-between items-start mb-2">
                                <div>
                                  <div className="font-semibold text-sm text-on-surface flex items-center gap-1">
                                    <span>💼</span> {r.name}
                                  </div>
                                  <div className="text-xs text-on-surface-variant">Raumnr. {r.room_number}</div>
                                </div>
                                <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${freeCount > 0 ? "bg-secondary-container text-on-secondary-container" : "bg-surface-container text-on-surface-variant"}`}>
                                  {freeCount} von {r.desks.length} frei
                                </span>
                              </div>

                              {r.labels.length > 0 && (
                                <div className="flex flex-wrap gap-1 mb-3">
                                  {r.labels.map((l) => (
                                    <span key={l} className="text-[10px] px-1.5 py-0.5 rounded bg-surface-container text-on-surface-variant">
                                      {l}
                                    </span>
                                  ))}
                                </div>
                              )}

                              <div className="flex items-center justify-between pt-2 border-t border-outline-variant/20">
                                <span className="text-xs text-on-surface-variant">{r.desks.length} Desks</span>
                                <button
                                  onClick={() => {
                                    setSelectedRoom(r);
                                    setViewMode("plan");
                                  }}
                                  className="text-xs font-semibold text-primary hover:underline flex items-center gap-1"
                                >
                                  🔍 Raumplan & Desks öffnen ↗
                                </button>
                              </div>
                            </Card>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* Meetingräume */}
                  {floorMeetingRooms.length > 0 && (
                    <div>
                      <h3 className="text-sm font-bold text-on-surface uppercase tracking-wider mb-2 flex items-center gap-1.5">
                        <span>🏛️</span> Meeting- & Konferenzräume ({floorMeetingRooms.length})
                      </h3>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        {floorMeetingRooms.map((r) => {
                          const mr = meetingRooms.find((m) => m.id === r.id);
                          return (
                            <Card key={r.id} className="p-3 border border-outline-variant/40 hover:shadow-md transition-shadow">
                              <div className="flex justify-between items-start mb-2">
                                <div>
                                  <div className="font-semibold text-sm text-on-surface flex items-center gap-1">
                                    <span>🏛️</span> {r.name}
                                  </div>
                                  <div className="text-xs text-on-surface-variant">
                                    Raumnr. {r.room_number} · Kapazität: {r.capacity || "?"} Personen
                                  </div>
                                </div>
                                <Badge tone={mr?.is_occupied_now ? "neutral" : "positive"}>
                                  {mr?.is_occupied_now ? "Belegt" : "Frei"}
                                </Badge>
                              </div>

                              {r.labels.length > 0 && (
                                <div className="flex flex-wrap gap-1 mb-3">
                                  {r.labels.map((l) => (
                                    <span key={l} className="text-[10px] px-1.5 py-0.5 rounded bg-surface-container text-on-surface-variant">
                                      {l}
                                    </span>
                                  ))}
                                </div>
                              )}

                              <div className="flex justify-end pt-2 border-t border-outline-variant/20">
                                <Button
                                  className="px-3 py-1 text-xs"
                                  variant="accent"
                                  onClick={() => {
                                    openMeetingRoom(
                                      mr || {
                                        id: r.id,
                                        room_number: r.room_number,
                                        name: r.name,
                                        capacity: r.capacity,
                                        approval_required: r.approval_required,
                                        restricted_role_code: r.restricted_role_code,
                                        labels: r.labels,
                                        is_occupied_now: false,
                                      }
                                    );
                                  }}
                                >
                                  📅 Meetingraum buchen
                                </Button>
                              </div>
                            </Card>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {floorDeskRooms.length === 0 && floorMeetingRooms.length === 0 && (
                    <div className="p-8 text-center text-sm text-on-surface-variant bg-surface-container-lowest rounded-lg border border-outline-variant/30">
                      Auf dieser Etage sind noch keine Räume eingerichtet.
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Legende */}
          <div className="flex flex-wrap gap-4 mt-4 text-xs text-on-surface-variant bg-surface-container-lowest p-2 rounded border border-outline-variant/20">
            <span>🟩 Verfügbar</span>
            <span>💚 Top-Match</span>
            <span>🟦 Meine Buchung</span>
            <span>⬜ Belegt</span>
            <span>🔒 Gesperrt</span>
            <span>🏛️ Meetingraum</span>
            <span>💼 Büroraum</span>
          </div>
        </div>
      </div>

      {/* Desk Buchungs-Drawer */}
      {selectedDesk && (
        <div className="fixed inset-y-0 right-0 w-96 bg-surface shadow-2xl border-l border-outline-variant/30 p-6 overflow-y-auto z-40">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-bold">Desk {selectedDesk.desk_number}</h2>
            <button
              onClick={() => {
                setSelectedDesk(null);
                setBookingState("idle");
              }}
              className="text-sm px-2 py-1 rounded bg-surface-container text-on-surface-variant hover:bg-surface-container-high"
            >
              ✕ Schließen
            </button>
          </div>

          <div className="text-sm text-on-surface-variant mb-1">
            Raum: <strong>{selectedDesk.room_name}</strong>
          </div>
          <div className="text-xs text-on-surface-variant mb-3">
            Datum: {date} · {dayPart === "full" ? "Ganztags" : dayPart === "am" ? "Vormittags" : "Nachmittags"}
          </div>

          {selectedDesk.labels.length > 0 && (
            <div className="flex flex-wrap gap-1 mb-4">
              {selectedDesk.labels.map((l) => (
                <span key={l} className="text-xs px-2 py-0.5 rounded-full bg-surface-container text-on-surface-variant">
                  {l}
                </span>
              ))}
            </div>
          )}

          {selectedDesk.match_score > 0 && (
            <div className="mb-4">
              <Badge tone="positive">
                Top-Match — {selectedDesk.match_score} Präferenzen erfüllt
              </Badge>
            </div>
          )}

          {error && (
            <div className="mt-3 p-2 rounded bg-error-container text-on-error-container text-sm" role="alert">
              {error}
            </div>
          )}

          {selectedDesk.status === "mine" ? (
            <Button
              variant="destructive"
              className="mt-6 w-full"
              loading={bookingState === "loading"}
              onClick={cancelOwnBooking}
            >
              Buchung stornieren
            </Button>
          ) : bookingState === "done" ? (
            <div className="mt-6 p-3 rounded bg-tertiary-fixed/40 text-on-tertiary-fixed-variant text-sm font-semibold text-center">
              ✓ Erfolgreich gebucht!
            </div>
          ) : (
            <Button
              variant="accent"
              className="mt-6 w-full"
              loading={bookingState === "loading"}
              onClick={() => confirmBooking()}
            >
              Jetzt verbindlich buchen
            </Button>
          )}
        </div>
      )}

      {/* Meetingraum Buchungs-Modal */}
      {activeMeetingRoom && (
        <Modal
          title={`Meetingraum buchen: ${activeMeetingRoom.name}`}
          onClose={() => setActiveMeetingRoom(null)}
        >
          <div className="space-y-4 max-h-[75vh] overflow-y-auto pr-1">
            <div className="text-xs text-on-surface-variant">
              Raumnummer: <strong>{activeMeetingRoom.room_number}</strong> · Maximale Kapazität:{" "}
              <strong>{activeMeetingRoom.capacity || "?"} Personen</strong>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-on-surface-variant mb-1">Von (Uhr)</label>
                <select
                  value={meetingForm.startHour}
                  onChange={(e) => setMeetingForm((f) => ({ ...f, startHour: Number(e.target.value) }))}
                  className="w-full bg-surface-container-low rounded px-2 py-1.5 text-sm border border-outline-variant/40"
                >
                  {Array.from({ length: 14 }, (_, i) => i + 7).map((h) => (
                    <option key={h} value={h}>
                      {h}:00 Uhr
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-on-surface-variant mb-1">Bis (Uhr)</label>
                <select
                  value={meetingForm.endHour}
                  onChange={(e) => setMeetingForm((f) => ({ ...f, endHour: Number(e.target.value) }))}
                  className="w-full bg-surface-container-low rounded px-2 py-1.5 text-sm border border-outline-variant/40"
                >
                  {Array.from({ length: 14 }, (_, i) => i + 8).map((h) => (
                    <option key={h} value={h} disabled={h <= meetingForm.startHour}>
                      {h}:00 Uhr
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Bestuhlungsoptionen */}
            {seatingOptions.length > 0 && (
              <div>
                <label className="block text-xs font-semibold text-on-surface-variant mb-1">
                  Gewünschte Bestuhlung
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {seatingOptions.map((opt) => (
                    <label
                      key={opt.id}
                      className={`p-2.5 rounded-lg border text-xs cursor-pointer flex flex-col justify-between transition-colors ${
                        meetingForm.seatingOptionId === String(opt.id)
                          ? "border-primary bg-primary/10 font-semibold"
                          : "border-outline-variant/40 hover:bg-surface-container-low"
                      }`}
                    >
                      <div className="flex items-center gap-1.5">
                        <input
                          type="radio"
                          name="seatingOption"
                          value={opt.id}
                          checked={meetingForm.seatingOptionId === String(opt.id)}
                          onChange={(e) => setMeetingForm((f) => ({ ...f, seatingOptionId: e.target.value }))}
                        />
                        <span>
                          {opt.name} {opt.is_standard ? "(Standard)" : ""} · Vorlauf: {opt.changeover_days} Tag(e)
                        </span>
                      </div>
                    </label>
                  ))}
                </div>
              </div>
            )}

            {/* Visuelle Bestuhlungsvorschau */}
            {meetingLayout && (
              <div className="border border-outline-variant/30 rounded-lg p-2 bg-surface-container-lowest">
                <div className="text-[11px] font-semibold text-on-surface-variant mb-1">
                  Grundriss- & Bestuhlungsvorschau
                </div>
                <div className="h-44 overflow-hidden rounded">
                  <FloorplanCanvas layout={meetingLayout} desks={[]} />
                </div>
              </div>
            )}

            {/* Catering & Kostenstellen-Bereich */}
            <div className="p-3 rounded-lg border border-outline-variant/40 bg-surface-container-lowest space-y-3">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={hasCatering}
                  onChange={(e) => setHasCatering(e.target.checked)}
                  className="rounded"
                />
                <span className="text-sm font-semibold">☕ Catering für diesen Termin hinzubuchen</span>
              </label>

              {hasCatering && (
                <div className="pl-6 space-y-3 pt-1 border-t border-outline-variant/20">
                  <div>
                    <label className="block text-xs font-semibold text-on-surface-variant mb-1">
                      Catering-Details / Wünsche (z.B. Kaffee, Wasser, Gebäck)
                    </label>
                    <textarea
                      rows={2}
                      value={cateringNotes}
                      onChange={(e) => setCateringNotes(e.target.value)}
                      placeholder="z.B. 10x Filterkaffee, Mineralwasser still/sprudelnd, Obstkorb"
                      className="w-full bg-surface-container-low rounded p-2 text-xs border border-outline-variant/40"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-on-surface-variant mb-1">
                      Verrechnung / Kostenstelle
                    </label>
                    <div className="space-y-1.5 text-xs">
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="radio"
                          name="billingMode"
                          value="own"
                          checked={billingMode === "own"}
                          onChange={() => setBillingMode("own")}
                        />
                        <span>
                          Eigene Kostenstelle / Abteilung ({user?.department || "Standard-Kostenstelle"})
                        </span>
                      </label>
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="radio"
                          name="billingMode"
                          value="foreign"
                          checked={billingMode === "foreign"}
                          onChange={() => setBillingMode("foreign")}
                        />
                        <span>Auf abweichende Organisationseinheit / Kostenstelle belasten</span>
                      </label>
                    </div>
                  </div>

                  {billingMode === "foreign" && (
                    <div className="p-2.5 rounded bg-warning-container/20 border border-warning/40 space-y-2 text-xs">
                      <div>
                        <label className="block font-semibold mb-1">Zu belastende Organisationseinheit:</label>
                        <select
                          value={foreignDeptId}
                          onChange={(e) => {
                            const val = e.target.value ? Number(e.target.value) : "";
                            setForeignDeptId(val);
                            const dept = departments.find((d) => d.id === val);
                            if (dept?.cost_center) setForeignCostCenter(dept.cost_center);
                          }}
                          className="w-full bg-surface-container-low rounded p-1.5 border border-outline-variant/40 text-xs"
                        >
                          <option value="">-- Abteilung wählen --</option>
                          {departments.map((d) => (
                            <option key={d.id} value={d.id}>
                              {d.name} {d.cost_center ? `(${d.cost_center})` : ""}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div>
                        <label className="block font-semibold mb-1">Kostenstellen-Nummer:</label>
                        <input
                          type="text"
                          value={foreignCostCenter}
                          onChange={(e) => setForeignCostCenter(e.target.value)}
                          placeholder="z.B. KST-9040"
                          className="w-full bg-surface-container-low rounded p-1.5 border border-outline-variant/40 text-xs"
                        />
                      </div>

                      <label className="flex items-start gap-2 pt-1 cursor-pointer font-medium text-on-surface">
                        <input
                          type="checkbox"
                          checked={costCenterWarningAcknowledged}
                          onChange={(e) => setCostCenterWarningAcknowledged(e.target.checked)}
                          className="mt-0.5"
                        />
                        <span>
                          Ich bestätige, dass die Weiterbelastung des Caterings an die abweichende Organisationseinheit vorab abgestimmt wurde.
                        </span>
                      </label>
                    </div>
                  )}
                </div>
              )}
            </div>

            {meetingError && (
              <div className="p-2.5 rounded bg-error-container text-on-error-container text-xs" role="alert">
                {meetingError}
              </div>
            )}

            {meetingBookingState === "done" && (
              <div className="p-3 rounded bg-tertiary-fixed/40 text-on-tertiary-fixed-variant text-sm font-semibold text-center">
                ✓ Meetingraum erfolgreich reserviert!
              </div>
            )}

            <div className="flex justify-end gap-2 pt-2 border-t border-outline-variant/20">
              <Button
                variant="secondary"
                onClick={() => {
                  setActiveMeetingRoom(null);
                  setMeetingBookingState("idle");
                }}
              >
                Schließen
              </Button>
              {meetingBookingState !== "done" && (
                <Button
                  variant="accent"
                  loading={meetingBookingState === "loading"}
                  onClick={() => submitMeetingBooking()}
                >
                  Verbindlich buchen
                </Button>
              )}
            </div>
          </div>
        </Modal>
      )}

      {/* Doppelbuchungs-Warnung */}
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
