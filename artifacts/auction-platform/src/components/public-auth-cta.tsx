import { useLocation } from "wouter";
import { useOrganizerAccountAuth } from "@/hooks/use-auth";

type PublicAuthCtaVariant = "navbar" | "homepage" | "drawer" | "footer-link";

type PublicAuthCtaProps = {
  variant?: PublicAuthCtaVariant;
  /** Called before navigation (e.g. close mobile menu). */
  onBeforeNavigate?: () => void;
  /** Optional brand primary for gold buttons (public navbar). */
  primaryColor?: string;
};

/**
 * Single component that owns public auth CTAs:
 * loading → nothing; anonymous → Sign In + Get Started; authenticated → Dashboard.
 */
export function PublicAuthCta({
  variant = "navbar",
  onBeforeNavigate,
  primaryColor,
}: PublicAuthCtaProps) {
  const { isLoggedIn, isLoading } = useOrganizerAccountAuth();
  const [, navigate] = useLocation();

  function go(path: string) {
    onBeforeNavigate?.();
    navigate(path);
  }

  if (isLoading) {
    if (variant === "footer-link") {
      return <span className="opacity-0 pointer-events-none select-none" aria-hidden>Dashboard</span>;
    }
    if (variant === "drawer") {
      return <div className="h-10" aria-hidden />;
    }
    if (variant === "homepage") {
      return <div className="w-[60px] sm:w-[150px] h-8" aria-hidden />;
    }
    // navbar
    return <div className="w-[60px] sm:w-[150px] h-8" aria-hidden />;
  }

  if (isLoggedIn) {
    if (variant === "footer-link") {
      return (
        <a
          href="/organizer"
          className="hover:text-foreground"
          onClick={(e) => {
            e.preventDefault();
            go("/organizer");
          }}
        >
          Dashboard
        </a>
      );
    }
    if (variant === "drawer") {
      return (
        <button
          type="button"
          onClick={() => go("/organizer")}
          className="gold-button gold-button-hover w-full rounded-lg px-4 py-3 text-sm font-bold flex items-center justify-center gap-2"
          style={primaryColor ? { background: primaryColor } : undefined}
        >
          Dashboard →
        </button>
      );
    }
    if (variant === "homepage") {
      return (
        <button
          type="button"
          onClick={() => go("/organizer")}
          className="gold-button gold-button-hover rounded-md px-3 sm:px-4 py-1.5 sm:py-2 text-xs font-semibold whitespace-nowrap"
        >
          Dashboard
        </button>
      );
    }
    // navbar — always visible
    return (
      <button
        type="button"
        onClick={() => go("/organizer")}
        className="gold-button gold-button-hover rounded-md px-3 sm:px-4 py-1.5 sm:py-2 text-xs font-semibold whitespace-nowrap"
        style={primaryColor ? { background: primaryColor } : undefined}
      >
        Dashboard
      </button>
    );
  }

  if (variant === "footer-link") {
    return (
      <a
        href="/organizer"
        className="hover:text-foreground"
        onClick={(e) => {
          e.preventDefault();
          go("/organizer");
        }}
      >
        Sign In
      </a>
    );
  }

  if (variant === "drawer") {
    return (
      <div className="grid grid-cols-2 gap-2.5">
        <button
          type="button"
          onClick={() => go("/organizer")}
          className="ghost-button ghost-button-hover border border-white/20 hover:border-white/40 hover:bg-white/10 w-full rounded-lg px-3 py-2.5 text-sm font-semibold text-center transition-colors"
        >
          Sign In
        </button>
        <button
          type="button"
          onClick={() => go("/organizer?tab=signup")}
          className="gold-button gold-button-hover w-full rounded-lg px-3 py-2.5 text-sm font-semibold text-center"
          style={primaryColor ? { background: primaryColor } : undefined}
        >
          Get Started
        </button>
      </div>
    );
  }

  if (variant === "homepage") {
    return (
      <>
        <button
          type="button"
          onClick={() => go("/organizer")}
          className="ghost-button ghost-button-hover rounded-lg px-2.5 sm:px-3 py-1.5 text-xs font-medium whitespace-nowrap"
        >
          Sign in
        </button>
        <button
          type="button"
          onClick={() => go("/organizer?tab=signup")}
          className="gold-button gold-button-hover hidden sm:inline-block rounded-lg px-3.5 py-1.5 text-xs font-semibold whitespace-nowrap"
        >
          Get Started
        </button>
      </>
    );
  }

  // navbar
  return (
    <>
      <button
        type="button"
        onClick={() => go("/organizer")}
        className="ghost-button ghost-button-hover rounded-lg px-2.5 sm:px-3 py-1.5 text-xs font-medium whitespace-nowrap"
      >
        Sign in
      </button>
      <button
        type="button"
        onClick={() => go("/organizer?tab=signup")}
        className="gold-button gold-button-hover hidden sm:inline-block rounded-lg px-3.5 py-1.5 text-xs font-semibold whitespace-nowrap"
        style={primaryColor ? { background: primaryColor } : undefined}
      >
        Get Started
      </button>
    </>
  );
}
