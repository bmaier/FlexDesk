import { useEffect, useRef, useState } from "react";
import { api } from "../api/client";
import type { FloorNode, MeetingRoomOut, PropertyOut, PropertyTree, RoomNode } from "../api/types";
import { Button } from "./ui";
import {
  type FloorplanLayout,
  type FloorplanObject,
  type FloorplanObjectType,
  type SeatingPreset,
  generateDeskAreaLayout,
  generateMeetingRoomLayout,
  parseFloorplanLayout,
} from "./FloorplanCanvas";

export type DesignerTool = "select" | FloorplanObjectType;

interface ToolConfig {
  type: DesignerTool;
  label: string;
  size: [number, number];
  icon: string;
  description: string;
}

const FLOOR_TOOLS: ToolConfig[] = [
  { type: "room", label: "Raum platzieren", size: [180, 120], icon: "🚪", description: "Raumgrenze aus Stammdaten auf der Etage anlegen" },
  { type: "stairs", label: "Treppenhaus / Aufzug", size: [100, 70], icon: "🪜", description: "Vertikale Erschließung" },
  { type: "door", label: "Tür / Zugang", size: [48, 12], icon: "🚪", description: "Etagen-Zugang / Flurtür" },
  { type: "window", label: "Fenster", size: [70, 10], icon: "🪟", description: "Außenfenster" },
  { type: "blocked", label: "Wand / Sperrzone", size: [100, 30], icon: "⬛", description: "Wand oder nicht nutzbare Zone" },
  { type: "planter", label: "Pflanztrog / Deko", size: [60, 24], icon: "🪴", description: "Begrünung im Flurbereich" },
];

const MEETING_ROOM_TOOLS: ToolConfig[] = [
  { type: "table", label: "Konferenztisch", size: [140, 70], icon: "🪵", description: "Zentraler Besprechungstisch" },
  { type: "chair", label: "Stuhl", size: [24, 24], icon: "🪑", description: "Konferenz- / Besucherstuhl" },
  { type: "whiteboard", label: "Screen / Whiteboard", size: [100, 12], icon: "📺", description: "Präsentationswand oder 85\" Display" },
  { type: "door", label: "Raumtür", size: [44, 12], icon: "🚪", description: "Zimmertür" },
  { type: "window", label: "Fenster", size: [60, 10], icon: "🪟", description: "Außenfenster" },
  { type: "cabinet", label: "Schrank", size: [65, 28], icon: "🗄", description: "Catering- / Materialschaank" },
  { type: "planter", label: "Pflanztrog", size: [50, 22], icon: "🪴", description: "Raumbegrünung" },
];

