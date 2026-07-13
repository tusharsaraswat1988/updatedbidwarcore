import { Component, type ErrorInfo, type ReactNode } from "react";

type Props = { children: ReactNode };
type State = { hasError: boolean; message: string };

/**
 * Global React error boundary — recovers without killing the WebView shell.
 */
export class AppErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, message: "" };

  static getDerivedStateFromError(error: Error): State {
    return {
      hasError: true,
      message: error?.message || "Something went wrong",
    };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("[BidWar] UI crash", error, info.componentStack);
  }

  render() {
    if (!this.state.hasError) return this.props.children;

    return (
      <div className="h-full flex flex-col items-center justify-center bg-[#09090b] px-6 text-center safe-top safe-bottom">
        <p className="font-display font-black text-amber-400 text-2xl">BidWar</p>
        <h1 className="font-display font-bold text-xl text-white mt-4">Something went wrong</h1>
        <p className="text-[#a1a1aa] text-sm mt-2 max-w-sm leading-relaxed">{this.state.message}</p>
        <button
          type="button"
          className="mt-6 w-full max-w-sm py-4 rounded-2xl font-display font-black text-black bg-amber-400"
          onClick={() => {
            this.setState({ hasError: false, message: "" });
            window.location.reload();
          }}
        >
          Reload
        </button>
      </div>
    );
  }
}
