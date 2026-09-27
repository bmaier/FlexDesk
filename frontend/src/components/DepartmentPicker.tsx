import { useEffect, useMemo, useRef, useState } from "react";
import type { DepartmentOut } from "../api/types";

interface DepartmentPickerProps {
  departments: DepartmentOut[];
  value: number | null;
  onChange: (id: number) => void;
  placeholder?: string;
}

/** Suchbarer, hierarchisch eingerückter Referats-/Abteilungs-Picker — Ersatz für ein natives
 * <select> mit 30+ flachen Einträgen, das die Organisationsstruktur nicht erkennbar macht. */
export function DepartmentPicker({ departments, value, onChange, placeholder }: DepartmentPickerProps) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  const byId = useMemo(() => new Map(departments.map((d) => [d.id, d])), [departments]);
  function depthOf(dept: DepartmentOut): number {
    let depth = 0;
    let current: DepartmentOut | undefined = dept;
    while (current?.parent_id) {
      depth += 1;
      current = byId.get(current.parent_id);
    }
    return depth;
  }

  useEffect(() => {
    function onDocClick(e: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, []);

  const selected = value ? byId.get(value) : null;
  const q = query.trim().toLowerCase();
  const filtered = q ? departments.filter((d) => d.name.toLowerCase().includes(q) || d.code.toLowerCase().includes(q)) : departments;

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="w-full text-left bg-surface rounded px-2 py-1.5 text-sm border border-outline-variant/40 flex justify-between items-center gap-2"
      >
        <span className={selected ? "" : "text-on-surface-variant"}>{selected ? selected.name : placeholder ?? "Organisationseinheit wählen…"}</span>
        <span className="text-on-surface-variant">▾</span>
      </button>
      {open && (
        <div className="absolute z-20 mt-1 w-full bg-surface-container-lowest border border-outline-variant/40 rounded shadow-lg">
          <input
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Referat/Abteilung suchen…"
            className="w-full px-2 py-1.5 text-sm border-b border-outline-variant/30 bg-transparent"
          />
          <div className="max-h-56 overflow-y-auto py-1">
            {filtered.map((d) => (
              <button
                key={d.id}
                type="button"
                onClick={() => { onChange(d.id); setOpen(false); setQuery(""); }}
                style={{ paddingLeft: `${10 + depthOf(d) * 14}px` }}
                className={`w-full text-left pr-2 py-1 text-sm hover:bg-surface-container-high ${d.id === value ? "bg-secondary-container" : ""}`}
              >
                {d.name}
              </button>
            ))}
            {filtered.length === 0 && <div className="px-2 py-2 text-xs text-on-surface-variant">Keine Treffer.</div>}
          </div>
        </div>
      )}
    </div>
  );
}
