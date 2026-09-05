import type { FloorDeskStatus } from "../api/types";

export type FloorplanObjectType = "door" | "window" | "table" | "cabinet" | "planter" | "whiteboard" | "blocked" | "desk";

export interface FloorplanObject {
  id: string;
  type: FloorplanObjectType;
  x: number;
  y: number;
  width: number;
  height: number;
  label?: string;
  deskId?: number;
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

const OBJECT_STYLE: Record<Exclude<FloorplanObjectType, "desk">, { fill: string; stroke: string; label: string }> = {
  door: { fill: "#d8b878", stroke: "#8b6c36", label: "Tür" },
  window: { fill: "#9fd6ea", stroke: "#4189a4", label: "Fenster" },
  table: { fill: "#cbb99d", stroke: "#715d43", label: "Tisch" },
  cabinet: { fill: "#aa9b8a", stroke: "#5e544a", label: "Schrank" },
  planter: { fill: "#699c59", stroke: "#3c6b3b", label: "Pflanztrog" },
  whiteboard: { fill: "#f8fafc", stroke: "#64748b", label: "Whiteboard" },
  blocked: { fill: "#d5d2cb", stroke: "#7b7368", label: "Nicht nutzbar" },
};

function FixedObject({ object }: { object: FloorplanObject }) {
  const style = OBJECT_STYLE[object.type as Exclude<FloorplanObjectType, "desk">];
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

export function FloorplanCanvas({ layout, desks, onDeskClick }: { layout: FloorplanLayout; desks: FloorDeskStatus[]; onDeskClick?: (desk: FloorDeskStatus) => void }) {
  const layoutDeskIds = new Set(layout.objects.filter((o) => o.type === "desk" && o.deskId).map((o) => o.deskId));
  const deskById = new Map(desks.map((desk) => [desk.desk_id, desk]));

  return (
    <svg viewBox="0 0 900 500" className="w-full bg-surface rounded-md border border-outline-variant/30" role="img" aria-label="Interaktiver digitaler Grundriss">
      <rect x={10} y={10} width={880} height={480} fill="#fbfaf6" stroke="#4f514c" strokeWidth={4} />
      {layout.objects.filter((o) => o.type !== "desk").map((object) => <FixedObject key={object.id} object={object} />)}
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
      {desks.filter((desk) => !layoutDeskIds.has(desk.desk_id)).map((desk) => (
        <g key={desk.desk_id} className={onDeskClick ? "cursor-pointer" : ""} onClick={() => onDeskClick?.(desk)} aria-label={desk.desk_number}>
          <rect x={desk.pos_x ?? 30} y={desk.pos_y ?? 30} width={40} height={40} rx={4} fill={STATUS_FILL[desk.status]} stroke="#425a49" strokeWidth={2} />
          <text x={(desk.pos_x ?? 30) + 20} y={(desk.pos_y ?? 30) + 24} fontSize={10} textAnchor="middle">{desk.desk_number}</text>
        </g>
      ))}
    </svg>
  );
}