const DESK_ROOM_TOOLS: ToolConfig[] = [
  { type: "desk", label: "Desk (Arbeitsplatz)", size: [60, 38], icon: "🖥", description: "Buchbarer Schreibtisch aus Stammdaten" },
  { type: "chair", label: "Bürostuhl", size: [24, 24], icon: "🪑", description: "Ergonomischer Drehstuhl" },
  { type: "table", label: "Beistelltisch", size: [90, 50], icon: "🪵", description: "Ablage- oder Besprechungstisch" },
  { type: "cabinet", label: "Schrank / Container", size: [65, 28], icon: "🗄", description: "Rollcontainer oder Aktenschrank" },
  { type: "blocked", label: "Schallschutz / Trennwand", size: [90, 16], icon: "🧱", description: "Akustik-Trennwand" },
  { type: "whiteboard", label: "Team-Whiteboard", size: [90, 12], icon: "📺", description: "Whiteboard für Notizen" },
  { type: "door", label: "Raumtür", size: [44, 12], icon: "🚪", description: "Zimmertür" },
  { type: "window", label: "Fenster", size: [60, 10], icon: "🪟", description: "Außenfenster" },
  { type: "planter", label: "Pflanze", size: [40, 22], icon: "🪴", description: "Raumbegrünung" },
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

export interface FloorplanDesignerProps {
  structureVersion?: number;
  onStructureChanged?: () => void;
  initialPropertyId?: number;
  initialFloorId?: number;
}

export function FloorplanDesigner({ structureVersion = 0 }: FloorplanDesignerProps) {
  const [properties, setProperties] = useState<PropertyOut[]>([]);
  const [propertyId, setPropertyId] = useState<number | null>(null);
  const [tree, setTree] = useState<PropertyTree | null>(null);
  const [floorId, setFloorId] = useState<number | null>(null);

  // Scope: "floor" (Etagen-Grundriss) or "room" (Raum-Innenplanung)
  const [scope, setScope] = useState<"floor" | "room">("floor");
  const [selectedRoomId, setSelectedRoomId] = useState<number | null>(null);

  // Aktives Werkzeug: Default ist "select" (Auswählen / Verschieben)
  const [tool, setTool] = useState<DesignerTool>("select");

  // Layouts
  const [layout, setLayout] = useState<FloorplanLayout>(blankLayout());
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  // Raum-Auswahl für Platzierung auf der Etage
  const [assignRoomId, setAssignRoomId] = useState<number | null>(null);

  // Desk-Auswahl für Platzierung im Büroraum
  const [assignDeskId, setAssignDeskId] = useState<number | null>(null);

  // Seating Preset für Meetingraum
  const [seatingPreset, setSeatingPreset] = useState<SeatingPreset>("boardroom");

  // Drag & Drop State
  const [dragState, setDragState] = useState<{
    id: string;
    startClientX: number;
    startClientY: number;
    origX: number;
    origY: number;
    hasMoved: boolean;
  } | null>(null);

  const canvasRef = useRef<SVGSVGElement>(null);

  // Lade Liegenschaften & Baum neu, auch reaktiv bei structureVersion-Änderung
  function loadPropertiesAndTree() {
    api.get<PropertyOut[]>("/catalog/properties").then((items) => {
      setProperties(items);
      if (!propertyId && items.length > 0) {
        setPropertyId(items[0].id);
      }
    });
  }

  useEffect(() => {
    loadPropertiesAndTree();
  }, [structureVersion]);

  useEffect(() => {
    if (!propertyId) return;
    api.get<PropertyTree>(`/catalog/properties/${propertyId}/tree`).then((data) => {
      setTree(data);
      const allFloors = data.buildings.flatMap((b) => b.floors);
      if (!floorId || !allFloors.some((f) => f.id === floorId)) {
        setFloorId(allFloors[0]?.id ?? null);
      }
    });
  }, [propertyId, structureVersion]);

  const floors = tree?.buildings.flatMap((building) => building.floors.map((floor) => ({ ...floor, buildingName: building.name }))) ?? [];
  const floor = floors.find((item) => item.id === floorId) as (FloorNode & { buildingName: string }) | undefined;
  const floorRooms: RoomNode[] = floor?.rooms ?? [];

  const currentRoom = floorRooms.find((r) => r.id === selectedRoomId);
  const currentRoomDesks = currentRoom?.desks ?? [];

  // Lade Layout bei Wechsel von Etage oder Raum
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
            // Automatische Erstbestuhlung oder Erst-Desklayout je nach Raumtyp
            if (currentRoom?.room_type === "meeting") {
              const cap = currentRoom.capacity || 10;
              const preset = (res.seating_layout as SeatingPreset) || "boardroom";
              setSeatingPreset(preset);
              setLayout({ objects: generateMeetingRoomLayout(cap, preset) });
            } else {
              setLayout({ objects: generateDeskAreaLayout(currentRoomDesks) });
            }
          }
          if (res.seating_layout) {
            setSeatingPreset(res.seating_layout as SeatingPreset);
          }
          setSelectedId(null);
        })
        .catch(() => {
          if (currentRoom?.room_type === "meeting") {
            setLayout({ objects: generateMeetingRoomLayout(currentRoom.capacity || 10, "boardroom") });
          } else {
            setLayout({ objects: generateDeskAreaLayout(currentRoomDesks) });
          }
        });
    }
  }, [scope, floorId, floor?.floorplan_layout, selectedRoomId]);

  // Tastatur-Events: ESC schaltet immer auf "select" zurück, Entf löscht gewähltes Element
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        setTool("select");
      }
      if ((e.key === "Delete" || e.key === "Backspace") && selectedId && !(e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement)) {
        deleteSelected();
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [selectedId]);

  // Flüssiges Drag & Drop mit MouseMove/MouseUp auf Window
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

  function handleObjectClick(e: React.MouseEvent, obj: FloorplanObject) {
    e.stopPropagation();
    setSelectedId(obj.id);
  }

  function handleCanvasClick(event: React.MouseEvent<SVGSVGElement>) {
    // Im "select"-Modus deselektiert ein Klick in freie Fläche einfach
    if (tool === "select") {
      if (!dragState?.hasMoved) {
        setSelectedId(null);
      }
      return;
    }

    if (dragState?.hasMoved) return;
    if (!canvasRef.current) return;
    const bounds = canvasRef.current.getBoundingClientRect();
    const scaleX = 900 / bounds.width;
    const scaleY = 500 / bounds.height;
    const clickX = Math.max(15, Math.min(860, (event.clientX - bounds.left) * scaleX));
    const clickY = Math.max(15, Math.min(460, (event.clientY - bounds.top) * scaleY));

    // Finde Konfiguration des aktiven Werkzeugs
    const allTools = [...FLOOR_TOOLS, ...MEETING_ROOM_TOOLS, ...DESK_ROOM_TOOLS];
    const config = allTools.find((t) => t.type === tool);
    if (!config) return;

    // Spezifische Validierung für Raum-Platzierung auf der Etage
    if (tool === "room") {
      if (!assignRoomId) {
        setMessage("Bitte wählen Sie links zuerst den zuzuordnenden Raum aus.");
        return;
      }
      if (layout.objects.some((o) => (o.type === "room" || o.type === "meeting_room") && o.roomId === assignRoomId)) {
        setMessage("Dieser Raum ist bereits im Grundriss platziert.");
        return;
      }
    }

    // Spezifische Validierung für Desk-Platzierung im Büroraum
    if (tool === "desk") {
      if (!assignDeskId) {
        setMessage("Bitte wählen Sie links zuerst den zuzuordnenden Desk aus.");
        return;
      }
      if (layout.objects.some((o) => o.type === "desk" && o.deskId === assignDeskId)) {
        setMessage("Dieser Desk ist bereits im Raum platziert.");
        return;
      }
    }

    const assignedRoom = floorRooms.find((r) => r.id === assignRoomId);
    const assignedDesk = currentRoomDesks.find((d) => d.id === assignDeskId);
    const chairCount = layout.objects.filter((o) => o.type === "chair").length;

    const newObj: FloorplanObject = {
      id: crypto.randomUUID(),
      type: tool as FloorplanObjectType,
      x: Math.round((clickX - config.size[0] / 2) / 5) * 5,
      y: Math.round((clickY - config.size[1] / 2) / 5) * 5,
      width: config.size[0],
      height: config.size[1],
      deskId: tool === "desk" ? assignDeskId ?? undefined : undefined,
      roomId: tool === "room" ? assignRoomId ?? undefined : undefined,
      roomType: tool === "room" && assignedRoom ? assignedRoom.room_type : undefined,
      label:
        tool === "room"
          ? assignedRoom
            ? `${assignedRoom.name} (${assignedRoom.room_number})`
            : "Raum"
          : tool === "desk"
          ? assignedDesk
            ? assignedDesk.desk_number
            : "Desk"
          : tool === "chair"
          ? `Sitz ${chairCount + 1}`
          : config.label,
    };

    setLayout((curr) => ({ objects: [...curr.objects, newObj] }));
    setSelectedId(newObj.id);
    setMessage(null);

    // Nach dem Platzieren schalten wir automatisch wieder auf "Auswählen & Verschieben"
    setTool("select");
  }

  function handleDrillDownToRoom(roomId: number) {
    setSelectedRoomId(roomId);
    setScope("room");
    setTool("select");
    setSelectedId(null);
    setMessage(null);
  }

  function handleAutoSeating(preset: SeatingPreset) {
    if (!currentRoom) return;
    const capacity = currentRoom.capacity || 10;
    const generated = generateMeetingRoomLayout(capacity, preset);
    setLayout({ objects: generated });
    setSeatingPreset(preset);
    setSelectedId(null);
    setMessage(`Automatische Bestuhlung für ${capacity} Plätze (${SEATING_PRESETS.find((p) => p.id === preset)?.label}) generiert.`);
  }

  function handleAutoDesks() {
    if (!currentRoom) return;
    const generated = generateDeskAreaLayout(currentRoomDesks);
    setLayout({ objects: generated });
    setSelectedId(null);
    setMessage(`Automatische Desk-Anordnung für ${currentRoomDesks.length} Arbeitsplätze generiert.`);
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
        setMessage("Etagen-Grundriss erfolgreich gespeichert. Er ist sofort im Raumplan und in allen Ansichten aktiv.");
      } else {
        if (!selectedRoomId) return;
        await api.put(`/fm/rooms/${selectedRoomId}/floorplan-layout`, {
          layout: JSON.stringify(layout),
          seating_layout: currentRoom?.room_type === "meeting" ? seatingPreset : null,
        });
        setMessage("Raum-Grundriss erfolgreich gespeichert.");
      }
    } catch {
      setMessage("Fehler beim Speichern des Grundrisses.");
    }
  }

  const selected = layout.objects.find((item) => item.id === selectedId);

  return (
    <div className="space-y-4">
      {/* Oberer Breadcrumb & Status-Leiste */}
      <div className="flex flex-wrap items-center justify-between gap-3 p-3 bg-surface-container-low rounded-md border border-outline-variant/30">
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <span className="font-semibold text-on-surface-variant uppercase tracking-wider">Planungsebene:</span>

          {scope === "floor" ? (
            <div className="flex items-center gap-2 font-medium text-sm text-on-surface">
              <span className="px-2.5 py-1 rounded bg-primary text-on-primary font-semibold flex items-center gap-1.5">
                🏢 Etagen-Grundriss: {floor ? `${floor.buildingName} / ${floor.name}` : "Etage wählen"}
              </span>
              <span className="text-xs text-on-surface-variant">
                (Hier planen Sie Raumgrenzen, Treppen, Zugänge und Fenster der Etage)
              </span>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  setScope("floor");
                  setTool("select");
                  setSelectedId(null);
                }}
                className="px-3 py-1 rounded text-xs font-semibold bg-surface hover:bg-surface-container border border-outline-variant/30 text-on-surface flex items-center gap-1"
              >
                ← Zurück zur Etage ({floor?.buildingName} / {floor?.name})
              </button>
              <span className="text-on-surface-variant font-bold">/</span>
              <span className="px-2.5 py-1 rounded bg-primary text-on-primary font-semibold text-sm flex items-center gap-1.5">
                {currentRoom?.room_type === "meeting" ? "🏛" : "💼"} Raum-Detailplan: {currentRoom ? `${currentRoom.name} (Raum ${currentRoom.room_number})` : "Raum wählen"}
              </span>
            </div>
          )}
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="secondary"
            onClick={() => {
              loadPropertiesAndTree();
              setMessage("Liegenschaften und Räume frisch aktualisiert.");
            }}
            title="Daten ohne Browser-Refresh neu laden"
          >
            🔄 Aktualisieren
          </Button>
          <Button variant="primary" onClick={save}>
            💾 {scope === "floor" ? "Etagen-Plan" : "Raum-Plan"} speichern
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-[290px_1fr_260px] gap-4">
        {/* Linke Leiste: Navigation, Werkzeuge & Presets */}
        <section className="bg-surface-container-low rounded-md p-3 border border-outline-variant/30 space-y-4 text-xs">
          {/* 1. Liegenschafts- & Etagen-Auswahl */}
          <div className="space-y-2">
            <div className="font-semibold text-sm">1. Standort & Etage</div>
            <label className="block">
              Liegenschaft
              <select
                value={propertyId ?? ""}
                onChange={(e) => {
                  setPropertyId(Number(e.target.value));
                  setFloorId(null);
                  setSelectedRoomId(null);
                  setScope("floor");
                }}
                className="w-full mt-1 bg-surface rounded px-2 py-1.5 border border-outline-variant/30 text-sm"
              >
                {properties.map((property) => (
                  <option key={property.id} value={property.id}>
                    {property.name}
                  </option>
                ))}
              </select>
            </label>

            <label className="block">
              Gebäude / Etage
              <select
                value={floorId ?? ""}
                onChange={(e) => {
                  setFloorId(Number(e.target.value));
                  setSelectedRoomId(null);
                  setScope("floor");
                }}
                className="w-full mt-1 bg-surface rounded px-2 py-1.5 border border-outline-variant/30 text-sm"
              >
                {floors.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.buildingName} / {item.name}
                  </option>
                ))}
              </select>
            </label>
          </div>

          {/* 2. Werkzeug-Auswahl */}
          <div className="pt-2 border-t border-outline-variant/30 space-y-3">
            <div className="font-semibold text-sm">2. Werkzeuge</div>

            {/* Prominenter "Auswählen & Verschieben"-Modus */}
            <button
              type="button"
              onClick={() => setTool("select")}
              className={`w-full p-2.5 rounded text-left transition-all border flex items-center justify-between ${
                tool === "select"
                  ? "bg-primary text-on-primary border-primary shadow-sm font-semibold"
                  : "bg-surface hover:bg-surface-container border-outline-variant/30 text-on-surface"
              }`}
            >
              <div className="flex items-center gap-2">
                <span className="text-base">👆</span>
                <div>
                  <div className="font-bold">Auswählen & Verschieben</div>
                  <div className={`text-[10px] ${tool === "select" ? "text-on-primary/80" : "text-on-surface-variant"}`}>
                    Element anklicken & per Drag & Drop ziehen
                  </div>
                </div>
              </div>
              {tool === "select" && <span className="text-xs">✓ Aktiv</span>}
            </button>

            {/* EBENE: ETAGEN-WERKZEUGE */}
            {scope === "floor" && (
              <div className="space-y-2.5 pt-1">
                <div className="font-semibold text-on-surface-variant uppercase tracking-wider text-[11px]">
                  Räume auf dieser Etage platzieren
                </div>
                <label className="block">
                  Raum auswählen:
                  <select
                    value={assignRoomId ?? ""}
                    onChange={(e) => setAssignRoomId(e.target.value ? Number(e.target.value) : null)}
                    className="w-full mt-1 bg-surface rounded px-2 py-1.5 border border-outline-variant/30 text-xs"
                  >
                    <option value="">Raum wählen…</option>
                    {floorRooms.map((r) => (
                      <option key={r.id} value={r.id}>
                        {r.room_type === "meeting" ? "🏛" : "💼"} {r.name} ({r.room_number}) · {r.room_type === "meeting" ? `max. ${r.capacity ?? "—"} P.` : `${r.desks.length} Desks`}
                      </option>
                    ))}
                  </select>
                </label>

                <button
                  type="button"
                  onClick={() => setTool("room")}
                  disabled={!assignRoomId}
                  className={`w-full p-2 rounded text-left transition-colors border ${
                    tool === "room"
                      ? "bg-primary text-on-primary border-primary font-medium"
                      : assignRoomId
                      ? "bg-surface hover:bg-surface-container border-outline-variant/30 text-on-surface"
                      : "opacity-50 cursor-not-allowed bg-surface border-outline-variant/20"
                  }`}
                >
                  <div className="font-semibold">🚪 Gewählten Raum auf Etage platzieren</div>
                  <div className="text-[10px] text-on-surface-variant line-clamp-1">
                    Klick auf Grundriss platziert die Raumfläche
                  </div>
                </button>

                <div className="font-semibold text-on-surface-variant uppercase tracking-wider text-[11px] pt-2">
                  Architektur & Erschließung
                </div>
                <div className="grid grid-cols-2 gap-1.5">
                  {FLOOR_TOOLS.filter((t) => t.type !== "room").map((item) => (
                    <button
                      key={item.type}
                      type="button"
                      onClick={() => setTool(item.type)}
                      className={`p-2 rounded text-left transition-colors border ${
                        tool === item.type
                          ? "bg-primary text-on-primary border-primary font-medium"
                          : "bg-surface hover:bg-surface-container border-outline-variant/30"
                      }`}
                    >
                      <div className="font-semibold">{item.icon} {item.label}</div>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* EBENE: RAUM-WERKZEUGE (MEETINGRAUM) */}
            {scope === "room" && currentRoom?.room_type === "meeting" && (
              <div className="space-y-3 pt-1">
                <div className="p-2 rounded bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-800 text-[11px] text-blue-900 dark:text-blue-200 space-y-1">
                  <div className="font-bold flex items-center gap-1">🏛 Meetingraum: {currentRoom.name}</div>
                  <div>Kapazität: <b>{currentRoom.capacity ?? 10} Personen</b></div>
                </div>

                <div className="font-semibold text-on-surface-variant uppercase tracking-wider text-[11px]">
                  Automatische Bestuhlungs-Vorlagen
                </div>
                <div className="space-y-1">
                  {SEATING_PRESETS.map((preset) => (
                    <button
                      key={preset.id}
                      type="button"
                      onClick={() => handleAutoSeating(preset.id)}
                      className={`w-full text-left p-2 rounded transition-colors border ${
                        seatingPreset === preset.id
                          ? "bg-primary/10 border-primary text-primary font-medium"
                          : "bg-surface border-outline-variant/30 hover:bg-surface-container"
                      }`}
                    >
                      <div className="font-semibold">{preset.label}</div>
                      <div className="text-[10px] text-on-surface-variant">{preset.desc}</div>
                    </button>
                  ))}
                </div>

                <div className="font-semibold text-on-surface-variant uppercase tracking-wider text-[11px] pt-1">
                  Möbel einzeln hinzufügen
                </div>
                <div className="grid grid-cols-2 gap-1.5">
                  {MEETING_ROOM_TOOLS.map((item) => (
                    <button
                      key={item.type}
                      type="button"
                      onClick={() => setTool(item.type)}
                      className={`p-2 rounded text-left transition-colors border ${
                        tool === item.type
                          ? "bg-primary text-on-primary border-primary font-medium"
                          : "bg-surface hover:bg-surface-container border-outline-variant/30"
                      }`}
                    >
                      <div className="font-semibold">{item.icon} {item.label}</div>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* EBENE: RAUM-WERKZEUGE (BÜRORAUM / DESK-BEREICH) */}
            {scope === "room" && currentRoom?.room_type === "desk_area" && (
              <div className="space-y-3 pt-1">
                <div className="p-2 rounded bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 text-[11px] text-amber-900 dark:text-amber-200 space-y-1">
                  <div className="font-bold flex items-center gap-1">💼 Büroraum: {currentRoom.name}</div>
                  <div>Zugeordnete Desks: <b>{currentRoomDesks.length} Desks</b></div>
                </div>

                <Button variant="accent" className="w-full text-xs" onClick={handleAutoDesks}>
                  🤖 Alle {currentRoomDesks.length} Desks automatisch anordnen
                </Button>

                <div className="font-semibold text-on-surface-variant uppercase tracking-wider text-[11px] pt-1">
                  Einzelne Desks platzieren
                </div>
                <label className="block">
                  Desk verbinden:
                  <select
                    value={assignDeskId ?? ""}
                    onChange={(e) => setAssignDeskId(e.target.value ? Number(e.target.value) : null)}
                    className="w-full mt-1 bg-surface rounded px-2 py-1.5 border border-outline-variant/30 text-xs"
                  >
                    <option value="">Desk wählen…</option>
                    {currentRoomDesks.map((d) => (
                      <option key={d.id} value={d.id}>
                        {d.desk_number} {layout.objects.some((o) => o.deskId === d.id) ? "(bereits im Plan)" : ""}
                      </option>
                    ))}
                  </select>
                </label>

                <button
                  type="button"
                  onClick={() => setTool("desk")}
                  disabled={!assignDeskId}
                  className={`w-full p-2 rounded text-left transition-colors border ${
                    tool === "desk"
                      ? "bg-primary text-on-primary border-primary font-medium"
                      : assignDeskId
                      ? "bg-surface hover:bg-surface-container border-outline-variant/30 text-on-surface"
                      : "opacity-50 cursor-not-allowed bg-surface border-outline-variant/20"
                  }`}
                >
                  <div className="font-semibold">🖥 Gewählten Desk platzieren</div>
                </button>

                <div className="font-semibold text-on-surface-variant uppercase tracking-wider text-[11px] pt-1">
                  Büromöbel hinzufügen
                </div>
                <div className="grid grid-cols-2 gap-1.5">
                  {DESK_ROOM_TOOLS.filter((t) => t.type !== "desk").map((item) => (
                    <button
                      key={item.type}
                      type="button"
                      onClick={() => setTool(item.type)}
                      className={`p-2 rounded text-left transition-colors border ${
                        tool === item.type
                          ? "bg-primary text-on-primary border-primary font-medium"
                          : "bg-surface hover:bg-surface-container border-outline-variant/30"
                      }`}
                    >
                      <div className="font-semibold">{item.icon} {item.label}</div>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </section>

        {/* Mittlerer Bereich: Interaktiver SVG Canvas mit Drag & Drop */}
        <section className="space-y-2">
          <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
            <div>
              <div className="font-bold text-sm text-on-surface">
                {scope === "floor"
                  ? `Etage: ${floor ? `${floor.buildingName} / ${floor.name}` : "Keine Etage ausgewählt"}`
                  : `Raum: ${currentRoom?.name} (${currentRoom?.room_number})`}
              </div>
              <div className="text-on-surface-variant flex items-center gap-2">
                <span>Aktiver Modus: <b>{tool === "select" ? "👆 Auswählen & Verschieben" : `➕ ${tool} platzieren`}</b></span>
                <span>•</span>
                <span>Objekte: {layout.objects.length}</span>
                {tool !== "select" && (
                  <button type="button" onClick={() => setTool("select")} className="ml-2 font-semibold text-primary underline">
                    (ESC für Auswählen)
                  </button>
                )}
              </div>
            </div>

            {scope === "floor" && floorRooms.length > 0 && (
              <div className="flex items-center gap-1.5">
                <span className="text-on-surface-variant">Direkt zu Raum:</span>
                <select
                  value=""
                  onChange={(e) => {
                    if (e.target.value) handleDrillDownToRoom(Number(e.target.value));
                  }}
                  className="bg-surface rounded px-2 py-1 border border-outline-variant/30 text-xs"
                >
                  <option value="">Raum-Detailplan öffnen…</option>
                  {floorRooms.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.room_type === "meeting" ? "🏛" : "💼"} {r.name} ({r.room_number})
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>

          <div className="relative">
            <svg
              ref={canvasRef}
              viewBox="0 0 900 500"
              onClick={handleCanvasClick}
              className={`w-full bg-surface rounded-md border border-outline-variant/30 select-none ${
                dragState ? "cursor-grabbing" : tool === "select" ? "cursor-default" : "cursor-crosshair"
              }`}
              aria-label="Grundriss bearbeiten mit Auswahl und Drag and Drop"
            >
              {/* Raster-Hintergrund */}
              <defs>
                <pattern id="grid" width="20" height="20" patternUnits="userSpaceOnUse">
                  <path d="M 20 0 L 0 0 0 20" fill="none" stroke="#e2e8f0" strokeWidth="0.5" />
                </pattern>
              </defs>
              <rect x={10} y={10} width={880} height={480} fill="#fbfaf6" stroke="#4f514c" strokeWidth={4} />
              <rect x={10} y={10} width={880} height={480} fill="url(#grid)" />

              {/* Fußzeilen-Titel im SVG */}
              <text x={450} y={482} fontSize={11} fill="#64748b" textAnchor="middle" fontWeight="500">
                {scope === "floor"
                  ? `🏢 Etagenplan: ${floor?.buildingName || ""} / ${floor?.name || ""} (${layout.objects.filter((o) => o.type === "room" || o.type === "meeting_room").length} platzierte Räume)`
                  : `${currentRoom?.room_type === "meeting" ? "🏛 Meetingraum" : "💼 Bürobereich"}: ${currentRoom?.name || ""} (Raum ${currentRoom?.room_number || ""})`}
              </text>

              {/* Alle platzierten Objekte */}
              {layout.objects.map((object) => {
                const isSelected = selectedId === object.id;
                const isDragging = dragState?.id === object.id;

                // STUHL
                if (object.type === "chair") {
                  return (
                    <g
                      key={object.id}
                      onMouseDown={(e) => handleObjectMouseDown(e, object)}
                      onClick={(e) => handleObjectClick(e, object)}
                      className="cursor-grab active:cursor-grabbing"
                    >
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

                // TREPPENHAUS / AUFZUG
                if (object.type === "stairs") {
                  return (
                    <g
                      key={object.id}
                      onMouseDown={(e) => handleObjectMouseDown(e, object)}
                      onClick={(e) => handleObjectClick(e, object)}
                      className="cursor-grab active:cursor-grabbing"
                    >
                      <rect
                        x={object.x}
                        y={object.y}
                        width={object.width}
                        height={object.height}
                        rx={2}
                        fill={isSelected ? "#fef3c7" : "#f1f5f9"}
                        stroke={isSelected ? "#d97706" : "#64748b"}
                        strokeWidth={isSelected ? 3 : 2}
                      />
                      {Array.from({ length: Math.max(2, Math.floor(object.height / 10)) }).map((_, i) => (
                        <line
                          key={i}
                          x1={object.x}
                          y1={object.y + (i + 1) * 10}
                          x2={object.x + object.width}
                          y2={object.y + (i + 1) * 10}
                          stroke="#94a3b8"
                          strokeWidth={1}
                          strokeDasharray="2,2"
                        />
                      ))}
                      <text
                        x={object.x + object.width / 2}
                        y={object.y + object.height / 2 + 4}
                        fontSize={10}
                        fontWeight="bold"
                        textAnchor="middle"
                        fill="#475569"
                        className="pointer-events-none select-none"
                      >
                        🪜 {object.label || "Treppenhaus"}
                      </text>
                    </g>
                  );
                }

                // RAUM AUF DER ETAGE
                if (object.type === "room" || object.type === "meeting_room") {
                  const isMeeting = object.type === "meeting_room" || object.roomType === "meeting";
                  return (
                    <g
                      key={object.id}
                      onMouseDown={(e) => handleObjectMouseDown(e, object)}
                      onClick={(e) => handleObjectClick(e, object)}
                      onDoubleClick={() => object.roomId && handleDrillDownToRoom(object.roomId)}
                      className="cursor-grab active:cursor-grabbing group"
                    >
                      {/* Raumumriss */}
                      <rect
                        x={object.x}
                        y={object.y}
                        width={object.width}
                        height={object.height}
                        rx={6}
                        fill={isSelected ? (isMeeting ? "#bfdbfe" : "#e2e8f0") : isMeeting ? "#e0f2fe" : "#f8fafc"}
                        stroke={isSelected ? "#16a34a" : isDragging ? "#2563eb" : isMeeting ? "#0284c7" : "#475569"}
                        strokeWidth={isSelected ? 3 : 2}
                      />

                      {/* Header-Balken im Raum */}
                      <rect
                        x={object.x}
                        y={object.y}
                        width={object.width}
                        height={24}
                        rx={6}
                        fill={isMeeting ? "#0284c7" : "#475569"}
                      />

                      <text
                        x={object.x + 8}
                        y={object.y + 16}
                        fontSize={11}
                        fontWeight="bold"
                        fill="#ffffff"
                        className="pointer-events-none select-none"
                      >
                        {isMeeting ? "🏛" : "💼"} {object.label}
                      </text>

                      {/* Raum-Details im Innenraum */}
                      {object.height >= 60 && (
                        <text
                          x={object.x + object.width / 2}
                          y={object.y + object.height / 2 + 6}
                          fontSize={11}
                          textAnchor="middle"
                          fill="#334155"
                          className="pointer-events-none select-none font-medium"
                        >
                          {object.roomId ? "Doppelklick zum Gestalten" : "Freie Raumfläche"}
                        </text>
                      )}

                      {/* Button im Raum um direkt in den Detailplan zu springen */}
                      {object.roomId && object.width >= 120 && object.height >= 70 && (
                        <g
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDrillDownToRoom(object.roomId!);
                          }}
                          className="cursor-pointer"
                        >
                          <rect
                            x={object.x + object.width / 2 - 45}
                            y={object.y + object.height - 24}
                            width={90}
                            height={18}
                            rx={3}
                            fill="#ffffff"
                            stroke={isMeeting ? "#0284c7" : "#475569"}
                            strokeWidth={1}
                          />
                          <text
                            x={object.x + object.width / 2}
                            y={object.y + object.height - 11}
                            fontSize={9.5}
                            fontWeight="bold"
                            textAnchor="middle"
                            fill={isMeeting ? "#0284c7" : "#475569"}
                          >
                            Einrichten ↗
                          </text>
                        </g>
                      )}
                    </g>
                  );
                }

                // STANDARD-OBJEKTE (Tische, Desks, Fenster, Türen, Schränke, Wände)
                return (
                  <g
                    key={object.id}
                    onMouseDown={(e) => handleObjectMouseDown(e, object)}
                    onClick={(e) => handleObjectClick(e, object)}
                    className="cursor-grab active:cursor-grabbing"
                  >
                    <rect
                      x={object.x}
                      y={object.y}
                      width={object.width}
                      height={object.height}
                      rx={object.type === "desk" ? 4 : object.type === "table" ? 4 : 3}
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
                          : "#cbb99d"
                      }
                      stroke={isSelected ? "#16a34a" : isDragging ? "#2563eb" : "#4f514c"}
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

                    <text
                      x={object.x + object.width / 2}
                      y={object.y + object.height / 2 + 4}
                      fontSize={11}
                      textAnchor="middle"
                      fill="#1e293b"
                      className="pointer-events-none select-none font-medium"
                    >
                      {object.type === "desk" ? `🖥 ${object.label}` : object.label}
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

        {/* Rechte Leiste: Element-Eigenschaften & Navigation */}
        <section className="bg-surface-container-low rounded-md p-3 border border-outline-variant/30 text-xs">
          <div className="font-semibold text-sm mb-2">3. Element-Details</div>

          {selected ? (
            <div className="space-y-3">
              <div className="p-2 rounded bg-surface border border-outline-variant/30 flex items-center justify-between">
                <span className="font-bold text-primary">{selected.label || selected.type}</span>
                <span className="text-[10px] text-on-surface-variant font-mono">Typ: {selected.type}</span>
              </div>

              {/* Absprung bei Raum auf der Etage */}
              {(selected.type === "room" || selected.type === "meeting_room") && selected.roomId && (
                <div className="p-2.5 rounded bg-primary/10 border border-primary/30 space-y-2">
                  <div className="font-semibold text-primary">Raum-Innenplanung öffnen</div>
                  <p className="text-[11px] text-on-surface-variant leading-relaxed">
                    Wechseln Sie in die Innenansicht dieses Raumes, um Tische, Stühle oder Desks zu konfigurieren.
                  </p>
                  <Button
                    variant="primary"
                    className="w-full text-xs"
                    onClick={() => handleDrillDownToRoom(selected.roomId!)}
                  >
                    🚪 Raum-Innenplan gestalten ↗
                  </Button>
                </div>
              )}

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

              <div className="pt-2 border-t border-outline-variant/30">
                <Button variant="destructive" className="w-full text-xs" onClick={deleteSelected}>
                  🗑 Element löschen
                </Button>
              </div>
            </div>
          ) : (
            <div className="text-on-surface-variant space-y-2.5">
              <p>
                Klicken Sie ein beliebiges Element im Plan an, um seine Position oder Größe zu ändern bzw. es zu löschen.
              </p>
              <div className="p-2.5 rounded bg-surface border border-outline-variant/20 space-y-1.5 text-[11px]">
                <div className="font-bold text-on-surface">💡 Bedienungshinweise:</div>
                <div>• <b>Auswählen:</b> Element anklicken</div>
                <div>• <b>Verschieben:</b> Mit gedrückter Maustaste ziehen</div>
                <div>• <b>Raum gestalten:</b> Raum auf Etage anklicken & „Raum-Innenplan gestalten“ wählen</div>
                <div>• <b>Löschen:</b> Element wählen und Entf drücken</div>
              </div>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
