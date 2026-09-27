import { useEffect, useMemo, useState } from "react";
import { api, ApiError } from "../api/client";
import type {
  BookingOut,
  DepartmentOut,
  FloorNode,
  MeetingRoomOut,
  MeetingSlotConfigOut,
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
import { MeetingRoomThumbnail } from "../components/MeetingRoomThumbnail";
import { isDeptAuthorized } from "../utils/orgHierarchy";

interface RoomBookingSlot {
  booking_id: number;
  start_at: string;
  end_at: string;
  status: string;
  booked_for_name: string;
  booked_for_department: string | null;
  remark: string | null;
}

/**
 * Flow 4 — Intelligente & effiziente Meetingraum-Buchung:
 * - Direkte Suche: "Ich suche einen Raum für Tag X zum Slot Y"
 * - Tages-Zeitstrahl dynamisch nach globaler Konfiguration & Raum-Betriebszeiten
 * - Thumbnail-Grafik mit maßstäblicher Bestuhlung
 * - Filter für "Nur freie Räume im gewünschten Zeitraum"
 * - 1-Klick-Buchung aus freiem Slot
 */
export default function MeetingRooms() {
  const { user, users, hasRole, actingAsUserId } = useAuth();
  const effectiveUser = (actingAsUserId && users.find((u) => u.id === actingAsUserId)) || user;
  const [properties, setProperties] = useState<PropertyOut[]>([]);
  const [propertyId, setPropertyId] = useState<number | null>(null);
  const [tree, setTree] = useState<PropertyTree | null>(null);
  const [selectedFloorId, setSelectedFloorId] = useState<number | null>(null);

  // 3 Ansichtsmodi: "matrix" (Tages-Timeline), "cards" (Kacheln), "plan" (Grundriss)
  const [viewMode, setViewMode] = useState<"matrix" | "cards" | "plan">("matrix");

  // Globale Meeting-Slot-Konfiguration
  const [slotConfig, setSlotConfig] = useState<MeetingSlotConfigOut>({
    slot_duration_minutes: 60,
    day_start_hour: 8,
    day_end_hour: 18,
  });

  // Tag X & Slot Y Filter
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [startTime, setStartTime] = useState("09:00");
  const [endTime, setEndTime] = useState("10:00");
  const [onlyFreeInSlot, setOnlyFreeInSlot] = useState(false);
  const [minCapacity, setMinCapacity] = useState<number>(0);
  const [selectedLabel, setSelectedLabel] = useState<string>("");

  const [rooms, setRooms] = useState<MeetingRoomOut[]>([]);
  const [departments, setDepartments] = useState<DepartmentOut[]>([]);
  const [timelines, setTimelines] = useState<Record<number, RoomBookingSlot[]>>({});

  // Modal State
  const [activeRoom, setActiveRoom] = useState<MeetingRoomOut | null>(null);
  const [roomLayout, setRoomLayout] = useState<FloorplanLayout | null>(null);
  const [seating, setSeating] = useState<SeatingOptionOut[]>([]);
  const [form, setForm] = useState({ startTime: "09:00", endTime: "10:00", seatingOptionId: "", remark: "" });
  const [hasCatering, setHasCatering] = useState(false);
  const [cateringNotes, setCateringNotes] = useState("");
  const [billingMode, setBillingMode] = useState<"own" | "foreign">("own");
  const [foreignDeptId, setForeignDeptId] = useState<number | "">("");
  const [foreignCostCenter, setForeignCostCenter] = useState("");
  const [costCenterWarningAcknowledged, setCostCenterWarningAcknowledged] = useState(false);

  const [state, setState] = useState<"idle" | "loading" | "done" | "error">("idle");
  const [error, setError] = useState<string | null>(null);
  const [doubleBooking, setDoubleBooking] = useState<DoubleBookingDetail | null>(null);

  // 1. Initialisiere Stammdaten & globale Slot-Konfiguration
  useEffect(() => {
    api.get<PropertyOut[]>("/catalog/properties").then((props) => {
      setProperties(props);
      if (props.length) setPropertyId((current) => current ?? props[0].id);
    });
    api.get<DepartmentOut[]>("/catalog/departments").then(setDepartments).catch(() => setDepartments([]));
    api.get<MeetingSlotConfigOut>("/catalog/meeting-slot-config").then(setSlotConfig).catch(() => {});
  }, []);

  // 2. Lade Gebäude & Etagen für Liegenschaft
  useEffect(() => {
    if (!propertyId) return;
    api.get<PropertyTree>(`/catalog/properties/${propertyId}/tree`).then((data) => {
      setTree(data);
      const allFloors = data.buildings.flatMap((b) => b.floors);
      const floorWithLayout = allFloors.find(
        (f) => !!f.floorplan_layout && f.rooms.some((r) => r.room_type === "meeting")
      );
      setSelectedFloorId(floorWithLayout ? floorWithLayout.id : allFloors[0]?.id ?? null);
    });
  }, [propertyId]);

  // 3. Lade Meetingräume und deren Belegungs-Timelines für das gewählte Datum
  function loadRooms() {
    if (!propertyId) return;
    api.get<MeetingRoomOut[]>(`/catalog/properties/${propertyId}/meeting-rooms`).then(async (rs) => {
      setRooms(rs);
      const entries = await Promise.all(
        rs.map((r) =>
          api
            .get<RoomBookingSlot[]>(`/catalog/rooms/${r.id}/bookings?target_date=${date}`)
            .then((slots) => [r.id, slots] as const)
            .catch(() => [r.id, []] as const)
        )
      );
      setTimelines(Object.fromEntries(entries));
    });
  }

  useEffect(loadRooms, [propertyId, date]);

  const floors = tree?.buildings.flatMap((b) => b.floors.map((f) => ({ ...f, buildingName: b.name }))) ?? [];
  const currentFloor = floors.find((f) => f.id === selectedFloorId) as (FloorNode & { buildingName: string }) | undefined;
  const digitalLayout = parseFloorplanLayout(currentFloor?.floorplan_layout);

  // Dynamische Tagesgrenzen & Slot-Dauer
  const dayStartHour = useMemo(() => {
    let minH = slotConfig.day_start_hour ?? 8;
    for (const r of rooms) {
      if (r.effective_day_start_hour != null && r.effective_day_start_hour < minH) {
        minH = r.effective_day_start_hour;
      }
    }
    return Math.max(0, minH);
  }, [slotConfig, rooms]);

  const dayEndHour = useMemo(() => {
    let maxH = slotConfig.day_end_hour ?? 18;
    for (const r of rooms) {
      if (r.effective_day_end_hour != null && r.effective_day_end_hour > maxH) {
        maxH = r.effective_day_end_hour;
      }
    }
    return Math.min(24, Math.max(dayStartHour + 1, maxH));
  }, [slotConfig, rooms, dayStartHour]);

  const slotStepMinutes = Math.max(15, Math.min(180, slotConfig.slot_duration_minutes ?? 60));

  function minutesToTime(totalMinutes: number): string {
    const h = Math.floor(totalMinutes / 60);
    const m = totalMinutes % 60;
    return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
  }

  function timeToMinutes(timeStr: string): number {
    const [h, m] = timeStr.split(":").map(Number);
    return (h || 0) * 60 + (m || 0);
  }

  interface TimelineSlot {
    startMinute: number;
    endMinute: number;
    startLabel: string;
    endLabel: string;
  }

  const timelineSlots = useMemo<TimelineSlot[]>(() => {
    const list: TimelineSlot[] = [];
    const startM = dayStartHour * 60;
    const endM = dayEndHour * 60;
    for (let m = startM; m < endM; m += slotStepMinutes) {
      const curEnd = Math.min(endM, m + slotStepMinutes);
      list.push({
        startMinute: m,
        endMinute: curEnd,
        startLabel: minutesToTime(m),
        endLabel: minutesToTime(curEnd),
      });
    }
    return list;
  }, [dayStartHour, dayEndHour, slotStepMinutes]);

  const timeOptions = useMemo(() => {
    const opts: { value: string; minute: number; label: string }[] = [];
    const startM = dayStartHour * 60;
    const endM = dayEndHour * 60;
    for (let m = startM; m <= endM; m += slotStepMinutes) {
      const timeStr = minutesToTime(m);
      opts.push({
        value: timeStr,
        minute: m,
        label: `${timeStr} Uhr`,
      });
    }
    return opts;
  }, [dayStartHour, dayEndHour, slotStepMinutes]);

  // Schnelle Datums-Navigation
  function adjustDate(daysDelta: number) {
    const d = new Date(date);
    d.setDate(d.getDate() + daysDelta);
    setDate(d.toISOString().slice(0, 10));
  }

  function setDatePreset(offsetDays: number) {
    const d = new Date();
    d.setDate(d.getDate() + offsetDays);
    setDate(d.toISOString().slice(0, 10));
  }

  // Preset für Slot Y setzen
  function applySlotPreset(startStr: string, endStr: string) {
    setStartTime(startStr);
    setEndTime(endStr);
  }

  // Berechne Belegungs-Status pro Slot & Raum
  function getSlotStatus(roomId: number, startMinute: number, endMinute: number) {
    const r = rooms.find((rm) => rm.id === roomId);
    const rStartMin = (r?.effective_day_start_hour ?? slotConfig.day_start_hour ?? 8) * 60;
    const rEndMin = (r?.effective_day_end_hour ?? slotConfig.day_end_hour ?? 18) * 60;

    if (endMinute <= rStartMin || startMinute >= rEndMin) {
      return { isAvailable: false, isOutOfHours: true, isLocked: false, slot: null };
    }

    const slots = timelines[roomId] || [];
    const targetStart = `${date}T${minutesToTime(startMinute)}:00`;
    const targetEnd = `${date}T${minutesToTime(endMinute)}:00`;

    const match = slots.find((s) => s.start_at < targetEnd && s.end_at > targetStart);
    if (!match) return { isAvailable: true, isOutOfHours: false, isLocked: false, slot: null };
    if (match.status === "locked") return { isAvailable: false, isOutOfHours: false, isLocked: true, slot: match };
    return { isAvailable: false, isOutOfHours: false, isLocked: false, slot: match };
  }

  // Prüft, ob ein Raum im gesamten gesuchten Slot Y (startTime bis endTime) frei ist
  function isRoomFreeInSlot(roomId: number, startMin: number, endMin: number) {
    const r = rooms.find((rm) => rm.id === roomId);
    const rStartMin = (r?.effective_day_start_hour ?? slotConfig.day_start_hour ?? 8) * 60;
    const rEndMin = (r?.effective_day_end_hour ?? slotConfig.day_end_hour ?? 18) * 60;

    if (startMin < rStartMin || endMin > rEndMin) return false;

    const slots = timelines[roomId] || [];
    const targetStart = `${date}T${minutesToTime(startMin)}:00`;
    const targetEnd = `${date}T${minutesToTime(endMin)}:00`;

    return !slots.some((s) => s.start_at < targetEnd && s.end_at > targetStart);
  }

  // Alle verfügbaren Labels zur Filterung sammeln
  const allLabels = useMemo(() => {
    const set = new Set<string>();
    rooms.forEach((r) => r.labels.forEach((l) => set.add(l)));
    return Array.from(set);
  }, [rooms]);

  // Gefilterte Räume nach Liegenschaft, Etage, Kapazität, Labels und "Nur Freie"
  const filteredRooms = useMemo(() => {
    const startM = timeToMinutes(startTime);
    const endM = timeToMinutes(endTime);
    return rooms.filter((r) => {
      if (selectedFloorId && r.floor_id !== selectedFloorId) {
        if (!currentFloor?.rooms.some((cr) => cr.id === r.id)) return false;
      }
      if (minCapacity > 0 && (r.capacity ?? 0) < minCapacity) return false;
      if (selectedLabel && !r.labels.includes(selectedLabel)) return false;
      if (onlyFreeInSlot && !isRoomFreeInSlot(r.id, startM, endM)) return false;
      return true;
    });
  }, [rooms, selectedFloorId, currentFloor, minCapacity, selectedLabel, onlyFreeInSlot, startTime, endTime, timelines, slotConfig]);

  const freeRoomsCountInSlot = useMemo(() => {
    const startM = timeToMinutes(startTime);
    const endM = timeToMinutes(endTime);
    return rooms.filter((r) => isRoomFreeInSlot(r.id, startM, endM)).length;
  }, [rooms, startTime, endTime, timelines, slotConfig]);

  // Modal öffnen & Bestuhlung/Grundriss laden
  function openRoom(room: MeetingRoomOut, initialStart = startTime, initialEnd = endTime) {
    setActiveRoom(room);
    setState("idle");
    setError(null);
    const startM = timeToMinutes(initialStart);
    const roomDuration = room.effective_slot_duration_minutes ?? slotStepMinutes;
    const endM = timeToMinutes(initialEnd) > startM ? timeToMinutes(initialEnd) : startM + roomDuration;

    setForm({
      startTime: initialStart,
      endTime: minutesToTime(endM),
      seatingOptionId: "",
      remark: "",
    });
    setHasCatering(false);
    setCateringNotes("");
    setBillingMode("own");
    setForeignDeptId("");
    setForeignCostCenter("");
    setCostCenterWarningAcknowledged(false);

    api.get<SeatingOptionOut[]>(`/fm/rooms/${room.id}/seating-options`).then(setSeating).catch(() => setSeating([]));

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

  // Buchung abschicken
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
    const start_at = `${date}T${form.startTime}:00`;
    const end_at = `${date}T${form.endTime}:00`;

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

  const userDept = departments.find((d) => d.id === effectiveUser?.department_id);
  const ownCostCenter = effectiveUser?.cost_center || userDept?.cost_center || "Standard-KST";

  const activeRoomDeptRestricted = activeRoom
    ? !isDeptAuthorized(
        effectiveUser?.department_id,
        effectiveUser?.department,
        activeRoom.restricted_department_ids,
        activeRoom.restricted_department_names,
        departments,
        hasRole("fm")
      )
    : false;

  return (
    <div className="space-y-6">
      {/* Kopfbereich mit Titel & Erklärung */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight mb-1">Meetingräume</h1>
        <p className="text-sm text-on-surface-variant">
          Sofortige Übersicht aller Räume mit <strong>Live-Tages-Matrix (08–18 Uhr)</strong>, Grundriss-Thumbnails,
          gezielter Slot-Suche und 1-Klick-Reservierung.
        </p>
      </div>

      {/* INTELLIGENTE SUCHE: "Ich suche einen Meetingraum für Tag X zum Slot Y" */}
      <div className="bg-surface-container-lowest p-4 rounded-xl border border-outline-variant/40 shadow-sm space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-outline-variant/30 pb-3">
          <div className="flex items-center gap-2">
            <span className="text-xl">🎯</span>
            <span className="font-bold text-sm text-on-surface uppercase tracking-wider">
              Zielgerichtete Meetingraum-Suche: Tag X · Slot Y
            </span>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs text-on-surface-variant">Ansicht:</span>
            <div className="flex gap-1 bg-surface-container-low rounded-lg p-1 border border-outline-variant/30">
              <button
                onClick={() => setViewMode("matrix")}
                className={`px-3 py-1 text-xs font-semibold rounded-md transition-colors flex items-center gap-1.5 ${
                  viewMode === "matrix"
                    ? "bg-primary text-on-primary shadow-sm"
                    : "text-on-surface-variant hover:bg-surface-container"
                }`}
              >
                <span>📊</span> Tages-Matrix
              </button>
              <button
                onClick={() => setViewMode("cards")}
                className={`px-3 py-1 text-xs font-semibold rounded-md transition-colors flex items-center gap-1.5 ${
                  viewMode === "cards"
                    ? "bg-primary text-on-primary shadow-sm"
                    : "text-on-surface-variant hover:bg-surface-container"
                }`}
              >
                <span>🗂️</span> Kacheln
              </button>
              {digitalLayout && (
                <button
                  onClick={() => setViewMode("plan")}
                  className={`px-3 py-1 text-xs font-semibold rounded-md transition-colors flex items-center gap-1.5 ${
                    viewMode === "plan"
                      ? "bg-primary text-on-primary shadow-sm"
                      : "text-on-surface-variant hover:bg-surface-container"
                  }`}
                >
                  <span>🗺️</span> Etagen-Grundriss
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Filter-Zeile: Datum, Zeitslot, Presets & Freifilter */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* 1. Tag X (mit Schnellwahltasten) */}
          <div>
            <label className="block text-xs font-bold text-on-surface-variant mb-1">
              Datum (Tag X)
            </label>
            <div className="flex items-center gap-1">
              <button
                onClick={() => adjustDate(-1)}
                className="p-2 text-xs rounded bg-surface-container hover:bg-surface-container-high text-on-surface font-bold"
                title="Vorheriger Tag"
              >
                ◀
              </button>
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="flex-1 bg-surface-container-low rounded px-2.5 py-1.5 text-sm font-semibold border border-outline-variant/40"
              />
              <button
                onClick={() => adjustDate(1)}
                className="p-2 text-xs rounded bg-surface-container hover:bg-surface-container-high text-on-surface font-bold"
                title="Nächster Tag"
              >
                ▶
              </button>
            </div>
            <div className="flex gap-1.5 mt-1.5">
              <button
                onClick={() => setDatePreset(0)}
                className="text-[11px] px-2 py-0.5 rounded bg-surface-container hover:bg-surface-container-high text-on-surface"
              >
                Heute
              </button>
              <button
                onClick={() => setDatePreset(1)}
                className="text-[11px] px-2 py-0.5 rounded bg-surface-container hover:bg-surface-container-high text-on-surface"
              >
                Morgen
              </button>
              <button
                onClick={() => setDatePreset(2)}
                className="text-[11px] px-2 py-0.5 rounded bg-surface-container hover:bg-surface-container-high text-on-surface"
              >
                Übermorgen
              </button>
            </div>
          </div>

          {/* 2. Zeitslot Y */}
          <div>
            <label className="block text-xs font-bold text-on-surface-variant mb-1">
              Gesuchter Slot Y (Uhrzeit)
            </label>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <select
                  value={startTime}
                  onChange={(e) => {
                    const s = e.target.value;
                    setStartTime(s);
                    if (timeToMinutes(endTime) <= timeToMinutes(s)) {
                      setEndTime(minutesToTime(timeToMinutes(s) + slotStepMinutes));
                    }
                  }}
                  className="w-full bg-surface-container-low rounded px-2 py-1.5 text-sm font-semibold border border-outline-variant/40"
                >
                  {timeOptions.filter((o) => o.minute < dayEndHour * 60).map((o) => (
                    <option key={o.value} value={o.value}>
                      ab {o.value} Uhr
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <select
                  value={endTime}
                  onChange={(e) => setEndTime(e.target.value)}
                  className="w-full bg-surface-container-low rounded px-2 py-1.5 text-sm font-semibold border border-outline-variant/40"
                >
                  {timeOptions.map((o) => (
                    <option key={o.value} value={o.value} disabled={o.minute <= timeToMinutes(startTime)}>
                      bis {o.value} Uhr
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div className="flex flex-wrap gap-1 mt-1.5">
              <button
                type="button"
                onClick={() => applySlotPreset(startTime, minutesToTime(timeToMinutes(startTime) + slotStepMinutes))}
                className="text-[10px] px-1.5 py-0.5 rounded bg-surface-container hover:bg-surface-container-high"
              >
                {slotStepMinutes}m (1 Slot)
              </button>
              <button
                type="button"
                onClick={() => applySlotPreset(startTime, minutesToTime(timeToMinutes(startTime) + 2 * slotStepMinutes))}
                className="text-[10px] px-1.5 py-0.5 rounded bg-surface-container hover:bg-surface-container-high"
              >
                {2 * slotStepMinutes}m (2 Slots)
              </button>
              <button
                type="button"
                onClick={() => applySlotPreset("09:00", "12:00")}
                className={`text-[10px] px-1.5 py-0.5 rounded ${
                  startTime === "09:00" && endTime === "12:00" ? "bg-primary text-on-primary font-bold" : "bg-surface-container hover:bg-surface-container-high"
                }`}
              >
                Vormittag
              </button>
              <button
                type="button"
                onClick={() => applySlotPreset("13:00", "17:00")}
                className={`text-[10px] px-1.5 py-0.5 rounded ${
                  startTime === "13:00" && endTime === "17:00" ? "bg-primary text-on-primary font-bold" : "bg-surface-container hover:bg-surface-container-high"
                }`}
              >
                Nachmittag
              </button>
            </div>
          </div>

          {/* 3. Liegenschaft & Etage */}
          <div>
            <label className="block text-xs font-bold text-on-surface-variant mb-1">
              Standort / Liegenschaft
            </label>
            <select
              value={propertyId ?? ""}
              onChange={(e) => {
                setPropertyId(Number(e.target.value));
                setSelectedFloorId(null);
              }}
              className="w-full bg-surface-container-low rounded px-2.5 py-1.5 text-xs font-medium border border-outline-variant/40 mb-1"
            >
              {properties.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
            {floors.length > 0 && (
              <select
                value={selectedFloorId ?? ""}
                onChange={(e) => setSelectedFloorId(e.target.value ? Number(e.target.value) : null)}
                className="w-full bg-surface-container-low rounded px-2 py-1 text-xs border border-outline-variant/40"
              >
                <option value="">Alle Gebäude & Etagen</option>
                {floors.map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.buildingName} · {f.name}
                  </option>
                ))}
              </select>
            )}
          </div>

          {/* 4. Kapazität & Live-Filter Checkbox */}
          <div className="flex flex-col justify-between">
            <div>
              <label className="block text-xs font-bold text-on-surface-variant mb-1">
                Mindest-Kapazität
              </label>
              <select
                value={minCapacity}
                onChange={(e) => setMinCapacity(Number(e.target.value))}
                className="w-full bg-surface-container-low rounded px-2 py-1.5 text-xs font-medium border border-outline-variant/40 mb-2"
              >
                <option value={0}>Beliebige Personenzahl</option>
                <option value={4}>Ab 4 Personen</option>
                <option value={8}>Ab 8 Personen</option>
                <option value={12}>Ab 12 Personen</option>
                <option value={16}>Ab 16 Personen</option>
              </select>
            </div>

            {/* Der zentrale Effizienz-Filter: "Nur freie Räume anzeigen" */}
            <label className="flex items-center gap-2 p-2 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-300 dark:border-emerald-700/50 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={onlyFreeInSlot}
                onChange={(e) => setOnlyFreeInSlot(e.target.checked)}
                className="w-4 h-4 rounded text-emerald-600 focus:ring-emerald-500"
              />
              <span className="text-xs font-bold text-emerald-950 dark:text-emerald-200">
                Nur freie Räume im Slot {startTime}–{endTime} Uhr anzeigen
              </span>
            </label>
          </div>
        </div>

        {/* Statuszeile mit Treffern */}
        <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-outline-variant/20 text-xs">
          <div className="flex items-center gap-2">
            <span className="inline-block w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
            <span className="text-on-surface font-semibold">
              {freeRoomsCountInSlot} von {rooms.length} Meetingräumen frei
            </span>
            <span className="text-on-surface-variant">
              am {date} von {startTime} bis {endTime} Uhr.
            </span>
          </div>

          {/* Quick-Filter nach Ausstattung */}
          {allLabels.length > 0 && (
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="text-on-surface-variant text-[11px]">Ausstattung:</span>
              <button
                onClick={() => setSelectedLabel("")}
                className={`px-2 py-0.5 rounded-full text-[11px] ${
                  !selectedLabel ? "bg-primary text-on-primary font-bold" : "bg-surface-container text-on-surface-variant"
                }`}
              >
                Alle
              </button>
              {allLabels.map((l) => (
                <button
                  key={l}
                  onClick={() => setSelectedLabel(selectedLabel === l ? "" : l)}
                  className={`px-2 py-0.5 rounded-full text-[11px] transition-colors ${
                    selectedLabel === l ? "bg-primary text-on-primary font-bold" : "bg-surface-container hover:bg-surface-container-high text-on-surface-variant"
                  }`}
                >
                  {l}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* HAUPTANSICHT 1: DIE TAGES-MATRIX (Timeline 08:00 - 18:00) */}
      {viewMode === "matrix" && (
        <div className="space-y-3">
          <div className="flex items-center justify-between text-xs text-on-surface-variant bg-surface-container-low px-3 py-2 rounded-lg border border-outline-variant/30">
            <div className="flex items-center gap-3">
              <span className="font-semibold text-on-surface">Tages-Zeitstrahl ({date}):</span>
              <span className="flex items-center gap-1">
                <span className="w-3 h-3 rounded bg-emerald-100 border border-emerald-400 inline-block" /> Frei (Klick
                zum Buchen)
              </span>
              <span className="flex items-center gap-1">
                <span className="w-3 h-3 rounded bg-slate-300 border border-slate-400 inline-block" /> Belegt
              </span>
              <span className="flex items-center gap-1">
                <span className="w-3 h-3 rounded bg-red-200 border border-red-400 inline-block" /> Gesperrt
              </span>
              <span className="flex items-center gap-1">
                <span className="w-3 h-3 rounded bg-sky-200 border-2 border-sky-500 inline-block" /> Gesuchter Slot Y
              </span>
            </div>
            <span>💡 Klicke auf ein beliebiges freies Stundenfeld, um direkt dafür zu buchen.</span>
          </div>

          <div className="bg-surface rounded-xl border border-outline-variant/30 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-left text-xs">
                <thead>
                  <tr className="bg-surface-container-low border-b border-outline-variant/40">
                    <th className="p-3 font-bold text-on-surface min-w-[280px]">
                      Meetingraum & Ausstattung
                    </th>
                    {timelineSlots.map((slot) => {
                      const isTarget = slot.startMinute >= timeToMinutes(startTime) && slot.endMinute <= timeToMinutes(endTime);
                      return (
                        <th
                          key={slot.startMinute}
                          className={`p-2 text-center border-l border-outline-variant/30 font-bold min-w-[62px] transition-colors ${
                            isTarget ? "bg-sky-100 dark:bg-sky-950/60 text-sky-900 dark:text-sky-200 border-b-2 border-sky-500" : "text-on-surface-variant"
                          }`}
                        >
                          <div>{slot.startLabel}</div>
                          <div className="text-[10px] font-normal opacity-75">bis {slot.endLabel}</div>
                        </th>
                      );
                    })}
                    <th className="p-3 text-right font-bold text-on-surface min-w-[150px]">
                      Aktion für Slot Y
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-outline-variant/20">
                  {filteredRooms.length === 0 ? (
                    <tr>
                      <td colSpan={timelineSlots.length + 2} className="p-8 text-center text-on-surface-variant">
                        Keine Meetingräume gefunden, die den gewählten Suchkriterien entsprechen.
                      </td>
                    </tr>
                  ) : (
                    filteredRooms.map((r) => {
                      const isFreeInTarget = isRoomFreeInSlot(r.id, timeToMinutes(startTime), timeToMinutes(endTime));
                      const roleRestricted = r.restricted_role_code && !hasRole(r.restricted_role_code, "fm");
                      const deptRestricted = !isDeptAuthorized(
                        effectiveUser?.department_id,
                        effectiveUser?.department,
                        r.restricted_department_ids,
                        r.restricted_department_names,
                        departments,
                        hasRole("fm")
                      );
                      const notAuthorized = Boolean(roleRestricted || deptRestricted || r.is_locked);

                      return (
                        <tr
                          key={r.id}
                          className={`hover:bg-surface-container-lowest transition-colors ${
                            isFreeInTarget ? "bg-emerald-50/20" : ""
                          }`}
                        >
                          {/* Raum-Details & Thumbnail */}
                          <td className="p-3">
                            <div className="flex items-start gap-3">
                              {/* SVG-Grundriss Thumbnail */}
                              <div className="w-28 flex-shrink-0 border border-outline-variant/40 rounded-lg overflow-hidden bg-white shadow-2xs">
                                <MeetingRoomThumbnail room={r} width="100%" height={68} isAvailable={isFreeInTarget} />
                              </div>

                              <div className="min-w-0 flex-1">
                                <div className="font-bold text-sm text-on-surface flex items-center gap-1.5 truncate">
                                  <span>🏛️</span>
                                  <span className="truncate">{r.name}</span>
                                </div>
                                <div className="text-[11px] text-on-surface-variant mt-0.5">
                                  Raum {r.room_number} · max. <strong>{r.capacity ?? "—"} P.</strong>
                                  {r.floor_name && ` · ${r.floor_name}`}
                                </div>
                                <div className="text-[10px] text-on-surface-variant flex items-center gap-1.5 mt-0.5">
                                  <span>⏱ {r.effective_slot_duration_minutes ?? slotConfig.slot_duration_minutes}m Slots</span>
                                  <span>•</span>
                                  <span>🕒 {r.effective_day_start_hour ?? slotConfig.day_start_hour}:00–{r.effective_day_end_hour ?? slotConfig.day_end_hour}:00</span>
                                </div>

                                {r.labels.length > 0 && (
                                  <div className="flex flex-wrap gap-1 mt-1.5">
                                    {r.labels.map((l) => (
                                      <span
                                        key={l}
                                        className="text-[10px] px-1.5 py-0.2 rounded bg-surface-container text-on-surface-variant"
                                      >
                                        {l}
                                      </span>
                                    ))}
                                  </div>
                                )}

                                {r.is_locked && (
                                  <div className="mt-1">
                                    <span className="text-[10px] font-semibold text-red-700 bg-red-100 px-1.5 py-0.5 rounded flex items-center gap-1 w-fit">
                                      🔒 Gesperrt {r.lock_reason ? `(${r.lock_reason})` : ""}
                                    </span>
                                  </div>
                                )}

                                {r.restricted_department_names && r.restricted_department_names.length > 0 && (
                                  <div className="mt-1">
                                    <span className="text-[10px] font-semibold text-sky-800 bg-sky-100 px-1.5 py-0.5 rounded flex items-center gap-1 w-fit">
                                      🏢 Nur: {r.restricted_department_names.join(", ")}
                                    </span>
                                  </div>
                                )}

                                {r.approval_required && (
                                  <div className="mt-1">
                                    <span className="text-[10px] font-semibold text-amber-700 bg-amber-100 px-1.5 py-0.5 rounded">
                                      ⚠️ Genehmigung erforderlich
                                    </span>
                                  </div>
                                )}
                              </div>
                            </div>
                          </td>

                          {/* Dynamische Zeitleisten-Slots */}
                          {timelineSlots.map((slot) => {
                            const status = getSlotStatus(r.id, slot.startMinute, slot.endMinute);
                            const isTarget = slot.startMinute >= timeToMinutes(startTime) && slot.endMinute <= timeToMinutes(endTime);

                            if (status.isOutOfHours) {
                              return (
                                <td
                                  key={slot.startMinute}
                                  className="p-1 text-center border-l border-outline-variant/30 bg-surface-container-highest/40 cursor-not-allowed"
                                  title={`Außerhalb der Raum-Betriebszeit (${r.effective_day_start_hour ?? 8}:00–${r.effective_day_end_hour ?? 18}:00 Uhr)`}
                                >
                                  <div className="h-12 flex flex-col items-center justify-center text-on-surface-variant/40 select-none">
                                    <span className="text-[11px] font-bold">—</span>
                                  </div>
                                </td>
                              );
                            }

                            if (status.isAvailable) {
                              return (
                                <td
                                  key={slot.startMinute}
                                  onClick={() => !notAuthorized && openRoom(r, slot.startLabel, slot.endLabel)}
                                  className={`p-1 text-center border-l border-outline-variant/30 cursor-pointer transition-all hover:brightness-95 group ${
                                    isTarget
                                      ? "bg-emerald-100/90 hover:bg-emerald-200 border-sky-300 font-bold"
                                      : "bg-emerald-50/70 hover:bg-emerald-100"
                                  }`}
                                  title={`${r.name} um ${slot.startLabel}–${slot.endLabel} Uhr ist frei. Klicken zum Buchen!`}
                                >
                                  <div className="h-12 flex flex-col items-center justify-center rounded border border-emerald-300/50 group-hover:border-emerald-500 group-hover:shadow-xs">
                                    <span className="text-[11px] font-bold text-emerald-800">Frei</span>
                                    <span className="text-[9px] text-emerald-600 opacity-70 group-hover:opacity-100">
                                      + Buchen
                                    </span>
                                  </div>
                                </td>
                              );
                            }

                            if (status.isLocked) {
                              return (
                                <td
                                  key={slot.startMinute}
                                  className="p-1 text-center border-l border-outline-variant/30 bg-red-100/80 cursor-not-allowed"
                                  title={`Gesperrt: ${status.slot?.remark || "Wartung / Facility Management"}`}
                                >
                                  <div className="h-12 flex flex-col items-center justify-center rounded border border-red-300/60 bg-red-50/50 text-red-800">
                                    <span className="text-xs">🔒</span>
                                    <span className="text-[9px] font-bold truncate max-w-[55px]">Gesperrt</span>
                                  </div>
                                </td>
                              );
                            }

                            // Belegt
                            return (
                              <td
                                key={slot.startMinute}
                                className="p-1 text-center border-l border-outline-variant/30 bg-slate-100/90"
                                title={`Belegt von: ${status.slot?.booked_for_name || "Unbekannt"} (${
                                  status.slot?.booked_for_department || "Ihre Organisation"
                                })`}
                              >
                                <div className="h-12 flex flex-col items-center justify-center rounded border border-slate-300/70 bg-white/60 text-slate-700 px-0.5">
                                  <span className="text-[10px] font-semibold truncate max-w-[55px]">
                                    {status.slot?.booked_for_name || "Belegt"}
                                  </span>
                                  <span className="text-[9px] text-slate-500 truncate max-w-[55px]">
                                    {status.slot?.booked_for_department || "Reserviert"}
                                  </span>
                                </div>
                              </td>
                            );
                          })}

                          {/* Rechte Aktions-Spalte für den gesuchten Slot Y */}
                          <td className="p-3 text-right">
                            {r.is_locked ? (
                              <span className="text-xs text-red-600 font-semibold">🔒 Gesperrt</span>
                            ) : deptRestricted ? (
                              <span className="text-xs text-on-surface-variant font-medium">Nur {r.restricted_department_names?.join(", ")}</span>
                            ) : roleRestricted ? (
                              <span className="text-xs text-on-surface-variant font-medium">Rolle erforderlich</span>
                            ) : isFreeInTarget ? (
                              <Button
                                variant="accent"
                                className="w-full text-xs font-bold shadow-sm"
                                onClick={() => openRoom(r, startTime, endTime)}
                              >
                                📅 Slot buchen
                              </Button>
                            ) : (
                              <Button
                                variant="secondary"
                                className="w-full text-xs"
                                onClick={() => openRoom(r)}
                              >
                                Anderen Slot
                              </Button>
                            )}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* HAUPTANSICHT 2: KACHEL-ANSICHT (Cards mit Thumbnail & Slot-Badge) */}
      {viewMode === "cards" && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {filteredRooms.map((r) => {
            const isFreeInTarget = isRoomFreeInSlot(r.id, timeToMinutes(startTime), timeToMinutes(endTime));
            const roleRestricted = r.restricted_role_code && !hasRole(r.restricted_role_code, "fm");
            const deptRestricted = !isDeptAuthorized(
              effectiveUser?.department_id,
              effectiveUser?.department,
              r.restricted_department_ids,
              r.restricted_department_names,
              departments,
              hasRole("fm")
            );
            const notAuthorized = Boolean(roleRestricted || deptRestricted || r.is_locked);

            return (
              <Card
                key={r.id}
                data-testid={`meeting-room-${r.id}`}
                className="overflow-hidden p-0 border border-outline-variant/40 hover:shadow-md transition-shadow flex flex-col justify-between"
              >
                {/* SVG-Grundriss Thumbnail groß oben */}
                <div className="relative bg-surface-container-low border-b border-outline-variant/30 p-2">
                  <MeetingRoomThumbnail room={r} width="100%" height={125} isAvailable={isFreeInTarget} />
                  <div className="absolute top-3 right-3 flex flex-col items-end gap-1">
                    {r.is_locked ? (
                      <span className="text-xs px-2.5 py-0.5 rounded-full font-bold shadow-xs bg-red-600 text-white">
                        🔒 Gesperrt
                      </span>
                    ) : (
                      <span
                        className={`text-xs px-2.5 py-0.5 rounded-full font-bold shadow-xs ${
                          isFreeInTarget
                            ? "bg-emerald-500 text-white"
                            : "bg-slate-200 text-slate-800"
                        }`}
                      >
                        {isFreeInTarget ? `Frei: ${startTime}–${endTime} Uhr` : "Im Slot belegt"}
                      </span>
                    )}
                    {r.approval_required && (
                      <span className="text-[10px] px-2 py-0.5 rounded-full font-semibold bg-amber-100 text-amber-900 border border-amber-300 shadow-xs">
                        Freigabe Req.
                      </span>
                    )}
                    {r.restricted_department_names && r.restricted_department_names.length > 0 && (
                      <span className="text-[10px] px-2 py-0.5 rounded-full font-semibold bg-sky-100 text-sky-900 border border-sky-300 shadow-xs">
                        🏢 {r.restricted_department_names.join(", ")}
                      </span>
                    )}
                  </div>
                </div>

                <div className="p-4 flex-1 flex flex-col justify-between space-y-3">
                  <div>
                    <div className="font-bold text-base text-on-surface">{r.name}</div>
                    <div className="text-xs text-on-surface-variant mt-0.5">
                      Raum {r.room_number} · max. {r.capacity ?? "—"} Personen
                      {r.floor_name && ` · ${r.floor_name}`}
                    </div>
                    <div className="text-[10px] text-on-surface-variant flex items-center gap-1.5 mt-0.5">
                      <span>⏱ {r.effective_slot_duration_minutes ?? slotConfig.slot_duration_minutes}m Slots</span>
                      <span>•</span>
                      <span>🕒 {r.effective_day_start_hour ?? slotConfig.day_start_hour}:00–{r.effective_day_end_hour ?? slotConfig.day_end_hour}:00</span>
                    </div>

                    {r.labels.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-2.5">
                        {r.labels.map((l) => (
                          <span
                            key={l}
                            className="text-[11px] px-2 py-0.5 rounded bg-surface-container text-on-surface-variant"
                          >
                            {l}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Mini-Timeline-Leiste */}
                  <div>
                    <div className="flex justify-between items-center text-[10px] text-on-surface-variant mb-1 font-medium">
                      <span>{minutesToTime(dayStartHour * 60)}</span>
                      <span>{minutesToTime(Math.round((dayStartHour + dayEndHour) / 2) * 60)}</span>
                      <span>{minutesToTime(dayEndHour * 60)}</span>
                    </div>
                    <div className="h-3 rounded-full bg-surface-container-highest overflow-hidden flex gap-0.5 p-0.5">
                      {timelineSlots.map((slot) => {
                        const status = getSlotStatus(r.id, slot.startMinute, slot.endMinute);
                        return (
                          <div
                            key={slot.startMinute}
                            title={`${slot.startLabel}–${slot.endLabel}: ${status.isOutOfHours ? "Außerhalb Betriebszeit" : status.isAvailable ? "Frei" : status.isLocked ? "Gesperrt" : "Belegt"}`}
                            className={`flex-1 rounded-sm ${
                              status.isOutOfHours
                                ? "bg-surface-container-highest/40"
                                : status.isAvailable
                                ? "bg-emerald-400"
                                : status.isLocked
                                ? "bg-red-400"
                                : "bg-slate-400"
                            }`}
                          />
                        );
                      })}
                    </div>
                  </div>

                  <Button
                    variant={isFreeInTarget && !notAuthorized ? "accent" : "secondary"}
                    className="w-full text-xs font-bold"
                    disabled={!!notAuthorized}
                    onClick={() => openRoom(r, startTime, endTime)}
                  >
                    {r.is_locked
                      ? "🔒 Raum gesperrt"
                      : deptRestricted
                      ? "Nicht berechtigt (Org-Einheit)"
                      : roleRestricted
                      ? "Rolle erforderlich"
                      : isFreeInTarget
                      ? `Jetzt für ${startTime}–${endTime} Uhr buchen`
                      : "Anderen Zeitraum wählen"}
                  </Button>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {/* HAUPTANSICHT 3: ETAGEN-GRUNDRISS */}
      {viewMode === "plan" && digitalLayout && (
        <div className="space-y-3">
          <div className="flex items-center justify-between text-xs text-on-surface-variant bg-surface-container-low p-2.5 rounded-lg border border-outline-variant/30">
            <div className="flex items-center gap-4">
              <span className="font-semibold text-on-surface">
                Etage: {currentFloor?.buildingName} / {currentFloor?.name}
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-3 h-3 rounded bg-[#e0f2fe] border border-[#0284c7] inline-block" /> Frei
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-3 h-3 rounded bg-[#fef9c3] border border-[#ca8a04] inline-block" /> Freigabe erforderlich
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-3 h-3 rounded bg-[#e2e8f0] border border-[#64748b] inline-block" /> Besetzt
              </span>
            </div>
            <span>Klick auf einen Meetingraum im Grundriss öffnet das Buchungsformular.</span>
          </div>

          <FloorplanCanvas
            layout={digitalLayout}
            meetingRooms={filteredRooms}
            onMeetingRoomClick={(room) => openRoom(room, startTime, endTime)}
          />
        </div>
      )}

      {/* BUCHUNGS-MODAL */}
      {activeRoom && (
        <Modal
          title={`🏛 ${activeRoom.name} (Raum ${activeRoom.room_number})`}
          onClose={() => setActiveRoom(null)}
        >
          {state === "done" ? (
            <div className="p-4 rounded-xl bg-tertiary-fixed/40 text-on-tertiary-fixed-variant text-sm space-y-2">
              <div className="font-semibold text-base">
                {activeRoom.approval_required
                  ? "Buchungsanfrage erfolgreich eingereicht!"
                  : "Meetingraum erfolgreich gebucht!"}
              </div>
              <p className="text-xs">
                {activeRoom.approval_required
                  ? "Der Raum erfordert eine Freigabe durch den zuständigen Raumverantwortlichen. Der Status steht auf „Ausstehend“."
                  : "Ihre Reservierung wurde verbindlich bestätigt."}
                {hasCatering && " Das Catering wurde an den Bewirtschaftungsdienst weitergeleitet."}
              </p>
              <div className="pt-3">
                <Button variant="secondary" onClick={() => setActiveRoom(null)}>
                  Schließen
                </Button>
              </div>
            </div>
          ) : (
            <div className="space-y-4 max-h-[80vh] overflow-y-auto pr-1 text-sm">
              {error && (
                <div className="p-2.5 rounded bg-error-container text-on-error-container text-xs font-medium" role="alert">
                  {error}
                </div>
              )}

              {activeRoom.is_locked && (
                <div className="p-3 rounded bg-red-100 text-red-900 border border-red-300 text-xs font-semibold flex items-center gap-2">
                  <span>🔒</span>
                  <span>Dieser Meetingraum ist derzeit gesperrt ({activeRoom.lock_reason || "Wartung"}). Buchungen sind nicht möglich.</span>
                </div>
              )}

              {activeRoomDeptRestricted && (
                <div className="p-3 rounded bg-sky-100 text-sky-900 border border-sky-300 text-xs font-semibold flex items-center gap-2">
                  <span>🏢</span>
                  <span>Dieser Meetingraum ist für die Organisationseinheit {activeRoom.restricted_department_names?.join(", ")} reserviert. Ihre Org-Einheit ({effectiveUser?.department || "Keine"}) hat hierfür keine Buchungsberechtigung.</span>
                </div>
              )}

              {/* Grundriss & Bestuhlungs-Vorschau */}
              {roomLayout && (
                <div className="border border-outline-variant/30 rounded-lg p-2.5 bg-surface-container-low space-y-1">
                  <div className="flex items-center justify-between text-xs text-on-surface-variant font-medium">
                    <span>Raum-Grundriss & Bestuhlung ({activeRoom.capacity ?? "—"} Plätze)</span>
                    <span className="text-[11px] font-semibold text-primary">
                      🏛 {activeRoom.seating_layout || "Konferenztisch"}
                    </span>
                  </div>
                  <div className="w-full h-40 bg-surface rounded border border-outline-variant/20 overflow-hidden">
                    <FloorplanCanvas layout={roomLayout} />
                  </div>
                </div>
              )}

              {/* Zeitslot-Auswahl */}
              <div className="grid grid-cols-2 gap-3">
                <label className="block text-xs font-semibold text-on-surface-variant">
                  Von (Uhrzeit)
                  <select
                    value={form.startTime}
                    onChange={(e) => {
                      const newStart = e.target.value;
                      const startM = timeToMinutes(newStart);
                      const roomDuration = activeRoom.effective_slot_duration_minutes ?? slotStepMinutes;
                      const endM = timeToMinutes(form.endTime) <= startM ? startM + roomDuration : timeToMinutes(form.endTime);
                      setForm((f) => ({ ...f, startTime: newStart, endTime: minutesToTime(endM) }));
                    }}
                    className="w-full mt-1 bg-surface-container-low rounded px-2.5 py-1.5 border border-outline-variant/40 text-sm font-medium"
                  >
                    {timeOptions.filter((o) => o.minute < dayEndHour * 60).map((o) => (
                      <option key={o.value} value={o.value}>
                        {o.value} Uhr
                      </option>
                    ))}
                  </select>
                </label>
                <label className="block text-xs font-semibold text-on-surface-variant">
                  Bis (Uhrzeit)
                  <select
                    value={form.endTime}
                    onChange={(e) => setForm((f) => ({ ...f, endTime: e.target.value }))}
                    className="w-full mt-1 bg-surface-container-low rounded px-2.5 py-1.5 border border-outline-variant/40 text-sm font-medium"
                  >
                    {timeOptions.map((o) => (
                      <option key={o.value} value={o.value} disabled={o.minute <= timeToMinutes(form.startTime)}>
                        {o.value} Uhr
                      </option>
                    ))}
                  </select>
                </label>
              </div>

              {/* Bestuhlungsoptionen */}
              {seating.length > 0 && (
                <label className="block text-xs font-semibold text-on-surface-variant">
                  Alternative Bestuhlung anfragen
                  <select
                    value={form.seatingOptionId}
                    onChange={(e) => {
                      const optId = e.target.value;
                      setForm((f) => ({ ...f, seatingOptionId: optId }));
                      const selOpt = seating.find((s) => String(s.id) === optId);
                      const cap = activeRoom.capacity || 10;
                      if (!selOpt) {
                        const preset = activeRoom.seating_layout || "boardroom";
                        setRoomLayout({ objects: generateMeetingRoomLayout(cap, preset) });
                      } else {
                        const n = selOpt.name.toLowerCase();
                        let preset = "boardroom";
                        if (n.includes("u-form") || n.includes("u_shape") || n.includes("u form")) preset = "u_shape";
                        else if (n.includes("parlament") || n.includes("schulung") || n.includes("classroom")) preset = "classroom";
                        else if (n.includes("kino") || n.includes("reihe") || n.includes("cinema") || n.includes("theater")) preset = "cinema";
                        else if (n.includes("bankett") || n.includes("banquet") || n.includes("gruppe")) preset = "banquet";
                        setRoomLayout({ objects: generateMeetingRoomLayout(cap, preset) });
                      }
                    }}
                    className="w-full mt-1 bg-surface-container-low rounded px-2.5 py-1.5 border border-outline-variant/40 text-sm font-medium"
                  >
                    <option value="">Standard-Bestuhlung beibehalten ({activeRoom.seating_layout || "Konferenztisch"})</option>
                    {seating
                      .filter((s) => !s.is_standard)
                      .map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.name} (+{s.changeover_days} Umbautag/e)
                        </option>
                      ))}
                  </select>
                </label>
              )}

              {/* Catering-Option */}
              <div className="p-3 rounded-lg bg-surface-container-low border border-outline-variant/30 space-y-2.5">
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
                <label className="block text-xs font-semibold text-on-surface-variant">
                  Bemerkung (nur für VM sichtbar)
                  <input
                    value={form.remark}
                    onChange={(e) => setForm((f) => ({ ...f, remark: e.target.value }))}
                    className="w-full mt-1 bg-surface-container-low rounded px-2.5 py-1.5 border border-outline-variant/30 text-sm"
                  />
                </label>
              )}

              <Button
                variant="accent"
                className="w-full mt-2"
                loading={state === "loading"}
                disabled={Boolean(activeRoom.is_locked || activeRoomDeptRestricted)}
                onClick={() => submitBooking()}
              >
                {activeRoom.is_locked
                  ? "Raum gesperrt"
                  : activeRoomDeptRestricted
                  ? "Nicht berechtigt (Org-Einheit)"
                  : activeRoom.approval_required
                  ? "Buchungsanfrage einreichen"
                  : "Jetzt verbindlich buchen"}
              </Button>
            </div>
          )}
        </Modal>
      )}

      {/* Doppelbuchungs-Warnung */}
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
