import type { ButtonHTMLAttributes, HTMLAttributes, ReactNode } from "react";

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
      className={`px-4 py-2 rounded text-sm font-medium transition-transform disabled:opacity-50 disabled:cursor-not-allowed hover:-translate-y-0.5 ${variantClasses[variant]} ${className}`}
      {...rest}
    >
      {loading ? "Wird verarbeitet…" : children}
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
    <div className="flex flex-col items-center justify-center text-center py-16 max-w-md mx-auto">
      <div className="w-20 h-20 rounded-full bg-surface-container-high flex items-center justify-center text-3xl mb-4 opacity-40">◌</div>
      <div className="text-xl font-bold">{title}</div>
      {description && <div className="text-on-surface-variant mt-2 text-sm">{description}</div>}
    </div>
  );
}

export function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  return (
    <div data-testid="modal-backdrop" className="fixed inset-0 bg-inverse-surface/50 backdrop-blur-sm flex items-center justify-center z-50" onClick={onClose}>
      <div
        className="bg-surface rounded-lg shadow-xl w-full max-w-md p-6"
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="text-lg font-semibold mb-4">{title}</div>
        {children}
      </div>
    </div>
  );
}
