import { Component, type ErrorInfo, type ReactNode } from "react";

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
    console.error("[ErrorBoundary caught an error]:", error, errorInfo);
  }

  public render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-stage text-foreground flex items-center justify-center p-6 text-center">
          <div className="max-w-md w-full panel p-8 rounded-2xl border border-white/10 bg-black/60 shadow-2xl space-y-4">
            <div className="mx-auto w-12 h-12 rounded-full bg-primary/20 border border-primary/30 flex items-center justify-center text-primary text-xl font-bold font-mono">
              !
            </div>
            <h2 className="font-display text-2xl font-bold text-foreground">
              {this.props.fallbackTitle || "Something went wrong"}
            </h2>
            <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed">
              We encountered an issue loading this view. You can reload the page or return to the main dashboard.
            </p>
            {this.state.error && import.meta.env.DEV && (
              <pre className="text-left text-[11px] font-mono text-rose-400 bg-black/80 p-3 rounded-lg overflow-x-auto max-h-40">
                {this.state.error.message}
              </pre>
            )}
            <div className="pt-2 flex flex-wrap items-center justify-center gap-3">
              <button
                type="button"
                onClick={() => window.location.reload()}
                className="gold-button gold-button-hover rounded-lg px-5 py-2.5 text-xs font-bold uppercase tracking-wider"
              >
                Reload Page
              </button>
              <a
                href="/"
                className="ghost-button ghost-button-hover rounded-lg px-4 py-2.5 text-xs font-semibold text-muted-foreground hover:text-foreground"
              >
                Go to Homepage
              </a>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
