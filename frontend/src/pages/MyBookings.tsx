import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../api/client";
import type { BookingOut, BulkCancelResult } from "../api/types";
import { Badge, Button, EmptyState, Modal } from "../components/ui";
import { useAuth } from "../context/AuthContext";

const STATUS_TONE: Record<string, "positive" | "neutral" | "negative"> = {
  confirmed: "positive",
  pending_approval: "neutral",
  rejected: "negative",
  cancelled: "negative",
};

const STATUS_LABEL: Record<string, string> = {
  confirmed: "Bestätigt",
  pending_approval: "Ausstehend",
  rejected: "Abgelehnt",
  cancelled: "Storniert",
};

function fmtDateTime(iso: string) {
  return new Date(iso).toLocaleString("de-DE", { dateStyle: "medium", timeStyle: "short" });
}

export default function MyBookings() {
  const { actingAsUserId, actingAs } = useAuth();
  const navigate = useNavigate();
  const [scope, setScope] = useState<"upcoming" | "history">("upcoming");
  const [bookings, setBookings] = useState<BookingOut[]>([]);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [rangeOpen, setRangeOpen] = useState(false);
  const [rangeFrom, setRangeFrom] = useState(() => new Date().toISOString().slice(0, 10));
  const [rangeTo, setRangeTo] = useState(() => new Date().toISOString().slice(0, 10));
  const [detail, setDetail] = useState<BookingOut | null>(null);
  const [bulkMessage, setBulkMessage] = useState<string | null>(null);

  function load() {
    const forParam = actingAsUserId ? `&for_user_id=${actingAsUserId}` : "";
    api.get<BookingOut[]>(`/bookings/mine?scope=${scope}${forParam}`).then(setBookings);
    setSelected(new Set());
  }

  useEffect(load, [scope, actingAsUserId]);

  const activeBookings = useMemo(() => bookings.filter((b) => b.status !== "cancelled"), [bookings]);

  async function cancel(id: number) {
    await api.post(`/bookings/${id}/cancel`);
    setDetail(null);
    load();
  }

  async function cancelSeries(seriesId: number) {
    await api.post(`/bookings/series/${seriesId}/cancel`);
    setDetail(null);
    load();
  }

  async function checkin(id: number) {
    await api.post(`/bookings/${id}/checkin`);
    load();
  }

  function toggleSelect(id: number) {
    setSelected((s) => {
      const next = new Set(s);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function selectRange() {
    const from = new Date(rangeFrom);
    const to = new Date(rangeTo);
    to.setHours(23, 59, 59, 999);
    const ids = activeBookings.filter((b) => {
      const start = new Date(b.start_at);
      return start >= from && start <= to;
    }).map((b) => b.id);
    setSelected(new Set(ids));
    setRangeOpen(false);
  }

  async function bulkCancel() {
    if (selected.size === 0) return;
    const res = await api.post<BulkCancelResult>("/bookings/bulk-cancel", { booking_ids: Array.from(selected) });
    setBulkMessage(`${res.cancelled_ids.length} Buchung(en) storniert${res.failed.length ? `, ${res.failed.length} fehlgeschlagen` : ""}.`);
    load();
  }

  function jumpToFloorplan(b: BookingOut) {
    if (!b.property_id) return;
    const date = b.start_at.slice(0, 10);
    navigate(`/gezielte-buchung/${b.property_id}?date=${date}`);
  }

  return (
    <div className="max-w-3xl">
      <h1 className="text-3xl font-bold mb-1">Meine Buchungen</h1>
      <p className="text-on-surface-variant mb-1">
        {actingAs ? `Buchungen von ${actingAs.employeeName}.` : "Verwalten Sie Ihre aktiven Desk- und Raumbuchungen."}
      </p>
      <p className="text-on-surface-variant mb-6 text-sm">
        Bei Krankheit, Urlaub oder Abwesenheit: Zeitraum wählen, alle Treffer werden vorausgewählt — einzelne Einträge können Sie wieder abwählen.
      </p>

      <div className="flex flex-wrap items-center gap-2 mb-4">
        {(["upcoming", "history"] as const).map((s) => (
          <button
            key={s}
            onClick={() => setScope(s)}
            className={`px-3 py-1.5 rounded-full text-sm font-semibold ${scope === s ? "bg-primary text-on-primary" : "bg-surface-container-high text-on-surface-variant"}`}
          >
            {s === "upcoming" ? "Aktuelle & Anstehende" : "Verlauf"}
          </button>
        ))}
        <div className="flex-1" />
        <Button variant="secondary" onClick={() => setRangeOpen(true)}>Zeitraum auswählen…</Button>
        {selected.size > 0 && (
          <Button variant="destructive" onClick={bulkCancel}>{selected.size} ausgewählte stornieren</Button>
        )}
      </div>

      {bulkMessage && <div className="p-2 rounded bg-tertiary-fixed/40 text-on-tertiary-fixed-variant text-sm mb-4">{bulkMessage}</div>}

      {bookings.length === 0 && <EmptyState title="Keine Buchungen" description="Für diesen Bereich liegen aktuell keine Einträge vor." />}

      <div className="space-y-2">
        {bookings.map((b) => (
          <div key={b.id} className="group flex items-center gap-3 p-4 rounded bg-surface-container-lowest border border-outline-variant/30">
            {b.status !== "cancelled" && (
              <input type="checkbox" checked={selected.has(b.id)} onChange={() => toggleSelect(b.id)} aria-label={`${b.resource_label} auswählen`} />
            )}
            <button className="flex-1 text-left" onClick={() => setDetail(b)}>
              <div className="font-semibold">
                {b.resource_label}
                {b.series_id && <span className="ml-2 text-xs px-2 py-0.5 rounded-full bg-surface-container text-on-surface-variant">Serie</span>}
              </div>
              <div className="text-sm text-on-surface-variant data-tabular">
                {fmtDateTime(b.start_at)} – {new Date(b.end_at).toLocaleTimeString("de-DE", { timeStyle: "short" })}
              </div>
              {b.cancel_reason && <div className="text-sm text-error mt-1">Storniert: {b.cancel_reason}</div>}
            </button>
            <div className="flex items-center gap-2">
              <Badge tone={STATUS_TONE[b.status]}>{STATUS_LABEL[b.status]}</Badge>
              {b.checkin_status === "pending" && (
                <Button variant="secondary" onClick={() => checkin(b.id)}>Jetzt einchecken</Button>
              )}
              {(b.status === "confirmed" || b.status === "pending_approval") && (
                <button onClick={() => cancel(b.id)} className="opacity-0 group-hover:opacity-100 focus:opacity-100 text-sm text-error">
                  Stornieren
                </button>
              )}
            </div>
          </div>
        ))}
      </div>

      {rangeOpen && (
        <Modal title="Zeitraum auswählen" onClose={() => setRangeOpen(false)}>
          <div className="space-y-3">
            <p className="text-sm text-on-surface-variant">Alle Buchungen mit Beginn in diesem Zeitraum werden vorausgewählt.</p>
            <div className="grid grid-cols-2 gap-3">
              <label className="block text-sm">Von <input type="date" value={rangeFrom} onChange={(e) => setRangeFrom(e.target.value)} className="w-full mt-1 bg-surface-container-low rounded px-3 py-2" /></label>
              <label className="block text-sm">Bis <input type="date" value={rangeTo} onChange={(e) => setRangeTo(e.target.value)} className="w-full mt-1 bg-surface-container-low rounded px-3 py-2" /></label>
            </div>
            <Button variant="primary" className="w-full" onClick={selectRange}>Treffer auswählen</Button>
          </div>
        </Modal>
      )}

      {detail && (
        <Modal title={detail.resource_label} onClose={() => setDetail(null)}>
          <div className="space-y-3 text-sm">
            <div><span className="text-on-surface-variant">Zeitraum: </span>{fmtDateTime(detail.start_at)} – {new Date(detail.end_at).toLocaleTimeString("de-DE", { timeStyle: "short" })}</div>
            <div><span className="text-on-surface-variant">Status: </span><Badge tone={STATUS_TONE[detail.status]}>{STATUS_LABEL[detail.status]}</Badge></div>
            {detail.property_name && <div><span className="text-on-surface-variant">Liegenschaft: </span>{detail.property_name}</div>}
            <div><span className="text-on-surface-variant">Gebucht für: </span>{detail.booked_for_name}</div>
            <div><span className="text-on-surface-variant">Gebucht von: </span>{detail.booked_by_name}</div>
            {detail.labels.length > 0 && (
              <div className="flex flex-wrap gap-1">
                {detail.labels.map((l) => <span key={l} className="text-xs px-2 py-0.5 rounded-full bg-surface-container text-on-surface-variant">{l}</span>)}
              </div>
            )}
            {detail.remark && <div><span className="text-on-surface-variant">Bemerkung: </span>{detail.remark}</div>}
            {detail.double_booking_reason && <div><span className="text-on-surface-variant">Begründung Doppelbuchung: </span>{detail.double_booking_reason}</div>}
            {detail.cancel_reason && <div className="text-error">Storniert: {detail.cancel_reason}</div>}
            <div className="flex flex-wrap gap-2 pt-2">
              {detail.kind === "desk" && detail.property_id && (
                <Button variant="secondary" onClick={() => jumpToFloorplan(detail)}>Zum Raumplan springen</Button>
              )}
              {(detail.status === "confirmed" || detail.status === "pending_approval") && (
                <Button variant="destructive" onClick={() => cancel(detail.id)}>Diese Buchung stornieren</Button>
              )}
              {detail.series_id && (detail.status === "confirmed" || detail.status === "pending_approval") && (
                <Button variant="destructive" onClick={() => cancelSeries(detail.series_id!)}>Ganze Serie stornieren</Button>
              )}
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
