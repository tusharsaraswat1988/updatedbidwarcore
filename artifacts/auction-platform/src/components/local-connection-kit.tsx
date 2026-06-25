import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Copy,
  ExternalLink,
  MessageCircle,
  KeyRound,
  RefreshCw,
  Laptop,
  Monitor,
  Smartphone,
  QrCode,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface ConnectionKitTeam {
  id: number;
  name: string;
  shortCode: string;
  ownerName: string | null;
  ownerMobile?: string | null;
  accessCode?: string | null;
  ownerUrl: string;
}

interface ConnectionKitData {
  baseUrl: string;
  tournamentId: number;
  tournamentName: string;
  operator: { url: string; path: string };
  display: { url: string; path: string };
  teams: ConnectionKitTeam[];
}

function qrSrc(targetUrl: string, cacheBust: number): string {
  return `/local/qr.png?url=${encodeURIComponent(targetUrl)}&_=${cacheBust}`;
}

function KitLinkRow({
  label,
  icon,
  url,
  description,
  shareText,
  cacheBust,
}: {
  label: string;
  icon: React.ReactNode;
  url: string;
  description: string;
  shareText?: string;
  cacheBust: number;
}) {
  const { toast } = useToast();

  function copy() {
    navigator.clipboard.writeText(url);
    toast({ title: "Copied!", description: `${label} link copied` });
  }

  const whatsappHref = `https://wa.me/?text=${encodeURIComponent(shareText ?? `${label}: ${url}`)}`;

  return (
    <div className="rounded-xl border border-border/50 bg-card/50 p-4 space-y-3">
      <div className="flex items-start gap-3">
        <div className="flex-shrink-0 w-10 h-10 rounded-lg bg-muted/40 flex items-center justify-center text-primary">
          {icon}
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-sm">{label}</p>
          <p className="text-xs text-muted-foreground mt-0.5">{description}</p>
          <p className="text-xs font-mono text-primary mt-2 break-all">{url}</p>
        </div>
        <img
          src={qrSrc(url, cacheBust)}
          alt={`${label} QR`}
          className="w-[88px] h-[88px] rounded-lg border border-border/60 bg-white flex-shrink-0"
        />
      </div>
      <div className="flex gap-2 flex-wrap">
        <Button size="sm" variant="outline" className="gap-1.5 h-8" onClick={copy}>
          <Copy className="w-3.5 h-3.5" /> Copy
        </Button>
        <Button size="sm" variant="outline" className="gap-1.5 h-8" asChild>
          <a href={whatsappHref} target="_blank" rel="noopener noreferrer">
            <MessageCircle className="w-3.5 h-3.5" /> Share
          </a>
        </Button>
        <Button size="sm" variant="outline" className="gap-1.5 h-8" onClick={() => window.open(url, "_blank")}>
          <ExternalLink className="w-3.5 h-3.5" /> Open
        </Button>
      </div>
    </div>
  );
}

