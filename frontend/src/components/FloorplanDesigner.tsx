import { useEffect, useRef, useState } from "react";
import { api } from "../api/client";
import type { FloorNode, MeetingRoomOut, PropertyOut, PropertyTree } from "../api/types";
import { Button } from "./ui";
import {
  type FloorplanLayout,
  type FloorplanObject,
  type FloorplanObjectType,
  type SeatingPreset,
  generateMeetingRoomLayout,
  parseFloorplanLayout,
} from "./FloorplanCanvas";

const TOOLS: { type: FloorplanObjectType; label: string; size: [number, number] }[] = [
  { type: "chair", label: "Stuhl", size: [24, 24] },
  { type: "table", label: "Tisch", size: [110, 60] },
  { type: "desk", label: "Desk", size: [55, 35] },
  { type: "meeting_room", label: "Meetingraum-Bereich", size: [160, 100] },
  { type: "whiteboard", label: "Whiteboard / Screen", size: [90, 12] },
  { type: "door", label: "Tür", size: [44, 12] },
  { type: "window", label: "Fenster", size: [60, 10] },
  { type: "cabinet", label: "Schrank", size: [65, 28] },
  { type: "planter", label: "Pflanztrog", size: [70, 22] },
  { type: "blocked", label: "Nicht nutzbar", size: [100, 70] },
];

const SEATING_PRESETS: { id: SeatingPreset; label: string; desc: string }[] = [
  { id: "boardroom", label: "Konferenztisch (Block)", desc: "Großer Tisch in der Raummitte mit Stühlen rundherum" },
  { id: "u_shape", label: "U-Form", desc: "Offene U-Tischformation mit Außenbestuhlung" },
  { id: "cinema", label: "Kino / Reihen", desc: "Reine Stuhlreihen mit Blick auf Präsentationswand" },
  { id: "classroom", label: "Schulung / Parlament", desc: "Tischreihen mit Arbeitsplätzen zum Screen" },
  { id: "banquet", label: "Gruppentische (Bankett)", desc: "Mehrere separate runde Inseln für Workshops" },
];

function blankLayout(): FloorplanLayout {
  return { objects: [] };
}

