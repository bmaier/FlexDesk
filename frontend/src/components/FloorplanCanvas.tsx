import type { FloorDeskStatus, MeetingRoomOut } from "../api/types";

export type FloorplanObjectType =
  | "door"
  | "window"
  | "table"
  | "chair"
  | "cabinet"
  | "planter"
  | "whiteboard"
  | "blocked"
  | "desk"
  | "meeting_room"
  | "room"
  | "stairs";

export interface FloorplanObject {
  id: string;
  type: FloorplanObjectType;
  x: number;
  y: number;
  width: number;
  height: number;
  label?: string;
  deskId?: number;
  roomId?: number;
  roomType?: "meeting" | "desk_area";
}

export interface FloorplanLayout {
  objects: FloorplanObject[];
}

export function parseFloorplanLayout(value: string | null | undefined): FloorplanLayout | null {
  if (!value) return null;
  try {
    const candidate = JSON.parse(value) as FloorplanLayout;
    return Array.isArray(candidate.objects) ? candidate : null;
  } catch {
    return null;
  }
}

export type SeatingPreset = "boardroom" | "u_shape" | "cinema" | "classroom" | "banquet";

export function generateMeetingRoomLayout(
  capacity: number,
  seatingPreset: SeatingPreset | string = "boardroom",
  canvasWidth = 860,
  canvasHeight = 460
): FloorplanObject[] {
  const objects: FloorplanObject[] = [];
  const cx = canvasWidth / 2;
  const cy = canvasHeight / 2 + 15;
  const count = Math.max(2, capacity);

  // Wandelemente: Whiteboard / Präsentationswand oben
  objects.push({
    id: crypto.randomUUID(),
    type: "whiteboard",
    x: cx - 80,
    y: 20,
    width: 160,
    height: 12,
    label: "Präsentationswand / 85\" Screen",
  });

  // Raumtür
  objects.push({
    id: crypto.randomUUID(),
    type: "door",
    x: 35,
    y: 20,
    width: 44,
    height: 12,
    label: "Eingangstür",
  });

  if (seatingPreset === "boardroom" || seatingPreset === "conference") {
    // Zentraler Konferenztisch mit Stühlen rundherum
    const sideChairs = Math.max(1, Math.floor((count - 2) / 2));
    const tableW = Math.min(640, Math.max(180, sideChairs * 48 + 50));
    const tableH = 110;
    const tx = cx - tableW / 2;
    const ty = cy - tableH / 2;

    objects.push({
      id: crypto.randomUUID(),
      type: "table",
      x: tx,
      y: ty,
      width: tableW,
      height: tableH,
      label: "Konferenztisch",
    });

    let placed = 0;
    // Oben
    const stepTop = tableW / (sideChairs + 1);
    for (let i = 1; i <= sideChairs && placed < count; i++) {
      objects.push({
        id: crypto.randomUUID(),
        type: "chair",
        x: tx + i * stepTop - 12,
        y: ty - 26,
        width: 24,
        height: 24,
        label: `Sitz ${placed + 1}`,
      });
      placed++;
    }
    // Unten
    const stepBottom = tableW / (sideChairs + 1);
    for (let i = 1; i <= sideChairs && placed < count; i++) {
      objects.push({
        id: crypto.randomUUID(),
        type: "chair",
        x: tx + i * stepBottom - 12,
        y: ty + tableH + 4,
        width: 24,
        height: 24,
        label: `Sitz ${placed + 1}`,
      });
      placed++;
    }
    // Stirnseite links
    if (placed < count) {
      objects.push({
        id: crypto.randomUUID(),
        type: "chair",
        x: tx - 28,
        y: cy - 12,
        width: 24,
        height: 24,
        label: `Sitz ${placed + 1}`,
      });
      placed++;
    }
    // Stirnseite rechts
    if (placed < count) {
      objects.push({
        id: crypto.randomUUID(),
        type: "chair",
        x: tx + tableW + 4,
        y: cy - 12,
        width: 24,
        height: 24,
        label: `Sitz ${placed + 1}`,
      });
      placed++;
    }
    // Eventuelle Restplätze
    while (placed < count) {
      objects.push({
        id: crypto.randomUUID(),
        type: "chair",
        x: tx + ((placed % sideChairs) + 1) * stepTop - 12,
        y: ty - 26,
        width: 24,
        height: 24,
        label: `Sitz ${placed + 1}`,
      });
      placed++;
    }
  } else if (seatingPreset === "u_shape") {
    const legLen = 220;
    const baseLen = 380;
    const uLeft = cx - baseLen / 2;
    const uTop = 85;

    // Tisch links
    objects.push({
      id: crypto.randomUUID(),
      type: "table",
      x: uLeft,
      y: uTop,
      width: 55,
      height: legLen,
      label: "Tisch links",
    });
    // Tisch mitte/unten
    objects.push({
      id: crypto.randomUUID(),
      type: "table",
      x: uLeft,
      y: uTop + legLen,
      width: baseLen,
      height: 55,
      label: "Tisch mitte",
    });
    // Tisch rechts
    objects.push({
      id: crypto.randomUUID(),
      type: "table",
      x: uLeft + baseLen - 55,
      y: uTop,
      width: 55,
      height: legLen,
      label: "Tisch rechts",
    });

    const sideCount = Math.max(1, Math.floor(count / 3));
    let placed = 0;
    // Stühle links außen
    for (let i = 0; i < sideCount && placed < count; i++) {
      objects.push({
        id: crypto.randomUUID(),
        type: "chair",
        x: uLeft - 28,
        y: uTop + 15 + i * (legLen / Math.max(1, sideCount)),
        width: 24,
        height: 24,
        label: `Sitz ${placed + 1}`,
      });
      placed++;
    }
    // Stühle unten außen
    const bottomCount = Math.max(1, count - sideCount * 2);
    for (let i = 0; i < bottomCount && placed < count; i++) {
      objects.push({
        id: crypto.randomUUID(),
        type: "chair",
        x: uLeft + 35 + i * ((baseLen - 70) / Math.max(1, bottomCount)),
        y: uTop + legLen + 59,
        width: 24,
        height: 24,
        label: `Sitz ${placed + 1}`,
      });
      placed++;
    }
    // Stühle rechts außen
    while (placed < count) {
      const idx = placed - sideCount - bottomCount;
      objects.push({
        id: crypto.randomUUID(),
        type: "chair",
        x: uLeft + baseLen + 4,
        y: uTop + 15 + idx * (legLen / Math.max(1, sideCount)),
        width: 24,
        height: 24,
        label: `Sitz ${placed + 1}`,
      });
      placed++;
    }
  } else if (seatingPreset === "cinema" || seatingPreset === "theater") {
    // Kino: Nur Stuhlreihen mit Mittelgang
    const chairsPerRow = Math.min(10, Math.max(4, Math.ceil(Math.sqrt(count * 1.5))));
    const perSide = Math.ceil(chairsPerRow / 2);
    const aisleWidth = 55;
    const startY = 85;
    const chairGapX = 32;
    const chairGapY = 36;

    let placed = 0;
    let row = 0;
    while (placed < count) {
      // Links
      for (let col = 0; col < perSide && placed < count; col++) {
        objects.push({
          id: crypto.randomUUID(),
          type: "chair",
          x: cx - aisleWidth / 2 - (perSide - col) * chairGapX,
          y: startY + row * chairGapY,
          width: 24,
          height: 24,
          label: `R${row + 1}-P${placed + 1}`,
        });
        placed++;
      }
      // Rechts
      for (let col = 0; col < perSide && placed < count; col++) {
        objects.push({
          id: crypto.randomUUID(),
          type: "chair",
          x: cx + aisleWidth / 2 + col * chairGapX,
          y: startY + row * chairGapY,
          width: 24,
          height: 24,
          label: `R${row + 1}-P${placed + 1}`,
        });
        placed++;
      }
      row++;
    }
  } else if (seatingPreset === "classroom" || seatingPreset === "parliament") {
    // Schulung: Tische mit Stühlen dahinter
    const tablesPerRow = 2;
    const chairsPerTable = 2;
    const chairsPerRow = tablesPerRow * chairsPerTable;
    const rows = Math.ceil(count / chairsPerRow);
    const aisleW = 60;
    const tableW = 145;
    const tableH = 45;
    const rowGap = 75;
    const startY = 85;

    let placed = 0;
    for (let r = 0; r < rows && placed < count; r++) {
      const curY = startY + r * rowGap;
      // Tisch links
      objects.push({
        id: crypto.randomUUID(),
        type: "table",
        x: cx - aisleW / 2 - tableW,
        y: curY,
        width: tableW,
        height: tableH,
        label: `Tisch ${r + 1}L`,
      });
      for (let c = 0; c < chairsPerTable && placed < count; c++) {
        objects.push({
          id: crypto.randomUUID(),
          type: "chair",
          x: cx - aisleW / 2 - tableW + 20 + c * 55,
          y: curY + tableH + 4,
          width: 24,
          height: 24,
          label: `Sitz ${placed + 1}`,
        });
        placed++;
      }

      // Tisch rechts
      objects.push({
        id: crypto.randomUUID(),
        type: "table",
        x: cx + aisleW / 2,
        y: curY,
        width: tableW,
        height: tableH,
        label: `Tisch ${r + 1}R`,
      });
      for (let c = 0; c < chairsPerTable && placed < count; c++) {
        objects.push({
          id: crypto.randomUUID(),
          type: "chair",
          x: cx + aisleW / 2 + 20 + c * 55,
          y: curY + tableH + 4,
          width: 24,
          height: 24,
          label: `Sitz ${placed + 1}`,
        });
        placed++;
      }
    }
  } else {
    // Gruppentische (Banquet)
    const tableCount = Math.max(2, Math.ceil(count / 5));
    const cols = Math.min(3, tableCount);
    const rows = Math.ceil(tableCount / cols);
    const cellW = (canvasWidth - 100) / cols;
    const cellH = (canvasHeight - 120) / rows;
    let placed = 0;

    for (let t = 0; t < tableCount; t++) {
      const c = t % cols;
      const r = Math.floor(t / cols);
      const tcx = 70 + c * cellW + cellW / 2;
      const tcy = 80 + r * cellH + cellH / 2;
      const podW = 95;
      const podH = 65;

      objects.push({
        id: crypto.randomUUID(),
        type: "table",
        x: tcx - podW / 2,
        y: tcy - podH / 2,
        width: podW,
        height: podH,
        label: `Insel ${t + 1}`,
      });

      const remainingTables = tableCount - t;
      const remainingChairs = count - placed;
      const chairsForPod = Math.min(remainingChairs, Math.ceil(remainingChairs / remainingTables));

      for (let ch = 0; ch < chairsForPod; ch++) {
        const angle = (ch / chairsForPod) * 2 * Math.PI - Math.PI / 2;
        const radX = podW / 2 + 18;
        const radY = podH / 2 + 18;
        objects.push({
          id: crypto.randomUUID(),
          type: "chair",
          x: tcx + Math.cos(angle) * radX - 12,
          y: tcy + Math.sin(angle) * radY - 12,
          width: 24,
          height: 24,
          label: `Sitz ${placed + 1}`,
        });
        placed++;
      }
    }
  }

  return objects;
}

