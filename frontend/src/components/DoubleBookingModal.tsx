import { useState } from "react";
import { Button, Modal } from "./ui";

export interface DoubleBookingDetail {
  other_booking_id: number;
  other_resource_label: string;
  other_start_at: string;
  other_end_at: string;
}

interface Props {
  detail: DoubleBookingDetail;
  onCancelOther: () => Promise<void>;
  onOverride: (reason: string) => Promise<void>;
  onClose: () => void;
}

/** Doppelbuchungs-Warnung: zeigt die überlappende Eigenbuchung, bietet Stornieren der anderen
 * Buchung oder begründetes Fortfahren (beide Plätze bleiben reserviert). */
export function DoubleBookingModal({ detail, onCancelOther, onOverride, onClose }: Props) {
  const [reason, setReason] = useState("");
  const [mode, setMode] = useState<"choice" | "reason">("choice");
  const [busy, setBusy] = useState(false);

  return (
    <Modal title="Bereits eine Buchung in diesem Zeitraum" onClose={onClose}>
      <p className="text-sm text-on-surface-variant mb-3">
        Sie haben zu dieser Zeit bereits gebucht: <strong>{detail.other_resource_label}</strong>
        <br />
        {new Date(detail.other_start_at).toLocaleString("de-DE", { dateStyle: "medium", timeStyle: "short" })} –{" "}
        {new Date(detail.other_end_at).toLocaleTimeString("de-DE", { timeStyle: "short" })}
      </p>

      {mode === "choice" ? (
        <div className="space-y-2">
          <Button
            variant="destructive"
            className="w-full"
            loading={busy}
            onClick={async () => {
              setBusy(true);
              await onCancelOther();
              setBusy(false);
            }}
          >
            Andere Buchung stornieren und diese buchen
          </Button>
          <Button variant="secondary" className="w-full" onClick={() => setMode("reason")}>
            Beide Plätze behalten (Begründung erforderlich)
          </Button>
        </div>
      ) : (
        <div className="space-y-3">
          <textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Begründung für die Doppelbuchung…"
            aria-label="Begründung für die Doppelbuchung"
            className="w-full bg-surface-container-low rounded px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            rows={3}
          />
          <Button
            variant="accent"
            className="w-full"
            disabled={!reason.trim()}
            loading={busy}
            onClick={async () => {
              setBusy(true);
              await onOverride(reason);
              setBusy(false);
            }}
          >
            Trotzdem buchen
          </Button>
        </div>
      )}
    </Modal>
  );
}
