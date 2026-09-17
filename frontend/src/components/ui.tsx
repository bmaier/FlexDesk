import { useEffect, useRef, type ButtonHTMLAttributes, type HTMLAttributes, type ReactNode } from "react";

type Variant = "primary" | "accent" | "secondary" | "destructive";

const variantClasses: Record<Variant, string> = {
  primary: "bg-primary text-on-primary hover:brightness-110",
  accent: "bg-tertiary-container text-on-tertiary hover:brightness-110",
  secondary: "bg-surface-container text-on-surface hover:bg-surface-container-high",
  destructive: "bg-error text-on-error hover:brightness-110",
};

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  loading?: boolean;
  children: ReactNode;
}

export function Button({ variant = "primary", loading, disabled, children, className = "", ...rest }: ButtonProps) {
  return (
    <button
      disabled={disabled || loading}
      aria-busy={loading ? "true" : undefined}
      className={`px-4 py-2 rounded text-sm font-medium transition-transform disabled:opacity-50 disabled:cursor-not-allowed hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 ${variantClasses[variant]} ${className}`}
      {...rest}
    >
      {loading ? (
        <span className="flex items-center justify-center gap-2">
          <span className="animate-spin text-xs" aria-hidden="true">⏳</span>
          <span>Wird verarbeitet…</span>
        </span>
      ) : (
        children
      )}
    </button>
  );
}

type BadgeTone = "positive" | "neutral" | "negative";

const badgeClasses: Record<BadgeTone, string> = {
  positive: "bg-tertiary-fixed text-on-tertiary-fixed-variant",
  neutral: "bg-surface-container-highest text-on-surface-variant",
  negative: "bg-error-container text-on-error-container",
};

export function Badge({ tone = "neutral", children }: { tone?: BadgeTone; children: ReactNode }) {
  return <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-semibold ${badgeClasses[tone]}`}>{children}</span>;
}

export function Card({ children, className = "", ...rest }: { children: ReactNode; className?: string } & HTMLAttributes<HTMLDivElement>) {
  return <div className={`bg-surface-container-lowest rounded-md shadow-sm border border-outline-variant/30 p-4 ${className}`} {...rest}>{children}</div>;
}

export function EmptyState({ title, description }: { title: string; description?: string }) {
  return (
    <div className="flex flex-col items-center justify-center text-center py-16 max-w-md mx-auto" role="status">
      <div className="w-20 h-20 rounded-full bg-surface-container-high flex items-center justify-center text-3xl mb-4 opacity-40" aria-hidden="true">◌</div>
      <div className="text-xl font-bold">{title}</div>
      {description && <div className="text-on-surface-variant mt-2 text-sm">{description}</div>}
    </div>
  );
}

export function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  const modalRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        e.stopPropagation();
        onClose();
        return;
      }
      if (e.key === "Tab" && modalRef.current) {
        const focusable = modalRef.current.querySelectorAll<HTMLElement>(
          'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
        );
        if (focusable.length === 0) return;
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  return (
    <div data-testid="modal-backdrop" className="fixed inset-0 bg-inverse-surface/50 backdrop-blur-sm flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div
        ref={modalRef}
        className="bg-surface rounded-lg shadow-xl w-full max-w-md p-6 max-h-[90vh] overflow-y-auto"
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-dialog-title"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4 border-b border-outline-variant/20 pb-2">
          <h2 id="modal-dialog-title" className="text-lg font-semibold text-on-surface">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Dialog schließen"
            className="w-8 h-8 rounded-full flex items-center justify-center text-on-surface-variant hover:text-on-surface hover:bg-surface-container transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
          >
            ✕
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