export function generateDeskAreaLayout(
  desks: { id: number; desk_number: string }[],
  canvasWidth = 860,
  canvasHeight = 460
): FloorplanObject[] {
  const objects: FloorplanObject[] = [];
  const cx = canvasWidth / 2;
  const cy = canvasHeight / 2 + 10;
  const count = desks.length;

  // Eingangstür
  objects.push({
    id: crypto.randomUUID(),
    type: "door",
    x: 35,
    y: 20,
    width: 44,
    height: 12,
    label: "Eingangstür",
  });

  // Whiteboard
  objects.push({
    id: crypto.randomUUID(),
    type: "whiteboard",
    x: cx - 60,
    y: 20,
    width: 120,
    height: 12,
    label: "Team-Whiteboard",
  });

  // Schrank
  objects.push({
    id: crypto.randomUUID(),
    type: "cabinet",
    x: 35,
    y: 120,
    width: 28,
    height: 80,
    label: "Aktenschrank",
  });

  // Pflanze
  objects.push({
    id: crypto.randomUUID(),
    type: "planter",
    x: canvasWidth - 65,
    y: 20,
    width: 30,
    height: 30,
    label: "Pflanze",
  });

  if (count === 0) return objects;

  const cols = Math.min(3, Math.max(1, Math.ceil(count / 4)));
  const rows = Math.ceil(count / (cols * 2));
  const podWidth = 140;
  const podHeight = 100;
  const gapX = 35;
  const gapY = 45;
  const totalW = cols * podWidth + (cols - 1) * gapX;
  const totalH = rows * podHeight + (rows - 1) * gapY;
  const startX = cx - totalW / 2;
  const startY = Math.max(65, cy - totalH / 2);

  let placed = 0;
  for (let r = 0; r < rows && placed < count; r++) {
    for (let c = 0; c < cols && placed < count; c++) {
      const px = startX + c * (podWidth + gapX);
      const py = startY + r * (podHeight + gapY);

      // Desk 1
      if (placed < count) {
        const d = desks[placed++];
        objects.push({
          id: crypto.randomUUID(),
          type: "desk",
          x: px,
          y: py,
          width: 58,
          height: 36,
          deskId: d.id,
          label: d.desk_number,
        });
        objects.push({
          id: crypto.randomUUID(),
          type: "chair",
          x: px + 17,
          y: py - 24,
          width: 24,
          height: 24,
          label: `Stuhl ${d.desk_number}`,
        });
      }

      // Desk 2 (gegenüber)
      if (placed < count) {
        const d = desks[placed++];
        objects.push({
          id: crypto.randomUUID(),
          type: "desk",
          x: px,
          y: py + 46,
          width: 58,
          height: 36,
          deskId: d.id,
          label: d.desk_number,
        });
        objects.push({
          id: crypto.randomUUID(),
          type: "chair",
          x: px + 17,
          y: py + 46 + 40,
          width: 24,
          height: 24,
          label: `Stuhl ${d.desk_number}`,
        });
      }

      // Desk 3 (rechts)
      if (placed < count) {
        const d = desks[placed++];
        objects.push({
          id: crypto.randomUUID(),
          type: "desk",
          x: px + 68,
          y: py,
          width: 58,
          height: 36,
          deskId: d.id,
          label: d.desk_number,
        });
        objects.push({
          id: crypto.randomUUID(),
          type: "chair",
          x: px + 68 + 17,
          y: py - 24,
          width: 24,
          height: 24,
          label: `Stuhl ${d.desk_number}`,
        });
      }

      // Desk 4 (rechts gegenüber)
      if (placed < count) {
        const d = desks[placed++];
        objects.push({
          id: crypto.randomUUID(),
          type: "desk",
          x: px + 68,
          y: py + 46,
          width: 58,
          height: 36,
          deskId: d.id,
          label: d.desk_number,
        });
        objects.push({
          id: crypto.randomUUID(),
          type: "chair",
          x: px + 68 + 17,
          y: py + 46 + 40,
          width: 24,
          height: 24,
          label: `Stuhl ${d.desk_number}`,
        });
      }
    }
  }

  return objects;
}

