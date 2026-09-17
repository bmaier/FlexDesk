import { useEffect, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { api, ApiError } from "../api/client";
import type {
  BuildingNode,
  DefectOut,
  DepartmentOut,
  DeskNode,
  LabelOut,
  LabelSuggestion,
  LabelUsage,
  OccupancyOut,
  PropertyOut,
  PropertyTree,
  RoomDepartmentOut,
  RoomNode,
  SeatingOptionOut,
  ZoneOut,
} from "../api/types";
import { Badge, Button, Modal } from "../components/ui";
import { DepartmentPicker } from "../components/DepartmentPicker";
import { FloorplanDesigner } from "../components/FloorplanDesigner";

type Tab = "struktur" | "grundriss" | "labels" | "zonen" | "auslastung" | "defekte";

export default function FacilityManagement() {
  const [searchParams, setSearchParams] = useSearchParams();
  const activeTabParam = searchParams.get("tab") as Tab | null;
  const tab: Tab =
    activeTabParam && ["struktur", "grundriss", "labels", "zonen", "auslastung", "defekte"].includes(activeTabParam)
      ? activeTabParam
      : "struktur";

  function setTab(nextTab: Tab) {
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        next.set("tab", nextTab);
        return next;
      },
      { replace: true }
    );
  }

  const [structureVersion, setStructureVersion] = useState(0);

  // Geteilter Zustand über alle FM-Tabs hinweg (bleibt beim Umschalten erhalten)
  const [selectedPropertyId, setSelectedPropertyId] = useState<number | null>(() => {
    const p = searchParams.get("propertyId");
    return p ? Number(p) : null;
  });
  const [selectedFloorId, setSelectedFloorId] = useState<number | null>(() => {
    const f = searchParams.get("floorId");
    return f ? Number(f) : null;
  });
  const [selectedRoomId, setSelectedRoomId] = useState<number | null>(() => {
    const r = searchParams.get("roomId");
    return r ? Number(r) : null;
  });
  const [designerScope, setDesignerScope] = useState<"floor" | "room">(() => {
    return searchParams.get("roomId") ? "room" : "floor";
  });

  function notifyStructureChanged() {
    setStructureVersion((version) => version + 1);
  }

  function handleSelectProperty(id: number | null) {
    setSelectedPropertyId(id);
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        if (id) next.set("propertyId", String(id));
        else next.delete("propertyId");
        return next;
      },
      { replace: true }
    );
  }

  function handleSelectFloor(id: number | null) {
    setSelectedFloorId(id);
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        if (id) next.set("floorId", String(id));
        else next.delete("floorId");
        return next;
      },
      { replace: true }
    );
  }

  function handleSelectRoom(id: number | null) {
    setSelectedRoomId(id);
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        if (id) next.set("roomId", String(id));
        else next.delete("roomId");
        return next;
      },
      { replace: true }
    );
  }

  function handleOpenFloorplanForFloor(floorId: number) {
    setSelectedFloorId(floorId);
    setSelectedRoomId(null);
    setDesignerScope("floor");
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        next.set("tab", "grundriss");
        next.set("floorId", String(floorId));
        next.delete("roomId");
        return next;
      },
      { replace: true }
    );
  }

  function handleOpenFloorplanForRoom(roomId: number, floorId?: number | null) {
    setSelectedRoomId(roomId);
    if (floorId) setSelectedFloorId(floorId);
    setDesignerScope("room");
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        next.set("tab", "grundriss");
        next.set("roomId", String(roomId));
        if (floorId) next.set("floorId", String(floorId));
        return next;
      },
      { replace: true }
    );
  }

  return (
    <div>
      <h1 className="text-3xl font-bold mb-1">Facility-Management</h1>
      <p className="text-on-surface-variant mb-4">Liegenschaften, Räume, Labels, Zonen und Auslastung verwalten.</p>
      <div className="flex gap-2 mb-6 border-b border-outline-variant/30">
        {(["struktur", "grundriss", "labels", "zonen", "auslastung", "defekte"] as Tab[]).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-3 py-2 text-sm font-semibold capitalize border-b-2 -mb-px ${tab === t ? "border-primary text-primary" : "border-transparent text-on-surface-variant"}`}
          >
            {t}
          </button>
        ))}
      </div>
      {/* Alle Tabs bleiben gemountet (nur per CSS ausgeblendet), damit die Auswahl
          (Liegenschaft/Raum/Desk, Grundriss-Canvas, Formulare etc.) beim Tab-Wechsel erhalten bleibt. */}
      <div className={tab === "struktur" ? "" : "hidden"}>
        <StructureTab
          onStructureChanged={notifyStructureChanged}
          selectedPropertyId={selectedPropertyId}
          onSelectProperty={handleSelectProperty}
          selectedFloorId={selectedFloorId}
          onSelectFloor={handleSelectFloor}
          selectedRoomId={selectedRoomId}
          onSelectRoom={handleSelectRoom}
          onOpenFloorplanForFloor={handleOpenFloorplanForFloor}
          onOpenFloorplanForRoom={handleOpenFloorplanForRoom}
        />
      </div>
      <div className={tab === "grundriss" ? "" : "hidden"}>
        <FloorplanDesigner
          structureVersion={structureVersion}
          onStructureChanged={notifyStructureChanged}
          selectedPropertyId={selectedPropertyId}
          onSelectProperty={handleSelectProperty}
          selectedFloorId={selectedFloorId}
          onSelectFloor={handleSelectFloor}
          selectedRoomId={selectedRoomId}
          onSelectRoom={handleSelectRoom}
          scope={designerScope}
          onScopeChange={setDesignerScope}
        />
      </div>
      <div className={tab === "labels" ? "" : "hidden"}><LabelsTab /></div>
      <div className={tab === "zonen" ? "" : "hidden"}>
        <ZonesTab
          structureVersion={structureVersion}
          selectedPropertyId={selectedPropertyId}
          onSelectProperty={handleSelectProperty}
        />
      </div>
      <div className={tab === "auslastung" ? "" : "hidden"}><OccupancyTab /></div>
      <div className={tab === "defekte" ? "" : "hidden"}><DefectsTab /></div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Struktur: Baum + Anlegen-Formulare + Raum-/Desk-Detail
// ---------------------------------------------------------------------------

interface StructureTabProps {
  onStructureChanged: () => void;
  selectedPropertyId?: number | null;
  onSelectProperty?: (id: number) => void;
  selectedFloorId?: number | null;
  onSelectFloor?: (floorId: number) => void;
  selectedRoomId?: number | null;
  onSelectRoom?: (roomId: number | null) => void;
  onOpenFloorplanForFloor?: (floorId: number) => void;
  onOpenFloorplanForRoom?: (roomId: number, floorId?: number | null) => void;
}

function StructureTab({
  onStructureChanged,
  selectedPropertyId: propPropertyId,
  onSelectProperty,
  selectedFloorId: propFloorId,
  onSelectFloor,
  selectedRoomId: propRoomId,
  onSelectRoom,
  onOpenFloorplanForFloor,
  onOpenFloorplanForRoom,
}: StructureTabProps) {
  const [properties, setProperties] = useState<PropertyOut[]>([]);
  const [propertyId, setPropertyId] = useState<number | null>(propPropertyId ?? null);
  const [tree, setTree] = useState<PropertyTree | null>(null);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [selectedRoom, setSelectedRoom] = useState<RoomNode | null>(null);
  const [selectedDesk, setSelectedDesk] = useState<DeskNode | null>(null);
  const [formOpen, setFormOpen] = useState<null | { level: "property" | "building" | "floor" | "room" | "desk"; parentId: number | null }>(null);
  const [editOpen, setEditOpen] = useState<null | { level: "property" | "building"; id: number }>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [globalSlotsOpen, setGlobalSlotsOpen] = useState(false);
  const handledPropRoomRef = useRef<number | null>(null);
  const handledPropFloorRef = useRef<number | null>(null);

  // Sync Liegenschaft bei externer Änderung (z.B. aus Zonen oder Grundriss)
  useEffect(() => {
    if (propPropertyId !== undefined && propPropertyId !== null && propPropertyId !== propertyId) {
      setPropertyId(propPropertyId);
    }
  }, [propPropertyId]);

  function loadProperties() {
    api.get<PropertyOut[]>("/catalog/properties").then((props) => {
      setProperties(props);
      if (!propertyId && props.length) {
        const initId = propPropertyId ?? props[0].id;
        setPropertyId(initId);
        onSelectProperty?.(initId);
      }
    });
  }

  useEffect(loadProperties, []);

  function loadTree() {
    if (!propertyId) return;
    api.get<PropertyTree>(`/catalog/properties/${propertyId}/tree`).then(setTree);
  }

  useEffect(loadTree, [propertyId]);

  // Hält die Detail-Auswahl nach einem Reload (z.B. nach Label-/Feld-Änderung) aktuell.
  useEffect(() => {
    if (!tree) return;
    const allRooms = tree.buildings.flatMap((b) => b.floors.flatMap((f) => f.rooms));
    if (selectedDesk) {
      const updatedDesk = allRooms.flatMap((r) => r.desks).find((d) => d.id === selectedDesk.id);
      if (updatedDesk) {
        setSelectedDesk(updatedDesk);
        const parentRoom = allRooms.find((r) => r.desks.some((d) => d.id === updatedDesk.id));
        if (parentRoom) setSelectedRoom(parentRoom);
      }
    } else if (selectedRoom) {
      const updatedRoom = allRooms.find((r) => r.id === selectedRoom.id);
      if (updatedRoom) setSelectedRoom(updatedRoom);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tree]);

  // Reaktiv den Struktur-Baum aufklappen und Raum/Etage selektieren, wenn vom Grundriss oder FM-State übergeben
  useEffect(() => {
    if (!tree) return;
    if (propRoomId && propRoomId !== handledPropRoomRef.current) {
      handledPropRoomRef.current = propRoomId;
      for (const b of tree.buildings) {
        for (const f of b.floors) {
          const r = f.rooms.find((rm) => rm.id === propRoomId);
          if (r) {
            setExpanded((prev) => ({
              ...prev,
              [`b${b.id}`]: true,
              [`f${f.id}`]: true,
            }));
            setSelectedRoom(r);
            setSelectedDesk(null);
            return;
          }
        }
      }
    } else if (propFloorId && propFloorId !== handledPropFloorRef.current) {
      handledPropFloorRef.current = propFloorId;
      for (const b of tree.buildings) {
        const f = b.floors.find((fl) => fl.id === propFloorId);
        if (f) {
          setExpanded((prev) => ({
            ...prev,
            [`b${b.id}`]: true,
            [`f${f.id}`]: true,
          }));
          return;
        }
      }
    }
  }, [tree, propRoomId, propFloorId]);

  const currentRoomFloorId = tree?.buildings
    .flatMap((b) => b.floors)
    .find((fl) => fl.rooms.some((rm) => rm.id === selectedRoom?.id))?.id;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[320px_1fr] gap-6">
      <div className="bg-surface-container-low rounded-md p-3 border border-outline-variant/30">
        <div className="mb-3 text-xs text-on-surface-variant">
          Struktur von oben nach unten pflegen: Liegenschaft → Gebäude → Etage → Raum → Desk. Ein Eintrag öffnet rechts seine Details; ✎ bearbeitet Liegenschaft oder Gebäude.
        </div>
        <div className="flex gap-2 mb-3 items-center">
          <select
            value={propertyId ?? ""}
            onChange={(e) => {
              const newId = Number(e.target.value);
              setPropertyId(newId);
              onSelectProperty?.(newId);
            }}
            className="flex-1 bg-surface rounded px-2 py-1.5 text-sm"
          >
            {properties.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
          {propertyId && <button onClick={() => setEditOpen({ level: "property", id: propertyId })} className="text-xs text-primary" title="Liegenschaft bearbeiten">✎</button>}
        </div>
        {message && <div className="text-xs text-tertiary-fixed-dim mb-2">{message}</div>}
        {tree?.buildings.map((b: BuildingNode) => (
          <div key={b.id} className="mb-1">
            <div className="flex items-center gap-1">
              <button onClick={() => setExpanded((e) => ({ ...e, [`b${b.id}`]: !e[`b${b.id}`] }))} className="flex-1 text-left text-sm font-semibold px-1 py-1 flex items-center gap-1">
                <span className={`transition-transform inline-block ${expanded[`b${b.id}`] ? "rotate-90" : ""}`}>›</span> {b.name}
              </button>
              <button onClick={() => setEditOpen({ level: "building", id: b.id })} className="text-xs text-on-surface-variant hover:text-primary" title="Gebäude bearbeiten">✎</button>
            </div>
            {expanded[`b${b.id}`] &&
              b.floors.map((f) => (
                <div key={f.id} className="ml-3">
                  <div className="flex items-center justify-between group pr-1">
                    <button
                      onClick={() => {
                        setExpanded((e) => ({ ...e, [`f${f.id}`]: !e[`f${f.id}`] }));
                        onSelectFloor?.(f.id);
                      }}
                      className="text-left text-sm px-1 py-1 flex items-center gap-1 text-on-surface-variant flex-1 hover:text-on-surface"
                    >
                      <span className={`transition-transform inline-block ${expanded[`f${f.id}`] ? "rotate-90" : ""}`}>›</span> {f.name}
                    </button>
                    <button
                      type="button"
                      onClick={() => onOpenFloorplanForFloor?.(f.id)}
                      className="text-[11px] px-1.5 py-0.5 rounded hover:bg-primary/10 text-primary font-medium flex items-center gap-1 transition-colors"
                      title="Etagen-Grundriss im Designer öffnen"
                    >
                      🗺️ Grundriss
                    </button>
                  </div>
                  {expanded[`f${f.id}`] && (
                    <div className="ml-3">
                      {f.rooms.map((r) => (
                        <div key={r.id}>
                          <button
                            onClick={() => {
                              setSelectedRoom(r);
                              setSelectedDesk(null);
                              onSelectRoom?.(r.id);
                              onSelectFloor?.(f.id);
                            }}
                            className={`w-full text-left text-sm px-2 py-1 rounded flex items-center gap-1 ${selectedRoom?.id === r.id ? "bg-secondary-container text-on-primary-fixed-variant" : "hover:bg-surface-container-high"}`}
                          >
                            {r.room_type === "meeting" ? "🏛" : "🪑"} {r.name}
                            {r.approval_required && <span title="Genehmigungspflichtig">🛡</span>}
                          </button>
                          {r.room_type === "desk_area" && r.desks.map((d) => (
                            <button
                              key={d.id}
                              onClick={() => {
                                setSelectedDesk(d);
                                setSelectedRoom(r);
                                onSelectRoom?.(r.id);
                                onSelectFloor?.(f.id);
                              }}
                              className={`w-full text-left text-xs px-2 py-0.5 ml-4 rounded ${selectedDesk?.id === d.id ? "bg-secondary-container" : "hover:bg-surface-container-high text-on-surface-variant"}`}
                            >
                              {d.desk_number}
                            </button>
                          ))}
                          <button onClick={() => setFormOpen({ level: "desk", parentId: r.id })} className="ml-4 text-xs text-primary">+ Desk</button>
                        </div>
                      ))}
                      <button onClick={() => setFormOpen({ level: "room", parentId: f.id })} className="text-xs text-primary ml-2">+ Raum</button>
                    </div>
                  )}
                </div>
              ))}
            <button onClick={() => setFormOpen({ level: "floor", parentId: b.id })} className="text-xs text-primary ml-3">+ Etage</button>
          </div>
        ))}
        {propertyId && <button onClick={() => setFormOpen({ level: "building", parentId: propertyId })} className="text-xs text-primary mt-1">+ Gebäude</button>}
        <button onClick={() => setFormOpen({ level: "property", parentId: null })} className="text-xs font-semibold text-primary mt-2 block">+ Neue Liegenschaft</button>
        <div className="pt-3 mt-3 border-t border-outline-variant/30">
          <button
            type="button"
            onClick={() => setGlobalSlotsOpen(true)}
            className="w-full p-2 rounded text-xs font-semibold bg-surface hover:bg-surface-container border border-outline-variant/30 text-primary flex items-center justify-center gap-1.5 transition-colors shadow-sm"
          >
            ⏱️ Globale Meeting-Slot Einstellungen
          </button>
        </div>
      </div>

      <div>
        {selectedDesk ? (
          <DeskDetail desk={selectedDesk} onLocked={() => setMessage("Sperrung gesetzt.")} onChanged={() => { loadTree(); setMessage("Aktualisiert."); }} />
        ) : selectedRoom ? (
          <RoomDetail
            room={selectedRoom}
            floorId={currentRoomFloorId}
            onChanged={() => { loadTree(); setMessage("Aktualisiert."); }}
            onOpenFloorplanForRoom={onOpenFloorplanForRoom}
          />
        ) : (
          <div className="text-on-surface-variant text-sm">Wählen Sie links einen Raum oder Desk, oder legen Sie eine neue Ebene an.</div>
        )}
      </div>

      {formOpen && (
        <CreateEntityModal
          level={formOpen.level}
          parentId={formOpen.parentId}
          onClose={() => setFormOpen(null)}
          onCreated={(newId) => {
            const lvl = formOpen.level;
            const pid = formOpen.parentId;
            setFormOpen(null);
            if (lvl === "property" && newId) {
              setPropertyId(newId);
            }
            if (lvl === "building" && newId) {
              setExpanded((e) => ({ ...e, [`b${newId}`]: true }));
            }
            if (lvl === "floor" && pid) {
              setExpanded((e) => ({ ...e, [`b${pid}`]: true, ...(newId ? { [`f${newId}`]: true } : {}) }));
            }
            if (lvl === "room" && pid) {
              setExpanded((e) => ({ ...e, [`f${pid}`]: true }));
            }
            loadProperties();
            loadTree();
            onStructureChanged();
            setMessage("Erfolgreich angelegt.");
          }}
        />
      )}

      {globalSlotsOpen && (
        <GlobalMeetingSlotSettingsModal
          onClose={() => setGlobalSlotsOpen(false)}
          onSaved={() => {
            loadProperties();
            loadTree();
            onStructureChanged();
            setMessage("Globale Meeting-Slot Einstellungen aktualisiert.");
          }}
        />
      )}

      {editOpen && editOpen.level === "property" && (
        <EditPropertyModal propertyId={editOpen.id} onClose={() => setEditOpen(null)} onSaved={() => { setEditOpen(null); loadProperties(); onStructureChanged(); setMessage("Aktualisiert."); }} />
      )}
      {editOpen && editOpen.level === "building" && propertyId && (
        <EditBuildingModal buildingId={editOpen.id} propertyId={propertyId} onClose={() => setEditOpen(null)} onSaved={() => { setEditOpen(null); loadTree(); onStructureChanged(); setMessage("Aktualisiert."); }} />
      )}
    </div>
  );
}

function CreateEntityModal({
  level, parentId, onClose, onCreated,
}: { level: "property" | "building" | "floor" | "room" | "desk"; parentId: number | null; onClose: () => void; onCreated: (newId?: number) => void }) {
  const [name, setName] = useState("");
  const [address, setAddress] = useState("");
  const [lat, setLat] = useState("51.0");
  const [lon, setLon] = useState("10.0");
  const [roomNumber, setRoomNumber] = useState("");
  const [roomType, setRoomType] = useState<"desk_area" | "meeting">("desk_area");
  const [capacity, setCapacity] = useState("8");
  const [deskNumber, setDeskNumber] = useState("");
  const [error, setError] = useState<string | null>(null);

  const titles: Record<string, string> = {
    property: "Neue Liegenschaft", building: "Neues Gebäude", floor: "Neue Etage", room: "Neuer Raum", desk: "Neuer Desk",
  };

  async function submit() {
    setError(null);
    try {
      let res: { id: number } | undefined;
      if (level === "property") res = await api.post<{ id: number }>("/fm/properties", { name, address, lat: Number(lat), lon: Number(lon) });
      if (level === "building") res = await api.post<{ id: number }>(`/fm/properties/${parentId}/buildings`, { name });
      if (level === "floor") res = await api.post<{ id: number }>(`/fm/buildings/${parentId}/floors`, { name });
      if (level === "room") res = await api.post<{ id: number }>(`/fm/floors/${parentId}/rooms`, { room_number: roomNumber, name, room_type: roomType, capacity: roomType === "meeting" ? Number(capacity) : null });
      if (level === "desk") res = await api.post<{ id: number }>(`/fm/rooms/${parentId}/desks`, { desk_number: deskNumber });
      onCreated(res?.id);
    } catch (e) {
      if (e instanceof ApiError) setError(e.message);
    }
  }

  return (
    <Modal title={titles[level]} onClose={onClose}>
      <div className="space-y-3">
        {error && <div className="p-2 rounded bg-error-container text-on-error-container text-sm" role="alert">{error}</div>}
        {level !== "desk" && (
          <label className="block text-sm">Name <input value={name} onChange={(e) => setName(e.target.value)} className="w-full mt-1 bg-surface-container-low rounded px-3 py-2" /></label>
        )}
        {level === "property" && (
          <>
            <label className="block text-sm">Adresse <input value={address} onChange={(e) => setAddress(e.target.value)} className="w-full mt-1 bg-surface-container-low rounded px-3 py-2" /></label>
            <div className="grid grid-cols-2 gap-2">
              <label className="block text-sm">Lat <input value={lat} onChange={(e) => setLat(e.target.value)} className="w-full mt-1 bg-surface-container-low rounded px-3 py-2" /></label>
              <label className="block text-sm">Lon <input value={lon} onChange={(e) => setLon(e.target.value)} className="w-full mt-1 bg-surface-container-low rounded px-3 py-2" /></label>
            </div>
          </>
        )}
        {level === "room" && (
          <>
            <label className="block text-sm">Raumnummer <input value={roomNumber} onChange={(e) => setRoomNumber(e.target.value)} className="w-full mt-1 bg-surface-container-low rounded px-3 py-2" /></label>
            <div className="flex gap-2">
              {(["meeting", "desk_area"] as const).map((rt) => (
                <button key={rt} onClick={() => setRoomType(rt)} className={`px-3 py-1.5 rounded-full text-sm ${roomType === rt ? "bg-primary text-on-primary" : "bg-surface-container-high"}`}>
                  {rt === "meeting" ? "Meetingraum" : "Büro-/Desk-Fläche"}
                </button>
              ))}
            </div>
            {roomType === "meeting" && <label className="block text-sm">Kapazität <input value={capacity} onChange={(e) => setCapacity(e.target.value)} className="w-full mt-1 bg-surface-container-low rounded px-3 py-2" /></label>}
          </>
        )}
        {level === "desk" && (
          <label className="block text-sm">Desk-Nummer <input value={deskNumber} onChange={(e) => setDeskNumber(e.target.value)} className="w-full mt-1 bg-surface-container-low rounded px-3 py-2" /></label>
        )}
        <Button variant="primary" className="w-full" onClick={submit}>Anlegen</Button>
      </div>
    </Modal>
  );
}

function EditPropertyModal({ propertyId, onClose, onSaved }: { propertyId: number; onClose: () => void; onSaved: () => void }) {
  const [values, setValues] = useState<{ name: string; address: string; lat: string; lon: string; checkin_required: boolean; labels: string[] } | null>(null);
  const [error, setError] = useState<string | null>(null);

  function load() {
    api.get<PropertyOut[]>("/catalog/properties").then((props) => {
      const p = props.find((x) => x.id === propertyId);
      if (p) setValues({ name: p.name, address: p.address, lat: String(p.lat), lon: String(p.lon), checkin_required: p.checkin_required, labels: p.labels });
    });
  }
  useEffect(load, [propertyId]);

  async function save() {
    if (!values) return;
    setError(null);
    try {
      await api.patch(`/fm/properties/${propertyId}`, {
        name: values.name, address: values.address, lat: Number(values.lat), lon: Number(values.lon),
        checkin_required: values.checkin_required,
      });
      onSaved();
    } catch (e) {
      if (e instanceof ApiError) setError(e.message);
    }
  }

  if (!values) return null;
  return (
    <Modal title="Liegenschaft bearbeiten" onClose={onClose}>
      <div className="space-y-3">
        {error && <div className="p-2 rounded bg-error-container text-on-error-container text-sm" role="alert">{error}</div>}
        <label className="block text-sm">Name <input value={values.name} onChange={(e) => setValues({ ...values, name: e.target.value })} className="w-full mt-1 bg-surface-container-low rounded px-3 py-2" /></label>
        <label className="block text-sm">Adresse <input value={values.address} onChange={(e) => setValues({ ...values, address: e.target.value })} className="w-full mt-1 bg-surface-container-low rounded px-3 py-2" /></label>
        <div className="grid grid-cols-2 gap-2">
          <label className="block text-sm">Lat <input value={values.lat} onChange={(e) => setValues({ ...values, lat: e.target.value })} className="w-full mt-1 bg-surface-container-low rounded px-3 py-2" /></label>
          <label className="block text-sm">Lon <input value={values.lon} onChange={(e) => setValues({ ...values, lon: e.target.value })} className="w-full mt-1 bg-surface-container-low rounded px-3 py-2" /></label>
        </div>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={values.checkin_required} onChange={(e) => setValues({ ...values, checkin_required: e.target.checked })} />
          Check-in als Standardvorschlag für neue Räume/Desks dieser Liegenschaft
        </label>
        <LabelPicker assigned={values.labels} entityKind="properties" entityId={propertyId} onChanged={load} />
        <Button variant="primary" className="w-full" onClick={save}>Speichern</Button>
      </div>
    </Modal>
  );
}

function EditBuildingModal({ buildingId, propertyId, onClose, onSaved }: { buildingId: number; propertyId: number; onClose: () => void; onSaved: () => void }) {
  const [name, setName] = useState("");
  const [labels, setLabels] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);

  function load() {
    api.get<PropertyTree>(`/catalog/properties/${propertyId}/tree`).then((tree) => {
      const b = tree.buildings.find((x) => x.id === buildingId);
      if (b) { setName(b.name); setLabels(b.labels); }
    });
  }
  useEffect(load, [buildingId, propertyId]);

  async function save() {
    setError(null);
    try {
      await api.patch(`/fm/buildings/${buildingId}`, { name });
      onSaved();
    } catch (e) {
      if (e instanceof ApiError) setError(e.message);
    }
  }

  return (
    <Modal title="Gebäude bearbeiten" onClose={onClose}>
      <div className="space-y-3">
        {error && <div className="p-2 rounded bg-error-container text-on-error-container text-sm" role="alert">{error}</div>}
        <label className="block text-sm">Name <input value={name} onChange={(e) => setName(e.target.value)} className="w-full mt-1 bg-surface-container-low rounded px-3 py-2" /></label>
        <LabelPicker assigned={labels} entityKind="buildings" entityId={buildingId} onChanged={load} />
        <Button variant="primary" className="w-full" disabled={!name.trim()} onClick={save}>Speichern</Button>
      </div>
    </Modal>
  );
}

/** Wiederverwendbarer Label-Chip-Picker: zugewiesene Labels anzeigen/entfernen + aus Katalog hinzufügen. */
function LabelPicker({ assigned, entityKind, entityId, roomType, onChanged }: {
  assigned: string[]; entityKind: "rooms" | "desks" | "properties" | "buildings"; entityId: number; roomType?: "meeting" | "desk_area"; onChanged: () => void;
}) {
  const [catalog, setCatalog] = useState<LabelOut[]>([]);
  const [picking, setPicking] = useState(false);
  const addBtnRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const entityType = entityKind === "properties" ? "property" : entityKind === "buildings" ? "building"
      : entityKind === "desks" ? "desk" : roomType === "meeting" ? "meeting_room" : "room";
    api.get<LabelOut[]>(`/catalog/labels?entity_type=${entityType}`).then(setCatalog);
  }, [entityKind, roomType]);

  async function add(labelId: number) {
    await api.post(`/fm/${entityKind}/${entityId}/labels`, { label_id: labelId });
    setPicking(false);
    onChanged();
    setTimeout(() => addBtnRef.current?.focus(), 50);
  }

  async function remove(labelName: string) {
    const label = catalog.find((l) => l.name === labelName);
    if (!label) return;
    await api.del(`/fm/${entityKind}/${entityId}/labels/${label.id}`);
    onChanged();
    setTimeout(() => addBtnRef.current?.focus(), 50);
  }

  const unassigned = catalog.filter((l) => !assigned.includes(l.name));

  return (
    <div className="mb-4">
      <div className="text-sm font-semibold mb-1">Labels</div>
      <div className="flex flex-wrap gap-1 mb-2">
        {assigned.map((l) => (
          <span key={l} className="text-xs pl-2 pr-1 py-0.5 rounded-full bg-secondary-container text-on-secondary-container flex items-center gap-1">
            {l}
            <button onClick={() => remove(l)} aria-label={`${l} entfernen`} className="hover:text-error">×</button>
          </span>
        ))}
        {assigned.length === 0 && <span className="text-xs text-on-surface-variant">Keine Labels zugewiesen.</span>}
      </div>
      {picking ? (
        <select
          autoFocus
          onChange={(e) => {
            if (e.target.value) add(Number(e.target.value));
          }}
          onBlur={() => {
            setPicking(false);
            setTimeout(() => addBtnRef.current?.focus(), 50);
          }}
          className="bg-surface-container-low rounded px-2 py-1 text-sm"
        >
          <option value="">Label wählen…</option>
          {unassigned.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
        </select>
      ) : (
        <button ref={addBtnRef} type="button" onClick={() => setPicking(true)} className="text-xs text-primary">+ Label hinzufügen</button>
      )}
    </div>
  );
}

/** Org-Einheiten-Zuordnung eines Raums mit konfigurierbarer Hierarchie-Kaskade (FR-44/45-Erweiterung). */
function OrgUnitAssignment({ roomId }: { roomId: number }) {
  const [assignments, setAssignments] = useState<RoomDepartmentOut[]>([]);
  const [departments, setDepartments] = useState<DepartmentOut[]>([]);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [selectedDept, setSelectedDept] = useState<number | "">("");
  const [includeDescendants, setIncludeDescendants] = useState(true);

  function load() {
    api.get<RoomDepartmentOut[]>(`/fm/rooms/${roomId}/departments`).then(setAssignments);
    api.get<DepartmentOut[]>("/fm/departments").then(setDepartments);
  }
  useEffect(load, [roomId]);

  async function assign() {
    if (!selectedDept) return;
    await api.post(`/fm/rooms/${roomId}/departments`, { department_id: selectedDept, include_descendants: includeDescendants });
    setPickerOpen(false);
    setSelectedDept("");
    load();
  }

  async function remove(departmentId: number) {
    await api.del(`/fm/rooms/${roomId}/departments/${departmentId}`);
    load();
  }

  return (
    <div className="mb-4">
      <div className="text-sm font-semibold mb-1">Organisationseinheiten (Zugriffsbeschränkung)</div>
      <p className="text-xs text-on-surface-variant mb-2">
        Ohne Zuordnung ist der Raum für alle buchbar. Mit Zuordnung nur für die genannte(n) Einheit(en) —
        optional inklusive aller untergeordneten Referate.
      </p>
      <div className="space-y-1 mb-2">
        {assignments.map((a) => (
          <div key={a.department_id} className="flex items-center justify-between text-sm p-2 rounded bg-surface-container-low">
            <span>{a.department_name} {a.include_descendants && <Badge tone="neutral">+ Unter-Referate</Badge>}</span>
            <button onClick={() => remove(a.department_id)} className="text-error text-xs">Entfernen</button>
          </div>
        ))}
        {assignments.length === 0 && <div className="text-xs text-on-surface-variant">Keine Beschränkung — für alle buchbar.</div>}
      </div>
      {pickerOpen ? (
        <div className="p-3 rounded bg-surface-container-low space-y-2">
          <DepartmentPicker departments={departments} value={selectedDept || null} onChange={setSelectedDept} />
          <label className="flex items-center gap-2 text-xs">
            <input type="checkbox" checked={includeDescendants} onChange={(e) => setIncludeDescendants(e.target.checked)} />
            Auch untergeordnete Organisationseinheiten einschließen
          </label>
          <div className="flex gap-2">
            <Button variant="primary" disabled={!selectedDept} onClick={assign}>Zuweisen</Button>
            <Button variant="secondary" onClick={() => setPickerOpen(false)}>Abbrechen</Button>
          </div>
        </div>
      ) : (
        <button onClick={() => setPickerOpen(true)} className="text-xs text-primary">+ Org-Einheit zuweisen</button>
      )}
    </div>
  );
}

function GlobalMeetingSlotSettingsModal({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const [slotDuration, setSlotDuration] = useState(60);
  const [dayStart, setDayStart] = useState(8);
  const [dayEnd, setDayEnd] = useState(18);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get<{ slot_duration_minutes: number; day_start_hour: number; day_end_hour: number }>("/fm/settings/meeting-slots")
      .then((cfg) => {
        setSlotDuration(cfg.slot_duration_minutes);
        setDayStart(cfg.day_start_hour);
        setDayEnd(cfg.day_end_hour);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  async function handleSave() {
    if (dayEnd <= dayStart) {
      setError("Das Ende des Buchungsfensters muss nach dem Beginn liegen.");
      return;
    }
    try {
      await api.put("/fm/settings/meeting-slots", {
        slot_duration_minutes: Number(slotDuration),
        day_start_hour: Number(dayStart),
        day_end_hour: Number(dayEnd),
      });
      onSaved();
      onClose();
    } catch (e) {
      if (e instanceof ApiError) setError(e.message);
      else setError("Fehler beim Speichern der Slot-Einstellungen.");
    }
  }

  return (
    <Modal title="Globale Meetingraum-Slot-Einstellungen" onClose={onClose}>
      <div className="space-y-4 text-sm text-on-surface">
        <p className="text-xs text-on-surface-variant">
          Diese Einstellungen gelten standardmäßig für alle Meetingräume, sofern kein raumspezifischer Override hinterlegt ist.
        </p>
        {error && <div className="p-2 rounded bg-error-container text-on-error-container text-xs">{error}</div>}

        <label className="block text-xs">
          Standard Slot-Dauer
          <select
            value={slotDuration}
            onChange={(e) => setSlotDuration(Number(e.target.value))}
            className="w-full mt-1 bg-surface-container-low rounded px-2.5 py-1.5 border border-outline-variant/30 text-sm"
          >
            <option value={15}>15 Minuten</option>
            <option value={30}>30 Minuten</option>
            <option value={45}>45 Minuten</option>
            <option value={60}>60 Minuten (1 Stunde)</option>
            <option value={90}>90 Minuten (1,5 Stunden)</option>
            <option value={120}>120 Minuten (2 Stunden)</option>
          </select>
        </label>

        <div className="grid grid-cols-2 gap-3">
          <label className="block text-xs">
            Buchungsfenster Beginn
            <select
              value={dayStart}
              onChange={(e) => setDayStart(Number(e.target.value))}
              className="w-full mt-1 bg-surface-container-low rounded px-2.5 py-1.5 border border-outline-variant/30 text-sm"
            >
              {[6, 7, 8, 9, 10].map((h) => (
                <option key={h} value={h}>{String(h).padStart(2, "0")}:00 Uhr</option>
              ))}
            </select>
          </label>

          <label className="block text-xs">
            Buchungsfenster Ende
            <select
              value={dayEnd}
              onChange={(e) => setDayEnd(Number(e.target.value))}
              className="w-full mt-1 bg-surface-container-low rounded px-2.5 py-1.5 border border-outline-variant/30 text-sm"
            >
              {[16, 17, 18, 19, 20, 21, 22].map((h) => (
                <option key={h} value={h}>{String(h).padStart(2, "0")}:00 Uhr</option>
              ))}
            </select>
          </label>
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <Button variant="secondary" onClick={onClose}>Abbrechen</Button>
          <Button variant="primary" onClick={handleSave} disabled={loading}>Einstellungen speichern</Button>
        </div>
      </div>
    </Modal>
  );
}

function SeatingOptionManager({
  roomId,
  options,
  onOptionsChanged,
}: {
  roomId: number;
  options: SeatingOptionOut[];
  onOptionsChanged: () => void;
}) {
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editName, setEditName] = useState("");
  const [editIsStandard, setEditIsStandard] = useState(false);
  const [editDays, setEditDays] = useState(0);

  const [adding, setAdding] = useState(false);
  const [newName, setNewName] = useState("");
  const [newIsStandard, setNewIsStandard] = useState(false);
  const [newDays, setNewDays] = useState(0);
  const [error, setError] = useState<string | null>(null);

  function startEdit(opt: SeatingOptionOut) {
    setEditingId(opt.id);
    setEditName(opt.name);
    setEditIsStandard(opt.is_standard);
    setEditDays(opt.changeover_days);
    setError(null);
  }

  async function saveEdit(optionId: number) {
    if (!editName.trim()) {
      setError("Name der Bestuhlungsoption darf nicht leer sein.");
      return;
    }
    try {
      await api.put(`/fm/rooms/${roomId}/seating-options/${optionId}`, {
        name: editName.trim(),
        is_standard: editIsStandard,
        changeover_days: Number(editDays),
      });
      setEditingId(null);
      setError(null);
      onOptionsChanged();
    } catch (e) {
      if (e instanceof ApiError) setError(e.message);
      else setError("Fehler beim Speichern der Bestuhlungsoption.");
    }
  }

  async function deleteOption(optionId: number) {
    if (!confirm("Möchten Sie diese Bestuhlungsoption wirklich löschen?")) return;
    try {
      await api.del(`/fm/rooms/${roomId}/seating-options/${optionId}`);
      if (editingId === optionId) setEditingId(null);
      onOptionsChanged();
    } catch (e) {
      if (e instanceof ApiError) setError(e.message);
      else setError("Fehler beim Löschen der Bestuhlungsoption.");
    }
  }

  async function createOption() {
    if (!newName.trim()) {
      setError("Bitte einen Namen für die Bestuhlungsoption eingeben.");
      return;
    }
    try {
      await api.post(`/fm/rooms/${roomId}/seating-options`, {
        name: newName.trim(),
        is_standard: newIsStandard,
        changeover_days: Number(newDays),
      });
      setAdding(false);
      setNewName("");
      setNewIsStandard(false);
      setNewDays(0);
      setError(null);
      onOptionsChanged();
    } catch (e) {
      if (e instanceof ApiError) setError(e.message);
      else setError("Fehler beim Anlegen der Bestuhlungsoption.");
    }
  }

  return (
    <div className="mb-5 p-3.5 rounded-md bg-surface-container-low border border-outline-variant/30 space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <div className="text-sm font-semibold text-on-surface">🪑 Bestuhlungsoptionen & Umbautage</div>
          <div className="text-xs text-on-surface-variant">Konfigurieren Sie verfügbare Bestuhlungsarten und nötige Vorlaufzeiten (Umbautage).</div>
        </div>
        {!adding && (
          <button
            type="button"
            onClick={() => { setAdding(true); setError(null); }}
            className="px-2.5 py-1 text-xs font-semibold rounded bg-primary text-on-primary hover:bg-primary/90 transition-colors shadow-sm"
          >
            + Option hinzufügen
          </button>
        )}
      </div>

      {error && <div className="p-2 rounded bg-error-container text-on-error-container text-xs">{error}</div>}

      {/* Liste der Optionen */}
      <div className="space-y-2">
        {options.map((opt) => (
          <div key={opt.id} className="p-2.5 rounded bg-surface border border-outline-variant/20 text-xs">
            {editingId === opt.id ? (
              <div className="space-y-2">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  <label className="block">
                    Name
                    <input
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      className="w-full mt-0.5 bg-surface-container-lowest rounded px-2 py-1 border border-outline-variant/30 text-xs"
                    />
                  </label>
                  <label className="block">
                    Umbautage
                    <input
                      type="number"
                      min={0}
                      max={5}
                      value={editDays}
                      onChange={(e) => setEditDays(Number(e.target.value))}
                      className="w-full mt-0.5 bg-surface-container-lowest rounded px-2 py-1 border border-outline-variant/30 text-xs"
                    />
                  </label>
                  <label className="flex items-center gap-2 pt-4">
                    <input
                      type="checkbox"
                      checked={editIsStandard}
                      onChange={(e) => setEditIsStandard(e.target.checked)}
                    />
                    Als Standardbestuhlung
                  </label>
                </div>
                <div className="flex gap-2 justify-end pt-1">
                  <Button variant="secondary" className="text-xs py-1" onClick={() => setEditingId(null)}>Abbrechen</Button>
                  <Button variant="primary" className="text-xs py-1" onClick={() => saveEdit(opt.id)}>Speichern</Button>
                </div>
              </div>
            ) : (
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-on-surface">{opt.name}</span>
                  {opt.is_standard && (
                    <span className="px-1.5 py-0.5 rounded bg-secondary-container text-on-secondary-container font-medium text-[10px]">
                      Standard
                    </span>
                  )}
                  <span className="text-on-surface-variant">
                    · {opt.changeover_days} {opt.changeover_days === 1 ? "Umbautag" : "Umbautage"}
                  </span>
                </div>
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => startEdit(opt)}
                    className="px-2 py-0.5 rounded text-[11px] text-primary hover:bg-primary/10 transition-colors"
                  >
                    ✎ Bearbeiten
                  </button>
                  <button
                    type="button"
                    onClick={() => deleteOption(opt.id)}
                    className="px-2 py-0.5 rounded text-[11px] text-error hover:bg-error/10 transition-colors"
                  >
                    🗑 Löschen
                  </button>
                </div>
              </div>
            )}
          </div>
        ))}
        {options.length === 0 && !adding && (
          <div className="text-xs text-on-surface-variant italic py-1">
            Noch keine speziellen Bestuhlungsoptionen angelegt. Der Raum nutzt die im Plan konfigurierte Standard-Anordnung.
          </div>
        )}
      </div>

      {/* Neue Option anlegen */}
      {adding && (
        <div className="p-3 rounded bg-surface border border-primary/40 space-y-2 text-xs">
          <div className="font-semibold text-primary">Neue Bestuhlungsoption erfassen</div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            <label className="block">
              Name
              <input
                placeholder="z. B. U-Form, Parlament..."
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                className="w-full mt-0.5 bg-surface-container-lowest rounded px-2 py-1 border border-outline-variant/30 text-xs"
              />
            </label>
            <label className="block">
              Umbautage
              <input
                type="number"
                min={0}
                max={5}
                value={newDays}
                onChange={(e) => setNewDays(Number(e.target.value))}
                className="w-full mt-0.5 bg-surface-container-lowest rounded px-2 py-1 border border-outline-variant/30 text-xs"
              />
            </label>
            <label className="flex items-center gap-2 pt-4">
              <input
                type="checkbox"
                checked={newIsStandard}
                onChange={(e) => setNewIsStandard(e.target.checked)}
              />
              Als Standard
            </label>
          </div>
          <div className="flex gap-2 justify-end pt-1">
            <Button variant="secondary" className="text-xs py-1" onClick={() => setAdding(false)}>Abbrechen</Button>
            <Button variant="primary" className="text-xs py-1" onClick={createOption}>Option anlegen</Button>
          </div>
        </div>
      )}
    </div>
  );
}

function RoomDetail({
  room,
  floorId,
  onChanged,
  onOpenFloorplanForRoom,
}: {
  room: RoomNode;
  floorId?: number | null;
  onChanged: () => void;
  onOpenFloorplanForRoom?: (roomId: number, floorId?: number | null) => void;
}) {
  const [approvalRequired, setApprovalRequired] = useState(room.approval_required);
  const [checkinRequired, setCheckinRequired] = useState(room.checkin_required);
  const [name, setName] = useState(room.name);
  const [roomNumber, setRoomNumber] = useState(room.room_number);
  const [capacity, setCapacity] = useState(room.capacity ?? 0);
  const [slotDuration, setSlotDuration] = useState<number | "">(room.slot_duration_minutes ?? "");
  const [dayStartHour, setDayStartHour] = useState<number | "">(room.day_start_hour ?? "");
  const [dayEndHour, setDayEndHour] = useState<number | "">(room.day_end_hour ?? "");
  const [seatingLayout, setSeatingLayout] = useState(room.seating_layout || "boardroom");
  const [lockOpen, setLockOpen] = useState(false);
  const [lockReason, setLockReason] = useState("");
  const [lockError, setLockError] = useState<string | null>(null);
  const [seating, setSeating] = useState<SeatingOptionOut[]>([]);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    setApprovalRequired(room.approval_required);
    setCheckinRequired(room.checkin_required);
    setName(room.name);
    setRoomNumber(room.room_number);
    setCapacity(room.capacity ?? 0);
    setSlotDuration(room.slot_duration_minutes ?? "");
    setDayStartHour(room.day_start_hour ?? "");
    setDayEndHour(room.day_end_hour ?? "");
    setSeatingLayout(room.seating_layout || "boardroom");
    if (room.room_type === "meeting") {
      api.get<SeatingOptionOut[]>(`/fm/rooms/${room.id}/seating-options`).then(setSeating);
    }
  }, [room]);

  async function toggleApproval() {
    await api.patch(`/fm/rooms/${room.id}`, { approval_required: !approvalRequired });
    setApprovalRequired((v) => !v);
    onChanged();
  }

  async function toggleCheckin() {
    await api.patch(`/fm/rooms/${room.id}`, { checkin_required: !checkinRequired });
    setCheckinRequired((v) => !v);
    onChanged();
  }

  async function saveDetails(newDuration?: number | "", newStart?: number | "", newEnd?: number | "") {
    const d = newDuration !== undefined ? newDuration : slotDuration;
    const s = newStart !== undefined ? newStart : dayStartHour;
    const e = newEnd !== undefined ? newEnd : dayEndHour;

    await api.patch(`/fm/rooms/${room.id}`, {
      name,
      room_number: roomNumber,
      capacity: room.room_type === "meeting" ? capacity : null,
      seating_layout: room.room_type === "meeting" ? seatingLayout : null,
      slot_duration_minutes: d === "" ? 0 : Number(d),
      day_start_hour: s === "" ? -1 : Number(s),
      day_end_hour: e === "" ? 0 : Number(e),
    });
    setSaved(true);
    onChanged();
  }

  async function lock() {
    setLockError(null);
    const today = new Date().toISOString().slice(0, 10);
    try {
      await api.post("/fm/locks", { entity_type: "room", entity_id: room.id, start_at: `${today}T00:00:00`, end_at: null, reason: lockReason });
      setLockOpen(false);
      setLockReason("");
      onChanged();
    } catch (e) {
      if (e instanceof ApiError) setLockError(e.message);
    }
  }

  return (
    <div className="bg-surface-container-lowest rounded-md p-5 border border-outline-variant/30 space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="text-sm text-on-surface-variant font-medium">
          Raum {room.room_number} · {room.room_type === "meeting" ? "🏛 Meetingraum" : "💼 Büro-/Desk-Fläche"}
        </div>
        {onOpenFloorplanForRoom && (
          <button
            type="button"
            onClick={() => onOpenFloorplanForRoom(room.id, floorId)}
            className="px-3 py-1.5 text-xs font-semibold rounded bg-primary/10 text-primary hover:bg-primary/20 border border-primary/20 transition-colors flex items-center gap-1.5 shadow-sm"
            title="Diesen Raum im Grundriss-Designer öffnen"
          >
            🎨 Diesen Raum im Grundriss-Designer gestalten ↗
          </button>
        )}
      </div>

      <div className="grid grid-cols-2 gap-3">
        <label className="block text-sm">Name
          <input value={name} onChange={(e) => { setName(e.target.value); setSaved(false); }} onBlur={() => saveDetails()} className="w-full mt-1 bg-surface-container-low rounded px-3 py-2 text-sm" />
        </label>
        <label className="block text-sm">Raumnummer
          <input value={roomNumber} onChange={(e) => { setRoomNumber(e.target.value); setSaved(false); }} onBlur={() => saveDetails()} className="w-full mt-1 bg-surface-container-low rounded px-3 py-2 text-sm" />
        </label>
      </div>
      {room.room_type === "meeting" && (
        <div className="grid grid-cols-2 gap-3">
          <label className="block text-sm">Kapazität (Personen)
            <input type="number" value={capacity} onChange={(e) => { setCapacity(Number(e.target.value)); setSaved(false); }} onBlur={() => saveDetails()} className="w-full mt-1 bg-surface-container-low rounded px-3 py-2 text-sm" />
          </label>
          <label className="block text-sm">Standard-Bestuhlung
            <select
              value={seatingLayout}
              onChange={async (e) => {
                const val = e.target.value;
                setSeatingLayout(val);
                await api.patch(`/fm/rooms/${room.id}`, { seating_layout: val });
                setSaved(true);
                onChanged();
              }}
              className="w-full mt-1 bg-surface-container-low rounded px-3 py-2 text-sm"
            >
              <option value="boardroom">Konferenztisch (Boardroom)</option>
              <option value="u_shape">U-Form</option>
              <option value="classroom">Parlamentarisch / Schulung</option>
              <option value="cinema">Reihenbestuhlung / Theater</option>
              <option value="banquet">Bankett / Gruppen</option>
            </select>
          </label>
        </div>
      )}

      {/* RAUM-SPEZIFISCHE BUCHUNGS-SLOT KONFIGURATION BEI MEETINGRÄUMEN */}
      {room.room_type === "meeting" && (
        <div className="p-3.5 rounded-md bg-surface-container-low border border-outline-variant/30 space-y-2.5">
          <div className="text-sm font-semibold text-on-surface">⏱️ Buchungs-Slot Konfiguration (Raum-Override)</div>
          <div className="text-xs text-on-surface-variant">
            Hier können Sie die Slot-Dauer und das tägliche Buchungsfenster individuell für diesen Meetingraum überschreiben.
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1">
            <label className="block text-xs">
              Slot-Dauer
              <select
                value={slotDuration}
                onChange={(e) => {
                  const val = e.target.value ? Number(e.target.value) : "";
                  setSlotDuration(val);
                  saveDetails(val, undefined, undefined);
                }}
                className="w-full mt-1 bg-surface rounded px-2.5 py-1.5 border border-outline-variant/30 text-xs"
              >
                <option value="">Globaler Standard</option>
                <option value={15}>15 Minuten</option>
                <option value={30}>30 Minuten</option>
                <option value={45}>45 Minuten</option>
                <option value={60}>60 Minuten (1 Stunde)</option>
                <option value={90}>90 Minuten (1,5 Stunden)</option>
                <option value={120}>120 Minuten (2 Stunden)</option>
              </select>
            </label>

            <label className="block text-xs">
              Buchungsfenster Beginn
              <select
                value={dayStartHour}
                onChange={(e) => {
                  const val = e.target.value ? Number(e.target.value) : "";
                  setDayStartHour(val);
                  saveDetails(undefined, val, undefined);
                }}
                className="w-full mt-1 bg-surface rounded px-2.5 py-1.5 border border-outline-variant/30 text-xs"
              >
                <option value="">Globaler Standard</option>
                {[6, 7, 8, 9, 10].map((h) => (
                  <option key={h} value={h}>{String(h).padStart(2, "0")}:00 Uhr</option>
                ))}
              </select>
            </label>

            <label className="block text-xs">
              Buchungsfenster Ende
              <select
                value={dayEndHour}
                onChange={(e) => {
                  const val = e.target.value ? Number(e.target.value) : "";
                  setDayEndHour(val);
                  saveDetails(undefined, undefined, val);
                }}
                className="w-full mt-1 bg-surface rounded px-2.5 py-1.5 border border-outline-variant/30 text-xs"
              >
                <option value="">Globaler Standard</option>
                {[16, 17, 18, 19, 20, 21, 22].map((h) => (
                  <option key={h} value={h}>{String(h).padStart(2, "0")}:00 Uhr</option>
                ))}
              </select>
            </label>
          </div>
        </div>
      )}

      {saved && <div className="text-xs text-tertiary-fixed-dim">✓ Gespeichert.</div>}

      <LabelPicker assigned={room.labels} entityKind="rooms" entityId={room.id} roomType={room.room_type} onChanged={onChanged} />

      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" checked={approvalRequired} onChange={toggleApproval} /> Genehmigungspflichtig
      </label>
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" checked={checkinRequired} onChange={toggleCheckin} /> Check-in erforderlich (unabhängig von der Liegenschaft)
      </label>

      <OrgUnitAssignment roomId={room.id} />

      {/* BESTUHLUNGSOPTIONEN MANAGER FÜR MEETINGRÄUME */}
      {room.room_type === "meeting" && (
        <SeatingOptionManager
          roomId={room.id}
          options={seating}
          onOptionsChanged={() => {
            api.get<SeatingOptionOut[]>(`/fm/rooms/${room.id}/seating-options`).then(setSeating);
            onChanged();
          }}
        />
      )}

      {room.is_locked ? (
        <div className="p-3.5 rounded-md bg-amber-500/10 border border-amber-500/30 text-amber-200 flex items-center justify-between">
          <div>
            <div className="font-semibold text-sm flex items-center gap-1.5">
              🔒 Raum ist aktuell gesperrt
            </div>
            {room.lock_reason && <div className="text-xs text-on-surface-variant mt-0.5">Grund: {room.lock_reason}</div>}
          </div>
          <Button
            variant="secondary"
            onClick={async () => {
              try {
                await api.post("/fm/unlock", { entity_type: "room", entity_id: room.id, lock_id: room.lock_id });
                onChanged();
              } catch (err) {
                if (err instanceof ApiError) setLockError(err.message);
              }
            }}
          >
            Sperrung aufheben
          </Button>
        </div>
      ) : (
        <Button variant="destructive" onClick={() => setLockOpen(true)}>Raum sperren</Button>
      )}

      {lockOpen && (
        <Modal title="Raum sperren" onClose={() => setLockOpen(false)}>
          <p className="text-sm text-on-surface-variant mb-2">Bestehende Buchungen werden automatisch storniert; Betroffene werden benachrichtigt (FR-27/29).</p>
          {lockError && <div className="p-2 rounded bg-error-container text-on-error-container text-sm mb-2" role="alert">{lockError}</div>}
          <textarea value={lockReason} onChange={(e) => setLockReason(e.target.value)} placeholder="Grund (z.B. Wasserschaden)…" className="w-full bg-surface-container-low rounded px-3 py-2 mb-3" rows={3} />
          <Button variant="destructive" disabled={!lockReason.trim()} onClick={lock}>Sperrung bestätigen</Button>
        </Modal>
      )}
    </div>
  );
}

function DeskDetail({ desk, onLocked, onChanged }: { desk: DeskNode; onLocked: () => void; onChanged: () => void }) {
  const [lockOpen, setLockOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [deskNumber, setDeskNumber] = useState(desk.desk_number);
  const [approvalRequired, setApprovalRequired] = useState(desk.approval_required);
  const [checkinRequired, setCheckinRequired] = useState(desk.checkin_required);

  useEffect(() => {
    setDeskNumber(desk.desk_number);
    setApprovalRequired(desk.approval_required);
    setCheckinRequired(desk.checkin_required);
  }, [desk]);

  async function saveNumber() {
    await api.patch(`/fm/desks/${desk.id}`, { desk_number: deskNumber });
    onChanged();
  }

  async function toggleApproval() {
    await api.patch(`/fm/desks/${desk.id}`, { approval_required: !approvalRequired });
    setApprovalRequired((v) => !v);
    onChanged();
  }

  async function toggleCheckin() {
    await api.patch(`/fm/desks/${desk.id}`, { checkin_required: !checkinRequired });
    setCheckinRequired((v) => !v);
    onChanged();
  }

  async function lock() {
    setError(null);
    const today = new Date().toISOString().slice(0, 10);
    try {
      await api.post("/fm/locks", { entity_type: "desk", entity_id: desk.id, start_at: `${today}T00:00:00`, end_at: null, reason });
      setLockOpen(false);
      setReason("");
      onLocked();
    } catch (e) {
      if (e instanceof ApiError) setError(e.message);
    }
  }

  return (
    <div className="bg-surface-container-lowest rounded-md p-5 border border-outline-variant/30">
      {desk.is_locked ? (
        <div className="mb-4 p-3.5 rounded-md bg-amber-500/10 border border-amber-500/30 text-amber-200 flex items-center justify-between">
          <div>
            <div className="font-semibold text-sm flex items-center gap-1.5">
              🔒 Arbeitsplatz ist aktuell gesperrt
            </div>
            {desk.lock_reason && <div className="text-xs text-on-surface-variant mt-0.5">Grund: {desk.lock_reason}</div>}
          </div>
          <Button
            variant="secondary"
            onClick={async () => {
              try {
                await api.post("/fm/unlock", { entity_type: "desk", entity_id: desk.id, lock_id: desk.lock_id });
                onChanged();
              } catch (err) {
                if (err instanceof ApiError) setError(err.message);
              }
            }}
          >
            Sperrung aufheben
          </Button>
        </div>
      ) : null}

      <label className="block text-sm mb-4 max-w-[200px]">Desk-Nummer
        <input value={deskNumber} onChange={(e) => setDeskNumber(e.target.value)} onBlur={saveNumber} className="w-full mt-1 bg-surface-container-low rounded px-3 py-2" />
      </label>

      <LabelPicker assigned={desk.labels} entityKind="desks" entityId={desk.id} onChanged={onChanged} />

      <label className="flex items-center gap-2 text-sm mb-3">
        <input type="checkbox" checked={approvalRequired} onChange={toggleApproval} /> Genehmigungspflichtig
      </label>
      <label className="flex items-center gap-2 text-sm mb-4">
        <input type="checkbox" checked={checkinRequired} onChange={toggleCheckin} /> Check-in erforderlich
      </label>

      {!desk.is_locked && (
        <Button variant="destructive" onClick={() => setLockOpen(true)}>Desk sperren (Wartung)</Button>
      )}
      {lockOpen && (
        <Modal title="Desk sperren" onClose={() => setLockOpen(false)}>
          {error && <div className="p-2 rounded bg-error-container text-on-error-container text-sm mb-2" role="alert">{error}</div>}
          <textarea value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Grund…" className="w-full bg-surface-container-low rounded px-3 py-2 mb-3" rows={3} />
          <Button variant="destructive" disabled={!reason.trim()} onClick={lock}>Sperrung bestätigen</Button>
        </Modal>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Labels
// ---------------------------------------------------------------------------

const LABEL_TYPES: { value: string; label: string }[] = [
  { value: "property", label: "Liegenschaft" },
  { value: "building", label: "Gebäude" },
  { value: "room", label: "Raum (Desk-Bereich)" },
  { value: "meeting_room", label: "Meetingraum" },
  { value: "desk", label: "Desk" },
];

function LabelsTab() {
  const [catalog, setCatalog] = useState<LabelUsage[]>([]);
  const [name, setName] = useState("");
  const [similar, setSimilar] = useState<LabelSuggestion[]>([]);
  const [selected, setSelected] = useState<number[]>([]);
  const [newTypes, setNewTypes] = useState<string[]>(LABEL_TYPES.map((t) => t.value));
  const [editingTypesFor, setEditingTypesFor] = useState<number | null>(null);
  const [editTypes, setEditTypes] = useState<string[]>([]);

  function load() {
    api.get<LabelUsage[]>("/fm/labels/catalog").then(setCatalog);
  }
  useEffect(load, []);

  async function checkSimilar(value: string) {
    setName(value);
    if (value.length < 3) { setSimilar([]); return; }
    setSimilar(await api.get<LabelSuggestion[]>(`/fm/labels/similar?name=${encodeURIComponent(value)}`));
  }

  async function createLabel(force: boolean) {
    await api.post("/fm/labels", { name, force, applicable_types: newTypes });
    setName("");
    setSimilar([]);
    setNewTypes(LABEL_TYPES.map((t) => t.value));
    load();
  }

  async function mergeSelected() {
    if (selected.length < 2) return;
    const [target, ...sources] = selected;
    await api.post("/fm/labels/merge", { source_label_ids: sources, target_label_id: target });
    setSelected([]);
    load();
  }

  function startEditTypes(l: LabelUsage) {
    setEditingTypesFor(l.id);
    setEditTypes(l.applicable_types);
  }

  async function saveTypes(labelId: number) {
    await api.patch(`/fm/labels/${labelId}`, { applicable_types: editTypes });
    setEditingTypesFor(null);
    load();
  }

  return (
    <div className="max-w-2xl">
      <div className="mb-6">
        <label className="block text-sm mb-1">Neues Label</label>
        <div className="flex gap-2">
          <input value={name} onChange={(e) => checkSimilar(e.target.value)} className="flex-1 bg-surface-container-low rounded px-3 py-2" placeholder="z.B. Fensterplatz" />
          <Button variant="primary" disabled={newTypes.length === 0} onClick={() => createLabel(similar.length === 0)}>Anlegen</Button>
        </div>
        <div className="mt-2">
          <div className="text-xs text-on-surface-variant mb-1">Gilt für (mehrfach wählbar — ein Label wie "Barrierefrei" muss nicht pro Typ neu angelegt werden):</div>
          <div className="flex flex-wrap gap-3">
            {LABEL_TYPES.map((t) => (
              <label key={t.value} className="flex items-center gap-1 text-xs">
                <input
                  type="checkbox"
                  checked={newTypes.includes(t.value)}
                  onChange={(e) => setNewTypes((s) => (e.target.checked ? [...s, t.value] : s.filter((x) => x !== t.value)))}
                />
                {t.label}
              </label>
            ))}
          </div>
        </div>
        {similar.length > 0 && (
          <div className="mt-2 p-3 rounded bg-error-container/40 border border-error/20 text-sm" role="alert" aria-live="polite">
            Ähnliches Label existiert: <strong>{similar[0].label_name}</strong> ({Math.round(similar[0].similarity * 100)}% Ähnlichkeit).
            <div className="flex gap-3 mt-2">
              <button className="text-primary font-semibold" onClick={() => setName(similar[0].label_name)}>Vorhandenes verwenden</button>
              <button className="text-on-surface-variant" onClick={() => createLabel(true)}>Trotzdem neu anlegen</button>
            </div>
          </div>
        )}
      </div>

      <div className="flex justify-between items-center mb-2">
        <div className="font-semibold">Label-Katalog</div>
        <Button variant="secondary" disabled={selected.length < 2} onClick={mergeSelected}>Ausgewählte zusammenführen</Button>
      </div>
      <div className="space-y-1">
        {catalog.map((l) => (
          <div key={l.id} className="p-2 rounded hover:bg-surface-container-low text-sm">
            <div className="flex items-center gap-3">
              <input type="checkbox" checked={selected.includes(l.id)} onChange={(e) => setSelected((s) => (e.target.checked ? [...s, l.id] : s.filter((x) => x !== l.id)))} />
              <span className="flex-1">{l.name}</span>
              <span className="text-on-surface-variant data-tabular">{l.usage_count}× verwendet</span>
              <button onClick={() => startEditTypes(l)} className="text-xs text-primary">Typen bearbeiten</button>
            </div>
            {editingTypesFor === l.id ? (
              <div className="ml-7 mt-1 flex flex-wrap items-center gap-3">
                {LABEL_TYPES.map((t) => (
                  <label key={t.value} className="flex items-center gap-1 text-xs">
                    <input
                      type="checkbox"
                      checked={editTypes.includes(t.value)}
                      onChange={(e) => setEditTypes((s) => (e.target.checked ? [...s, t.value] : s.filter((x) => x !== t.value)))}
                    />
                    {t.label}
                  </label>
                ))}
                <Button variant="secondary" onClick={() => saveTypes(l.id)}>Speichern</Button>
                <button onClick={() => setEditingTypesFor(null)} className="text-xs text-on-surface-variant">Abbrechen</button>
              </div>
            ) : (
              <div className="ml-7 text-xs text-on-surface-variant">
                {l.applicable_types.map((v) => LABEL_TYPES.find((t) => t.value === v)?.label ?? v).join(", ")}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Zonen
// ---------------------------------------------------------------------------

function ZonesTab({
  structureVersion,
  selectedPropertyId: propPropertyId,
  onSelectProperty,
}: {
  structureVersion: number;
  selectedPropertyId?: number | null;
  onSelectProperty?: (id: number) => void;
}) {
  const [properties, setProperties] = useState<PropertyOut[]>([]);
  const [propertyId, setPropertyId] = useState<number | null>(propPropertyId ?? null);
  const [zones, setZones] = useState<ZoneOut[]>([]);
  const [departments, setDepartments] = useState<DepartmentOut[]>([]);
  const [tree, setTree] = useState<PropertyTree | null>(null);
  const [newZoneName, setNewZoneName] = useState("");
  const [assignZoneId, setAssignZoneId] = useState<number | null>(null);
  const [assignDeptId, setAssignDeptId] = useState<number | null>(null);
  const [assignIncludeDescendants, setAssignIncludeDescendants] = useState(true);
  const [selectedDesks, setSelectedDesks] = useState<number[]>([]);
  const [selectedRoomIds, setSelectedRoomIds] = useState<number[]>([]);
  const [selectedBuildingIds, setSelectedBuildingIds] = useState<number[]>([]);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (propPropertyId !== undefined && propPropertyId !== null && propPropertyId !== propertyId) {
      setPropertyId(propPropertyId);
    }
  }, [propPropertyId]);

  useEffect(() => {
    api.get<PropertyOut[]>("/catalog/properties").then((props) => {
      setProperties(props);
      if (!propertyId && props.length) {
        const initId = propPropertyId ?? props[0].id;
        setPropertyId(initId);
        onSelectProperty?.(initId);
      }
    });
    api.get<DepartmentOut[]>("/fm/departments").then(setDepartments);
  }, []);

  useEffect(() => {
    api.get<PropertyOut[]>("/catalog/properties").then((props) => {
      setProperties(props);
      if (props.length) setPropertyId((current) => current ?? propPropertyId ?? props[0].id);
    });
  }, [structureVersion]);

  async function loadZones() {
    if (!propertyId) return;
    const [zoneData, treeData] = await Promise.all([
      api.get<ZoneOut[]>(`/fm/zones?property_id=${propertyId}`),
      api.get<PropertyTree>(`/catalog/properties/${propertyId}/tree`),
    ]);
    setZones(zoneData);
    setTree(treeData);
  }
  useEffect(() => { void loadZones(); }, [propertyId, structureVersion]);

  async function createZone() {
    if (!propertyId || !newZoneName) return;
    setError(null);
    try {
      await api.post("/fm/zones", { property_id: propertyId, name: newZoneName });
      setNewZoneName("");
      setMessage("Zone angelegt. Ordnen Sie nun zuerst eine Organisationseinheit zu.");
      await loadZones();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Zone konnte nicht angelegt werden.");
    }
  }

  async function assignDepartment() {
    if (!assignZoneId || !assignDeptId) return;
    setError(null);
    try {
      await api.post(`/fm/zones/${assignZoneId}/departments`, { department_id: assignDeptId, include_descendants: assignIncludeDescendants });
      setMessage("Organisationseinheit zugeordnet. Nur diese Einheit und optional ihre Untereinheiten dürfen die Zonen-Desks buchen.");
      await loadZones();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Organisationseinheit konnte nicht zugeordnet werden.");
    }
  }

  async function assignDesks() {
    if (!assignZoneId || (selectedDesks.length === 0 && selectedRoomIds.length === 0 && selectedBuildingIds.length === 0)) return;
    setError(null);
    try {
      await api.post(`/fm/zones/${assignZoneId}/desks`, { desk_ids: selectedDesks, room_ids: selectedRoomIds, building_ids: selectedBuildingIds });
      setMessage("Auswahl zugewiesen. Der Zähler der Zone wurde aktualisiert.");
      await loadZones();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Auswahl konnte nicht zugewiesen werden.");
    }
  }

  async function dissolve(id: number) {
    await api.del(`/fm/zones/${id}`);
    loadZones();
  }

  const allDesks = tree ? tree.buildings.flatMap((b) => b.floors.flatMap((f) => f.rooms.filter((r) => r.room_type === "desk_area").flatMap((r) => r.desks.map((d) => ({ ...d, roomName: r.name }))))) : [];
  const deskAreaRooms = tree ? tree.buildings.flatMap((b) => b.floors.flatMap((f) => f.rooms.filter((r) => r.room_type === "desk_area").map((r) => ({ ...r, buildingName: b.name, floorName: f.name })))) : [];
  const buildings = tree ? tree.buildings : [];

  return (
    <div>
      <div className="mb-4 p-3 rounded bg-secondary-container/40 border border-primary/20 text-sm text-on-surface">
        <strong>So funktionieren Zonen:</strong> Zuerst eine Organisationseinheit festlegen, dann ganze Gebäude, Räume oder einzelne Desks zuweisen.
        Mitarbeitende sehen und buchen diese Desks nur, wenn sie der zugeordneten Organisationseinheit angehören; mit „inkl. Unter-Referate“ gilt dies auch für deren Untereinheiten.
      </div>
      <select
        value={propertyId ?? ""}
        onChange={(e) => {
          const newId = Number(e.target.value);
          setPropertyId(newId);
          onSelectProperty?.(newId);
        }}
        className="mb-4 bg-surface-container-low rounded px-3 py-2 text-sm"
      >
        {properties.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
      </select>

      <div className="flex gap-2 mb-6">
        <input value={newZoneName} onChange={(e) => setNewZoneName(e.target.value)} placeholder="Neue Zone, z.B. Referat 12E — Nord" className="bg-surface-container-low rounded px-3 py-2 flex-1 max-w-sm" />
        <Button variant="primary" onClick={createZone}>+ Neue Zone</Button>
      </div>
      {message && <div className="mb-3 p-2 rounded bg-tertiary-fixed/40 text-on-tertiary-fixed-variant text-sm" role="status">{message}</div>}
      {error && <div className="mb-3 p-2 rounded bg-error-container text-on-error-container text-sm" role="alert">{error}</div>}

      <div className="space-y-3">
        {zones.map((z) => (
          <div key={z.id} className="p-4 rounded bg-surface-container-lowest border border-outline-variant/30">
            <div className="flex justify-between items-start">
              <div>
                <div className="font-semibold">{z.name}</div>
                <div className="text-sm text-on-surface-variant">{z.departments.join(", ") || "Kein Referat zugeordnet"} · {z.desk_count} Desks</div>
              </div>
              <button onClick={() => dissolve(z.id)} className="text-sm text-error">Zone auflösen</button>
            </div>
            <button onClick={() => setAssignZoneId(z.id === assignZoneId ? null : z.id)} className="text-xs text-primary mt-2">
              {assignZoneId === z.id ? "Bearbeitung schließen" : "Referate/Desks zuweisen"}
            </button>
            {assignZoneId === z.id && (
              <div className="mt-3 space-y-3 border-t border-outline-variant/20 pt-3">
                <div className="flex gap-2 items-center flex-wrap">
                  <div className="w-56"><DepartmentPicker departments={departments} value={assignDeptId} onChange={setAssignDeptId} /></div>
                  <label className="flex items-center gap-1 text-xs">
                    <input type="checkbox" checked={assignIncludeDescendants} onChange={(e) => setAssignIncludeDescendants(e.target.checked)} />
                    inkl. Unter-Referate
                  </label>
                  <Button variant="secondary" onClick={assignDepartment}>Referat zuweisen</Button>
                </div>
                <div>
                  <div className="text-xs text-on-surface-variant mb-1">Ganze Gebäude zuweisen (kaskadiert auf alle Desks)</div>
                  <div className="flex flex-wrap gap-1">
                    {buildings.map((b) => (
                      <label key={b.id} className="text-xs px-2 py-1 rounded bg-surface-container flex items-center gap-1">
                        <input type="checkbox" checked={selectedBuildingIds.includes(b.id)} onChange={(e) => setSelectedBuildingIds((s) => (e.target.checked ? [...s, b.id] : s.filter((x) => x !== b.id)))} />
                        {b.name}
                      </label>
                    ))}
                  </div>
                </div>
                <div>
                  <div className="text-xs text-on-surface-variant mb-1">Ganze Räume zuweisen (kaskadiert auf alle Desks im Raum)</div>
                  <div className="flex flex-wrap gap-1 max-h-24 overflow-y-auto">
                    {deskAreaRooms.map((r) => (
                      <label key={r.id} className="text-xs px-2 py-1 rounded bg-surface-container flex items-center gap-1">
                        <input type="checkbox" checked={selectedRoomIds.includes(r.id)} onChange={(e) => setSelectedRoomIds((s) => (e.target.checked ? [...s, r.id] : s.filter((x) => x !== r.id)))} />
                        {r.name} <span className="text-on-surface-variant">({r.buildingName}/{r.floorName})</span>
                      </label>
                    ))}
                  </div>
                </div>
                <div>
                  <div className="text-xs text-on-surface-variant mb-1">Einzelne Desks zuweisen (Mehrfachauswahl)</div>
                  <div className="flex flex-wrap gap-1 max-h-32 overflow-y-auto">
                    {allDesks.map((d) => (
                      <label key={d.id} className="text-xs px-2 py-1 rounded bg-surface-container flex items-center gap-1">
                        <input type="checkbox" checked={selectedDesks.includes(d.id)} onChange={(e) => setSelectedDesks((s) => (e.target.checked ? [...s, d.id] : s.filter((x) => x !== d.id)))} />
                        {d.desk_number}
                      </label>
                    ))}
                  </div>
                  <Button variant="secondary" className="mt-2" onClick={assignDesks}>Auswahl zuweisen</Button>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Auslastung
// ---------------------------------------------------------------------------

function OccupancyTab() {
  const [rows, setRows] = useState<OccupancyOut[]>([]);
  useEffect(() => { api.get<OccupancyOut[]>("/fm/occupancy").then(setRows); }, []);
  return (
    <table className="w-full text-sm max-w-2xl">
      <thead>
        <tr className="text-left text-on-surface-variant uppercase text-xs tracking-wide">
          <th className="py-2">Liegenschaft</th>
          <th className="py-2">Desks gesamt</th>
          <th className="py-2">Gebucht heute</th>
          <th className="py-2">Auslastung</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((r) => (
          <tr key={r.property_id} className="border-t border-outline-variant/20">
            <td className="py-2 font-medium">{r.property_name}</td>
            <td className="py-2 data-tabular">{r.total_desks}</td>
            <td className="py-2 data-tabular">{r.booked_today}</td>
            <td className="py-2 data-tabular">{typeof r.occupancy_pct === "number" ? `${r.occupancy_pct}%` : r.occupancy_pct}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

// ---------------------------------------------------------------------------
// Defekte
// ---------------------------------------------------------------------------

function DefectsTab() {
  const [defects, setDefects] = useState<DefectOut[]>([]);
  useEffect(() => { api.get<DefectOut[]>("/fm/defects").then(setDefects); }, []);
  return (
    <div className="max-w-2xl space-y-2">
      {defects.length === 0 && <div className="text-on-surface-variant text-sm">Keine Defektmeldungen vorhanden.</div>}
      {defects.map((d) => (
        <div key={d.id} className="p-3 rounded bg-surface-container-lowest border border-outline-variant/30 flex justify-between items-center">
          <div>
            <div className="text-sm">{d.description}</div>
            <div className="text-xs text-on-surface-variant">gemeldet von {d.reported_by} · {new Date(d.created_at).toLocaleDateString("de-DE")}</div>
          </div>
          <Badge tone={d.status === "open" ? "negative" : "positive"}>{d.status}</Badge>
        </div>
      ))}
    </div>
  );
}
