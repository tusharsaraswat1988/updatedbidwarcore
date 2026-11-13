import { type ReactNode } from "react";
import { useRoute } from "wouter";
import {
  useGetTournament,
  getGetTournamentQueryKey,
} from "@workspace/api-client-react";
import { AppLayout } from "@/components/layout";
import { OrganizerSectionHeader } from "@/components/organizer-page-chrome";
import { Card, CardContent } from "@/components/ui/card";
import { Monitor, Link2, Copy, ExternalLink, MessageCircle, Radio, Users } from "lucide-react";
import { ownerJoinPublicUrl } from "@workspace/platform-core";
import { BROADCAST_CANVAS_ASPECT_LABEL } from "@/lib/broadcast-canvas/constants";
import { BROADCAST_OVERLAY_ASPECT, broadcastOverlayUrl } from "@/lib/broadcast-overlay";
import { liveViewerPath, sideDisplayPath } from "@/lib/tournament-navigation";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

/**
 * Links typography system
 * Unified Inter font matching the sidebar and global organiser light mode
 */
const linksLabelSection =
  "font-sans text-xs sm:text-sm font-bold uppercase tracking-wider text-slate-700";
const linksLabelRow =
  "font-sans text-sm sm:text-base font-bold tracking-tight text-slate-900";
const linksLabelTagline =
  "text-xs font-medium text-slate-500 mt-1 leading-snug";
const linksBody =
  "text-xs sm:text-sm font-normal normal-case tracking-normal text-slate-600 mt-1 leading-relaxed";

function LinkSectionHeader({
  title,
  icon,
  subtitle,
}: {
  title: string;
  icon?: ReactNode;
  subtitle?: string;
}) {
  return (
    <div className="px-4 py-3 border-b border-border bg-slate-50">
      <div className="flex items-center gap-2.5 min-w-0">
        {icon ? <span className="text-amber-600 shrink-0">{icon}</span> : null}
        <h2 className="font-sans text-xs sm:text-sm font-bold uppercase tracking-wider text-slate-900">{title}</h2>
      </div>
      {subtitle ? <p className="text-xs font-medium text-slate-500 mt-1 leading-snug">{subtitle}</p> : null}
    </div>
  );
}

function LinkRowLabel({ children, className }: { children: string; className?: string }) {
  return <p className={cn(linksLabelRow, className)}>{children}</p>;
}

/** Row label: role + optional (aspect) + optional · detail — all uppercased together */
function LinkRowTitle({
  role,
  aspect,
  detail,
  className,
}: {
  role: string;
  aspect?: string;
  detail?: string;
  className?: string;
}) {
  return (
    <p className={cn(linksLabelRow, className)}>
      {role}
      {aspect ? <span className="text-amber-600 font-semibold"> ({aspect})</span> : null}
      {detail ? <span className="text-slate-600 font-normal"> · {detail}</span> : null}
    </p>
  );
}

function LinkActionToolbar({
  onCopy,
  onWhatsApp,
  onOpen,
}: {
  onCopy: () => void;
  onWhatsApp: () => void;
  onOpen: () => void;
}) {
  const actionClass =
    "flex flex-1 min-w-0 flex-col items-center justify-center gap-1 min-h-[44px] px-2 py-1.5 text-xs font-semibold text-slate-700 bg-white hover:bg-slate-50 hover:text-slate-950 active:bg-slate-100 transition-colors touch-manipulation focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500";

  return (
    <div
      className="grid grid-cols-3 w-full max-w-full sm:max-w-[17.5rem] md:max-w-[19rem] rounded-lg border border-border bg-white shadow-xs overflow-hidden divide-x divide-border"
      role="group"
      aria-label="Link actions"
    >
      <button type="button" className={actionClass} onClick={onCopy} aria-label="Copy link">
        <Copy className="w-4 h-4 shrink-0 text-slate-600" aria-hidden="true" />
        <span>Copy</span>
      </button>
      <button type="button" className={actionClass} onClick={onWhatsApp} aria-label="Copy for WhatsApp">
        <MessageCircle className="w-4 h-4 shrink-0 text-emerald-600" aria-hidden="true" />
        <span className="hidden min-[360px]:inline">WhatsApp</span>
        <span className="min-[360px]:hidden">WA</span>
      </button>
      <button
        type="button"
        className={actionClass}
        onClick={onOpen}
        aria-label="Open link in new tab"
      >
        <ExternalLink className="w-4 h-4 shrink-0 text-slate-600" aria-hidden="true" />
        <span>Open</span>
      </button>
    </div>
  );
}

