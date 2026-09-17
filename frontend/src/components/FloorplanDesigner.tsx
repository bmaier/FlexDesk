import { useEffect, useMemo, useRef, useState } from "react";
import { api } from "../api/client";
import type { FloorNode, MeetingRoomOut, PropertyOut, PropertyTree, RoomNode } from "../api/types";
import { Badge, Button } from "./ui";
import {
  type FloorplanLayout,
  type FloorplanObject,
  type FloorplanObjectType,
  type SeatingPreset,
  calculateCanvasDimensions,
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
  selectedPropertyId?: number | null;
  onSelectProperty?: (id: number) => void;
  selectedFloorId?: number | null;
  onSelectFloor?: (floorId: number) => void;
  selectedRoomId?: number | null;
  onSelectRoom?: (roomId: number | null) => void;
  scope?: "floor" | "room";
  onScopeChange?: (scope: "floor" | "room") => void;
}

export function FloorplanDesigner({
  structureVersion = 0,
  onStructureChanged,
  selectedPropertyId: propPropertyId,
  onSelectProperty,
  selectedFloorId: propFloorId,
  onSelectFloor,
  selectedRoomId: propRoomId,
  onSelectRoom,
  scope: propScope,
  onScopeChange,
}: FloorplanDesignerProps) {
  const [properties, setProperties] = useState<PropertyOut[]>([]);
  const [propertyId, setPropertyId] = useState<number | null>(propPropertyId ?? null);
  const [tree, setTree] = useState<PropertyTree | null>(null);
  const [floorId, setFloorId] = useState<number | null>(propFloorId ?? null);

  // Scope: "floor" (Etagen-Grundriss) or "room" (Raum-Innenplanung)
  const [scope, setScope] = useState<"floor" | "room">(propScope ?? (propRoomId ? "room" : "floor"));
  const [selectedRoomId, setSelectedRoomId] = useState<number | null>(propRoomId ?? null);

  // Sync mit übergeordnetem FM-Zustand
  useEffect(() => {
    if (propPropertyId !== undefined && propPropertyId !== null && propPropertyId !== propertyId) {
      setPropertyId(propPropertyId);
    }
  }, [propPropertyId]);

  useEffect(() => {
    if (propFloorId !== undefined && propFloorId !== null && propFloorId !== floorId) {
      setFloorId(propFloorId);
    }
  }, [propFloorId]);

  useEffect(() => {
    if (propRoomId !== undefined && propRoomId !== selectedRoomId) {
      setSelectedRoomId(propRoomId);
      if (propRoomId) {
        setScope("room");
      }
    }
  }, [propRoomId]);

  useEffect(() => {
    if (propScope !== undefined && propScope !== scope) {
      setScope(propScope);
    }
  }, [propScope]);

  // Aktives Werkzeug: Default ist "select" (Auswählen / Verschieben)
  const [tool, setTool] = useState<DesignerTool>("select");

  // Layouts
  const [layout, setLayout] = useState<FloorplanLayout>(blankLayout());
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  // Dynamische Canvas-Größe (Auto-Fit an platzierte Elemente oder voreingestellte Mindestgröße)
  const { canvasWidth, canvasHeight } = useMemo(() => {
    return calculateCanvasDimensions(layout);
  }, [layout]);

  // Auto-Save Status: "saved" | "saving" | "unsaved" | "error"
  const [saveStatus, setSaveStatus] = useState<"saved" | "saving" | "unsaved" | "error">("saved");
  const [lastSavedAt, setLastSavedAt] = useState<string | null>(null);
  const isInitialLoadRef = useRef(true);
  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Verhindert, dass Auto-Saves beim Tree-Refresh das eigene Layout überschreiben oder den Fokus/Selektion zerstören
  const lastLoadedTargetRef = useRef<{ scope: string; floorId: number | null; roomId: number | null }>({
    scope,
    floorId,
    roomId: selectedRoomId,
  });
  const lastSavedFloorLayoutRef = useRef<string | null>(null);
  const lastSavedRoomLayoutRef = useRef<string | null>(null);

  // Raum-Auswahl für Platzierung auf der Etage
  const [assignRoomId, setAssignRoomId] = useState<number | null>(null);

  // Desk-Auswahl für Platzierung im Büroraum
  const [assignDeskId, setAssignDeskId] = useState<number | null>(null);

  // Seating Preset für Meetingraum
  const [seatingPreset, setSeatingPreset] = useState<SeatingPreset>("boardroom");

  // Drag & Drop State mit fester Skalierungsbasis während der Mausbewegung
  const [dragState, setDragState] = useState<{
    id: string;
    startClientX: number;
    startClientY: number;
    origX: number;
    origY: number;
    hasMoved: boolean;
    startCanvasWidth: number;
    startCanvasHeight: number;
  } | null>(null);

  const canvasRef = useRef<SVGSVGElement>(null);

  // Lade Liegenschaften & Baum neu, auch reaktiv bei structureVersion-Änderung
  function loadPropertiesAndTree() {
    lastSavedFloorLayoutRef.current = null;
    lastSavedRoomLayoutRef.current = null;
    api.get<PropertyOut[]>("/catalog/properties").then((items) => {
      setProperties(items);
      if (!propertyId && items.length > 0) {
        const initialId = propPropertyId ?? items[0].id;
        setPropertyId(initialId);
        onSelectProperty?.(initialId);
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
        const firstFloorId = allFloors[0]?.id ?? null;
        setFloorId(firstFloorId);
        if (firstFloorId) onSelectFloor?.(firstFloorId);
      }
    });
  }, [propertyId, structureVersion]);

  const floors = tree?.buildings.flatMap((building) => building.floors.map((floor) => ({ ...floor, buildingName: building.name }))) ?? [];
  const floor = floors.find((item) => item.id === floorId) as (FloorNode & { buildingName: string }) | undefined;
  const floorRooms: RoomNode[] = floor?.rooms ?? [];

  const currentRoom = floorRooms.find((r) => r.id === selectedRoomId);
  const currentRoomDesks = currentRoom?.desks ?? [];

  // Refs für aktuellen Scope, Floor und Room (verhindert Race Conditions beim Auto-Save)
  const scopeRef = useRef(scope);
  const floorIdRef = useRef(floorId);
  const selectedRoomIdRef = useRef(selectedRoomId);
  const seatingPresetRef = useRef(seatingPreset);
  const currentRoomRef = useRef(currentRoom);

  useEffect(() => {
    scopeRef.current = scope;
    floorIdRef.current = floorId;
    selectedRoomIdRef.current = selectedRoomId;
    seatingPresetRef.current = seatingPreset;
    currentRoomRef.current = currentRoom;
  }, [scope, floorId, selectedRoomId, seatingPreset, currentRoom]);

  // Unplatzierte Räume auf Etagenebene berechnen
  const unplacedRooms = useMemo(() => {
    if (scope !== "floor") return [];
    const placedRoomIds = new Set(
      layout.objects
        .filter((o) => (o.type === "room" || o.type === "meeting_room") && o.roomId != null)
        .map((o) => o.roomId!)
    );
    return floorRooms.filter((r) => !placedRoomIds.has(r.id));
  }, [scope, floorRooms, layout.objects]);

  // Lade Etagen-Layout bei Wechsel von Etage oder externer Aktualisierung
  useEffect(() => {
    if (scope !== "floor") return;
    if (!floor) return;

    const isNavChange =
      lastLoadedTargetRef.current.scope !== "floor" ||
      lastLoadedTargetRef.current.floorId !== floorId;

    if (isNavChange) {
      lastLoadedTargetRef.current = { scope: "floor", floorId, roomId: null };
      setSelectedId(null);
      isInitialLoadRef.current = true;
      if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    }

    const rawLayout = floor.floorplan_layout;

    // Falls dieses Layout exakt unserem soeben gespeicherten Layout entspricht:
    // NIEMALS State überschreiben und NIEMALS Selektion / Fokus / Detail-Panel zerstören!
    if (!isNavChange && rawLayout && rawLayout === lastSavedFloorLayoutRef.current) {
      return;
    }

    const parsed = parseFloorplanLayout(rawLayout) ?? blankLayout();
    setLayout(parsed);

    // Selektion und Fokus erhalten, falls das selektierte Objekt im Layout weiterhin existiert
    if (isNavChange) {
      setSelectedId(null);
    } else {
      setSelectedId((prev) => (prev && parsed.objects.some((o) => o.id === prev) ? prev : null));
    }

    setTimeout(() => {
      isInitialLoadRef.current = false;
      setSaveStatus("saved");
    }, 250);
  }, [scope, floorId, floor?.floorplan_layout]);

  // Lade Raum-Layout bei Wechsel in den Raum-Detailplan
  useEffect(() => {
    if (scope !== "room" || !selectedRoomId) return;

    const isNavChange =
      lastLoadedTargetRef.current.scope !== "room" ||
      lastLoadedTargetRef.current.roomId !== selectedRoomId;

    if (isNavChange) {
      lastLoadedTargetRef.current = { scope: "room", floorId, roomId: selectedRoomId };
      setSelectedId(null);
      isInitialLoadRef.current = true;
      if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    }

    api
      .get<{ layout: string | null; seating_layout: string | null }>(`/catalog/rooms/${selectedRoomId}/floorplan-layout`)
      .then((res) => {
        if (!isNavChange && res.layout && res.layout === lastSavedRoomLayoutRef.current) {
          return;
        }
        const parsed = parseFloorplanLayout(res.layout);
        if (parsed && parsed.objects.length > 0) {
          setLayout(parsed);
          if (isNavChange) {
            setSelectedId(null);
          } else {
            setSelectedId((prev) => (prev && parsed.objects.some((o) => o.id === prev) ? prev : null));
          }
        } else {
          if (currentRoom?.room_type === "meeting") {
            const cap = currentRoom.capacity || 10;
            const preset = (res.seating_layout as SeatingPreset) || "boardroom";
            setSeatingPreset(preset);
            setLayout({ objects: generateMeetingRoomLayout(cap, preset) });
          } else {
            setLayout({ objects: generateDeskAreaLayout(currentRoomDesks) });
          }
          setSelectedId(null);
        }
        if (res.seating_layout) {
          setSeatingPreset(res.seating_layout as SeatingPreset);
        }
        setTimeout(() => {
          isInitialLoadRef.current = false;
          setSaveStatus("saved");
        }, 250);
      })
      .catch(() => {
        if (currentRoom?.room_type === "meeting") {
          setLayout({ objects: generateMeetingRoomLayout(currentRoom?.capacity || 10, "boardroom") });
        } else {
          setLayout({ objects: generateDeskAreaLayout(currentRoomDesks) });
        }
        setSelectedId(null);
        setTimeout(() => {
          isInitialLoadRef.current = false;
          setSaveStatus("saved");
        }, 250);
      });
  }, [scope, selectedRoomId]);

  // Automatisches Speichern (debounced um 1.2s) bei Layout-Änderungen
  useEffect(() => {
    if (isInitialLoadRef.current) return;
    setSaveStatus("unsaved");
    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);

    saveTimeoutRef.current = setTimeout(() => {
      triggerSave(layout, seatingPreset, false);
    }, 1200);

    return () => {
      if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    };
  }, [layout, seatingPreset]);

  // Warnung vor Verlassen der Seite bei ungespeicherten Daten
  useEffect(() => {
    function handleBeforeUnload(e: BeforeUnloadEvent) {
      if (saveStatus === "unsaved") {
        e.preventDefault();
        e.returnValue = "";
      }
    }
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [saveStatus]);

  async function triggerSave(
    targetLayout = layout,
    targetPreset = seatingPresetRef.current,
    isManual = false
  ) {
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
      saveTimeoutRef.current = null;
    }
    setSaveStatus("saving");
    try {
      const jsonStr = JSON.stringify(targetLayout);
      if (scopeRef.current === "floor") {
        if (!floorIdRef.current) return;
        lastSavedFloorLayoutRef.current = jsonStr;
        await api.put(`/fm/floors/${floorIdRef.current}/floorplan-layout`, {
          layout: jsonStr,
        });
      } else {
        if (!selectedRoomIdRef.current) return;
        lastSavedRoomLayoutRef.current = jsonStr;
        await api.put(`/fm/rooms/${selectedRoomIdRef.current}/floorplan-layout`, {
          layout: jsonStr,
          seating_layout: currentRoomRef.current?.room_type === "meeting" ? targetPreset : null,
        });
      }
      setSaveStatus("saved");
      setLastSavedAt(new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" }));
      if (isManual) {
        setMessage(scopeRef.current === "floor" ? "Etagen-Grundriss erfolgreich gespeichert." : "Raum-Grundriss erfolgreich gespeichert.");
      }
      onStructureChanged?.();
    } catch {
      setSaveStatus("error");
      setMessage("Fehler beim automatischen Speichern des Grundrisses.");
    }
  }

  function quickPlaceRoom(r: RoomNode) {
    const existingRooms = layout.objects.filter((o) => o.type === "room" || o.type === "meeting_room");
    const count = existingRooms.length;
    const col = count % 3;
    const row = Math.floor(count / 3);
    const width = 240;
    const height = 135;
    const x = 30 + col * 270;
    const y = 30 + row * 160;

    const newObj: FloorplanObject = {
      id: crypto.randomUUID(),
      type: "room",
      x,
      y,
      width,
      height,
      roomId: r.id,
      roomType: r.room_type,
      label: `${r.name} (${r.room_number})`,
    };

    setLayout((curr) => ({ ...curr, objects: [...curr.objects, newObj] }));
    setSelectedId(newObj.id);
    setMessage(`Raum „${r.name}” wurde auf dem Grundriss platziert.`);
  }

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

  // Flüssiges Drag & Drop mit dynamischer Arbeitsfläche
  useEffect(() => {
    function handleMouseMove(e: MouseEvent) {
      if (!dragState || !canvasRef.current) return;
      const bounds = canvasRef.current.getBoundingClientRect();
      const scaleX = dragState.startCanvasWidth / bounds.width;
      const scaleY = dragState.startCanvasHeight / bounds.height;
      const deltaX = (e.clientX - dragState.startClientX) * scaleX;
      const deltaY = (e.clientY - dragState.startClientY) * scaleY;

      if (Math.abs(deltaX) > 2 || Math.abs(deltaY) > 2) {
        setDragState((prev) => (prev ? { ...prev, hasMoved: true } : null));
      }

      setLayout((curr) => ({
        ...curr,
        objects: curr.objects.map((obj) => {
          if (obj.id !== dragState.id) return obj;
          const targetX = Math.round((dragState.origX + deltaX) / 5) * 5;
          const targetY = Math.round((dragState.origY + deltaY) / 5) * 5;
          const clampedX = Math.max(14, Math.min(3500, targetX));
          const clampedY = Math.max(14, Math.min(2500, targetY));
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
      startCanvasWidth: canvasWidth,
      startCanvasHeight: canvasHeight,
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
    const scaleX = canvasWidth / bounds.width;
    const scaleY = canvasHeight / bounds.height;
    const clickX = Math.max(15, Math.min(canvasWidth - 25, (event.clientX - bounds.left) * scaleX));
    const clickY = Math.max(15, Math.min(canvasHeight - 25, (event.clientY - bounds.top) * scaleY));

    // Finde Konfiguration des aktiven Werkzeugs
    const allTools = [...FLOOR_TOOLS, ...MEETING_ROOM_TOOLS, ...DESK_ROOM_TOOLS];
    const config = allTools.find((t) => t.type === tool);
    if (!config) return;

    // Spezifische Validierung für Raum-Platzierung auf der Etage
    if (tool === "room" || (tool as string) === "meeting_room") {
      if (scope === "room") {
        setMessage("Räume können nur auf Etagen-Grundrissen platziert werden, nicht innerhalb von Räumen.");
        return;
      }
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
    onSelectRoom?.(roomId);
    onScopeChange?.("room");
    setTool("select");
    setSelectedId(null);
    setMessage(null);
  }

  function handleAutoSeating(preset: SeatingPreset) {
    if (!currentRoom) return;
    const capacity = currentRoom.capacity || 10;
    const generated = generateMeetingRoomLayout(capacity, preset);
    setLayout((curr) => ({ ...curr, objects: generated }));
    setSeatingPreset(preset);
    setSelectedId(null);
    setMessage(`Automatische Bestuhlung für ${capacity} Plätze (${SEATING_PRESETS.find((p) => p.id === preset)?.label}) generiert.`);
  }

  function handleAutoDesks() {
    if (!currentRoom) return;
    const generated = generateDeskAreaLayout(currentRoomDesks);
    setLayout((curr) => ({ ...curr, objects: generated }));
    setSelectedId(null);
    setMessage(`Automatische Desk-Anordnung für ${currentRoomDesks.length} Arbeitsplätze generiert.`);
  }

  function updateSelected(patch: Partial<FloorplanObject>) {
    if (!selectedId) return;
    setLayout((current) => ({
      ...current,
      objects: current.objects.map((item) => {
        if (item.id !== selectedId) return item;
        const updated = { ...item, ...patch };
        if (patch.width !== undefined) updated.width = Math.max(15, patch.width);
        if (patch.height !== undefined) updated.height = Math.max(15, patch.height);
        if (patch.x !== undefined) updated.x = Math.max(12, patch.x);
        if (patch.y !== undefined) updated.y = Math.max(12, patch.y);
        return updated;
      }),
    }));
  }

  function deleteSelected() {
    if (!selectedId) return;
    setLayout((current) => ({ ...current, objects: current.objects.filter((item) => item.id !== selectedId) }));
    setSelectedId(null);
  }

  async function save() {
    await triggerSave(layout, seatingPreset, true);
  }

  const selected = layout.objects.find((item) => item.id === selectedId);

  const selectedRoomNode =
    (selected?.type === "room" || selected?.type === "meeting_room") && selected.roomId != null
      ? floorRooms.find((r) => r.id === selected.roomId)
      : undefined;

  const selectedDeskNode =
    selected?.type === "desk" && selected.deskId != null
      ? currentRoomDesks.find((d) => d.id === selected.deskId) ||
        floorRooms.flatMap((r) => r.desks).find((d) => d.id === selected.deskId)
      : undefined;

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
                  setSelectedRoomId(null);
                  onSelectRoom?.(null);
                  onScopeChange?.("floor");
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

        <div className="flex items-center gap-3">
          {/* Auto-Save Indikator (BITV 2.0 / WCAG 4.1.3 Status Messages) */}
          <div className="text-xs flex items-center gap-1.5 font-medium" role="status" aria-live="polite">
            {saveStatus === "saving" && (
              <span className="text-amber-700 dark:text-amber-400 flex items-center gap-1">
                <span className="animate-spin inline-block">⏳</span> Speichere...
              </span>
            )}
            {saveStatus === "saved" && (
              <span className="text-emerald-700 dark:text-emerald-400 flex items-center gap-1">
                ✓ Automatisch gespeichert {lastSavedAt ? `(${lastSavedAt})` : ""}
              </span>
            )}
            {saveStatus === "unsaved" && (
              <span className="text-amber-800 dark:text-amber-300 flex items-center gap-1">
                <span className="text-[10px]">●</span> Ungespeicherte Änderungen...
              </span>
            )}
            {saveStatus === "error" && (
              <span className="text-destructive flex items-center gap-1">
                ⚠️ Speicherfehler
              </span>
            )}
          </div>

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
          <Button variant="primary" onClick={() => triggerSave(undefined, undefined, true)}>
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
                  const newPropId = Number(e.target.value);
                  setPropertyId(newPropId);
                  onSelectProperty?.(newPropId);
                  setFloorId(null);
                  setSelectedRoomId(null);
                  onSelectRoom?.(null);
                  setScope("floor");
                  onScopeChange?.("floor");
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
                  const newFloorId = Number(e.target.value);
                  setFloorId(newFloorId);
                  onSelectFloor?.(newFloorId);
                  setSelectedRoomId(null);
                  onSelectRoom?.(null);
                  setScope("floor");
                  onScopeChange?.("floor");
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

            <div className="flex flex-wrap items-center gap-2">
              {/* Arbeitsfläche / Canvas-Größe & Auto-Expand Kontrollen */}
              <div className="flex items-center gap-1.5 bg-surface rounded px-2 py-1 border border-outline-variant/30 text-xs shadow-xs">
                <span className="text-on-surface-variant font-medium">📐 Plan-Größe:</span>
                <select
                  value={layout.width && layout.height ? `${layout.width}x${layout.height}` : "auto"}
                  onChange={(e) => {
                    const val = e.target.value;
                    if (val === "auto") {
                      setLayout((curr) => ({ ...curr, width: undefined, height: undefined }));
                    } else {
                      const [w, h] = val.split("x").map(Number);
                      setLayout((curr) => ({ ...curr, width: w, height: h }));
                    }
                  }}
                  className="bg-transparent font-semibold text-on-surface text-xs focus:outline-none"
                  title="Mindestgröße der Arbeitsfläche (passt sich bei vergrößerten Elementen automatisch weiter an)"
                >
                  <option value="auto">Auto-Fit ({canvasWidth} × {canvasHeight} px)</option>
                  <option value="900x500">Standard (900 × 500 px)</option>
                  <option value="1200x650">Groß (1200 × 650 px)</option>
                  <option value="1500x800">Sehr groß (1500 × 800 px)</option>
                  <option value="1800x950">Campus / Großraum (1800 × 950 px)</option>
                </select>
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
          </div>

          {/* Ergonomischer Warnhinweis & 1-Klick-Platzierung für unplatzierte Räume auf der Etage */}
          {scope === "floor" && unplacedRooms.length > 0 && (
            <div className="p-2.5 rounded-md bg-amber-500/10 border border-amber-500/30 text-amber-900 dark:text-amber-200 text-xs space-y-1.5">
              <div className="font-semibold flex items-center gap-1.5">
                <span>⚠️</span>
                <span>
                  {unplacedRooms.length === 1
                    ? "1 Raum dieser Etage ist noch nicht auf dem Grundriss platziert:"
                    : `${unplacedRooms.length} Räume dieser Etage sind noch nicht auf dem Grundriss platziert:`}
                </span>
                <span className="text-[11px] font-normal text-amber-800 dark:text-amber-300">
                  (Unplatzierte Räume erscheinen nicht in der Raum- und Buchungskarte!)
                </span>
              </div>
              <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
                <span className="text-[11px] font-medium text-on-surface-variant">1-Klick Schnellplatzierung:</span>
                {unplacedRooms.map((r) => (
                  <button
                    key={r.id}
                    type="button"
                    onClick={() => quickPlaceRoom(r)}
                    className="px-2 py-0.5 rounded bg-amber-200/80 hover:bg-amber-300 dark:bg-amber-900/60 dark:hover:bg-amber-800 text-amber-950 dark:text-amber-100 font-semibold text-[11px] border border-amber-400/40 flex items-center gap-1 transition-colors"
                    title="Raum direkt auf dem Grundriss platzieren"
                  >
                    <span>➕ {r.room_type === "meeting" ? "🏛" : "💼"} {r.name} ({r.room_number})</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="relative">
            <svg
              ref={canvasRef}
              viewBox={`0 0 ${canvasWidth} ${canvasHeight}`}
              onClick={handleCanvasClick}
              className={`w-full bg-surface rounded-md border border-outline-variant/30 select-none ${
                dragState ? "cursor-grabbing" : tool === "select" ? "cursor-default" : "cursor-crosshair"
              }`}
              aria-label="Grundriss bearbeiten mit dynamisch skalierter Arbeitsfläche und Drag and Drop"
            >
              {/* Raster-Hintergrund */}
              <defs>
                <pattern id="grid" width="20" height="20" patternUnits="userSpaceOnUse">
                  <path d="M 20 0 L 0 0 0 20" fill="none" stroke="#e2e8f0" strokeWidth="0.5" />
                </pattern>
              </defs>
              <rect x={10} y={10} width={canvasWidth - 20} height={canvasHeight - 20} fill="#fbfaf6" stroke="#4f514c" strokeWidth={4} rx={6} />
              <rect x={10} y={10} width={canvasWidth - 20} height={canvasHeight - 20} fill="url(#grid)" />

              {/* Fußzeilen-Titel im SVG */}
              <text x={canvasWidth / 2} y={canvasHeight - 16} fontSize={11} fill="#64748b" textAnchor="middle" fontWeight="500">
                {scope === "floor"
                  ? `🏢 Etagenplan: ${floor?.buildingName || ""} / ${floor?.name || ""} (${layout.objects.filter((o) => o.type === "room" || o.type === "meeting_room").length} platzierte Räume) — Arbeitsfläche ${canvasWidth} × ${canvasHeight} px`
                  : `${currentRoom?.room_type === "meeting" ? "🏛 Meetingraum" : "💼 Bürobereich"}: ${currentRoom?.name || ""} (Raum ${currentRoom?.room_number || ""}) — Arbeitsfläche ${canvasWidth} × ${canvasHeight} px`}
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
          <div className="font-semibold text-sm mb-2">3. Element-Details & Metadaten</div>

          {selected ? (
            <div className="space-y-3">
              <div className="p-2 rounded bg-surface border border-outline-variant/30 flex items-center justify-between">
                <span className="font-bold text-primary">{selected.label || selected.type}</span>
                <span className="text-[10px] text-on-surface-variant font-mono">Typ: {selected.type}</span>
              </div>

              {/* Detail-Metadaten für Räume */}
              {selectedRoomNode && (
                <div className="p-2.5 rounded bg-surface border border-outline-variant/30 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-xs text-on-surface flex items-center gap-1">
                      <span>{selectedRoomNode.room_type === "meeting" ? "🏛️" : "💼"}</span>
                      <span>{selectedRoomNode.name}</span>
                    </span>
                    <Badge tone={selectedRoomNode.room_type === "meeting" ? "neutral" : "positive"}>
                      {selectedRoomNode.room_type === "meeting" ? "Meetingraum" : "Büroraum"}
                    </Badge>
                  </div>

                  <div className="text-[11px] text-on-surface-variant space-y-1">
                    <div>Raumnummer: <b className="text-on-surface">{selectedRoomNode.room_number}</b></div>
                    <div>Kapazität: <b className="text-on-surface">{selectedRoomNode.capacity ?? "—"} Personen</b></div>
                    <div>
                      Genehmigung:{" "}
                      <b className={selectedRoomNode.approval_required ? "text-amber-700 dark:text-amber-300" : "text-emerald-700 dark:text-emerald-300"}>
                        {selectedRoomNode.approval_required ? "Genehmigungspflichtig" : "Direkt buchbar"}
                      </b>
                    </div>
                    <div>
                      Check-in:{" "}
                      <b className="text-on-surface">
                        {selectedRoomNode.checkin_required ? "Erforderlich" : "Nein"}
                      </b>
                    </div>
                    {selectedRoomNode.room_type === "meeting" && (
                      <>
                        <div>
                          Slot-Dauer:{" "}
                          <b className="text-on-surface">
                            {selectedRoomNode.slot_duration_minutes ? `${selectedRoomNode.slot_duration_minutes} Min.` : "Globaler Standard"}
                          </b>
                        </div>
                        <div>
                          Buchungszeiten:{" "}
                          <b className="text-on-surface">
                            {selectedRoomNode.day_start_hour != null && selectedRoomNode.day_end_hour != null
                              ? `${selectedRoomNode.day_start_hour}:00 - ${selectedRoomNode.day_end_hour}:00 Uhr`
                              : "Globale Betriebszeit"}
                          </b>
                        </div>
                      </>
                    )}
                    {selectedRoomNode.restricted_role_code && (
                      <div>
                        Beschränkt auf: <b className="text-amber-700">{selectedRoomNode.restricted_role_code}</b>
                      </div>
                    )}
                  </div>

                  {/* Labels / Ausstattung */}
                  <div className="pt-1.5 border-t border-outline-variant/20">
                    <div className="font-semibold text-[11px] text-on-surface mb-1 flex items-center gap-1">
                      <span>🏷️</span> Ausstattung & Labels:
                    </div>
                    {selectedRoomNode.labels && selectedRoomNode.labels.length > 0 ? (
                      <div className="flex flex-wrap gap-1">
                        {selectedRoomNode.labels.map((l) => (
                          <span
                            key={l}
                            className="px-1.5 py-0.5 rounded bg-primary/10 text-primary text-[10px] font-medium border border-primary/20"
                          >
                            {l}
                          </span>
                        ))}
                      </div>
                    ) : (
                      <span className="text-[10px] text-on-surface-variant italic">Keine Labels hinterlegt</span>
                    )}
                  </div>

                  {scope === "floor" && (
                    <Button
                      variant="primary"
                      className="w-full text-xs mt-1"
                      onClick={() => handleDrillDownToRoom(selectedRoomNode.id)}
                    >
                      🚪 Raum-Innenplan gestalten ↗
                    </Button>
                  )}
                </div>
              )}

              {/* Detail-Metadaten für Desks */}
              {selectedDeskNode && (
                <div className="p-2.5 rounded bg-surface border border-outline-variant/30 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-xs text-on-surface flex items-center gap-1">
                      <span>🖥</span>
                      <span>Desk {selectedDeskNode.desk_number}</span>
                    </span>
                    <Badge tone="positive">Arbeitsplatz</Badge>
                  </div>

                  <div className="text-[11px] text-on-surface-variant space-y-1">
                    <div>
                      Genehmigung:{" "}
                      <b className={selectedDeskNode.approval_required ? "text-amber-700 dark:text-amber-300" : "text-emerald-700 dark:text-emerald-300"}>
                        {selectedDeskNode.approval_required ? "Genehmigungspflichtig" : "Direkt buchbar"}
                      </b>
                    </div>
                    <div>
                      Check-in:{" "}
                      <b className="text-on-surface">
                        {selectedDeskNode.checkin_required ? "Erforderlich" : "Nein"}
                      </b>
                    </div>
                  </div>

                  {/* Labels / Ausstattung */}
                  <div className="pt-1.5 border-t border-outline-variant/20">
                    <div className="font-semibold text-[11px] text-on-surface mb-1 flex items-center gap-1">
                      <span>🏷️</span> Ausstattung:
                    </div>
                    {selectedDeskNode.labels && selectedDeskNode.labels.length > 0 ? (
                      <div className="flex flex-wrap gap-1">
                        {selectedDeskNode.labels.map((l) => (
                          <span
                            key={l}
                            className="px-1.5 py-0.5 rounded bg-secondary/10 text-secondary text-[10px] font-medium border border-secondary/20"
                          >
                            {l}
                          </span>
                        ))}
                      </div>
                    ) : (
                      <span className="text-[10px] text-on-surface-variant italic">Keine Labels hinterlegt</span>
                    )}
                  </div>
                </div>
              )}

              {/* Absprung bei Raum auf der Etage, falls kein RoomNode gefunden (Fallback) */}
              {(selected.type === "room" || selected.type === "meeting_room") && selected.roomId && !selectedRoomNode && (
                <div className="p-2.5 rounded bg-primary/10 border border-primary/30 space-y-2">
                  <div className="font-semibold text-primary">Raum-Innenplanung öffnen</div>
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
                Klicken Sie ein beliebiges Element im Plan an, um seine Metadaten, Labels, Position oder Größe einzusehen und zu bearbeiten.
              </p>
              <div className="p-2.5 rounded bg-surface border border-outline-variant/20 space-y-1.5 text-[11px]">
                <div className="font-bold text-on-surface">💡 Bedienungshinweise:</div>
                <div>• <b>Auswählen & Metadaten:</b> Element anklicken</div>
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
