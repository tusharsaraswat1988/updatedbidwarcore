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
      return <div className="h-12" aria-hidden />;
    }
    if (variant === "homepage") {
      return <div className="hidden md:block w-[168px] h-9" aria-hidden />;
    }
    // navbar: Get Started is visible on all breakpoints today — reserve that slot.
    return <div className="w-[108px] h-9" aria-hidden />;
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
          className="gold-button w-full rounded-lg px-4 py-3 text-sm"
          style={primaryColor ? { background: primaryColor } : undefined}
        >
          Dashboard
        </button>
      );
    }
    if (variant === "homepage") {
      return (
        <button
          type="button"
          onClick={() => go("/organizer")}
          className="gold-button gold-button-hover hidden rounded-md px-4 py-2 text-xs md:inline-block"
        >
          Dashboard
        </button>
      );
    }
    // navbar — always visible (replaces Get Started on small screens)
    return (
      <button
        type="button"
        onClick={() => go("/organizer")}
        className="gold-button gold-button-hover rounded-md px-4 py-2 text-xs"
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
      <div className="grid grid-cols-1 gap-3">
        <button
          type="button"
          onClick={() => go("/organizer")}
          className="ghost-button w-full rounded-lg px-4 py-3 text-sm"
        >
          Sign In
        </button>
        <button
          type="button"
          onClick={() => go("/organizer?tab=signup")}
          className="gold-button w-full rounded-lg px-4 py-3 text-sm"
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
          className="ghost-button ghost-button-hover hidden rounded-md px-4 py-2 text-xs md:inline-block"
        >
          Sign in
        </button>
        <button
          type="button"
          onClick={() => go("/organizer?tab=signup")}
          className="gold-button gold-button-hover hidden rounded-md px-4 py-2 text-xs md:inline-block"
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
        className="ghost-button ghost-button-hover hidden rounded-md px-4 py-2 text-xs lg:inline-block"
      >
        Sign in
      </button>
      <button
        type="button"
        onClick={() => go("/organizer?tab=signup")}
        className="gold-button gold-button-hover rounded-md px-4 py-2 text-xs"
        style={primaryColor ? { background: primaryColor } : undefined}
      >
        Get Started
      </button>
    </>
  );
}