export function FloorplanDesigner() {
  const [properties, setProperties] = useState<PropertyOut[]>([]);
  const [propertyId, setPropertyId] = useState<number | null>(null);
  const [tree, setTree] = useState<PropertyTree | null>(null);
  const [floorId, setFloorId] = useState<number | null>(null);

  // Scope: "floor" (Etagen-Grundriss) or "room" (Meetingraum-Grundriss)
  const [scope, setScope] = useState<"floor" | "room">("floor");
  const [selectedRoomId, setSelectedRoomId] = useState<number | null>(null);
  const [meetingRooms, setMeetingRooms] = useState<MeetingRoomOut[]>([]);

  // Layouts
  const [layout, setLayout] = useState<FloorplanLayout>(blankLayout());
  const [tool, setTool] = useState<FloorplanObjectType>("chair");
  const [deskId, setDeskId] = useState<number | null>(null);
  const [meetingRoomId, setMeetingRoomId] = useState<number | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  // Seating preset for meeting room
  const [seatingPreset, setSeatingPreset] = useState<SeatingPreset>("boardroom");

  // Drag & Drop state
  const [dragState, setDragState] = useState<{
    id: string;
    startClientX: number;
    startClientY: number;
    origX: number;
    origY: number;
    hasMoved: boolean;
  } | null>(null);

  const canvasRef = useRef<SVGSVGElement>(null);

  useEffect(() => {
    api.get<PropertyOut[]>("/catalog/properties").then((items) => {
      setProperties(items);
      setPropertyId((current) => current ?? items[0]?.id ?? null);
    });
  }, []);

  useEffect(() => {
    if (!propertyId) return;
    api.get<PropertyTree>(`/catalog/properties/${propertyId}/tree`).then((data) => {
      setTree(data);
      const first = data.buildings.flatMap((building) => building.floors)[0];
      setFloorId((current) => current ?? first?.id ?? null);
    });
    api.get<MeetingRoomOut[]>(`/catalog/properties/${propertyId}/meeting-rooms`).then((rooms) => {
      setMeetingRooms(rooms);
      if (rooms.length > 0) {
        setSelectedRoomId((curr) => curr ?? rooms[0].id);
      }
    });
  }, [propertyId]);

  const floors = tree?.buildings.flatMap((building) => building.floors.map((floor) => ({ ...floor, buildingName: building.name }))) ?? [];
  const floor = floors.find((item) => item.id === floorId) as (FloorNode & { buildingName: string }) | undefined;
  const desks = floor?.rooms.flatMap((room) => room.desks.map((desk) => ({ ...desk, roomName: room.name }))) ?? [];
  const floorMeetingRooms = floor?.rooms.filter((room) => room.room_type === "meeting") ?? [];

  const selectedRoom = meetingRooms.find((r) => r.id === selectedRoomId);

  // Load layout when scope or selection changes
  useEffect(() => {
    if (scope === "floor") {
      if (!floor) return;
      setLayout(parseFloorplanLayout(floor.floorplan_layout) ?? blankLayout());
      setSelectedId(null);
    } else {
      if (!selectedRoomId) return;
      api
        .get<{ layout: string | null; seating_layout: string | null }>(`/catalog/rooms/${selectedRoomId}/floorplan-layout`)
        .then((res) => {
          const parsed = parseFloorplanLayout(res.layout);
          if (parsed && parsed.objects.length > 0) {
            setLayout(parsed);
          } else {
            // Auto-generate initial room layout based on capacity
            const room = meetingRooms.find((r) => r.id === selectedRoomId);
            const cap = room?.capacity || 10;
            const preset = (res.seating_layout as SeatingPreset) || "boardroom";
            setSeatingPreset(preset);
            setLayout({ objects: generateMeetingRoomLayout(cap, preset) });
          }
          if (res.seating_layout) {
            setSeatingPreset(res.seating_layout as SeatingPreset);
          }
          setSelectedId(null);
        })
        .catch(() => {
          const room = meetingRooms.find((r) => r.id === selectedRoomId);
          setLayout({ objects: generateMeetingRoomLayout(room?.capacity || 10, "boardroom") });
        });
    }
  }, [scope, floorId, floor?.floorplan_layout, selectedRoomId]);

  // Window mouse move and mouse up for fluid Drag & Drop
  useEffect(() => {
    function handleMouseMove(e: MouseEvent) {
      if (!dragState || !canvasRef.current) return;
      const bounds = canvasRef.current.getBoundingClientRect();
      const scaleX = 900 / bounds.width;
      const scaleY = 500 / bounds.height;
      const deltaX = (e.clientX - dragState.startClientX) * scaleX;
      const deltaY = (e.clientY - dragState.startClientY) * scaleY;

      if (Math.abs(deltaX) > 2 || Math.abs(deltaY) > 2) {
        setDragState((prev) => (prev ? { ...prev, hasMoved: true } : null));
      }

      setLayout((curr) => ({
        objects: curr.objects.map((obj) => {
          if (obj.id !== dragState.id) return obj;
          const targetX = Math.round((dragState.origX + deltaX) / 5) * 5;
          const targetY = Math.round((dragState.origY + deltaY) / 5) * 5;
          const clampedX = Math.max(12, Math.min(888 - obj.width, targetX));
          const clampedY = Math.max(12, Math.min(488 - obj.height, targetY));
          return { ...obj, x: clampedX, y: clampedY };
        }),
      }));
    }

    function handleMouseUp() {
      if (dragState) {
        setDragState(null);
      }
    }

    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);
    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };
  }, [dragState]);

  function handleObjectMouseDown(e: React.MouseEvent, obj: FloorplanObject) {
    e.stopPropagation();
    setSelectedId(obj.id);
    setDragState({
      id: obj.id,
      startClientX: e.clientX,
      startClientY: e.clientY,
      origX: obj.x,
      origY: obj.y,
      hasMoved: false,
    });
  }

  function handleCanvasClick(event: React.MouseEvent<SVGSVGElement>) {
    if (dragState?.hasMoved) return;
    if (!canvasRef.current) return;
    const bounds = canvasRef.current.getBoundingClientRect();
    const scaleX = 900 / bounds.width;
    const scaleY = 500 / bounds.height;
    const x = Math.max(15, Math.min(860, (event.clientX - bounds.left) * scaleX));
    const y = Math.max(15, Math.min(460, (event.clientY - bounds.top) * scaleY));
    const config = TOOLS.find((item) => item.type === tool)!;

    if (tool === "desk" && !deskId) {
      setMessage("Wählen Sie zuerst einen vorhandenen Desk aus.");
      return;
    }
    if (tool === "desk" && layout.objects.some((item) => item.deskId === deskId)) {
      setMessage("Dieser Desk ist bereits im Grundriss platziert.");
      return;
    }
    if (tool === "meeting_room" && !meetingRoomId) {
      setMessage("Wählen Sie zuerst einen vorhandenen Meetingraum aus.");
      return;
    }
    if (tool === "meeting_room" && layout.objects.some((item) => item.roomId === meetingRoomId)) {
      setMessage("Dieser Meetingraum ist bereits im Grundriss platziert.");
      return;
    }

    const meetingRoom = meetingRooms.find((r) => r.id === meetingRoomId);
    const chairCount = layout.objects.filter((o) => o.type === "chair").length;
    const object: FloorplanObject = {
      id: crypto.randomUUID(),
      type: tool,
      x: Math.round((x - config.size[0] / 2) / 5) * 5,
      y: Math.round((y - config.size[1] / 2) / 5) * 5,
      width: config.size[0],
      height: config.size[1],
      deskId: tool === "desk" ? deskId ?? undefined : undefined,
      roomId: tool === "meeting_room" ? meetingRoomId ?? undefined : undefined,
      label:
        tool === "chair"
          ? `Sitz ${chairCount + 1}`
          : tool === "desk"
          ? desks.find((desk) => desk.id === deskId)?.desk_number
          : tool === "meeting_room"
          ? meetingRoom
            ? `${meetingRoom.name} (${meetingRoom.room_number})`
            : config.label
          : config.label,
    };

    setLayout((current) => ({ objects: [...current.objects, object] }));
    setSelectedId(object.id);
    setMessage(null);
  }

  function handleAutoSeat(preset: SeatingPreset) {
    if (!selectedRoom) return;
    const capacity = selectedRoom.capacity || 10;
    const generated = generateMeetingRoomLayout(capacity, preset);
    setLayout({ objects: generated });
    setSeatingPreset(preset);
    setSelectedId(null);
    setMessage(`Automatische Bestuhlung für ${capacity} Plätze im Muster „${SEATING_PRESETS.find((p) => p.id === preset)?.label}“ generiert.`);
  }

  function updateSelected(patch: Partial<FloorplanObject>) {
    if (!selectedId) return;
    setLayout((current) => ({
      objects: current.objects.map((item) => (item.id === selectedId ? { ...item, ...patch } : item)),
    }));
  }

  function deleteSelected() {
    if (!selectedId) return;
    setLayout((current) => ({ objects: current.objects.filter((item) => item.id !== selectedId) }));
    setSelectedId(null);
  }

  async function save() {
    try {
      if (scope === "floor") {
        if (!floorId) return;
        await api.put(`/fm/floors/${floorId}/floorplan-layout`, { layout: JSON.stringify(layout) });
        setMessage("Etagen-Grundriss gespeichert. Sofort im Raumplan verfügbar.");
      } else {
        if (!selectedRoomId) return;
        await api.put(`/fm/rooms/${selectedRoomId}/floorplan-layout`, {
          layout: JSON.stringify(layout),
          seating_layout: seatingPreset,
        });
        setMessage("Meetingraum-Grundriss mit Bestuhlung erfolgreich gespeichert.");
      }
    } catch {
      setMessage("Fehler beim Speichern des Grundrisses.");
    }
  }

  const selected = layout.objects.find((item) => item.id === selectedId);

  return (
    <div className="space-y-4">
      {/* Oberer Umschalter: Etage vs. Meetingraum */}
      <div className="flex flex-wrap items-center justify-between gap-4 p-3 bg-surface-container-low rounded-md border border-outline-variant/30">
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold text-on-surface-variant uppercase tracking-wider">Planungsbereich:</span>
          <button
            type="button"
            onClick={() => setScope("floor")}
            className={`px-3 py-1.5 rounded text-xs font-semibold transition-all ${
              scope === "floor"
                ? "bg-primary text-on-primary shadow-sm"
                : "bg-surface-container hover:bg-surface-container-high text-on-surface"
            }`}
          >
            🏢 Etagen-Grundriss
          </button>
          <button
            type="button"
            onClick={() => setScope("room")}
            className={`px-3 py-1.5 rounded text-xs font-semibold transition-all ${
              scope === "room"
                ? "bg-primary text-on-primary shadow-sm"
                : "bg-surface-container hover:bg-surface-container-high text-on-surface"
            }`}
          >
            🏛 Meetingraum-Grundriss & Bestuhlung
          </button>
        </div>

        <div className="flex items-center gap-2">
          <Button variant="primary" onClick={save}>
            💾 {scope === "floor" ? "Etagen-Plan" : "Raum-Grundriss"} speichern
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-[270px_1fr_240px] gap-4">
        {/* Linke Leiste: Auswahl & Werkzeuge */}
        <section className="bg-surface-container-low rounded-md p-3 border border-outline-variant/30 space-y-4">
          <div className="font-semibold text-sm">
            {scope === "floor" ? "1. Etage auswählen" : "1. Meetingraum auswählen"}
          </div>

          <label className="block text-xs">
            Liegenschaft
            <select
              value={propertyId ?? ""}
              onChange={(e) => {
                setPropertyId(Number(e.target.value));
                setFloorId(null);
                setSelectedRoomId(null);
              }}
              className="w-full mt-1 bg-surface rounded px-2 py-1.5 text-sm border border-outline-variant/30"
            >
              {properties.map((property) => (
                <option key={property.id} value={property.id}>
                  {property.name}
                </option>
              ))}
            </select>
          </label>

          {scope === "floor" ? (
            <label className="block text-xs">
              Gebäude / Etage
              <select
                value={floorId ?? ""}
                onChange={(e) => setFloorId(Number(e.target.value))}
                className="w-full mt-1 bg-surface rounded px-2 py-1.5 text-sm border border-outline-variant/30"
              >
                {floors.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.buildingName} / {item.name}
                  </option>
                ))}
              </select>
            </label>
          ) : (
            <div className="space-y-2">
              <label className="block text-xs">
                Meetingraum
                <select
                  value={selectedRoomId ?? ""}
                  onChange={(e) => setSelectedRoomId(Number(e.target.value))}
                  className="w-full mt-1 bg-surface rounded px-2 py-1.5 text-sm border border-outline-variant/30"
                >
                  {meetingRooms.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.name} (Raum {r.room_number}, max. {r.capacity ?? "—"} P.)
                    </option>
                  ))}
                </select>
              </label>

              {selectedRoom && (
                <div className="p-2.5 rounded bg-surface border border-outline-variant/30 text-xs space-y-1">
                  <div className="font-semibold text-on-surface">{selectedRoom.name}</div>
                  <div className="text-on-surface-variant">
                    Kapazität: <span className="font-semibold text-primary">{selectedRoom.capacity ?? "nicht festgelegt"} Personen</span>
                  </div>
                  <div className="text-on-surface-variant">
                    Aktuelle Bestuhlung: <span className="font-semibold">{SEATING_PRESETS.find((p) => p.id === seatingPreset)?.label || seatingPreset}</span>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Preset-Aktionen für Meetingraum */}
          {scope === "room" && (
            <div className="pt-2 border-t border-outline-variant/30 space-y-2">
              <div className="font-semibold text-xs uppercase tracking-wider text-on-surface-variant">
                Bestuhlungs-Vorlagen
              </div>
              <p className="text-[11px] text-on-surface-variant leading-relaxed">
                Platziert automatisch alle {selectedRoom?.capacity ?? 10} Stühle und Konferenztische nach der gewählten Anordnung.
              </p>
              <div className="space-y-1">
                {SEATING_PRESETS.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => handleAutoSeat(p.id)}
                    className={`w-full text-left p-2 rounded text-xs transition-colors border ${
                      seatingPreset === p.id
                        ? "bg-primary/10 border-primary text-primary font-medium"
                        : "bg-surface border-outline-variant/30 hover:bg-surface-container"
                    }`}
                  >
                    <div className="font-semibold">{p.label}</div>
                    <div className="text-[10px] text-on-surface-variant line-clamp-1">{p.desc}</div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Manuelle Werkzeuge */}
          <div className="pt-2 border-t border-outline-variant/30 space-y-2">
            <div className="font-semibold text-xs uppercase tracking-wider text-on-surface-variant">
              Elemente hinzufügen
            </div>
            <p className="text-[11px] text-on-surface-variant">
              Klicken Sie ein Element an und tippen Sie anschließend auf den Grundriss.
            </p>
            <div className="grid grid-cols-2 gap-1">
              {TOOLS.filter((t) => (scope === "room" ? t.type !== "meeting_room" && t.type !== "desk" : true)).map((item) => (
                <button
                  key={item.type}
                  type="button"
                  onClick={() => setTool(item.type)}
                  className={`p-2 rounded text-xs text-left transition-colors ${
                    tool === item.type
                      ? "bg-primary text-on-primary font-medium"
                      : "bg-surface-container-high hover:bg-surface-container-highest"
                  }`}
                >
                  {item.type === "chair" ? "🪑 " : item.type === "table" ? "🪵 " : item.type === "whiteboard" ? "📺 " : ""}
                  {item.label}
                </button>
              ))}
            </div>

            {scope === "floor" && tool === "desk" && (
              <label className="block text-xs mt-2">
                Desk verbinden
                <select
                  value={deskId ?? ""}
                  onChange={(e) => setDeskId(Number(e.target.value))}
                  className="w-full mt-1 bg-surface rounded px-2 py-1.5 text-sm border border-outline-variant/30"
                >
                  <option value="">Desk wählen…</option>
                  {desks.map((desk) => (
                    <option key={desk.id} value={desk.id}>
                      {desk.desk_number} · {desk.roomName}
                    </option>
                  ))}
                </select>
              </label>
            )}

            {scope === "floor" && tool === "meeting_room" && (
              <label className="block text-xs mt-2">
                Meetingraum verbinden
                <select
                  value={meetingRoomId ?? ""}
                  onChange={(e) => setMeetingRoomId(Number(e.target.value))}
                  className="w-full mt-1 bg-surface rounded px-2 py-1.5 text-sm border border-outline-variant/30"
                >
                  <option value="">Meetingraum wählen…</option>
                  {floorMeetingRooms.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.name} · Raum {r.room_number} (max. {r.capacity ?? "—"} P.)
                    </option>
                  ))}
                </select>
              </label>
            )}
          </div>
        </section>

        {/* Mittlerer Bereich: Interaktiver SVG Canvas mit Drag & Drop */}
        <section className="space-y-2">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <div className="font-semibold text-sm">
                {scope === "floor"
                  ? `${floor ? `${floor.buildingName} / ${floor.name}` : "Etage wählen"}`
                  : `${selectedRoom ? `Meetingraum: ${selectedRoom.name} (Raum ${selectedRoom.room_number})` : "Raum wählen"}`}
              </div>
              <div className="text-xs text-on-surface-variant flex items-center gap-3">
                <span>🖱️ <b>Drag & Drop:</b> Jedes Element anklicken und mit der Maus verschieben</span>
                <span>•</span>
                <span>📐 Klick in freie Fläche platziert: <b>{TOOLS.find((item) => item.type === tool)?.label}</b></span>
              </div>
            </div>
            <div className="text-xs text-on-surface-variant bg-surface-container px-2 py-1 rounded">
              Objekte im Plan: {layout.objects.length} (davon {layout.objects.filter((o) => o.type === "chair").length} Stühle)
            </div>
          </div>

          <div className="relative">
            <svg
              ref={canvasRef}
              viewBox="0 0 900 500"
              onClick={handleCanvasClick}
              className={`w-full bg-surface rounded-md border border-outline-variant/30 select-none ${
                dragState ? "cursor-grabbing" : "cursor-crosshair"
              }`}
              aria-label="Grundriss gestalten mit Drag und Drop"
            >
              {/* Raster / Hintergrund */}
              <defs>
                <pattern id="grid" width="20" height="20" patternUnits="userSpaceOnUse">
                  <path d="M 20 0 L 0 0 0 20" fill="none" stroke="#e2e8f0" strokeWidth="0.5" />
                </pattern>
              </defs>
              <rect x={10} y={10} width={880} height={480} fill="#fbfaf6" stroke="#4f514c" strokeWidth={4} />
              <rect x={10} y={10} width={880} height={480} fill="url(#grid)" />

              {/* Raumbeschriftung bei Meetingraum-Grundriss */}
              {scope === "room" && selectedRoom && (
                <text x={450} y={480} fontSize={11} fill="#64748b" textAnchor="middle" fontWeight="500">
                  🏛 Grundriss {selectedRoom.name} · Raum {selectedRoom.room_number} · Kapazität: {selectedRoom.capacity ?? "—"} Plätze ({seatingPreset})
                </text>
              )}

              {/* Alle platzierten Objekte */}
              {layout.objects.map((object) => {
                const isSelected = selectedId === object.id;
                const isDragging = dragState?.id === object.id;

                if (object.type === "chair") {
                  return (
                    <g
                      key={object.id}
                      onMouseDown={(e) => handleObjectMouseDown(e, object)}
                      className="cursor-grab active:cursor-grabbing"
                    >
                      {/* Stuhl Sitzfläche */}
                      <rect
                        x={object.x + 2}
                        y={object.y + 5}
                        width={Math.max(10, object.width - 4)}
                        height={Math.max(10, object.height - 7)}
                        rx={3}
                        fill={isSelected ? "#bbf7d0" : "#e2e8f0"}
                        stroke={isSelected ? "#16a34a" : "#475569"}
                        strokeWidth={isSelected ? 2.5 : 1.5}
                      />
                      {/* Stuhl Rückenlehne */}
                      <rect
                        x={object.x + 1}
                        y={object.y}
                        width={Math.max(12, object.width - 2)}
                        height={4}
                        rx={2}
                        fill={isSelected ? "#15803d" : "#334155"}
                        stroke="#1e293b"
                        strokeWidth={1}
                      />
                      <text
                        x={object.x + object.width / 2}
                        y={object.y + object.height / 2 + 3}
                        fontSize={8}
                        textAnchor="middle"
                        fill="#334155"
                        className="pointer-events-none select-none"
                      >
                        {object.label?.replace("Sitz ", "") || ""}
                      </text>
                    </g>
                  );
                }

                return (
                  <g
                    key={object.id}
                    onMouseDown={(e) => handleObjectMouseDown(e, object)}
                    className="cursor-grab active:cursor-grabbing"
                  >
                    <rect
                      x={object.x}
                      y={object.y}
                      width={object.width}
                      height={object.height}
                      rx={object.type === "meeting_room" ? 6 : object.type === "table" ? 4 : 3}
                      fill={
                        object.type === "blocked"
                          ? "#d5d2cb"
                          : object.type === "window"
                          ? "#9fd6ea"
                          : object.type === "door"
                          ? "#d8b878"
                          : object.type === "planter"
                          ? "#699c59"
                          : object.type === "desk"
                          ? "#dff2d9"
                          : object.type === "whiteboard"
                          ? "#f8fafc"
                          : object.type === "meeting_room"
                          ? "#e0f2fe"
                          : "#cbb99d"
                      }
                      stroke={
                        isSelected
                          ? "#16a34a"
                          : isDragging
                          ? "#2563eb"
                          : object.type === "meeting_room"
                          ? "#0284c7"
                          : "#4f514c"
                      }
                      strokeWidth={isSelected || isDragging ? 3 : 2}
                    />

                    {object.type === "blocked" && (
                      <path
                        d={`M ${object.x} ${object.y} L ${object.x + object.width} ${object.y + object.height} M ${
                          object.x + object.width
                        } ${object.y} L ${object.x} ${object.y + object.height}`}
                        stroke="#7b7368"
                        strokeWidth={2}
                      />
                    )}

                    {object.type === "meeting_room" && object.width >= 80 && object.height >= 40 && (
                      <rect
                        x={object.x + 10}
                        y={object.y + object.height / 2 - 8}
                        width={object.width - 20}
                        height={16}
                        rx={3}
                        fill="#ffffff"
                        stroke="#0284c7"
                        strokeWidth={1}
                        opacity={0.7}
                      />
                    )}

                    <text
                      x={object.x + object.width / 2}
                      y={object.y + object.height / 2 + 4}
                      fontSize={11}
                      textAnchor="middle"
                      fill="#1e293b"
                      className="pointer-events-none select-none font-medium"
                    >
                      {object.type === "meeting_room" ? `🏛 ${object.label}` : object.label}
                    </text>
                  </g>
                );
              })}
            </svg>
          </div>

          {message && (
            <div className="p-2.5 rounded bg-tertiary-fixed/40 text-on-tertiary-fixed-variant text-xs flex items-center justify-between" role="status">
              <span>{message}</span>
              <button type="button" onClick={() => setMessage(null)} className="font-bold ml-2">✕</button>
            </div>
          )}
        </section>

        {/* Rechte Leiste: Ausgewähltes Element bearbeiten */}
        <section className="bg-surface-container-low rounded-md p-3 border border-outline-variant/30">
          <div className="font-semibold text-sm mb-2">Element bearbeiten</div>
          {selected ? (
            <div className="space-y-2.5 text-xs">
              <div className="font-semibold text-primary flex items-center justify-between">
                <span>{TOOLS.find((item) => item.type === selected.type)?.label || selected.type}</span>
                <span className="text-[10px] text-on-surface-variant font-normal">ID: {selected.id.slice(0, 6)}</span>
              </div>

              <label className="block">
                Beschriftung
                <input
                  value={selected.label ?? ""}
                  onChange={(e) => updateSelected({ label: e.target.value })}
                  className="w-full mt-1 bg-surface rounded px-2 py-1.5 border border-outline-variant/30 text-xs"
                />
              </label>

              <div className="grid grid-cols-2 gap-2">
                <label className="block">
                  Breite (px)
                  <input
                    type="number"
                    value={selected.width}
                    onChange={(e) => updateSelected({ width: Number(e.target.value) })}
                    className="w-full mt-1 bg-surface rounded px-2 py-1.5 border border-outline-variant/30 text-xs"
                  />
                </label>
                <label className="block">
                  Höhe (px)
                  <input
                    type="number"
                    value={selected.height}
                    onChange={(e) => updateSelected({ height: Number(e.target.value) })}
                    className="w-full mt-1 bg-surface rounded px-2 py-1.5 border border-outline-variant/30 text-xs"
                  />
                </label>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <label className="block">
                  Position X
                  <input
                    type="number"
                    value={Math.round(selected.x)}
                    onChange={(e) => updateSelected({ x: Number(e.target.value) })}
                    className="w-full mt-1 bg-surface rounded px-2 py-1.5 border border-outline-variant/30 text-xs"
                  />
                </label>
                <label className="block">
                  Position Y
                  <input
                    type="number"
                    value={Math.round(selected.y)}
                    onChange={(e) => updateSelected({ y: Number(e.target.value) })}
                    className="w-full mt-1 bg-surface rounded px-2 py-1.5 border border-outline-variant/30 text-xs"
                  />
                </label>
              </div>

              <div className="pt-2">
                <Button variant="destructive" className="w-full text-xs" onClick={deleteSelected}>
                  🗑 Element löschen
                </Button>
              </div>
            </div>
          ) : (
            <div className="text-xs text-on-surface-variant space-y-2">
              <p>Klicken Sie ein Element im Plan an, um es zu verschieben, zu vergrößern oder zu löschen.</p>
              <div className="p-2 rounded bg-surface border border-outline-variant/20 text-[11px]">
                💡 <b>Tipp:</b> Sie können jedes Element direkt mit gedrückter Maustaste im Grundriss greifen und an die gewünschte Stelle ziehen.
              </div>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
