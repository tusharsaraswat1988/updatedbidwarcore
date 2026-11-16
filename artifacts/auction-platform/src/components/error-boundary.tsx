import { Component, type ErrorInfo, type ReactNode } from "react";
import { isChunkLoadError, reloadForFreshVersion } from "@/lib/lazy-with-retry";

interface Props {
  children: ReactNode;
  fallbackTitle?: string;
  resetKey?: string | number;
}

interface State {
  hasError: boolean;
  error: Error | null;
  showDetails: boolean;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
    showDetails: false,
  };

  private handlePopState = () => {
    if (this.state.hasError) {
      this.setState({ hasError: false, error: null });
    }
  };

  public componentDidMount() {
    if (typeof window !== "undefined") {
      window.addEventListener("popstate", this.handlePopState);
    }
  }

  public componentWillUnmount() {
    if (typeof window !== "undefined") {
      window.removeEventListener("popstate", this.handlePopState);
    }
  }

  public componentDidUpdate(prevProps: Props) {
    if (prevProps.resetKey !== this.props.resetKey && this.state.hasError) {
      this.setState({ hasError: false, error: null });
    }
  }

  public static getDerivedStateFromError(error: Error): Partial<State> {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("[ErrorBoundary caught an error]:", error, errorInfo);

    // If dynamic chunk failed to load (new deploy or network drop), attempt seamless reload
    if (isChunkLoadError(error)) {
      const didReload = reloadForFreshVersion();
      if (didReload) {
        return;
      }
    }
  }

  private handleReset = () => {
    this.setState({ hasError: false, error: null });
  };

  public render() {
    if (this.state.hasError) {
      const isChunkError = isChunkLoadError(this.state.error);

      return (
        <div className="min-h-screen bg-stage text-foreground flex items-center justify-center p-6 text-center">
          <div className="max-w-md w-full panel p-8 rounded-2xl border border-white/10 bg-black/60 shadow-2xl space-y-4">
            <div className="mx-auto w-12 h-12 rounded-full bg-primary/20 border border-primary/30 flex items-center justify-center text-primary text-xl font-bold font-mono">
              !
            </div>
            <h2 className="font-display text-2xl font-bold text-foreground">
              {isChunkError
                ? "Update Available"
                : this.props.fallbackTitle || "Something went wrong"}
            </h2>
            <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed">
              {isChunkError
                ? "A new version of BidWar was deployed or a network update occurred. Please reload to sync the latest version."
                : "We encountered an issue loading this view. You can reload the page or return to the main dashboard."}
            </p>

            {this.state.error && (
              <div className="text-left">
                <button
                  type="button"
                  onClick={() => this.setState((s) => ({ showDetails: !s.showDetails }))}
                  className="text-[11px] text-muted-foreground hover:text-foreground underline transition"
                >
                  {this.state.showDetails ? "Hide technical details" : "Show technical details"}
                </button>
                {this.state.showDetails && (
                  <pre className="mt-2 text-[11px] font-mono text-rose-400 bg-black/80 p-3 rounded-lg overflow-x-auto max-h-40 whitespace-pre-wrap break-all">
                    {this.state.error.message || String(this.state.error)}
                  </pre>
                )}
              </div>
            )}

            <div className="pt-2 flex flex-wrap items-center justify-center gap-3">
              <button
                type="button"
                onClick={() => window.location.reload()}
                className="gold-button gold-button-hover rounded-lg px-5 py-2.5 text-xs font-bold uppercase tracking-wider"
              >
                Reload Page
              </button>
              <button
                type="button"
                onClick={this.handleReset}
                className="ghost-button ghost-button-hover rounded-lg px-4 py-2.5 text-xs font-semibold text-muted-foreground hover:text-foreground border border-white/10"
              >
                Try Again
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
