import { useState } from "react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import {
  Tv2,
  Users,
  User,
  Crown,
  Image as ImageIcon,
  Gavel,
  Trophy,
  Film,
  Timer,
  Sparkles,
  Coins,
  Pause,
  Play,
  RotateCcw,
  CheckCircle,
  ExternalLink,
  Volume2,
  VolumeX,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { AuctionObsBroadcastTools } from "./auction-obs-broadcast-tools";
import type { PresentationContextKind, PrizePlate } from "@/lib/presentation-context";
import type { AuctionState } from "@workspace/api-client-react";

export type BroadcastStudioDrawerProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tournamentId: number;
  operatorReadOnly?: boolean;
  activeTab?: "led" | "obs" | "intermission";
  onTabChange?: (tab: "led" | "obs" | "intermission") => void;
  // LED State
  ledOverlay: string | null;
  onSelectLedOverlay: (mode: "off" | "team" | "player" | "top5" | "banner") => void;
  // OBS State
  presentationContext: {
    context?: PresentationContextKind;
    prize?: PrizePlate | null;
    revision?: number;
  };
  onSelectObsPresentation: (context: PresentationContextKind) => void;
  onAppliedPresentationState: (state: AuctionState) => void;
  // Intermission Tools
  onOpenBreakTimer: () => void;
  breakTimerActive?: boolean;
  breakTimerMusicMuted?: boolean;
  onToggleBreakMusic?: () => void;
  onOpenFortuneWheel: () => void;
  onOpenPurseBooster: () => void;
  onBringUnsold: () => void;
  unsoldPlayersCount: number;
  bringUnsoldDisabled?: boolean;
  // Session Controls
  isActive?: boolean;
  isPaused?: boolean;
  isPreAuction?: boolean;
  onStartResumeAuction: () => void;
  onPauseAuction: () => void;
  onConcludeAuction?: () => void;
  mainRoundExhausted?: boolean;
};