function LinkRow({
  title,
  url,
  description,
  shareText,
  accessCode,
}: {
  title: ReactNode;
  url: string;
  description: string;
  shareText?: string;
  accessCode?: string;
}) {
  const { toast } = useToast();
  const whatsappText = shareText ?? `${url}`;

  function copyUrl() {
    void navigator.clipboard.writeText(url).then(
      () => toast({ title: "Copied", description: "Link ready to paste", variant: "success" }),
      () => toast({ title: "Copy failed", description: "Select the address and copy it manually.", variant: "destructive" }),
    );
  }

  function copyCode() {
    if (!accessCode) return;
    void navigator.clipboard.writeText(accessCode).then(
      () => toast({ title: "Code copied", description: accessCode, variant: "success" }),
      () => toast({ title: "Copy failed", description: "Select the code and copy it manually.", variant: "destructive" }),
    );
  }

  function copyWhatsApp() {
    void navigator.clipboard.writeText(whatsappText).then(
      () => toast({ title: "Copied", description: "Paste in WhatsApp", variant: "success" }),
      () => toast({ title: "Copy failed", description: "Could not copy the WhatsApp message.", variant: "destructive" }),
    );
  }

  return (
    <div className="py-3.5 sm:py-4 border-b border-border/50 last:border-0 lg:grid lg:grid-cols-[minmax(0,1fr)_min(100%,17.5rem)] lg:gap-6 lg:items-start">
      <div className="min-w-0 space-y-2.5 lg:space-y-2">
        <div>
          {title}
          <p className={linksBody}>{description}</p>
        </div>

        {accessCode ? (
          <button
            type="button"
            onClick={copyCode}
            title="Copy auction code"
            className="inline-flex flex-col items-start gap-0.5 rounded-lg border border-amber-300 bg-amber-50 px-3 py-1.5 text-left transition-colors hover:bg-amber-100 touch-manipulation max-w-full lg:hidden shadow-xs"
          >
            <span className="text-[10px] font-bold uppercase tracking-wider text-amber-800">Auction code</span>
            <span className="font-mono text-base sm:text-lg font-bold leading-none tracking-widest text-amber-950">
              {accessCode}
            </span>
          </button>
        ) : null}
      </div>

      <div className="mt-2.5 lg:mt-0 space-y-2.5 shrink-0">
        {accessCode ? (
          <button
            type="button"
            onClick={copyCode}
            title="Copy auction code"
            className="hidden lg:inline-flex flex-col items-start gap-0.5 rounded-lg border border-amber-300 bg-amber-50 px-3 py-1.5 text-left transition-colors hover:bg-amber-100 w-full shadow-xs"
          >
            <span className="text-[10px] font-bold uppercase tracking-wider text-amber-800">Auction code</span>
            <span className="font-mono text-lg font-bold leading-none tracking-widest text-amber-950">{accessCode}</span>
          </button>
        ) : null}
        <LinkActionToolbar
          onCopy={copyUrl}
          onWhatsApp={copyWhatsApp}
          onOpen={() => window.open(url, "_blank", "noopener,noreferrer")}
        />
      </div>
    </div>
  );
}