const OBJECT_STYLE: Record<Exclude<FloorplanObjectType, "desk" | "meeting_room" | "chair">, { fill: string; stroke: string; label: string }> = {
  door: { fill: "#d8b878", stroke: "#8b6c36", label: "Tür" },
  window: { fill: "#9fd6ea", stroke: "#4189a4", label: "Fenster" },
  table: { fill: "#cbb99d", stroke: "#715d43", label: "Tisch" },
  cabinet: { fill: "#aa9b8a", stroke: "#5e544a", label: "Schrank" },
  planter: { fill: "#699c59", stroke: "#3c6b3b", label: "Pflanztrog" },
  whiteboard: { fill: "#f8fafc", stroke: "#64748b", label: "Whiteboard" },
  blocked: { fill: "#d5d2cb", stroke: "#7b7368", label: "Nicht nutzbar" },
  stairs: { fill: "#f1f5f9", stroke: "#64748b", label: "Treppenhaus / Aufzug" },
  room: { fill: "#f8fafc", stroke: "#475569", label: "Raum" },
};

function FixedObject({ object, onExitRoom }: { object: FloorplanObject; onExitRoom?: () => void }) {
  if (object.type === "door" && onExitRoom) {
    return (
      <g
        className="cursor-pointer group select-none"
        onClick={onExitRoom}
        aria-label="Zurück zum Etagen-Grundriss"
      >
        <rect
          x={object.x}
          y={object.y}
          width={object.width}
          height={object.height}
          rx={2}
          fill="#d8b878"
          stroke="#8b6c36"
          strokeWidth={2}
          className="group-hover:fill-amber-300 group-hover:stroke-amber-800 transition-all"
        />
        <text
          x={object.x + object.width / 2}
          y={object.y + object.height + 13}
          fontSize={9.5}
          fontWeight="bold"
          textAnchor="middle"
          fill="#1d4ed8"
          className="group-hover:underline"
        >
          🚪 Zurück zur Etage ↗
        </text>
      </g>
    );
  }

  if (object.type === "chair") {
    return (
      <g aria-label={object.label || "Stuhl"} className="select-none pointer-events-none">
        {/* Stuhl-Sitzfläche */}
        <rect x={object.x + 2} y={object.y + 5} width={Math.max(10, object.width - 4)} height={Math.max(10, object.height - 7)} rx={3} fill="#e2e8f0" stroke="#475569" strokeWidth={1.5} />
        {/* Stuhl-Rückenlehne */}
        <rect x={object.x + 1} y={object.y} width={Math.max(12, object.width - 2)} height={4} rx={2} fill="#334155" stroke="#1e293b" strokeWidth={1} />
      </g>
    );
  }

  if (object.type === "stairs") {
    return (
      <g aria-label={object.label || "Treppenhaus / Aufzug"}>
        <rect x={object.x} y={object.y} width={object.width} height={object.height} rx={2} fill="#f1f5f9" stroke="#64748b" strokeWidth={2} />
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
        <text x={object.x + object.width / 2} y={object.y + object.height / 2 + 4} fontSize={10} fontWeight="bold" textAnchor="middle" fill="#475569">
          🪜 {object.label || "Treppenhaus / Aufzug"}
        </text>
      </g>
    );
  }

  const style = OBJECT_STYLE[object.type as Exclude<FloorplanObjectType, "desk" | "meeting_room" | "chair">];
  if (!style) return null;
  return (
    <g aria-label={object.label || style.label}>
      <rect x={object.x} y={object.y} width={object.width} height={object.height} rx={object.type === "window" ? 1 : 3} fill={style.fill} stroke={style.stroke} strokeWidth={2} />
      {object.type === "blocked" && <path d={`M ${object.x} ${object.y} L ${object.x + object.width} ${object.y + object.height} M ${object.x + object.width} ${object.y} L ${object.x} ${object.y + object.height}`} stroke={style.stroke} strokeWidth={2} />}
      {object.width > 42 && <text x={object.x + object.width / 2} y={object.y + object.height / 2 + 4} fontSize={11} textAnchor="middle" fill="#24302a">{object.label || style.label}</text>}
    </g>
  );
}

