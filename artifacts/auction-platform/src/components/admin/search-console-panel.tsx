import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Loader2, Link2, RefreshCw, Send, CheckCircle2, AlertCircle, Copy } from "lucide-react";

type SearchConsoleStatus = {
  connected: boolean;
  hasWebmastersScope: boolean;
  needsReconsent: boolean;
  email: string | null;
  redirectUri?: string;
};

/**
 * Google OAuth error pages include a "Contact the developer" mailto: link
 * (often the OAuth consent-screen support email). That is NOT BidWar opening Gmail —
 * it means Google rejected the OAuth request (usually redirect_uri_mismatch).
 */
export function SearchConsolePanel() {
  const [status, setStatus] = useState<SearchConsoleStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [connecting, setConnecting] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const loadStatus = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/google/search-console/status", { credentials: "include" });
      const body = await res.json().catch(() => ({})) as SearchConsoleStatus & {
        error?: string;
        hint?: string;
        loginPath?: string;
      };
      if (!res.ok) {
        throw new Error(
          body.error
            ? `${body.error}${body.hint ? ` — ${body.hint}` : ""}${body.loginPath ? ` (${body.loginPath})` : ""}`
            : `Failed to load status (${res.status})`,
        );
      }
      setStatus({
        connected: Boolean(body.connected),
        hasWebmastersScope: Boolean(body.hasWebmastersScope),
        needsReconsent: Boolean(body.needsReconsent),
        email: body.email ?? null,
        redirectUri: body.redirectUri,
      });
    } catch (e) {
      setStatus(null);
      setError(e instanceof Error ? e.message : "Failed to load Search Console status");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("google_search_console_connected") === "1") {
      setMessage("Google Search Console connected successfully.");
    } else if (params.get("error")?.startsWith("google_search_console")) {
      setError(`Connection failed: ${params.get("error")}`);
    }
    void loadStatus();
  }, [loadStatus]);

  async function copyRedirectUri() {
    const uri = status?.redirectUri;
    if (!uri) return;
    try {
      await navigator.clipboard.writeText(uri);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setError("Could not copy redirect URI");
    }
  }

  async function handleConnect() {
    setConnecting(true);
    setMessage(null);
    setError(null);
    try {
      const next = encodeURIComponent("/admin/settings/system/search-console");
      // debug=1 returns JSON (and still sets the OAuth cookie) so we never follow a bad Location blindly.
      const res = await fetch(`/api/google/search-console/connect?next=${next}&debug=1`, {
        credentials: "include",
      });
      const body = await res.json().catch(() => ({})) as {
        ok?: boolean;
        authorizeUrl?: string;
        redirectUri?: string;
        error?: string;
        hint?: string;
        reason?: string;
        loginPath?: string;
      };

      if (!res.ok) {
        setError(
          [
            body.error ?? `Connect failed (${res.status})`,
            body.reason ? `reason: ${body.reason}` : null,
            body.hint ?? null,
            body.loginPath ? `Log in at ${body.loginPath}` : null,
          ]
            .filter(Boolean)
            .join(" — "),
        );
        return;
      }

      const authorizeUrl = body.authorizeUrl?.trim() ?? "";
      if (!authorizeUrl.startsWith("https://accounts.google.com/o/oauth2/v2/auth")) {
        setError(
          `Server returned an unexpected authorize URL (not Google OAuth). Got: ${authorizeUrl.slice(0, 120) || "(empty)"}`,
        );
        return;
      }

      if (authorizeUrl.toLowerCase().startsWith("mailto:")) {
        setError("Refusing to open mailto: — this would open Gmail, not Google OAuth.");
        return;
      }

      // Navigate only to Google's authorize endpoint.
      window.location.assign(authorizeUrl);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to start Google OAuth");
      setConnecting(false);
    }
  }

  async function handleSubmitSitemap() {
    setSubmitting(true);
    setMessage(null);
    setError(null);
    try {
      const res = await fetch("/api/google/search-console/submit-sitemap", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      const body = await res.json().catch(() => ({})) as {
        error?: string;
        needsGoogleAuth?: boolean;
        needsReconsent?: boolean;
        sitemapUrl?: string;
        siteUrl?: string;
      };
      if (!res.ok) {
        if (body.needsGoogleAuth || body.needsReconsent) {
          setError(body.error ?? "Reconnect Google Search Console, then try again.");
        } else {
          setError(body.error ?? `Submit failed (${res.status})`);
        }
        return;
      }
      setMessage(`Sitemap submitted: ${body.sitemapUrl ?? "sitemap-index.xml"} (${body.siteUrl ?? "platform site"})`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Submit failed");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="p-6 space-y-6 max-w-xl">
      <div>
        <h2 className="font-display font-bold text-lg text-white flex items-center gap-2">
          <Link2 className="w-5 h-5 text-amber-400" />
          Google Search Console
        </h2>
        <p className="text-xs text-muted-foreground mt-1">
          Connect the platform Google account that owns bidwar.in in Search Console.
          Uses your admin session (username/password), not organizer Google login.
        </p>
      </div>

      {loading ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="w-4 h-4 animate-spin" /> Loading status…
        </div>
      ) : (
        <div className="space-y-4 rounded-lg border border-border/60 bg-muted/10 p-4">
          <div className="flex items-start justify-between gap-3">
            <div className="space-y-1 text-sm">
              <div className="flex items-center gap-2">
                {status?.connected && !status.needsReconsent ? (
                  <CheckCircle2 className="w-4 h-4 text-green-400" />
                ) : (
                  <AlertCircle className="w-4 h-4 text-amber-400" />
                )}
                <span className="font-medium text-foreground">
                  {status?.connected
                    ? status.needsReconsent
                      ? "Connected — re-consent required"
                      : "Connected"
                    : "Not connected"}
                </span>
              </div>
              {status?.email ? (
                <p className="text-xs text-muted-foreground pl-6">{status.email}</p>
              ) : null}
              {status?.connected && !status.hasWebmastersScope ? (
                <p className="text-xs text-amber-400/90 pl-6">
                  Webmasters scope missing. Reconnect to grant Search Console access.
                </p>
              ) : null}
            </div>
            <Button size="sm" variant="ghost" className="h-8 w-8 p-0" onClick={() => void loadStatus()} title="Refresh">
              <RefreshCw className="w-3.5 h-3.5" />
            </Button>
          </div>

          {status?.redirectUri ? (
            <div className="space-y-1.5 rounded-md border border-border/50 bg-background/40 p-3">
              <p className="text-[11px] text-muted-foreground uppercase tracking-wider">
                Authorized redirect URI (must match Google Cloud exactly)
              </p>
              <div className="flex items-start gap-2">
                <code className="flex-1 text-[11px] font-mono text-foreground break-all">{status.redirectUri}</code>
                <Button size="sm" variant="ghost" className="h-7 gap-1 shrink-0" onClick={() => void copyRedirectUri()}>
                  <Copy className="w-3 h-3" />
                  {copied ? "Copied" : "Copy"}
                </Button>
              </div>
              <p className="text-[11px] text-muted-foreground leading-relaxed">
                Google Cloud → APIs &amp; Services → Credentials → your OAuth client →
                Authorized redirect URIs. Also enable <strong>Google Search Console API</strong>.
                If Google shows an error and opens Gmail to contact the developer, that mailto is from
                Google&apos;s error page (usually <code className="text-[10px]">redirect_uri_mismatch</code>), not from BidWar.
              </p>
            </div>
          ) : null}

          <div className="flex flex-wrap gap-2">
            <Button size="sm" className="gap-1.5" disabled={connecting} onClick={() => void handleConnect()}>
              {connecting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Link2 className="w-3.5 h-3.5" />}
              {status?.connected ? "Reconnect Google Search Console" : "Connect Google Search Console"}
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="gap-1.5"
              disabled={!status?.connected || status.needsReconsent || submitting}
              onClick={() => void handleSubmitSitemap()}
            >
              {submitting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
              Submit sitemap
            </Button>
          </div>
        </div>
      )}

      {message ? <p className="text-sm text-green-400">{message}</p> : null}
      {error ? <p className="text-sm text-destructive whitespace-pre-wrap">{error}</p> : null}
    </div>
  );
}
