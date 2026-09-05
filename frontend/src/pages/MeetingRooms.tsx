import { useEffect, useState } from "react";
import { api, ApiError } from "../api/client";
import type {
  BookingOut,
  DepartmentOut,
  FloorNode,
  MeetingRoomOut,
  PropertyOut,
  PropertyTree,
  SeatingOptionOut,
} from "../api/types";
import { Badge, Button, Card, Modal } from "../components/ui";
import { useAuth } from "../context/AuthContext";
import { DoubleBookingModal, type DoubleBookingDetail } from "../components/DoubleBookingModal";
import {
  FloorplanCanvas,
  type FloorplanLayout,
  generateMeetingRoomLayout,
  parseFloorplanLayout,
} from "../components/FloorplanCanvas";

interface RoomBookingSlot {
  booking_id: number;
  start_at: string;
  end_at: string;
  status: string;
  booked_for_name: string;
  booked_for_department: string | null;
  remark: string | null;
}

/** Flow 4 — Meetingraum-Buchung mit Genehmigungspflicht, Grundriss & Bestuhlung sowie Catering-Option. */
export default function MeetingRooms() {
  const { user, hasRole, actingAsUserId } = useAuth();
  const [properties, setProperties] = useState<PropertyOut[]>([]);
  const [propertyId, setPropertyId] = useState<number | null>(null);
  const [tree, setTree] = useState<PropertyTree | null>(null);
  const [selectedFloorId, setSelectedFloorId] = useState<number | null>(null);
  const [viewMode, setViewMode] = useState<"plan" | "list">("plan");
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [rooms, setRooms] = useState<MeetingRoomOut[]>([]);
  const [departments, setDepartments] = useState<DepartmentOut[]>([]);
  const [timelines, setTimelines] = useState<Record<number, RoomBookingSlot[]>>({});
  const [activeRoom, setActiveRoom] = useState<MeetingRoomOut | null>(null);
  const [roomLayout, setRoomLayout] = useState<FloorplanLayout | null>(null);
  const [seating, setSeating] = useState<SeatingOptionOut[]>([]);

  // Form State
  const [form, setForm] = useState({ startHour: 9, endHour: 10, seatingOptionId: "", remark: "" });
  const [hasCatering, setHasCatering] = useState(false);
  const [cateringNotes, setCateringNotes] = useState("");
  const [billingMode, setBillingMode] = useState<"own" | "foreign">("own");
  const [foreignDeptId, setForeignDeptId] = useState<number | "">("");
  const [foreignCostCenter, setForeignCostCenter] = useState("");
  const [costCenterWarningAcknowledged, setCostCenterWarningAcknowledged] = useState(false);

  const [state, setState] = useState<"idle" | "loading" | "done" | "error">("idle");
  const [error, setError] = useState<string | null>(null);
  const [doubleBooking, setDoubleBooking] = useState<DoubleBookingDetail | null>(null);

  useEffect(() => {
    api.get<PropertyOut[]>("/catalog/properties").then((props) => {
      setProperties(props);
      if (props.length) setPropertyId((current) => current ?? props[0].id);
    });
    api.get<DepartmentOut[]>("/catalog/departments").then(setDepartments).catch(() => setDepartments([]));
  }, []);

  useEffect(() => {
    if (!propertyId) return;
    api.get<PropertyTree>(`/catalog/properties/${propertyId}/tree`).then((data) => {
      setTree(data);
      const allFloors = data.buildings.flatMap((b) => b.floors);
      // Finde bevorzugt eine Etage mit hinterlegtem Grundriss und Meetingräumen
      const floorWithLayout = allFloors.find(
        (f) => !!f.floorplan_layout && f.rooms.some((r) => r.room_type === "meeting"),
      );
      setSelectedFloorId(floorWithLayout ? floorWithLayout.id : allFloors[0]?.id ?? null);
    });
  }, [propertyId]);

  function loadRooms() {
    if (!propertyId) return;
    api.get<MeetingRoomOut[]>(`/catalog/properties/${propertyId}/meeting-rooms`).then(async (rs) => {
      setRooms(rs);
      const entries = await Promise.all(
        rs.map((r) =>
          api
            .get<RoomBookingSlot[]>(`/catalog/rooms/${r.id}/bookings?target_date=${date}`)
            .then((slots) => [r.id, slots] as const)
            .catch(() => [r.id, []] as const),
        ),
      );
      setTimelines(Object.fromEntries(entries));
    });
  }

  useEffect(loadRooms, [propertyId, date]);

  const floors = tree?.buildings.flatMap((b) => b.floors.map((f) => ({ ...f, buildingName: b.name }))) ?? [];
  const currentFloor = floors.find((f) => f.id === selectedFloorId) as (FloorNode & { buildingName: string }) | undefined;
  const digitalLayout = parseFloorplanLayout(currentFloor?.floorplan_layout);

  const displayedRooms = selectedFloorId
    ? rooms.filter((r) => r.floor_id === selectedFloorId || (currentFloor?.rooms.some((cr) => cr.id === r.id)))
    : rooms;

  const showPlan = viewMode === "plan" && !!digitalLayout;

  function openRoom(room: MeetingRoomOut) {
    setActiveRoom(room);
    setState("idle");
    setError(null);
    setForm({ startHour: 9, endHour: 10, seatingOptionId: "", remark: "" });
    setHasCatering(false);
    setCateringNotes("");
    setBillingMode("own");
    setForeignDeptId("");
    setForeignCostCenter("");
    setCostCenterWarningAcknowledged(false);

    api.get<SeatingOptionOut[]>(`/fm/rooms/${room.id}/seating-options`).then(setSeating).catch(() => setSeating([]));

    // Lade individuellen Grundriss des Meetingraums (oder generiere automatische Bestuhlung)
    api
      .get<{ layout: string | null; seating_layout: string | null }>(`/catalog/rooms/${room.id}/floorplan-layout`)
      .then((res) => {
        const parsed = parseFloorplanLayout(res.layout);
        if (parsed && parsed.objects.length > 0) {
          setRoomLayout(parsed);
        } else {
          const cap = room.capacity || 10;
          const preset = res.seating_layout || room.seating_layout || "boardroom";
          setRoomLayout({ objects: generateMeetingRoomLayout(cap, preset) });
        }
      })
      .catch(() => {
        const cap = room.capacity || 10;
        setRoomLayout({ objects: generateMeetingRoomLayout(cap, room.seating_layout || "boardroom") });
      });
  }

  async function submitBooking(override = false, reason?: string) {
    if (!activeRoom) return;

    if (hasCatering && billingMode === "foreign") {
      if (!foreignDeptId) {
        setError("Bitte wählen Sie die zu belastende fremde Organisationseinheit aus.");
        return;
      }
      if (!costCenterWarningAcknowledged) {
        setError("Bitte bestätigen Sie die Kostenübernahme durch die fremde Organisationseinheit.");
        return;
      }
    }

    setState("loading");
    setError(null);
    const start_at = `${date}T${String(form.startHour).padStart(2, "0")}:00:00`;
    const end_at = `${date}T${String(form.endHour).padStart(2, "0")}:00:00`;

    const selectedForeignDept = departments.find((d) => d.id === Number(foreignDeptId));

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

  const userDept = departments.find((d) => d.id === user?.department_id);
  const ownCostCenter = user?.cost_center || userDept?.cost_center || "Standard-KST";

  return (
    <div>
      <h1 className="text-3xl font-bold mb-1">Meetingräume</h1>
      <p className="text-on-surface-variant mb-4">
        Räume interaktiv über den Grundriss oder per Liste buchen bzw. anfragen. Inklusive Raumgrundriss, automatischer Bestuhlung und Catering-Option.
      </p>

      <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
        <div className="flex flex-wrap items-center gap-3">
          <label className="text-xs font-medium">
            Liegenschaft
            <select
              value={propertyId ?? ""}
              onChange={(e) => {
                setPropertyId(Number(e.target.value));
                setSelectedFloorId(null);
              }}
              className="block mt-1 bg-surface-container-low rounded px-3 py-2 text-sm border border-outline-variant/30"
            >
              {properties.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </label>

          {floors.length > 0 && (
            <label className="text-xs font-medium">
              Gebäude / Etage
              <select
                value={selectedFloorId ?? ""}
                onChange={(e) => setSelectedFloorId(e.target.value ? Number(e.target.value) : null)}
                className="block mt-1 bg-surface-container-low rounded px-3 py-2 text-sm border border-outline-variant/30"
              >
                <option value="">Alle Etagen</option>
                {floors.map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.buildingName} / {f.name} {f.floorplan_layout ? "🗺️" : ""}
                  </option>
                ))}
              </select>
            </label>
          )}

          <label className="text-xs font-medium">
            Datum
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="block mt-1 bg-surface-container-low rounded px-3 py-2 text-sm border border-outline-variant/30"
            />
          </label>
        </div>

        {digitalLayout && (
          <div className="flex gap-1 bg-surface-container-low rounded p-1 border border-outline-variant/30">
            <button
              onClick={() => setViewMode("plan")}
              className={`px-3 py-1.5 text-xs font-semibold rounded ${
                viewMode === "plan" ? "bg-primary text-on-primary shadow-sm" : "text-on-surface-variant hover:bg-surface-container"
              }`}
            >
              🗺️ Grundriss
            </button>
            <button
              onClick={() => setViewMode("list")}
              className={`px-3 py-1.5 text-xs font-semibold rounded ${
                viewMode === "list" ? "bg-primary text-on-primary shadow-sm" : "text-on-surface-variant hover:bg-surface-container"
              }`}
            >
              📋 Liste
            </button>
          </div>
        )}
      </div>

      {showPlan ? (
        <div className="space-y-3">
          <div className="flex items-center justify-between text-xs text-on-surface-variant bg-surface-container-low p-2.5 rounded-md border border-outline-variant/30">
            <div className="flex items-center gap-4">
              <span className="font-semibold text-on-surface">Etage: {currentFloor?.buildingName} / {currentFloor?.name}</span>
              <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded bg-[#e0f2fe] border border-[#0284c7] inline-block" /> Frei</span>
              <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded bg-[#fef9c3] border border-[#ca8a04] inline-block" /> Freigabe erforderlich</span>
              <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded bg-[#e2e8f0] border border-[#64748b] inline-block" /> Besetzt</span>
            </div>
            <span>Klick auf einen Meetingraum im Grundriss öffnet das Buchungsformular.</span>
          </div>

          <FloorplanCanvas
            layout={digitalLayout!}
            meetingRooms={displayedRooms}
            onMeetingRoomClick={(room) => openRoom(room)}
          />
        </div>
      ) : (
        <div>
          {selectedFloorId && !digitalLayout && (
            <div className="text-sm text-on-surface-variant mb-4 p-2.5 rounded bg-surface-container-low border border-outline-variant/30 flex items-center gap-2">
              <span>ℹ️</span> Für diese Etage liegt noch kein digitalisierter Grundriss vor — Anzeige als Liste.
            </div>
          )}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {displayedRooms.map((r) => {
              const notAuthorized = r.restricted_role_code && !hasRole(r.restricted_role_code, "fm");
              return (
                <Card key={r.id} data-testid={`meeting-room-${r.id}`} data-room-name={r.name} className={r.is_occupied_now ? "opacity-70" : ""}>
                  <div className="flex justify-between items-start">
                    <div>
                      <div className="font-semibold">{r.name}</div>
                      <div className="text-sm text-on-surface-variant">
                        Raum {r.room_number} · max. {r.capacity ?? "—"} Personen
                        {r.floor_name && ` · ${r.floor_name}`}
                      </div>
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
        </div>
      )}

      {/* Raum-Buchungs-Modal */}
      {activeRoom && (
        <Modal title={`🏛 ${activeRoom.name} (Raum ${activeRoom.room_number})`} onClose={() => setActiveRoom(null)}>
          {state === "done" ? (
            <div className="p-4 rounded bg-tertiary-fixed/40 text-on-tertiary-fixed-variant text-sm space-y-2">
              <div className="font-semibold">
                {activeRoom.approval_required ? "Buchungsanfrage erfolgreich eingereicht!" : "Meetingraum erfolgreich gebucht!"}
              </div>
              <p className="text-xs">
                {activeRoom.approval_required
                  ? "Der Raum erfordert eine Genehmigung. Ihre Anfrage steht unter „Meine Buchungen“ auf dem Status „Ausstehend“."
                  : "Ihre Buchungsbestätigung wurde erfasst."}
                {hasCatering && " Die Catering-Bestellung wurde an den Wirtschaftsdienst übermittelt."}
              </p>
            </div>
          ) : (
            <div className="space-y-4 max-h-[80vh] overflow-y-auto pr-1 text-sm">
              {error && <div className="p-2.5 rounded bg-error-container text-on-error-container text-xs" role="alert">{error}</div>}

              {/* Grundriss & Bestuhlungs-Vorschau */}
              {roomLayout && (
                <div className="border border-outline-variant/30 rounded-md p-2 bg-surface-container-low space-y-1">
                  <div className="flex items-center justify-between text-xs text-on-surface-variant font-medium">
                    <span>Raum-Grundriss & Bestuhlung ({activeRoom.capacity ?? "—"} Plätze)</span>
                    <span className="text-[11px] text-primary">🏛 {activeRoom.seating_layout || "Konferenztisch"}</span>
                  </div>
                  <div className="w-full h-40 bg-surface rounded border border-outline-variant/20 overflow-hidden">
                    <FloorplanCanvas layout={roomLayout} />
                  </div>
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                <label className="block text-xs font-medium">
                  Von
                  <select
                    value={form.startHour}
                    onChange={(e) => setForm((f) => ({ ...f, startHour: Number(e.target.value) }))}
                    className="w-full mt-1 bg-surface-container-low rounded px-2.5 py-1.5 border border-outline-variant/30 text-sm"
                  >
                    {Array.from({ length: 11 }, (_, i) => i + 8).map((h) => (
                      <option key={h} value={h}>{h}:00 Uhr</option>
                    ))}
                  </select>
                </label>
                <label className="block text-xs font-medium">
                  Bis
                  <select
                    value={form.endHour}
                    onChange={(e) => setForm((f) => ({ ...f, endHour: Number(e.target.value) }))}
                    className="w-full mt-1 bg-surface-container-low rounded px-2.5 py-1.5 border border-outline-variant/30 text-sm"
                  >
                    {Array.from({ length: 11 }, (_, i) => i + 9).map((h) => (
                      <option key={h} value={h}>{h}:00 Uhr</option>
                    ))}
                  </select>
                </label>
              </div>

              {seating.length > 0 && (
                <label className="block text-xs font-medium">
                  Alternative Bestuhlung anfragen
                  <select
                    value={form.seatingOptionId}
                    onChange={(e) => setForm((f) => ({ ...f, seatingOptionId: e.target.value }))}
                    className="w-full mt-1 bg-surface-container-low rounded px-2.5 py-1.5 border border-outline-variant/30 text-sm"
                  >
                    <option value="">Standard-Bestuhlung beibehalten</option>
                    {seating.filter((s) => !s.is_standard).map((s) => (
                      <option key={s.id} value={s.id}>{s.name} (+{s.changeover_days} Umbautag/e)</option>
                    ))}
                  </select>
                </label>
              )}

              {/* Catering-Option */}
              <div className="p-3 rounded-md bg-surface-container-low border border-outline-variant/30 space-y-2.5">
                <label className="flex items-center gap-2 font-medium text-xs cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={hasCatering}
                    onChange={(e) => setHasCatering(e.target.checked)}
                    className="w-4 h-4 rounded text-primary"
                  />
                  <span>🍽️ Catering als Option hinzubuchen</span>
                </label>

                {hasCatering && (
                  <div className="space-y-2.5 pt-2 border-t border-outline-variant/30 text-xs">
                    <label className="block">
                      Catering-Details / Wünsche (Kaffee, Snacks, Getränke)
                      <textarea
                        rows={2}
                        value={cateringNotes}
                        onChange={(e) => setCateringNotes(e.target.value)}
                        placeholder="z.B. Kaffee & Tee für 10 Personen, Mineralwasser, Brezeln..."
                        className="w-full mt-1 bg-surface rounded px-2.5 py-1.5 border border-outline-variant/30 text-xs"
                      />
                    </label>

                    <div className="space-y-1.5">
                      <div className="font-semibold">Kostenstellen-Zuordnung:</div>
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="radio"
                          name="billingMode"
                          checked={billingMode === "own"}
                          onChange={() => {
                            setBillingMode("own");
                            setCostCenterWarningAcknowledged(false);
                          }}
                        />
                        <span>Eigenes Kostenstellenkonto ({ownCostCenter})</span>
                      </label>
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="radio"
                          name="billingMode"
                          checked={billingMode === "foreign"}
                          onChange={() => setBillingMode("foreign")}
                        />
                        <span>Fremde Organisationseinheit / Kostenstelle belasten</span>
                      </label>
                    </div>

                    {billingMode === "foreign" && (
                      <div className="space-y-2 p-2.5 rounded bg-amber-50 dark:bg-amber-950/30 border border-amber-300 dark:border-amber-700/50">
                        <label className="block font-medium text-amber-900 dark:text-amber-200">
                          Abweichende Organisationseinheit auswählen:
                          <select
                            value={foreignDeptId}
                            onChange={(e) => {
                              const val = e.target.value ? Number(e.target.value) : "";
                              setForeignDeptId(val);
                              const found = departments.find((d) => d.id === val);
                              if (found) setForeignCostCenter(found.cost_center || "");
                            }}
                            className="w-full mt-1 bg-surface rounded px-2.5 py-1.5 border border-amber-400 text-xs text-on-surface"
                          >
                            <option value="">Organisationseinheit wählen…</option>
                            {departments.map((d) => (
                              <option key={d.id} value={d.id}>
                                {d.code} · {d.name} {d.cost_center ? `(${d.cost_center})` : ""}
                              </option>
                            ))}
                          </select>
                        </label>

                        {foreignCostCenter && (
                          <div className="text-[11px] text-amber-800 dark:text-amber-300">
                            Zugeordnete Kostenstelle: <span className="font-semibold">{foreignCostCenter}</span>
                          </div>
                        )}

                        <div className="p-2 rounded bg-amber-100 dark:bg-amber-900/40 text-amber-900 dark:text-amber-100 text-[11px] leading-relaxed">
                          ⚠️ <b>Achtung Budgetfreigabe:</b> Sie belasten eine fremde Organisationseinheit. Die Kostenübernahme muss vorab mit der Kostenstellenleitung abgestimmt worden sein.
                        </div>

                        <label className="flex items-start gap-2 text-xs text-amber-950 dark:text-amber-200 font-medium cursor-pointer">
                          <input
                            type="checkbox"
                            checked={costCenterWarningAcknowledged}
                            onChange={(e) => setCostCenterWarningAcknowledged(e.target.checked)}
                            className="mt-0.5 w-4 h-4 rounded text-amber-600"
                          />
                          <span>
                            Ich bestätige, dass die Kostenübernahme für das Catering mit der zuständigen Leitung der gewählten Organisationseinheit verbindlich vorab abgestimmt wurde.
                          </span>
                        </label>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {hasRole("vm") && (
                <label className="block text-xs font-medium">
                  Bemerkung (nur für VM sichtbar)
                  <input
                    value={form.remark}
                    onChange={(e) => setForm((f) => ({ ...f, remark: e.target.value }))}
                    className="w-full mt-1 bg-surface-container-low rounded px-2.5 py-1.5 border border-outline-variant/30 text-sm"
                  />
                </label>
              )}

              <Button variant="accent" className="w-full mt-2" loading={state === "loading"} onClick={() => submitBooking()}>
                {activeRoom.approval_required ? "Buchungsanfrage einreichen" : "Jetzt verbindlich buchen"}
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