export default function LinksPage() {
  const [, params] = useRoute("/tournament/:id/links");
  const tournamentId = parseInt(params?.id || "0");

  const { data: tournament } = useGetTournament(tournamentId, {
    query: { queryKey: getGetTournamentQueryKey(tournamentId), enabled: !!tournamentId },
  });
  const base = typeof window !== "undefined" ? window.location.origin : "";
  const displayUrl = `${base}/tournament/${tournamentId}/display`;
  const sideSponsorUrl = `${base}${sideDisplayPath(tournamentId, "sponsors", tournament?.auctionCode)}`;
  const sidePlayerUrl = `${base}${sideDisplayPath(tournamentId, "player", tournament?.auctionCode)}`;
  const liveViewerUrl = `${base}${liveViewerPath(tournamentId)}`;
  const broadcastOverlayUrlValue = broadcastOverlayUrl(base, tournamentId);
  const teamPortalUrl = ownerJoinPublicUrl(base, tournamentId);
  const auctionCode = tournament?.auctionCode?.trim() || undefined;
  const tournamentName = tournament?.name ?? "our auction";

  return (
    <AppLayout tournamentId={tournamentId}>
      <div className="org-page-content w-full max-w-3xl md:max-w-4xl lg:max-w-5xl xl:max-w-6xl !space-y-5 min-w-0 overflow-x-hidden">
        <OrganizerSectionHeader
          tournament={tournament}
          title={
            <span className="flex items-center gap-2 sm:gap-3 flex-wrap font-bold">
              <Link2 className="w-7 h-7 sm:w-8 sm:h-8 text-primary shrink-0" aria-hidden />
              <span>Links</span>
            </span>
          }
          titleClassName="text-xl sm:text-2xl lg:text-3xl font-bold"
          description="Share these URLs on auction day — venue screens, your live stream, and fans."
        />

        <Card className="overflow-hidden border border-border bg-card shadow-card">
          <CardContent className="p-0">
            <LinkSectionHeader icon={<Monitor className="h-4 w-4" />} title="Auction LED screens" />
            <div className="px-3 sm:px-4 pb-1">
              <LinkRow
                title={
                  <LinkRowTitle role="Main screen" aspect={BROADCAST_OVERLAY_ASPECT} />
                }
                url={displayUrl}
                accessCode={auctionCode}
                description={
                  auctionCode
                    ? "Use on a projector or TV. Enter the auction code when the screen prompts you."
                    : "Use on a projector or TV. Press F11 for full-screen mode."
                }
                shareText={
                  auctionCode
                    ? `Main screen (${BROADCAST_OVERLAY_ASPECT}) — ${tournamentName}\n${displayUrl}\nAuction code: ${auctionCode}`
                    : `Main screen — ${tournamentName}\n${displayUrl}`
                }
              />
              <LinkRow
                title={
                  <LinkRowTitle
                    role="Side screen"
                    aspect={BROADCAST_CANVAS_ASPECT_LABEL}
                    detail="Sponsors brand showcase"
                  />
                }
                url={sideSponsorUrl}
                description="Left or right vertical LED. Displays the rotating sponsor carousel."
                shareText={`Side screen (${BROADCAST_CANVAS_ASPECT_LABEL}) — sponsors — ${tournamentName}\n${sideSponsorUrl}`}
              />
              <LinkRow
                title={
                  <LinkRowTitle
                    role="Side screen"
                    aspect={BROADCAST_CANVAS_ASPECT_LABEL}
                    detail="Live player and bids"
                  />
                }
                url={sidePlayerUrl}
                description="Shows the player on the block with the live bid amount and timer."
                shareText={`Side screen (${BROADCAST_CANVAS_ASPECT_LABEL}) — live player — ${tournamentName}\n${sidePlayerUrl}`}
              />
            </div>
          </CardContent>
        </Card>

        <Card className="overflow-hidden border border-border bg-card shadow-card">
          <CardContent className="p-0">
            <LinkSectionHeader
              icon={<Radio className="h-4 w-4" />}
              title="Broadcast overlay (for live streaming)"
            />
            <div className="px-3 sm:px-4 pb-1">
              <LinkRow
                title={<LinkRowTitle role="Browser source overlay" aspect={BROADCAST_OVERLAY_ASPECT} />}
                url={broadcastOverlayUrlValue}
                description="In OBS, vMix, or similar software, add a Browser Source, paste this URL, and set the canvas to 1920 × 1080."
                shareText={`Broadcast overlay — ${tournamentName}\n${broadcastOverlayUrlValue}`}
              />
            </div>
          </CardContent>
        </Card>

        <Card className="overflow-hidden border border-border bg-card shadow-card">
          <CardContent className="p-0">
            <LinkSectionHeader
              icon={<Monitor className="h-4 w-4" />}
              title="For auction fans (spectators)"
              subtitle="Share with everyone connected to the auction."
            />
            <div className="px-3 sm:px-4 pb-1">
              <LinkRow
                title={<LinkRowLabel>Live auction viewer</LinkRowLabel>}
                url={liveViewerUrl}
                description="Fans open this link to watch the auction live. No code is required."
                shareText={`Watch our auction live — ${tournamentName}\n${liveViewerUrl}`}
              />
            </div>
          </CardContent>
        </Card>

        <Card className="overflow-hidden border border-border bg-card shadow-card">
          <CardContent className="p-0">
            <LinkSectionHeader icon={<Users className="h-4 w-4" />} title="Team portal" />
            <div className="px-3 sm:px-4 pb-1">
              <LinkRow
                title={<LinkRowLabel>Team owner portal</LinkRowLabel>}
                url={teamPortalUrl}
                description="Team owners sign in with their mobile number and access code."
                shareText={`Team portal — ${tournamentName}\n${teamPortalUrl}`}
              />
            </div>
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}
