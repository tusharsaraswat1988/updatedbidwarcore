import React, { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Link } from "wouter";
import {
  Radio,
  Tv,
  Globe,
  ExternalLink,
  CheckCircle2,
  AlertCircle,
  Clock,
  ShieldCheck,
  Flame,
  Play,
  Save,
  Loader2,
  Sparkles,
  Layers,
  Video,
  X,
  Plus,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { SettingsCard, SettingsInsetBlock } from "@/components/settings/settings-card";
import { useToast } from "@/hooks/use-toast";
import {
  validateBroadcastUrl,
  type BroadcastPlatform,
  type BroadcastStatus,
  type BroadcastLinkConfig,
  type TournamentBroadcastConfig,
  type FanArenaEligibilityResult,
} from "@workspace/platform-core";

interface MatchItem {
  id: number;
  sport: string;
  roundName: string | null;
  matchLabel: string | null;
  status: string;
  homeTeamName: string;
  awayTeamName: string;
  broadcast: BroadcastLinkConfig | null;
}

interface BroadcastDataResponse {
  tournamentId: number;
  fanArenaOptIn: boolean;
  fanArenaApproved: boolean;
  licenseStatus: string;
  adminLocked: boolean;
  auctionEnabled: boolean;
  scoringEnabled: boolean;
  eligibility: FanArenaEligibilityResult;
  broadcast: TournamentBroadcastConfig;
  matchBroadcasts: Record<string, BroadcastLinkConfig>;
  matches: MatchItem[];
}

export function FanArenaBroadcastSettings({
  tournamentId,
}: {
  tournamentId: number;
}) {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data, isLoading, isError, refetch } = useQuery<BroadcastDataResponse>({
    queryKey: ["/api/tournaments", tournamentId, "broadcast"],
    queryFn: async () => {
      const res = await fetch(`/api/tournaments/${tournamentId}/broadcast`, {
        headers: { "Content-Type": "application/json" },
      });
      if (!res.ok) {
        throw new Error("Failed to load broadcast settings");
      }
      return res.json();
    },
    enabled: !!tournamentId,
  });

  // Local form state
  const [optIn, setOptIn] = useState(false);
  const [auctionUrl, setAuctionUrl] = useState("");
  const [auctionEnabled, setAuctionEnabled] = useState(true);
  const [auctionStatus, setAuctionStatus] = useState<BroadcastStatus>("live");
  const [auctionTitle, setAuctionTitle] = useState("");

  const [scoringUrl, setScoringUrl] = useState("");
  const [scoringEnabled, setScoringEnabled] = useState(true);
  const [scoringStatus, setScoringStatus] = useState<BroadcastStatus>("live");
  const [scoringTitle, setScoringTitle] = useState("");

  // Match stream edits
  const [selectedMatchId, setSelectedMatchId] = useState<string>("");
  const [matchUrl, setMatchUrl] = useState("");
  const [matchStreamEnabled, setMatchStreamEnabled] = useState(true);
  const [matchStreamStatus, setMatchStreamStatus] = useState<BroadcastStatus>("live");
  const [matchStreamTitle, setMatchStreamTitle] = useState("");
  const [matchBroadcastsMap, setMatchBroadcastsMap] = useState<
    Record<string, BroadcastLinkConfig | null>
  >({});

  // Sync state when data arrives
  useEffect(() => {
    if (!data) return;
    setOptIn(data.fanArenaOptIn ?? false);

    if (data.broadcast?.auction) {
      setAuctionUrl(data.broadcast.auction.url ?? "");
      setAuctionEnabled(data.broadcast.auction.enabled ?? true);
      setAuctionStatus(data.broadcast.auction.status ?? "live");
      setAuctionTitle(data.broadcast.auction.title ?? "");
    } else {
      setAuctionUrl("");
      setAuctionEnabled(true);
      setAuctionStatus("live");
      setAuctionTitle("");
    }

    if (data.broadcast?.scoring) {
      setScoringUrl(data.broadcast.scoring.url ?? "");
      setScoringEnabled(data.broadcast.scoring.enabled ?? true);
      setScoringStatus(data.broadcast.scoring.status ?? "live");
      setScoringTitle(data.broadcast.scoring.title ?? "");
    } else {
      setScoringUrl("");
      setScoringEnabled(true);
      setScoringStatus("live");
      setScoringTitle("");
    }

    setMatchBroadcastsMap(data.matchBroadcasts ?? {});
  }, [data]);

  // Load selected match values
  useEffect(() => {
    if (!selectedMatchId) {
      setMatchUrl("");
      setMatchStreamEnabled(true);
      setMatchStreamStatus("live");
      setMatchStreamTitle("");
      return;
    }
    const existing = matchBroadcastsMap[selectedMatchId];
    if (existing) {
      setMatchUrl(existing.url ?? "");
      setMatchStreamEnabled(existing.enabled ?? true);
      setMatchStreamStatus(existing.status ?? "live");
      setMatchStreamTitle(existing.title ?? "");
    } else {
      setMatchUrl("");
      setMatchStreamEnabled(true);
      setMatchStreamStatus("live");
      setMatchStreamTitle("");
    }
  }, [selectedMatchId, matchBroadcastsMap]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      // Validate URLs if provided
      if (auctionUrl.trim()) {
        const val = validateBroadcastUrl(auctionUrl.trim());
        if (!val.valid) {
          throw new Error(`Auction stream URL: ${val.error}`);
        }
      }
      if (scoringUrl.trim()) {
        const val = validateBroadcastUrl(scoringUrl.trim());
        if (!val.valid) {
          throw new Error(`Scoring stream URL: ${val.error}`);
        }
      }

      // If a match is currently being edited with a URL, commit it to map
      const finalMatchMap = { ...matchBroadcastsMap };
      if (selectedMatchId) {
        if (matchUrl.trim()) {
          const val = validateBroadcastUrl(matchUrl.trim());
          if (!val.valid) {
            throw new Error(`Match stream URL: ${val.error}`);
          }
          finalMatchMap[selectedMatchId] = {
            url: val.normalizedUrl!,
            platform: val.platform,
            enabled: matchStreamEnabled,
            status: matchStreamStatus,
            title: matchStreamTitle.trim() || undefined,
          };
        } else {
          finalMatchMap[selectedMatchId] = null;
        }
      }

      const payload = {
        fanArenaOptIn: optIn,
        broadcast: {
          auction: auctionUrl.trim()
            ? {
                url: auctionUrl.trim(),
                enabled: auctionEnabled,
                status: auctionStatus,
                title: auctionTitle.trim() || undefined,
              }
            : null,
          scoring: scoringUrl.trim()
            ? {
                url: scoringUrl.trim(),
                enabled: scoringEnabled,
                status: scoringStatus,
                title: scoringTitle.trim() || undefined,
              }
            : null,
        },
        matchBroadcasts: finalMatchMap,
      };

      const res = await fetch(`/api/tournaments/${tournamentId}/broadcast`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        throw new Error(errJson.error || errJson.details || "Failed to save broadcast settings");
      }

      return res.json();
    },
    onSuccess: () => {
      toast({
        title: "Settings Saved",
        description: "Fan Arena and broadcast configurations updated successfully.",
      });
      void queryClient.invalidateQueries({
        queryKey: ["/api/tournaments", tournamentId, "broadcast"],
      });
      void queryClient.invalidateQueries({
        queryKey: ["/api/tournaments", tournamentId],
      });
      void queryClient.invalidateQueries({
        queryKey: ["/api/fan/tournaments"],
      });
    },
    onError: (err: any) => {
      toast({
        variant: "destructive",
        title: "Save Failed",
        description: err.message || "Could not update broadcast settings",
      });
    },
  });

  if (isLoading) {
    return (
      <div className="py-12 flex flex-col items-center justify-center space-y-3 text-muted-foreground text-sm">
        <Loader2 className="w-6 h-6 animate-spin text-amber-500" />
        <p>Loading Fan Arena & Broadcast settings...</p>
      </div>
    );
  }

  if (isError || !data) {
    return (
      <div className="py-12 text-center space-y-3">
        <AlertCircle className="w-8 h-8 text-rose-500 mx-auto" />
        <p className="text-sm text-muted-foreground">Unable to load broadcast settings.</p>
        <Button variant="outline" size="sm" onClick={() => refetch()}>
          Retry
        </Button>
      </div>
    );
  }

  const eligibility = data.eligibility;
  const matches = data.matches ?? [];

  return (
    <div className="space-y-6 animate-fade-in" data-testid="fan-arena-broadcast-settings">
      {/* ── CARD 1: FAN ARENA DISCOVERY & CURATION ──────────────────────────── */}
      <SettingsCard
        title="Fan Arena Curation & Public Discovery"
        description="Control tournament listing and spectator discovery on the main BidWar Fan Arena (/fan)."
        icon={<Globe className="w-4 h-4 text-amber-500" />}
      >
        <div className="space-y-4">
          {/* Eligibility Status Banner */}
          <div
            className={`p-4 rounded-xl border flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-xs ${
              eligibility.eligible
                ? "bg-emerald-50 border-emerald-200 text-emerald-950"
                : optIn
                ? "bg-amber-50 border-amber-200 text-amber-950"
                : "bg-slate-50 border-slate-200 text-slate-800"
            }`}
          >
            <div className="space-y-1 min-w-0">
              <div className="flex items-center gap-2">
                {eligibility.eligible ? (
                  <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
                ) : optIn ? (
                  <AlertCircle className="w-5 h-5 text-amber-600 shrink-0" />
                ) : (
                  <Clock className="w-5 h-5 text-slate-500 shrink-0" />
                )}
                <span className="font-bold text-sm text-slate-900">
                  Listing Status:{" "}
                  {eligibility.eligible ? (
                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800 border border-emerald-300 ml-1">
                      Live on Fan Arena
                    </span>
                  ) : optIn ? (
                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-bold bg-amber-100 text-amber-900 border border-amber-300 ml-1">
                      Pending BidWar License / Approval
                    </span>
                  ) : (
                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-bold bg-slate-200 text-slate-700 border border-slate-300 ml-1">
                      Disabled / Opted Out
                    </span>
                  )}
                </span>
              </div>
              <p className="text-xs text-slate-600 leading-relaxed">
                {eligibility.eligible
                  ? "Your tournament meets all BidWar curation criteria and is publicly discoverable on the Fan Arena."
                  : optIn
                  ? "Organizer opt-in is active. Awaiting BidWar production license or administrator approval before appearing publicly on /fan."
                  : "Enable Fan Arena listing below to submit this tournament for public discovery."}
              </p>
              {!eligibility.eligible && optIn && eligibility.reasons.length > 0 && (
                <ul className="text-xs text-slate-700 space-y-1 mt-2 pt-2 border-t border-amber-200/80">
                  {eligibility.reasons.map((r, i) => (
                    <li key={i} className="flex items-start gap-1.5">
                      <span className="w-1.5 h-1.5 rounded-full bg-amber-500 shrink-0 mt-1.5" />
                      <span>{r}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div className="flex items-center gap-2 self-start sm:self-auto shrink-0">
              <Link
                href="/fan"
                target="_blank"
                className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-bold bg-white hover:bg-slate-50 text-slate-800 border border-slate-300 shadow-xs transition-colors"
              >
                <span>Browse /fan</span>
                <ExternalLink className="w-3.5 h-3.5 text-slate-600" />
              </Link>
            </div>
          </div>

          {/* Opt-In Switch */}
          <SettingsInsetBlock className="bg-slate-50/80 border-slate-200">
            <div className="flex items-center justify-between gap-4">
              <div className="space-y-0.5 min-w-0">
                <Label htmlFor="fanArenaOptIn" className="font-bold text-sm text-slate-900 cursor-pointer">
                  Fan Arena Public Listing (Opt-In)
                </Label>
                <p className="text-xs text-slate-600 leading-relaxed">
                  Request listing on the curated BidWar discovery portal. Does not bypass BidWar licensing or administrator review.
                </p>
              </div>
              <Switch
                id="fanArenaOptIn"
                checked={optIn}
                onCheckedChange={setOptIn}
              />
            </div>
          </SettingsInsetBlock>
        </div>
      </SettingsCard>

      {/* ── CARD 2: TOURNAMENT-WIDE BROADCAST STREAMS ───────────────────────── */}
      <SettingsCard
        title="Official Broadcast Streams"
        description="Configure verified live stream links for your tournament auction and match play (YouTube, Facebook Live, Twitch)."
        icon={<Tv className="w-4 h-4 text-amber-500" />}
      >
        <div className="space-y-4">
          {/* Auction Broadcast */}
          {data.auctionEnabled && (
            <div className="rounded-xl border border-slate-200/90 bg-slate-50/70 p-4 sm:p-5 space-y-4 hover:border-slate-300 transition-colors shadow-xs">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-lg bg-amber-50 border border-amber-200 flex items-center justify-center text-amber-600 shadow-xs">
                    <Radio className="w-4 h-4" />
                  </div>
                  <div>
                    <h4 className="font-bold text-sm text-slate-900">Auction Live Broadcast</h4>
                    <p className="text-xs text-slate-600 mt-0.5">
                      Shown across spectator fan pages with &apos;Watch Auction Live&apos; CTA.
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2.5">
                  <span className="text-xs font-semibold text-slate-600">Display:</span>
                  <Switch
                    checked={auctionEnabled}
                    onCheckedChange={setAuctionEnabled}
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5 pt-1">
                <div className="md:col-span-2 space-y-1.5">
                  <Label className="text-xs font-semibold text-slate-700">Stream URL (HTTPS only)</Label>
                  <Input
                    placeholder="https://www.youtube.com/watch?v=..."
                    value={auctionUrl}
                    onChange={(e) => setAuctionUrl(e.target.value)}
                    className="h-9 text-xs bg-white border-slate-300 text-slate-900 placeholder:text-slate-400 focus-visible:ring-amber-500"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold text-slate-700">Stream Status</Label>
                  <Select
                    value={auctionStatus}
                    onValueChange={(v) => setAuctionStatus(v as BroadcastStatus)}
                  >
                    <SelectTrigger className="h-9 text-xs bg-white border-slate-300 text-slate-900">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-white border-slate-200 text-slate-900 shadow-lg">
                      <SelectItem value="live" className="text-xs font-medium focus:bg-amber-50">🔴 Live Now</SelectItem>
                      <SelectItem value="upcoming" className="text-xs font-medium focus:bg-amber-50">⏳ Upcoming</SelectItem>
                      <SelectItem value="ended" className="text-xs font-medium focus:bg-amber-50">🏁 Ended</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-slate-700">Display Title (Optional)</Label>
                <Input
                  placeholder="e.g. Official Grand Auction Night 2026"
                  value={auctionTitle}
                  onChange={(e) => setAuctionTitle(e.target.value)}
                  className="h-9 text-xs bg-white border-slate-300 text-slate-900 placeholder:text-slate-400 focus-visible:ring-amber-500"
                />
              </div>
            </div>
          )}

          {/* Scoring Broadcast */}
          {data.scoringEnabled && (
            <div className="rounded-xl border border-slate-200/90 bg-slate-50/70 p-4 sm:p-5 space-y-4 hover:border-slate-300 transition-colors shadow-xs">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-lg bg-emerald-50 border border-emerald-200 flex items-center justify-center text-emerald-600 shadow-xs">
                    <Tv className="w-4 h-4" />
                  </div>
                  <div>
                    <h4 className="font-bold text-sm text-slate-900">
                      Tournament Match / Scoring Broadcast
                    </h4>
                    <p className="text-xs text-slate-600 mt-0.5">
                      Shown across match centers with &apos;Watch Match Live&apos; CTA.
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2.5">
                  <span className="text-xs font-semibold text-slate-600">Display:</span>
                  <Switch
                    checked={scoringEnabled}
                    onCheckedChange={setScoringEnabled}
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5 pt-1">
                <div className="md:col-span-2 space-y-1.5">
                  <Label className="text-xs font-semibold text-slate-700">Stream URL (HTTPS only)</Label>
                  <Input
                    placeholder="https://www.youtube.com/live/..."
                    value={scoringUrl}
                    onChange={(e) => setScoringUrl(e.target.value)}
                    className="h-9 text-xs bg-white border-slate-300 text-slate-900 placeholder:text-slate-400 focus-visible:ring-emerald-500"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold text-slate-700">Stream Status</Label>
                  <Select
                    value={scoringStatus}
                    onValueChange={(v) => setScoringStatus(v as BroadcastStatus)}
                  >
                    <SelectTrigger className="h-9 text-xs bg-white border-slate-300 text-slate-900">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-white border-slate-200 text-slate-900 shadow-lg">
                      <SelectItem value="live" className="text-xs font-medium focus:bg-emerald-50">🔴 Live Now</SelectItem>
                      <SelectItem value="upcoming" className="text-xs font-medium focus:bg-emerald-50">⏳ Upcoming</SelectItem>
                      <SelectItem value="ended" className="text-xs font-medium focus:bg-emerald-50">🏁 Ended</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-slate-700">Display Title (Optional)</Label>
                <Input
                  placeholder="e.g. Center Court Live Coverage"
                  value={scoringTitle}
                  onChange={(e) => setScoringTitle(e.target.value)}
                  className="h-9 text-xs bg-white border-slate-300 text-slate-900 placeholder:text-slate-400 focus-visible:ring-emerald-500"
                />
              </div>
            </div>
          )}
        </div>
      </SettingsCard>

      {/* ── CARD 3: INDIVIDUAL MATCH STREAMS ─────────────────────────────────── */}
      {matches.length > 0 && (
        <SettingsCard
          title="Individual Match Broadcasts"
          description="Assign dedicated live streams to individual matches. Match stream links appear exclusively on their corresponding match cards."
          icon={<Layers className="w-4 h-4 text-amber-500" />}
        >
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-slate-700">Select Match to Configure</Label>
              <Select value={selectedMatchId} onValueChange={setSelectedMatchId}>
                <SelectTrigger className="h-10 text-xs bg-white border-slate-300 text-slate-900">
                  <SelectValue placeholder="Choose a match to assign dedicated live stream..." />
                </SelectTrigger>
                <SelectContent className="bg-white border-slate-200 text-slate-900 shadow-lg">
                  {matches.map((m) => {
                    const hasStream = !!matchBroadcastsMap[String(m.id)]?.url;
                    return (
                      <SelectItem key={m.id} value={String(m.id)} className="text-xs">
                        <span className="font-semibold text-slate-900">
                          Match #{m.id}: {m.homeTeamName} vs {m.awayTeamName}
                        </span>{" "}
                        {m.roundName ? <span className="text-slate-500">({m.roundName})</span> : null}
                        {hasStream ? <span className="text-emerald-700 font-medium"> · 📺 Stream Configured</span> : null}
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>
            </div>

            {selectedMatchId && (
              <div className="rounded-xl border border-slate-200/90 bg-slate-50/70 p-4 sm:p-5 space-y-4 shadow-sm animate-fade-in">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-bold text-slate-900">
                    Match #{selectedMatchId} Dedicated Stream Settings
                  </span>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-semibold text-slate-600">Enabled:</span>
                    <Switch
                      checked={matchStreamEnabled}
                      onCheckedChange={setMatchStreamEnabled}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5">
                  <div className="md:col-span-2 space-y-1.5">
                    <Label className="text-xs font-semibold text-slate-700">Match Stream URL</Label>
                    <Input
                      placeholder="https://www.youtube.com/watch?v=..."
                      value={matchUrl}
                      onChange={(e) => setMatchUrl(e.target.value)}
                      className="h-9 text-xs bg-white border-slate-300 text-slate-900 placeholder:text-slate-400 focus-visible:ring-amber-500"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold text-slate-700">Status</Label>
                    <Select
                      value={matchStreamStatus}
                      onValueChange={(v) => setMatchStreamStatus(v as BroadcastStatus)}
                    >
                      <SelectTrigger className="h-9 text-xs bg-white border-slate-300 text-slate-900">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="bg-white border-slate-200 text-slate-900 shadow-lg">
                        <SelectItem value="live" className="text-xs font-medium focus:bg-amber-50">🔴 Live Now</SelectItem>
                        <SelectItem value="upcoming" className="text-xs font-medium focus:bg-amber-50">⏳ Upcoming</SelectItem>
                        <SelectItem value="ended" className="text-xs font-medium focus:bg-amber-50">🏁 Ended</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold text-slate-700">Stream Title</Label>
                  <Input
                    placeholder="e.g. Court 1 / Pitch A Broadcast"
                    value={matchStreamTitle}
                    onChange={(e) => setMatchStreamTitle(e.target.value)}
                    className="h-9 text-xs bg-white border-slate-300 text-slate-900 placeholder:text-slate-400 focus-visible:ring-amber-500"
                  />
                </div>
              </div>
            )}
          </div>
        </SettingsCard>
      )}

      {/* Save Action Bar */}
      <div className="flex items-center justify-end gap-3 pt-2">
        <Button
          onClick={() => saveMutation.mutate()}
          disabled={saveMutation.isPending}
          className="bg-[#EAB308] hover:bg-[#CA8A04] text-[#0F172A] font-bold px-6 h-10 shadow-sm transition-colors rounded-lg flex items-center gap-2"
        >
          {saveMutation.isPending ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              Saving...
            </>
          ) : (
            <>
              <Save className="w-4 h-4 mr-2" />
              Save Broadcast Settings
            </>
          )}
        </Button>
      </div>
    </div>
  );
}

export default FanArenaBroadcastSettings;