export function BroadcastStudioDrawer({
  open,
  onOpenChange,
  tournamentId,
  operatorReadOnly = false,
  activeTab: controlledTab,
  onTabChange,
  ledOverlay,
  onSelectLedOverlay,
  presentationContext,
  onSelectObsPresentation,
  onAppliedPresentationState,
  onOpenBreakTimer,
  breakTimerActive = false,
  breakTimerMusicMuted = false,
  onToggleBreakMusic,
  onOpenFortuneWheel,
  onOpenPurseBooster,
  onBringUnsold,
  unsoldPlayersCount,
  bringUnsoldDisabled = false,
  isActive = false,
  isPaused = false,
  isPreAuction = false,
  onStartResumeAuction,
  onPauseAuction,
  onConcludeAuction,
  mainRoundExhausted = false,
}: BroadcastStudioDrawerProps) {
  const [internalTab, setInternalTab] = useState<"led" | "obs" | "intermission">("led");
  const activeTab = controlledTab ?? internalTab;

  const handleTabChange = (tab: "led" | "obs" | "intermission") => {
    setInternalTab(tab);
    onTabChange?.(tab);
  };

  const ledButtons = [
    { mode: "off" as const, label: "MAIN Live View", icon: Tv2, desc: "Stage player & bidding" },
    { mode: "team" as const, label: "Team Overview", icon: Users, desc: "Squad counts & purses" },
    { mode: "player" as const, label: "Player List", icon: User, desc: "Browse pool by status" },
    { mode: "top5" as const, label: "Top 5 Sold", icon: Crown, desc: "Highest bids leaderboard" },
    { mode: "banner" as const, label: "Sponsor Banner", icon: ImageIcon, desc: "Full-bleed graphic" },
  ];

  const obsButtons = [
    { context: "auction" as const, label: "Live Auction", icon: Gavel, desc: "Lower-third with active bid" },
    { context: "top5" as const, label: "Top 5 Sold", icon: Crown, desc: "Leaderboard overlay" },
    { context: "team" as const, label: "Team Details", icon: Users, desc: "Team roster & purse table" },
  ];

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="w-[92vw] sm:w-[480px] md:w-[540px] p-0 flex flex-col bg-[#0c1222] border-l border-white/15 text-white z-50 shadow-2xl"
      >
        <SheetHeader className="px-6 py-5 border-b border-white/10 shrink-0 bg-white/[0.02]">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-2xl bg-amber-500/20 border border-amber-500/35 flex items-center justify-center text-amber-400 shrink-0 shadow-sm">
                <Tv2 className="w-6 h-6" />
              </div>
              <div>
                <SheetTitle className="text-lg sm:text-xl font-black tracking-tight text-white flex items-center gap-2">
                  Broadcast &amp; Media Studio
                </SheetTitle>
                <SheetDescription className="text-xs sm:text-sm text-white/60 mt-0.5">
                  Manage stage screens, OBS graphics, and intermissions
                </SheetDescription>
              </div>
            </div>
          </div>

          {/* Navigation Tabs (LED / OBS / Intermissions) */}
          <div className="grid grid-cols-3 gap-2 pt-4">
            {[
              { id: "led" as const, label: "LED Screen", icon: Tv2 },
              { id: "obs" as const, label: "OBS Stream", icon: Gavel },
              { id: "intermission" as const, label: "Intermissions", icon: Sparkles },
            ].map((tab) => {
              const active = activeTab === tab.id;
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => handleTabChange(tab.id)}
                  className={`flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl text-xs sm:text-sm font-black transition-all ${
                    active
                      ? "bg-amber-400 text-slate-950 shadow-md font-black"
                      : "text-white/60 hover:text-white hover:bg-white/5 border border-white/10"
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  {tab.label}
                </button>
              );
            })}
          </div>
        </SheetHeader>

        {/* Scrollable Body */}
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-6">
          {/* TAB 1: LED STAGE SCREEN */}
          {activeTab === "led" && (
            <div className="space-y-6">
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-black uppercase tracking-wider text-emerald-400 bg-emerald-400/10 px-2.5 py-1 rounded-lg border border-emerald-400/25">
                      LED Stage Screen
                    </span>
                    <span className="text-xs text-white/50">In-Hall Visuals</span>
                  </div>
                  <a
                    href={`/tournament/${tournamentId}/display`}
                    target="_blank"
                    rel="noreferrer"
                    className="text-xs text-amber-300 hover:text-amber-200 flex items-center gap-1 font-bold transition-colors"
                  >
                    Open Screen <ExternalLink className="w-3.5 h-3.5" />
                  </a>
                </div>

                <div className="grid grid-cols-1 gap-2.5">
                  {ledButtons.map((btn) => {
                    const isSelected = btn.mode === "off" ? !ledOverlay : ledOverlay === btn.mode;
                    const Icon = btn.icon;
                    return (
                      <button
                        key={btn.mode}
                        type="button"
                        disabled={operatorReadOnly}
                        onClick={() => onSelectLedOverlay(btn.mode)}
                        className={`flex items-center justify-between p-3.5 rounded-xl border-2 text-left transition-all ${
                          isSelected
                            ? "bg-emerald-500/20 border-emerald-500 text-white shadow-[0_0_16px_rgba(16,185,129,0.3)] ring-1 ring-emerald-500/50"
                            : "bg-white/[0.03] border-white/10 text-white/80 hover:bg-white/8 hover:text-white"
                        }`}
                      >
                        <div className="flex items-center gap-3.5">
                          <div
                            className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                              isSelected
                                ? "bg-emerald-500 text-slate-950 font-bold"
                                : "bg-white/10 text-white/60"
                            }`}
                          >
                            <Icon className="w-5 h-5" />
                          </div>
                          <div>
                            <p className="text-sm font-black leading-tight flex items-center gap-2">
                              {btn.label}
                              {isSelected && (
                                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                              )}
                            </p>
                            <p className="text-xs text-white/50 mt-1">{btn.desc}</p>
                          </div>
                        </div>
                        {isSelected ? (
                          <span className="text-xs font-black uppercase text-emerald-300 bg-emerald-500/20 px-2.5 py-1 rounded-lg border border-emerald-500/40 tracking-wider">
                            ON AIR
                          </span>
                        ) : (
                          <span className="text-xs font-bold text-white/40 bg-white/5 px-2.5 py-1 rounded-lg border border-white/10">
                            Push
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: OBS STREAM & PRIZE CEREMONY */}
          {activeTab === "obs" && (
            <div className="space-y-6">
              {/* OBS Stream Overlays Section */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-black uppercase tracking-wider text-rose-400 bg-rose-400/10 px-2.5 py-1 rounded-lg border border-rose-400/25">
                      OBS Stream
                    </span>
                    <span className="text-xs text-white/50">Live Feed Graphics</span>
                  </div>
                  <a
                    href={`/tournament/${tournamentId}/obs`}
                    target="_blank"
                    rel="noreferrer"
                    className="text-xs text-rose-300 hover:text-rose-200 flex items-center gap-1 font-bold transition-colors"
                  >
                    Open OBS <ExternalLink className="w-3.5 h-3.5" />
                  </a>
                </div>

                <div className="grid grid-cols-1 gap-2.5">
                  {obsButtons.map((btn) => {
                    const isSelected = presentationContext.context === btn.context;
                    const Icon = btn.icon;
                    return (
                      <button
                        key={btn.context}
                        type="button"
                        disabled={operatorReadOnly}
                        onClick={() => onSelectObsPresentation(btn.context)}
                        className={`flex items-center justify-between p-3.5 rounded-xl border-2 text-left transition-all ${
                          isSelected
                            ? "bg-rose-500/20 border-rose-500 text-white shadow-[0_0_16px_rgba(239,68,68,0.3)] ring-1 ring-rose-500/50"
                            : "bg-white/[0.03] border-white/10 text-white/80 hover:bg-white/8 hover:text-white"
                        }`}
                      >
                        <div className="flex items-center gap-3.5">
                          <div
                            className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                              isSelected
                                ? "bg-rose-500 text-white font-bold"
                                : "bg-white/10 text-white/60"
                            }`}
                          >
                            <Icon className="w-5 h-5" />
                          </div>
                          <div>
                            <p className="text-sm font-black leading-tight flex items-center gap-2">
                              {btn.label}
                              {isSelected && (
                                <span className="w-2 h-2 rounded-full bg-rose-400 animate-pulse" />
                              )}
                            </p>
                            <p className="text-xs text-white/50 mt-1">{btn.desc}</p>
                          </div>
                        </div>
                        {isSelected ? (
                          <span className="text-xs font-black uppercase text-rose-300 bg-rose-500/20 px-2.5 py-1 rounded-lg border border-rose-500/40 tracking-wider">
                            STREAMING
                          </span>
                        ) : (
                          <span className="text-xs font-bold text-white/40 bg-white/5 px-2.5 py-1 rounded-lg border border-white/10">
                            Push
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Live Ceremony & Prize Plate Section */}
              <div className="p-4 rounded-xl bg-white/[0.03] border border-white/10 space-y-2 pt-4">
                <p className="text-sm font-bold text-white/95 flex items-center gap-2">
                  <Trophy className="w-4 h-4 text-amber-400" />
                  Live Ceremony &amp; Prize Plate
                </p>
                <p className="text-xs text-white/50 pb-2">
                  Broadcast award announcements or trophy reveals directly into the OBS lower-third stream.
                </p>
                <AuctionObsBroadcastTools
                  tournamentId={tournamentId}
                  revision={presentationContext.revision ?? 0}
                  prize={presentationContext.prize ?? null}
                  disabled={operatorReadOnly}
                  layout="panel"
                  onApplied={onAppliedPresentationState}
                />
              </div>
            </div>
          )}

          {/* TAB 3: INTERMISSION & FLOOR TOOLS */}
          {activeTab === "intermission" && (
            <div className="space-y-4">
              {/* Break Timer Card */}
              <div className="p-4 rounded-xl border border-white/10 bg-white/[0.03] space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-amber-500/20 border border-amber-500/30 flex items-center justify-center text-amber-400 shrink-0">
                      <Timer className="w-5 h-5" />
                    </div>
                    <div>
                      <p className="text-sm font-black text-white">Pre-Auction &amp; Break Timer</p>
                      <p className="text-xs text-white/50">Shows live countdown with music on LED stage</p>
                    </div>
                  </div>
                  {breakTimerActive && (
                    <span className="text-xs px-2.5 py-1 rounded-lg bg-amber-400/25 text-amber-300 font-black animate-pulse border border-amber-400/40">
                      ACTIVE
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-2.5 pt-1">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={onOpenBreakTimer}
                    className="flex-1 h-11 text-xs sm:text-sm font-bold bg-white/5 border-white/15 text-white hover:bg-white/10 rounded-xl"
                  >
                    <Timer className="w-4 h-4 mr-2 text-amber-400" />
                    {breakTimerActive ? "Configure / Stop Timer" : "Start Break Timer"}
                  </Button>

                  {breakTimerActive && onToggleBreakMusic && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={onToggleBreakMusic}
                      title={breakTimerMusicMuted ? "Resume music" : "Mute music"}
                      className="h-11 px-3.5 text-xs bg-white/5 border-white/15 text-white hover:bg-white/10 rounded-xl"
                    >
                      {breakTimerMusicMuted ? (
                        <VolumeX className="w-4 h-4 text-rose-400" />
                      ) : (
                        <Volume2 className="w-4 h-4 text-emerald-400" />
                      )}
                    </Button>
                  )}
                </div>
              </div>

              {/* Fortune Wheel Card */}
              <div className="p-4 rounded-xl border border-white/10 bg-white/[0.03] flex items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-purple-500/20 border border-purple-500/30 flex items-center justify-center text-purple-300 shrink-0">
                    <Sparkles className="w-5 h-5" />
                  </div>
                  <div>
                    <p className="text-sm font-black text-white">Fortune Wheel</p>
                    <p className="text-xs text-white/50">Random team draw lottery animation on stage</p>
                  </div>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={onOpenFortuneWheel}
                  className="h-11 px-4 text-xs sm:text-sm font-bold bg-purple-500/15 border-purple-500/30 text-purple-200 hover:bg-purple-500/25 rounded-xl"
                >
                  Open Wheel
                </Button>
              </div>

              {/* Purse Booster Card */}
              <div className="p-4 rounded-xl border border-white/10 bg-white/[0.03] flex items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-yellow-500/20 border border-yellow-500/30 flex items-center justify-center text-yellow-300 shrink-0">
                    <Coins className="w-5 h-5" />
                  </div>
                  <div>
                    <p className="text-sm font-black text-white">Purse Booster</p>
                    <p className="text-xs text-white/50">Inject bonus purse to all or specific teams</p>
                  </div>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={onOpenPurseBooster}
                  className="h-11 px-4 text-xs sm:text-sm font-bold bg-yellow-500/15 border-yellow-500/30 text-yellow-200 hover:bg-yellow-500/25 rounded-xl"
                >
                  Purse Booster
                </Button>
              </div>

              {/* Bring Unsold Pool */}
              <div className="p-4 rounded-xl border border-white/10 bg-white/[0.03] flex items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-orange-500/20 border border-orange-500/30 flex items-center justify-center text-orange-300 shrink-0">
                    <RotateCcw className="w-5 h-5" />
                  </div>
                  <div>
                    <p className="text-sm font-black text-white">
                      Bring Unsold Back ({unsoldPlayersCount})
                    </p>
                    <p className="text-xs text-white/50">Return unsold players to active draw pool</p>
                  </div>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={bringUnsoldDisabled || unsoldPlayersCount === 0}
                  onClick={onBringUnsold}
                  className="h-11 px-4 text-xs sm:text-sm font-bold bg-orange-500/15 border-orange-500/30 text-orange-200 hover:bg-orange-500/25 disabled:opacity-40 rounded-xl"
                >
                  Bring Pool
                </Button>
              </div>

              {/* Session Controls */}
              <div className="pt-4 border-t border-white/10 space-y-2.5">
                <p className="text-xs font-black uppercase tracking-wider text-white/40">
                  Session Control
                </p>

                {mainRoundExhausted && onConcludeAuction ? (
                  <Button
                    variant="outline"
                    onClick={onConcludeAuction}
                    className="w-full h-11 text-sm font-black bg-white/10 border-white/20 text-white hover:bg-white/15 rounded-xl"
                  >
                    <CheckCircle className="w-4 h-4 mr-2" /> Conclude Auction
                  </Button>
                ) : isPreAuction ? (
                  <Button
                    onClick={onStartResumeAuction}
                    className="w-full h-11 text-sm font-black bg-emerald-600 hover:bg-emerald-500 text-white shadow-md rounded-xl"
                  >
                    <Play className="w-4 h-4 mr-2 fill-current" /> Start Live Auction
                  </Button>
                ) : isPaused ? (
                  <Button
                    onClick={onStartResumeAuction}
                    className="w-full h-11 text-sm font-black bg-emerald-600 hover:bg-emerald-500 text-white shadow-md rounded-xl"
                  >
                    <Play className="w-4 h-4 mr-2 fill-current" /> Resume Auction
                  </Button>
                ) : isActive ? (
                  <Button
                    variant="outline"
                    onClick={onPauseAuction}
                    className="w-full h-11 text-sm font-black border-yellow-500/40 bg-yellow-500/15 text-yellow-300 hover:bg-yellow-500/25 rounded-xl"
                  >
                    <Pause className="w-4 h-4 mr-2" /> Pause Auction for Break
                  </Button>
                ) : null}
              </div>
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