function KitTeamRow({
  team,
  tournamentName,
  cacheBust,
}: {
  team: ConnectionKitTeam;
  tournamentName: string;
  cacheBust: number;
}) {
  const { toast } = useToast();
  const shareLines = [
    `${tournamentName} — ${team.name}`,
    team.ownerName ? `Owner: ${team.ownerName}` : null,
    team.accessCode ? `Access code: ${team.accessCode}` : null,
    `Bidding link: ${team.ownerUrl}`,
  ].filter(Boolean);
  const whatsappHref = `https://wa.me/${team.ownerMobile ? team.ownerMobile.replace(/\D/g, "") : ""}?text=${encodeURIComponent(shareLines.join("\n"))}`;

  function copyText(text: string, label: string) {
    navigator.clipboard.writeText(text);
    toast({ title: "Copied!", description: label });
  }

  return (
    <div className="rounded-xl border border-border/50 bg-card/50 p-4 space-y-3">
      <div className="flex items-start gap-3">
        <div
          className="w-10 h-10 rounded-lg flex items-center justify-center font-display font-bold text-xs flex-shrink-0"
          style={{ backgroundColor: "#3B82F622", color: "#3B82F6", border: "1px solid #3B82F644" }}
        >
          {team.shortCode}
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-sm">{team.name}</p>
          {team.ownerName && <p className="text-xs text-muted-foreground mt-0.5">{team.ownerName}</p>}
          {team.accessCode && (
            <div className="flex items-center gap-2 mt-2 rounded-lg bg-primary/5 border border-primary/20 px-2.5 py-1.5">
              <KeyRound className="w-3.5 h-3.5 text-primary flex-shrink-0" />
              <span className="text-xs font-display font-black tracking-[0.12em] text-primary">{team.accessCode}</span>
            </div>
          )}
          <p className="text-xs font-mono text-primary mt-2 break-all">{team.ownerUrl}</p>
        </div>
        <img
          src={qrSrc(team.ownerUrl, cacheBust)}
          alt={`${team.name} QR`}
          className="w-[88px] h-[88px] rounded-lg border border-border/60 bg-white flex-shrink-0"
        />
      </div>
      <div className="flex gap-2 flex-wrap">
        {team.accessCode && (
          <Button size="sm" variant="outline" className="gap-1.5 h-8" onClick={() => copyText(team.accessCode!, "Access code copied")}>
            <Copy className="w-3.5 h-3.5" /> Copy code
          </Button>
        )}
        <Button size="sm" variant="outline" className="gap-1.5 h-8" onClick={() => copyText(team.ownerUrl, "Owner link copied")}>
          <Copy className="w-3.5 h-3.5" /> Copy link
        </Button>
        <Button size="sm" variant="outline" className="gap-1.5 h-8" asChild>
          <a href={whatsappHref} target="_blank" rel="noopener noreferrer">
            <MessageCircle className="w-3.5 h-3.5" /> WhatsApp
          </a>
        </Button>
        <Button size="sm" variant="outline" className="gap-1.5 h-8" onClick={() => window.open(team.ownerUrl, "_blank")}>
          <ExternalLink className="w-3.5 h-3.5" /> Open
        </Button>
      </div>
    </div>
  );
}

export function LocalConnectionKit({ tournamentId }: { tournamentId: number }) {
  const [kit, setKit] = useState<ConnectionKitData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [cacheBust, setCacheBust] = useState(0);

  const load = useCallback(async () => {
    if (!tournamentId) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/local/connection-kit?tournamentId=${tournamentId}`, {
        credentials: "include",
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error((body as { error?: string }).error ?? "Could not load connection kit");
      }
      const data = (await res.json()) as ConnectionKitData;
      setKit(data);
      setCacheBust(Date.now());
    } catch (e) {
      setKit(null);
      setError(e instanceof Error ? e.message : "Could not load connection kit");
    } finally {
      setLoading(false);
    }
  }, [tournamentId]);

  useEffect(() => {
    void load();
  }, [load]);

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground py-4">
        <RefreshCw className="w-4 h-4 animate-spin" />
        Loading connection links…
      </div>
    );
  }

  if (error || !kit) {
    return (
      <div className="rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
        {error ?? "Connection kit unavailable. Import your tournament in BidWar Local first."}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <QrCode className="w-4 h-4 text-cyan-400" />
          <span>
            Venue server: <span className="font-mono text-foreground">{kit.baseUrl}</span>
          </span>
        </div>
        <Button size="sm" variant="outline" className="gap-1.5 h-8" onClick={() => void load()}>
          <RefreshCw className="w-3.5 h-3.5" /> Refresh links
        </Button>
      </div>

      <KitLinkRow
        label="Operator Panel"
        icon={<Laptop className="w-5 h-5" />}
        url={kit.operator.url}
        description="Auction computer — control the live auction"
        shareText={`Operator panel: ${kit.operator.url}`}
        cacheBust={cacheBust}
      />
      <KitLinkRow
        label="LED Display"
        icon={<Monitor className="w-5 h-5" />}
        url={kit.display.url}
        description="Big screen — open in a browser and go full-screen"
        shareText={`Display screen: ${kit.display.url}`}
        cacheBust={cacheBust}
      />

      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <Smartphone className="w-4 h-4 text-green-400" />
          <p className="text-sm font-semibold">Team Owners — scan or share one link per team</p>
        </div>
        {kit.teams.length === 0 ? (
          <p className="text-sm text-muted-foreground">No teams in this tournament.</p>
        ) : (
          <div className="space-y-3">
            {kit.teams.map((team) => (
              <KitTeamRow key={team.id} team={team} tournamentName={kit.tournamentName} cacheBust={cacheBust} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
