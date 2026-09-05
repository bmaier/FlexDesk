import { useEffect, useRef, useState } from "react";
import { api } from "../api/client";
import type { FloorNode, PropertyOut, PropertyTree } from "../api/types";
import { Button } from "./ui";
import { FloorplanCanvas, type FloorplanLayout, type FloorplanObject, type FloorplanObjectType, parseFloorplanLayout } from "./FloorplanCanvas";

const TOOLS: { type: FloorplanObjectType; label: string; size: [number, number] }[] = [
  { type: "door", label: "Tür", size: [44, 12] },
  { type: "window", label: "Fenster", size: [60, 10] },
  { type: "table", label: "Tisch", size: [110, 60] },
  { type: "desk", label: "Desk", size: [55, 35] },
  { type: "cabinet", label: "Schrank", size: [65, 28] },
  { type: "planter", label: "Pflanztrog", size: [70, 22] },
  { type: "whiteboard", label: "Whiteboard", size: [85, 12] },
  { type: "blocked", label: "Nicht nutzbar", size: [100, 70] },
];

function blankLayout(): FloorplanLayout {
  return { objects: [] };
}

export function FloorplanDesigner() {
  const [properties, setProperties] = useState<PropertyOut[]>([]);
  const [propertyId, setPropertyId] = useState<number | null>(null);
  const [tree, setTree] = useState<PropertyTree | null>(null);
  const [floorId, setFloorId] = useState<number | null>(null);
  const [layout, setLayout] = useState<FloorplanLayout>(blankLayout());
  const [tool, setTool] = useState<FloorplanObjectType>("table");
  const [deskId, setDeskId] = useState<number | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
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
  }, [propertyId]);

  const floors = tree?.buildings.flatMap((building) => building.floors.map((floor) => ({ ...floor, buildingName: building.name }))) ?? [];
  const floor = floors.find((item) => item.id === floorId) as (FloorNode & { buildingName: string }) | undefined;
  const desks = floor?.rooms.flatMap((room) => room.desks.map((desk) => ({ ...desk, roomName: room.name }))) ?? [];

  useEffect(() => {
    if (!floor) return;
    setLayout(parseFloorplanLayout(floor.floorplan_layout) ?? blankLayout());
    setSelectedId(null);
  }, [floorId, floor?.floorplan_layout]);

  function addObject(event: React.MouseEvent<SVGSVGElement>) {
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
    const object: FloorplanObject = {
      id: crypto.randomUUID(), type: tool, x: x - config.size[0] / 2, y: y - config.size[1] / 2,
      width: config.size[0], height: config.size[1], deskId: tool === "desk" ? deskId ?? undefined : undefined,
      label: tool === "desk" ? desks.find((desk) => desk.id === deskId)?.desk_number : config.label,
    };
    setLayout((current) => ({ objects: [...current.objects, object] }));
    setSelectedId(object.id);
    setMessage(null);
  }

  function updateSelected(patch: Partial<FloorplanObject>) {
    if (!selectedId) return;
    setLayout((current) => ({ objects: current.objects.map((item) => item.id === selectedId ? { ...item, ...patch } : item) }));
  }

  function deleteSelected() {
    if (!selectedId) return;
    setLayout((current) => ({ objects: current.objects.filter((item) => item.id !== selectedId) }));
    setSelectedId(null);
  }

  async function save() {
    if (!floorId) return;
    await api.put(`/fm/floors/${floorId}/floorplan-layout`, { layout: JSON.stringify(layout) });
    setMessage("Grundriss gespeichert. Er ist sofort im Raumplan für Buchung und Stornierung verfügbar.");
  }

  const selected = layout.objects.find((item) => item.id === selectedId);

  return (
    <div className="grid grid-cols-1 xl:grid-cols-[250px_1fr_220px] gap-4">
      <section className="bg-surface-container-low rounded-md p-3 border border-outline-variant/30 space-y-3">
        <div className="font-semibold">Grundriss wählen</div>
        <label className="block text-xs">Liegenschaft
          <select value={propertyId ?? ""} onChange={(e) => { setPropertyId(Number(e.target.value)); setFloorId(null); }} className="w-full mt-1 bg-surface rounded px-2 py-1.5 text-sm">
            {properties.map((property) => <option key={property.id} value={property.id}>{property.name}</option>)}
          </select>
        </label>
        <label className="block text-xs">Gebäude / Etage
          <select value={floorId ?? ""} onChange={(e) => setFloorId(Number(e.target.value))} className="w-full mt-1 bg-surface rounded px-2 py-1.5 text-sm">
            {floors.map((item) => <option key={item.id} value={item.id}>{item.buildingName} / {item.name}</option>)}
          </select>
        </label>
        <div className="text-xs text-on-surface-variant">Wählen Sie ein Element links und klicken Sie in den rechteckigen Grundriss. Für einen Desk wählen Sie zusätzlich den realen Desk aus der Stammdatenstruktur.</div>
        <div className="grid grid-cols-2 gap-1">
          {TOOLS.map((item) => <button key={item.type} onClick={() => setTool(item.type)} className={`p-2 rounded text-xs text-left ${tool === item.type ? "bg-primary text-on-primary" : "bg-surface-container-high hover:bg-surface-container-highest"}`}>{item.label}</button>)}
        </div>
        {tool === "desk" && <label className="block text-xs">Desk verbinden
          <select value={deskId ?? ""} onChange={(e) => setDeskId(Number(e.target.value))} className="w-full mt-1 bg-surface rounded px-2 py-1.5 text-sm">
            <option value="">Desk wählen…</option>
            {desks.map((desk) => <option key={desk.id} value={desk.id}>{desk.desk_number} · {desk.roomName}</option>)}
          </select>
        </label>}
      </section>

      <section>
        <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
          <div><div className="font-semibold">{floor ? `${floor.buildingName} / ${floor.name}` : "Etage wählen"}</div><div className="text-xs text-on-surface-variant">Klick in die Fläche platziert: {TOOLS.find((item) => item.type === tool)?.label}</div></div>
          <Button variant="primary" onClick={save}>Grundriss speichern</Button>
        </div>
        <svg ref={canvasRef} viewBox="0 0 900 500" onClick={addObject} className="w-full bg-surface rounded-md border border-outline-variant/30 cursor-crosshair" aria-label="Grundriss gestalten">
          <rect x={10} y={10} width={880} height={480} fill="#fbfaf6" stroke="#4f514c" strokeWidth={4} />
          {layout.objects.map((object) => (
            <g key={object.id} onClick={(event) => { event.stopPropagation(); setSelectedId(object.id); }} className="cursor-pointer">
              <rect x={object.x} y={object.y} width={object.width} height={object.height} rx={3} fill={object.type === "blocked" ? "#d5d2cb" : object.type === "window" ? "#9fd6ea" : object.type === "door" ? "#d8b878" : object.type === "planter" ? "#699c59" : object.type === "desk" ? "#dff2d9" : "#cbb99d"} stroke={selectedId === object.id ? "#176b47" : "#4f514c"} strokeWidth={selectedId === object.id ? 4 : 2} />
              <text x={object.x + object.width / 2} y={object.y + object.height / 2 + 4} fontSize={11} textAnchor="middle">{object.label}</text>
            </g>
          ))}
        </svg>
        {message && <div className="mt-2 p-2 rounded bg-tertiary-fixed/40 text-on-tertiary-fixed-variant text-sm" role="status">{message}</div>}
      </section>

      <section className="bg-surface-container-low rounded-md p-3 border border-outline-variant/30">
        <div className="font-semibold mb-2">Element bearbeiten</div>
        {selected ? <div className="space-y-2 text-sm">
          <div className="font-medium">{TOOLS.find((item) => item.type === selected.type)?.label}</div>
          <label className="block text-xs">Beschriftung<input value={selected.label ?? ""} onChange={(e) => updateSelected({ label: e.target.value })} className="w-full mt-1 bg-surface rounded px-2 py-1.5" /></label>
          <div className="grid grid-cols-2 gap-2">
            <label className="block text-xs">Breite<input type="number" value={selected.width} onChange={(e) => updateSelected({ width: Number(e.target.value) })} className="w-full mt-1 bg-surface rounded px-2 py-1.5" /></label>
            <label className="block text-xs">Höhe<input type="number" value={selected.height} onChange={(e) => updateSelected({ height: Number(e.target.value) })} className="w-full mt-1 bg-surface rounded px-2 py-1.5" /></label>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <label className="block text-xs">X<input type="number" value={Math.round(selected.x)} onChange={(e) => updateSelected({ x: Number(e.target.value) })} className="w-full mt-1 bg-surface rounded px-2 py-1.5" /></label>
            <label className="block text-xs">Y<input type="number" value={Math.round(selected.y)} onChange={(e) => updateSelected({ y: Number(e.target.value) })} className="w-full mt-1 bg-surface rounded px-2 py-1.5" /></label>
          </div>
          <Button variant="destructive" className="w-full" onClick={deleteSelected}>Element löschen</Button>
        </div> : <div className="text-xs text-on-surface-variant">Element auf dem Plan anklicken, um Größe, Position oder Beschriftung zu ändern bzw. es zu löschen.</div>}
      </section>
    </div>
  );
}
