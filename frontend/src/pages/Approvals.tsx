import { useEffect, useState } from "react";
import { api, ApiError } from "../api/client";
import type { ApprovalQueueItem, BookingOut } from "../api/types";
import { Badge, Button, EmptyState, Modal } from "../components/ui";

const STATUS_TONE: Record<string, "positive" | "neutral" | "negative"> = {
  confirmed: "positive",
  pending_approval: "neutral",
  rejected: "negative",
  cancelled: "negative",
};

const STATUS_LABEL: Record<string, string> = {
  confirmed: "Genehmigt",
  pending_approval: "Ausstehend",
  rejected: "Abgelehnt",
  cancelled: "Storniert",
};

export default function Approvals() {
  const [tab, setTab] = useState<"inbox" | "mine">("inbox");
  const [items, setItems] = useState<ApprovalQueueItem[]>([]);
  const [myRequests, setMyRequests] = useState<BookingOut[]>([]);
  const [rejecting, setRejecting] = useState<ApprovalQueueItem | null>(null);
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);

  function load() {
    api.get<ApprovalQueueItem[]>("/approvals/inbox").then(setItems);
    api.get<BookingOut[]>("/bookings/mine?scope=all").then((rows) => setMyRequests(rows.filter((b) => b.kind === "room")));
  }

  useEffect(load, []);

  async function approve(item: ApprovalQueueItem) {
    await api.post(`/approvals/${item.booking_id}/decide`, { decision: "approved" });
    load();
  }

  async function reject() {
    if (!rejecting) return;
    setError(null);
    try {
      await api.post(`/approvals/${rejecting.booking_id}/decide`, { decision: "rejected", comment: reason });
      setRejecting(null);
      setReason("");
      load();
    } catch (e) {
      if (e instanceof ApiError) setError(e.message);
    }
  }

  return (
    <div className="max-w-3xl">
      <h1 className="text-3xl font-bold mb-1">Genehmigungscenter</h1>
      <p className="text-on-surface-variant mb-4">Buchungsanfragen für Räume verwalten, für die Sie verantwortlich sind, oder eigene Anfragen einsehen.</p>

      <div className="flex gap-2 mb-6">
        <button
          onClick={() => setTab("inbox")}
          className={`px-3 py-1.5 rounded-full text-sm font-semibold ${tab === "inbox" ? "bg-primary text-on-primary" : "bg-surface-container-high text-on-surface-variant"}`}
        >
          Inbox {items.length > 0 && `(${items.length})`}
        </button>
        <button
          onClick={() => setTab("mine")}
          className={`px-3 py-1.5 rounded-full text-sm font-semibold ${tab === "mine" ? "bg-primary text-on-primary" : "bg-surface-container-high text-on-surface-variant"}`}
        >
          Meine Anfragen
        </button>
      </div>

      {tab === "inbox" ? (
        <>
          {items.length === 0 && <EmptyState title="Keine offenen Anfragen" description="Aktuell liegen keine zu bearbeitenden Anfragen vor." />}
          <div className="space-y-3">
            {items.map((item) => (
              <div key={item.booking_id} className="p-4 rounded bg-surface-container-lowest border border-outline-variant/30 flex justify-between items-start">
                <div>
                  <div className="font-semibold">{item.requester_name}</div>
                  <div className="text-sm text-on-surface-variant">{item.requester_department}</div>
                  <div className="text-sm mt-1 data-tabular">
                    {item.resource_label} · {new Date(item.start_at).toLocaleString("de-DE", { dateStyle: "medium", timeStyle: "short" })} – {new Date(item.end_at).toLocaleTimeString("de-DE", { timeStyle: "short" })}
                  </div>
                  <div className="text-xs text-on-surface-variant mt-1">Eingegangen: {new Date(item.created_at).toLocaleString("de-DE")}</div>
                </div>
                <div className="flex gap-2 shrink-0">
                  <Button variant="destructive" onClick={() => setRejecting(item)}>Ablehnen</Button>
                  <Button variant="accent" onClick={() => approve(item)}>Genehmigen</Button>
                </div>
              </div>
            ))}
          </div>
        </>
      ) : (
        <>
          {myRequests.length === 0 && <EmptyState title="Keine eigenen Anfragen" description="Sie haben bisher keine genehmigungspflichtigen Räume angefragt." />}
          <div className="space-y-2">
            {myRequests.map((b) => (
              <div key={b.id} className="p-4 rounded bg-surface-container-lowest border border-outline-variant/30 flex justify-between items-center">
                <div>
                  <div className="font-semibold">{b.resource_label}</div>
                  <div className="text-sm text-on-surface-variant data-tabular">
                    {new Date(b.start_at).toLocaleString("de-DE", { dateStyle: "medium", timeStyle: "short" })} – {new Date(b.end_at).toLocaleTimeString("de-DE", { timeStyle: "short" })}
                  </div>
                  {b.cancel_reason && <div className="text-sm text-error mt-1">{b.cancel_reason}</div>}
                </div>
                <Badge tone={STATUS_TONE[b.status]}>{STATUS_LABEL[b.status]}</Badge>
              </div>
            ))}
          </div>
        </>
      )}

      {rejecting && (
        <Modal title="Anfrage ablehnen" onClose={() => setRejecting(null)}>
          <p className="text-sm text-on-surface-variant mb-2">Der Antragsteller wird per Benachrichtigung informiert.</p>
          {error && <div className="p-2 rounded bg-error-container text-on-error-container text-sm mb-2" role="alert">{error}</div>}
          <textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Begründung (Pflichtfeld)…"
            className="w-full bg-surface-container-low rounded px-3 py-2 mb-3"
            rows={3}
          />
          <Button variant="destructive" disabled={!reason.trim()} onClick={reject}>Ablehnung bestätigen</Button>
        </Modal>
      )}
    </div>
  );
}
