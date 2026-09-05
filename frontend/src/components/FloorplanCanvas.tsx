import type { FloorDeskStatus, MeetingRoomOut } from "../api/types";

export type FloorplanObjectType = "door" | "window" | "table" | "cabinet" | "planter" | "whiteboard" | "blocked" | "desk" | "meeting_room";

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

const OBJECT_STYLE: Record<Exclude<FloorplanObjectType, "desk" | "meeting_room">, { fill: string; stroke: string; label: string }> = {
  door: { fill: "#d8b878", stroke: "#8b6c36", label: "Tür" },
  window: { fill: "#9fd6ea", stroke: "#4189a4", label: "Fenster" },
  table: { fill: "#cbb99d", stroke: "#715d43", label: "Tisch" },
  cabinet: { fill: "#aa9b8a", stroke: "#5e544a", label: "Schrank" },
  planter: { fill: "#699c59", stroke: "#3c6b3b", label: "Pflanztrog" },
  whiteboard: { fill: "#f8fafc", stroke: "#64748b", label: "Whiteboard" },
  blocked: { fill: "#d5d2cb", stroke: "#7b7368", label: "Nicht nutzbar" },
};

function FixedObject({ object }: { object: FloorplanObject }) {
  const style = OBJECT_STYLE[object.type as Exclude<FloorplanObjectType, "desk" | "meeting_room">];
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
}

export function FloorplanCanvas({
  layout,
  desks = [],
  onDeskClick,
  meetingRooms = [],
  onMeetingRoomClick,
}: FloorplanCanvasProps) {
  const layoutDeskIds = new Set(layout.objects.filter((o) => o.type === "desk" && o.deskId).map((o) => o.deskId));
  const deskById = new Map(desks.map((desk) => [desk.desk_id, desk]));

  const layoutRoomIds = new Set(layout.objects.filter((o) => o.type === "meeting_room" && o.roomId).map((o) => o.roomId));
  const roomById = new Map(meetingRooms.map((room) => [room.id, room]));

  return (
    <svg viewBox="0 0 900 500" className="w-full bg-surface rounded-md border border-outline-variant/30" role="img" aria-label="Interaktiver digitaler Grundriss">
      <rect x={10} y={10} width={880} height={480} fill="#fbfaf6" stroke="#4f514c" strokeWidth={4} />

      {/* Feste Architekturobjekte (Türen, Fenster, Schränke, etc.) */}
      {layout.objects.filter((o) => o.type !== "desk" && o.type !== "meeting_room").map((object) => (
        <FixedObject key={object.id} object={object} />
      ))}

      {/* Meetingräume im Grundriss */}
      {layout.objects.filter((o) => o.type === "meeting_room").map((object) => {
        const room = object.roomId ? roomById.get(object.roomId) : undefined;
        let fill = "#e0f2fe";
        let stroke = "#0284c7";
        let statusText = "Frei";
        let statusColor = "#0369a1";

        if (room) {
          if (room.restricted_role_code) {
            fill = "#f5ebe1";
            stroke = "#b45309";
            statusText = "Zugriff beschränkt";
            statusColor = "#92400e";
          } else if (room.is_occupied_now) {
            fill = "#e2e8f0";
            stroke = "#64748b";
            statusText = "Besetzt";
            statusColor = "#475569";
          } else if (room.approval_required) {
            fill = "#fef9c3";
            stroke = "#ca8a04";
            statusText = "Freigabe erforderlich";
            statusColor = "#a16207";
          }
        }

        const isInteractive = !!room && !!onMeetingRoomClick;

        return (
          <g
            key={object.id}
            className={isInteractive ? "cursor-pointer group" : ""}
            onClick={() => room && onMeetingRoomClick?.(room)}
            aria-label={room ? `Meetingraum ${room.name}` : object.label || "Meetingraum"}
          >
            {/* Raumumriss */}
            <rect
              x={object.x}
              y={object.y}
              width={object.width}
              height={object.height}
              rx={6}
              fill={fill}
              stroke={stroke}
              strokeWidth={isInteractive ? 2.5 : 2}
              className={isInteractive ? "transition-all group-hover:filter group-hover:brightness-95" : ""}
            />

            {/* Stilisierter Konferenztisch im Raum */}
            {object.width >= 90 && object.height >= 50 && (
              <rect
                x={object.x + 12}
                y={object.y + object.height / 2 - 10}
                width={object.width - 24}
                height={20}
                rx={4}
                fill="#ffffff"
                stroke={stroke}
                strokeWidth={1.5}
                opacity={0.8}
              />
            )}

            {/* Raumtitel */}
            <text
              x={object.x + object.width / 2}
              y={object.y + Math.min(22, object.height * 0.28)}
              fontSize={12}
              fontWeight="bold"
              textAnchor="middle"
              fill="#0f172a"
            >
              🏛 {room?.name || object.label || "Meetingraum"}
            </text>

            {/* Raumnummer & Kapazität */}
            {object.height >= 60 && (
              <text
                x={object.x + object.width / 2}
                y={object.y + object.height / 2 + 4}
                fontSize={10}
                textAnchor="middle"
                fill="#334155"
              >
                {room ? `Raum ${room.room_number} · max. ${room.capacity ?? "—"} P.` : object.label}
              </text>
            )}

            {/* Status-Zeile */}
            {object.height >= 75 && (
              <text
                x={object.x + object.width / 2}
                y={object.y + object.height - 10}
                fontSize={9.5}
                fontWeight="600"
                textAnchor="middle"
                fill={statusColor}
              >
                {statusText}
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

      {/* Desks im Grundriss */}
      {layout.objects.filter((o) => o.type === "desk").map((object) => {
        const desk = object.deskId ? deskById.get(object.deskId) : undefined;
        const fill = desk ? STATUS_FILL[desk.status] : "#eef0ed";
        return (
          <g key={object.id} className={desk && onDeskClick ? "cursor-pointer" : ""} onClick={() => desk && onDeskClick?.(desk)} aria-label={desk?.desk_number || object.label || "Desk"}>
            <rect x={object.x} y={object.y} width={object.width} height={object.height} rx={4} fill={fill} stroke="#425a49" strokeWidth={2} />
            <text x={object.x + object.width / 2} y={object.y + object.height / 2 + 4} fontSize={11} textAnchor="middle" fill="#24302a">{desk?.desk_number || object.label || "Desk"}</text>
          </g>
        );
      })}

      {/* Desks ohne explizites Layoutobjekt (Fallback über pos_x/pos_y) */}
      {desks.filter((desk) => !layoutDeskIds.has(desk.desk_id)).map((desk) => (
        <g key={desk.desk_id} className={onDeskClick ? "cursor-pointer" : ""} onClick={() => onDeskClick?.(desk)} aria-label={desk.desk_number}>
          <rect x={desk.pos_x ?? 30} y={desk.pos_y ?? 30} width={40} height={40} rx={4} fill={STATUS_FILL[desk.status]} stroke="#425a49" strokeWidth={2} />
          <text x={(desk.pos_x ?? 30) + 20} y={(desk.pos_y ?? 30) + 24} fontSize={10} textAnchor="middle">{desk.desk_number}</text>
        </g>
      ))}
    </svg>
  );
}