const STATUS_FILL: Record<string, string> = {
  available: "#dff2d9",
  top_match: "#b9e9a8",
  mine: "#b6d8f2",
  occupied: "#dad8d1",
  locked: "#f1c4c1",
  zone_restricted: "#eadfce",
};

export interface FloorplanCanvasProps {
  layout: FloorplanLayout;
  desks?: FloorDeskStatus[];
  onDeskClick?: (desk: FloorDeskStatus) => void;
  meetingRooms?: MeetingRoomOut[];
  onMeetingRoomClick?: (room: MeetingRoomOut) => void;
  onRoomClick?: (roomId: number, roomType: "meeting" | "desk_area") => void;
  onBackToFloor?: () => void;
  renderFallbackDesks?: boolean;
}

export function FloorplanCanvas({
  layout,
  desks = [],
  onDeskClick,
  meetingRooms = [],
  onMeetingRoomClick,
  onRoomClick,
  onBackToFloor,
  renderFallbackDesks = false,
}: FloorplanCanvasProps) {
  const layoutDeskIds = new Set(layout.objects.filter((o) => o.type === "desk" && o.deskId).map((o) => o.deskId));
  const deskById = new Map(desks.map((desk) => [desk.desk_id, desk]));

  const layoutRoomIds = new Set(
    layout.objects
      .filter((o) => (o.type === "meeting_room" || (o.type === "room" && o.roomType === "meeting")) && o.roomId)
      .map((o) => o.roomId)
  );
  const roomById = new Map(meetingRooms.map((room) => [room.id, room]));

  // Prüfe, ob der Grundriss Raumflächen enthält (z. B. Etagen-Grundriss)
  const hasRoomObjects = layout.objects.some((o) => o.type === "room" || o.type === "meeting_room");

  return (
    <svg viewBox="0 0 900 500" className="w-full bg-surface rounded-md border border-outline-variant/30 select-none" role="img" aria-label="Interaktiver digitaler Grundriss">
      <rect x={10} y={10} width={880} height={480} fill="#fbfaf6" stroke="#4f514c" strokeWidth={4} rx={6} />

      {/* Button zurück zur Etage direkt auf der Zeichenfläche einblenden wenn im Raumplan */}
      {onBackToFloor && (
        <g
          className="cursor-pointer group select-none"
          onClick={onBackToFloor}
          aria-label="Zurück zum Etagen-Grundriss"
        >
          <rect
            x={18}
            y={18}
            width={160}
            height={30}
            rx={6}
            fill="#ffffff"
            stroke="#2563eb"
            strokeWidth={1.5}
            className="shadow-sm group-hover:fill-blue-50 group-hover:stroke-blue-700 transition-all"
          />
          <text x={98} y={38} fontSize={11} fontWeight="bold" textAnchor="middle" fill="#1d4ed8">
            ← Zurück zur Etage
          </text>
        </g>
      )}

      {/* Feste Architekturobjekte (Türen, Fenster, Schränke, Treppenhaus, etc. – AUSSER Räume und Desks) */}
      {layout.objects.filter((o) => o.type !== "desk" && o.type !== "meeting_room" && o.type !== "room").map((object) => (
        <FixedObject key={object.id} object={object} onExitRoom={onBackToFloor} />
      ))}

      {/* RÄUME AUF DEM GRUNDRISS (Sowohl Meetingräume als auch Büroräume / Desk-Bereiche) */}
      {layout.objects.filter((o) => o.type === "room" || o.type === "meeting_room").map((object) => {
        const isMeeting = object.type === "meeting_room" || object.roomType === "meeting" || (object.roomId ? roomById.has(object.roomId) : false);
        const meetingRoom = object.roomId ? roomById.get(object.roomId) : undefined;

        // Berechne Desk-Verfügbarkeit für Büroräume
        const roomDesks = object.roomId ? desks.filter((d) => d.room_id === object.roomId) : [];
        const freeDesks = roomDesks.filter((d) => d.status === "available" || d.status === "top_match").length;
        const totalDesks = roomDesks.length;

        let fill = "#f8fafc";
        let stroke = "#475569";
        let badgeText = "";
        let badgeColor = "#475569";

        if (isMeeting) {
          fill = "#f0f9ff";
          stroke = "#0284c7";
          badgeText = "Meetingraum: Frei";
          badgeColor = "#0369a1";

          if (meetingRoom) {
            if (meetingRoom.restricted_role_code) {
              fill = "#f5ebe1";
              stroke = "#b45309";
              badgeText = "Zugriff beschränkt";
              badgeColor = "#92400e";
            } else if (meetingRoom.is_occupied_now) {
              fill = "#e2e8f0";
              stroke = "#64748b";
              badgeText = "Besetzt";
              badgeColor = "#475569";
            } else if (meetingRoom.approval_required) {
              fill = "#fef9c3";
              stroke = "#ca8a04";
              badgeText = "Freigabe erforderlich";
              badgeColor = "#a16207";
            }
          }
        } else {
          // Büroraum / Desk-Bereich
          if (totalDesks > 0) {
            if (freeDesks > 0) {
              fill = "#f0fdf4";
              stroke = "#16a34a";
              badgeText = `${freeDesks} von ${totalDesks} Desks frei`;
              badgeColor = "#15803d";
            } else {
              fill = "#f1f5f9";
              stroke = "#64748b";
              badgeText = `Voll belegt (0/${totalDesks})`;
              badgeColor = "#475569";
            }
          } else {
            fill = "#f8fafc";
            stroke = "#475569";
            badgeText = "Bürobereich";
            badgeColor = "#475569";
          }
        }

        const canClick =
          (isMeeting && (!!onMeetingRoomClick || !!onRoomClick)) ||
          (!isMeeting && !!onRoomClick && !!object.roomId);

        function handleRoomClick() {
          if (!canClick) return;
          if (isMeeting) {
            if (meetingRoom && onMeetingRoomClick) {
              onMeetingRoomClick(meetingRoom);
            } else if (object.roomId && onRoomClick) {
              onRoomClick(object.roomId, "meeting");
            } else if (object.roomId && onMeetingRoomClick) {
              onMeetingRoomClick({
                id: object.roomId,
                room_number: object.label || "",
                name: object.label || "Meetingraum",
                capacity: 10,
                approval_required: false,
                restricted_role_code: null,
                labels: [],
                is_occupied_now: false,
              });
            }
          } else {
            if (object.roomId && onRoomClick) {
              onRoomClick(object.roomId, "desk_area");
            }
          }
        }

        return (
          <g
            key={object.id}
            className={canClick ? "cursor-pointer group" : ""}
            onClick={handleRoomClick}
            aria-label={object.label || (isMeeting ? "Meetingraum" : "Büroraum")}
          >
            {/* Raumfläche */}
            <rect
              x={object.x}
              y={object.y}
              width={object.width}
              height={object.height}
              rx={6}
              fill={fill}
              stroke={stroke}
              strokeWidth={canClick ? 2 : 1.5}
              className={canClick ? "transition-all group-hover:filter group-hover:brightness-95 group-hover:stroke-primary" : ""}
            />

            {/* Spezifisches Raum-Icon & Tisch-Silhouette */}
            {isMeeting && object.width >= 80 && object.height >= 50 && (
              <rect
                x={object.x + 10}
                y={object.y + object.height / 2 - 8}
                width={object.width - 20}
                height={16}
                rx={4}
                fill="#ffffff"
                stroke={stroke}
                strokeWidth={1}
                opacity={0.85}
              />
            )}

            {/* Raumtitel */}
            <text
              x={object.x + object.width / 2}
              y={object.y + Math.min(22, object.height * 0.3)}
              fontSize={12}
              fontWeight="bold"
              textAnchor="middle"
              fill="#0f172a"
            >
              {isMeeting ? "🏛" : "💼"} {meetingRoom?.name || object.label || (isMeeting ? "Meetingraum" : "Büroraum")}
            </text>

            {/* Raumnummer / Untertitel */}
            {object.height >= 55 && (
              <text
                x={object.x + object.width / 2}
                y={object.y + object.height / 2 + (isMeeting ? 14 : 4)}
                fontSize={10}
                textAnchor="middle"
                fill="#334155"
              >
                {isMeeting
                  ? `Raum ${meetingRoom?.room_number ?? ""} · max. ${meetingRoom?.capacity ?? "—"} P.`
                  : badgeText}
              </text>
            )}

            {/* Klick-Hinweis / Statusanzeige unten */}
            {object.height >= 75 && (
              <text
                x={object.x + object.width / 2}
                y={object.y + object.height - 10}
                fontSize={9.5}
                fontWeight="600"
                textAnchor="middle"
                fill={badgeColor}
              >
                {canClick
                  ? isMeeting
                    ? `👉 Buchen (${badgeText}) ↗`
                    : `👉 Raumplan öffnen & Desks wählen ↗`
                  : badgeText}
              </text>
            )}
          </g>
        );
      })}

      {/* Unplatzierte Meetingräume mit fester Koordinate */}
      {meetingRooms.filter((room) => !layoutRoomIds.has(room.id) && room.pos_x != null && room.pos_y != null).map((room) => (
        <g
          key={`unplaced-room-${room.id}`}
          className={onMeetingRoomClick ? "cursor-pointer group" : ""}
          onClick={() => onMeetingRoomClick?.(room)}
          aria-label={`Meetingraum ${room.name}`}
        >
          <rect
            x={room.pos_x!}
            y={room.pos_y!}
            width={room.width ?? 140}
            height={room.height ?? 80}
            rx={6}
            fill={room.is_occupied_now ? "#e2e8f0" : room.approval_required ? "#fef9c3" : "#e0f2fe"}
            stroke={room.approval_required ? "#ca8a04" : "#0284c7"}
            strokeWidth={2}
          />
          <text x={(room.pos_x!) + (room.width ?? 140) / 2} y={(room.pos_y!) + 22} fontSize={11} fontWeight="bold" textAnchor="middle" fill="#0f172a">
            🏛 {room.name}
          </text>
          <text x={(room.pos_x!) + (room.width ?? 140) / 2} y={(room.pos_y!) + 42} fontSize={10} textAnchor="middle" fill="#334155">
            max. {room.capacity ?? "—"} P.
          </text>
        </g>
      ))}

      {/* Desks im Grundriss (z. B. im Raum-Detailplan oder bestehenden Plänen) */}
      {layout.objects.filter((o) => o.type === "desk").map((object) => {
        const desk = object.deskId ? deskById.get(object.deskId) : undefined;
        const fill = desk ? STATUS_FILL[desk.status] : "#eef0ed";
        return (
          <g key={object.id} className={desk && onDeskClick ? "cursor-pointer group" : ""} onClick={() => desk && onDeskClick?.(desk)} aria-label={desk?.desk_number || object.label || "Desk"}>
            <rect
              x={object.x}
              y={object.y}
              width={object.width}
              height={object.height}
              rx={4}
              fill={fill}
              stroke="#425a49"
              strokeWidth={2}
              className={desk && onDeskClick ? "group-hover:stroke-primary group-hover:stroke-[2.5]" : ""}
            />
            <text x={object.x + object.width / 2} y={object.y + object.height / 2 + 4} fontSize={11} textAnchor="middle" fill="#24302a">{desk?.desk_number || object.label || "Desk"}</text>
          </g>
        );
      })}

      {/* Fallback-Desks (NUR wenn explizit gewünscht und wenn feste Koordinaten vorhanden sind, NIE als 30,30-Dump auf Etagen-Plänen) */}
      {renderFallbackDesks && !hasRoomObjects && desks.filter((desk) => !layoutDeskIds.has(desk.desk_id) && desk.pos_x != null && desk.pos_y != null).map((desk) => (
        <g key={desk.desk_id} className={onDeskClick ? "cursor-pointer group" : ""} onClick={() => onDeskClick?.(desk)} aria-label={desk.desk_number}>
          <rect x={desk.pos_x!} y={desk.pos_y!} width={40} height={40} rx={4} fill={STATUS_FILL[desk.status]} stroke="#425a49" strokeWidth={2} />
          <text x={desk.pos_x! + 20} y={desk.pos_y! + 24} fontSize={10} textAnchor="middle">{desk.desk_number}</text>
        </g>
      ))}
    </svg>
  );
}

