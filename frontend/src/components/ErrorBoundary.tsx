import React, { Component, type ErrorInfo, type ReactNode } from "react";

interface Props {
  children: ReactNode;
  fallbackTitle?: string;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("ErrorBoundary caught an error:", error, errorInfo);
  }

  public handleReload = () => {
    window.location.reload();
  };

  public handleReset = () => {
    this.setState({ hasError: false, error: null });
  };

  public render() {
    if (this.state.hasError) {
      return (
        <div className="p-8 max-w-xl mx-auto my-8 bg-surface-container-low border border-error/30 rounded-xl shadow-lg text-center space-y-4">
          <div className="text-4xl">⚠️</div>
          <h2 className="text-xl font-bold text-on-surface">
            {this.props.fallbackTitle || "Ein unerwarteter Anzeigefehler ist aufgetreten"}
          </h2>
          <p className="text-sm text-on-surface-variant">
            Die Ansicht konnte nicht dargestellt werden. Bitte versuchen Sie, die Seite neu zu laden.
          </p>
          {this.state.error?.message && (
            <div className="text-xs font-mono bg-error-container/40 text-on-error-container p-3 rounded text-left overflow-auto max-h-32">
              {this.state.error.message}
            </div>
          )}
          <div className="flex justify-center gap-3 pt-2">
            <button
              type="button"
              onClick={this.handleReset}
              className="px-4 py-2 text-xs font-medium rounded-md border border-outline-variant hover:bg-surface-container transition-colors"
            >
              Erneut versuchen
            </button>
            <button
              type="button"
              onClick={this.handleReload}
              className="px-4 py-2 text-xs font-medium rounded-md bg-primary text-on-primary hover:bg-primary/90 transition-colors"
            >
              Seite neu laden
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
