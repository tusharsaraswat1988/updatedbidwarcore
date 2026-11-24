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
  Filter,
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
  // Player Filter State for LED Broadcast
  displayPlayerFilter?: {
    status?: string;
    categoryId?: number | null;
    teamId?: number | null;
  } | null;
  onSelectPlayerFilter?: (filter: {
    status: "all" | "sold" | "unsold" | "available" | "retained";
    categoryId?: number | null;
    teamId?: number | null;
  }) => void;
  teams?: { id: number; name: string; color?: string | null; shortCode?: string | null }[];
  categories?: { id: number; name: string }[];
  playerPoolCounts?: {
    total: number;
    available: number;
    sold: number;
    unsold: number;
    retained: number;
  };
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
  displayPlayerFilter,
  onSelectPlayerFilter,
  teams,
  categories,
  playerPoolCounts,
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
        className="w-[92vw] sm:w-[480px] md:w-[520px] p-0 flex flex-col bg-[#0c1222] border-l border-white/15 text-white z-50 shadow-2xl"
      >
        <SheetHeader className="px-4 py-3 sm:px-5 sm:py-3.5 border-b border-white/10 shrink-0 bg-white/[0.02]">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-amber-500/20 border border-amber-500/35 flex items-center justify-center text-amber-400 shrink-0 shadow-xs">
                <Tv2 className="w-4 h-4" />
              </div>
              <div>
                <SheetTitle className="text-sm sm:text-base font-black tracking-tight text-white flex items-center gap-2">
                  Broadcast &amp; Media Studio
                </SheetTitle>
                <SheetDescription className="text-[11px] sm:text-xs text-white/60">
                  Stage screens, OBS graphics, and intermissions
                </SheetDescription>
              </div>
            </div>
          </div>

          {/* Navigation Tabs (LED / OBS / Intermissions) */}
          <div className="grid grid-cols-3 gap-1.5 pt-2.5">
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
                  className={`flex items-center justify-center gap-1.5 py-1.5 px-2 rounded-lg text-xs font-bold transition-all ${
                    active
                      ? "bg-amber-400 text-slate-950 shadow-xs font-black"
                      : "text-white/65 hover:text-white hover:bg-white/5 border border-white/10"
                  }`}
                >
                  <Icon className="w-3.5 h-3.5" />
                  <span className="truncate">{tab.label}</span>
                </button>
              );
            })}
          </div>
        </SheetHeader>

        {/* Scrollable Body */}
        <div className="flex-1 overflow-y-auto px-4 py-3 sm:px-5 sm:py-3.5 space-y-3">
          {/* TAB 1: LED STAGE SCREEN */}
          {activeTab === "led" && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-black uppercase tracking-wider text-emerald-400 bg-emerald-400/10 px-2 py-0.5 rounded border border-emerald-400/25">
                    LED Stage Screen
                  </span>
                  <span className="text-[11px] text-white/50">In-Hall Visuals</span>
                </div>
                <a
                  href={`/tournament/${tournamentId}/display`}
                  target="_blank"
                  rel="noreferrer"
                  className="text-[11px] text-amber-300 hover:text-amber-200 flex items-center gap-1 font-bold transition-colors"
                >
                  Open Screen <ExternalLink className="w-3 h-3" />
                </a>
              </div>

              <div className="grid grid-cols-1 gap-2">
                {ledButtons.map((btn) => {
                  const isSelected = btn.mode === "off" ? !ledOverlay : ledOverlay === btn.mode;
                  const Icon = btn.icon;

                  if (btn.mode === "player") {
                    const currentStatus = displayPlayerFilter?.status ?? "all";
                    const currentCategory = categories?.find((c) => c.id === displayPlayerFilter?.categoryId);
                    const currentTeam = teams?.find((t) => t.id === displayPlayerFilter?.teamId);

                    let filterSummary = "ALL PLAYERS";
                    if (currentTeam) {
                      filterSummary = `${currentTeam.name.toUpperCase()} SQUAD`;
                    } else if (currentCategory && currentStatus !== "all") {
                      filterSummary = `${currentStatus.toUpperCase()} · ${currentCategory.name.toUpperCase()}`;
                    } else if (currentCategory) {
                      filterSummary = currentCategory.name.toUpperCase();
                    } else if (currentStatus !== "all") {
                      filterSummary = `${currentStatus.toUpperCase()} POOL`;
                    }

                    return (
                      <div
                        key={btn.mode}
                        className={`rounded-xl border transition-all ${
                          isSelected
                            ? "bg-emerald-500/10 border-emerald-500/70 shadow-[0_0_14px_rgba(16,185,129,0.2)] ring-1 ring-emerald-500/50"
                            : "bg-white/[0.03] border-white/10 hover:bg-white/8"
                        }`}
                      >
                        <button
                          type="button"
                          disabled={operatorReadOnly}
                          onClick={() => onSelectLedOverlay(btn.mode)}
                          className="w-full flex items-center justify-between p-2.5 text-left"
                        >
                          <div className="flex items-center gap-2.5 min-w-0">
                            <div
                              className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
                                isSelected
                                  ? "bg-emerald-500 text-slate-950 font-bold"
                                  : "bg-white/10 text-white/60"
                              }`}
                            >
                              <Icon className="w-4 h-4" />
                            </div>
                            <div className="min-w-0">
                              <p className="text-xs sm:text-sm font-bold leading-tight flex items-center gap-1.5">
                                <span className="truncate">{btn.label}</span>
                                {isSelected && (
                                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse shrink-0" />
                                )}
                              </p>
                              <p className="text-[11px] text-white/50 mt-0.5 truncate">{btn.desc}</p>
                            </div>
                          </div>
                          {isSelected ? (
                            <span className="text-[10px] font-black uppercase text-emerald-300 bg-emerald-500/20 px-2 py-0.5 rounded border border-emerald-500/40 tracking-wider shrink-0">
                              ON AIR
                            </span>
                          ) : (
                            <span className="text-[10px] font-bold text-white/40 bg-white/5 px-2 py-0.5 rounded border border-white/10 shrink-0">
                              Push
                            </span>
                          )}
                        </button>

                        {/* Interactive Broadcast Filter Controls inside the Drawer */}
                        <div className="px-3 pb-3 pt-1 border-t border-white/10 space-y-2 bg-black/25 rounded-b-xl">
                          <div className="flex items-center justify-between text-[10px] font-mono uppercase tracking-wider text-white/60">
                            <span className="flex items-center gap-1.5 text-amber-300 font-bold">
                              <Filter className="w-3 h-3 text-amber-400" />
                              Stage Filter
                            </span>
                            {isSelected && (
                              <span className="text-emerald-400 font-bold font-mono tracking-wide truncate max-w-[200px]">
                                ON AIR: {filterSummary}
                              </span>
                            )}
                          </div>

                          {/* Status Pills: ALL, AVAIL, SOLD, UNSOLD, RETAINED */}
                          <div className="flex flex-wrap gap-1">
                            {[
                              { id: "all", label: "ALL", count: playerPoolCounts?.total },
                              { id: "available", label: "AVAIL", count: playerPoolCounts?.available },
                              { id: "sold", label: "SOLD", count: playerPoolCounts?.sold },
                              { id: "unsold", label: "UNSOLD", count: playerPoolCounts?.unsold },
                              { id: "retained", label: "RET", count: playerPoolCounts?.retained },
                            ].map((st) => {
                              const isActive =
                                currentStatus === st.id && !displayPlayerFilter?.teamId;
                              return (
                                <button
                                  key={st.id}
                                  type="button"
                                  disabled={operatorReadOnly}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    onSelectPlayerFilter?.({
                                      status: st.id as any,
                                      categoryId: displayPlayerFilter?.categoryId ?? null,
                                      teamId: null,
                                    });
                                  }}
                                  className={`px-2 py-1 rounded-md text-[11px] font-bold transition-all flex items-center gap-1 ${
                                    isActive && isSelected
                                      ? "bg-amber-400 text-slate-950 font-black shadow-xs ring-1 ring-amber-400"
                                      : "bg-white/5 text-white/70 hover:bg-white/10 hover:text-white border border-white/10"
                                  }`}
                                >
                                  <span>{st.label}</span>
                                  {st.count !== undefined && (
                                    <span
                                      className={`text-[10px] font-mono ${
                                        isActive && isSelected ? "text-slate-950/80 font-bold" : "text-white/40"
                                      }`}
                                    >
                                      ({st.count})
                                    </span>
                                  )}
                                </button>
                              );
                            })}
                          </div>

                          {/* Category & Team Dropdowns */}
                          <div className="grid grid-cols-2 gap-2 pt-0.5">
                            {/* Role / Category */}
                            <div className="space-y-1">
                              <label className="text-[10px] font-bold text-white/50 uppercase tracking-wider block">
                                Category / Role
                              </label>
                              <select
                                disabled={operatorReadOnly}
                                value={displayPlayerFilter?.categoryId ?? ""}
                                onChange={(e) => {
                                  const val = e.target.value;
                                  onSelectPlayerFilter?.({
                                    status: (displayPlayerFilter?.status as any) ?? "all",
                                    categoryId: val ? Number(val) : null,
                                    teamId: displayPlayerFilter?.teamId ?? null,
                                  });
                                }}
                                className="w-full bg-slate-900 border border-white/20 rounded-lg px-2 py-1 text-xs text-white focus:outline-none focus:border-amber-400 font-medium"
                              >
                                <option value="">All Categories</option>
                                {categories?.map((cat) => (
                                  <option key={cat.id} value={cat.id}>
                                    {cat.name}
                                  </option>
                                ))}
                              </select>
                            </div>

                            {/* Team Squad Filter */}
                            <div className="space-y-1">
                              <label className="text-[10px] font-bold text-white/50 uppercase tracking-wider block">
                                Team Squad
                              </label>
                              <select
                                disabled={operatorReadOnly}
                                value={displayPlayerFilter?.teamId ?? ""}
                                onChange={(e) => {
                                  const val = e.target.value;
                                  onSelectPlayerFilter?.({
                                    status: val ? "sold" : ((displayPlayerFilter?.status as any) ?? "all"),
                                    categoryId: displayPlayerFilter?.categoryId ?? null,
                                    teamId: val ? Number(val) : null,
                                  });
                                }}
                                className="w-full bg-slate-900 border border-white/20 rounded-lg px-2 py-1 text-xs text-white focus:outline-none focus:border-amber-400 font-medium"
                              >
                                <option value="">All Teams</option>
                                {teams?.map((tm) => (
                                  <option key={tm.id} value={tm.id}>
                                    {tm.name}
                                  </option>
                                ))}
                              </select>
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  }

                  return (
                    <button
                      key={btn.mode}
                      type="button"
                      disabled={operatorReadOnly}
                      onClick={() => onSelectLedOverlay(btn.mode)}
                      className={`flex items-center justify-between p-2.5 rounded-xl border text-left transition-all ${
                        isSelected
                          ? "bg-emerald-500/20 border-emerald-500 text-white shadow-[0_0_12px_rgba(16,185,129,0.25)] ring-1 ring-emerald-500/50"
                          : "bg-white/[0.03] border-white/10 text-white/80 hover:bg-white/8 hover:text-white"
                      }`}
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div
                          className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
                            isSelected
                              ? "bg-emerald-500 text-slate-950 font-bold"
                              : "bg-white/10 text-white/60"
                          }`}
                        >
                          <Icon className="w-4 h-4" />
                        </div>
                        <div className="min-w-0">
                          <p className="text-xs sm:text-sm font-bold leading-tight flex items-center gap-1.5">
                            <span className="truncate">{btn.label}</span>
                            {isSelected && (
                              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse shrink-0" />
                            )}
                          </p>
                          <p className="text-[11px] text-white/50 mt-0.5 truncate">{btn.desc}</p>
                        </div>
                      </div>
                      {isSelected ? (
                        <span className="text-[10px] font-black uppercase text-emerald-300 bg-emerald-500/20 px-2 py-0.5 rounded border border-emerald-500/40 tracking-wider shrink-0">
                          ON AIR
                        </span>
                      ) : (
                        <span className="text-[10px] font-bold text-white/40 bg-white/5 px-2 py-0.5 rounded border border-white/10 shrink-0">
                          Push
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* TAB 2: OBS STREAM & PRIZE CEREMONY */}
          {activeTab === "obs" && (
            <div className="space-y-3">
              {/* OBS Stream Overlays Section */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-black uppercase tracking-wider text-rose-400 bg-rose-400/10 px-2 py-0.5 rounded border border-rose-400/25">
                    OBS Stream
                  </span>
                  <span className="text-[11px] text-white/50">Live Feed Graphics</span>
                </div>
                <a
                  href={`/tournament/${tournamentId}/obs`}
                  target="_blank"
                  rel="noreferrer"
                  className="text-[11px] text-rose-300 hover:text-rose-200 flex items-center gap-1 font-bold transition-colors"
                >
                  Open OBS <ExternalLink className="w-3 h-3" />
                </a>
              </div>

              <div className="grid grid-cols-1 gap-2">
                {obsButtons.map((btn) => {
                  const isSelected = presentationContext.context === btn.context;
                  const Icon = btn.icon;
                  return (
                    <button
                      key={btn.context}
                      type="button"
                      disabled={operatorReadOnly}
                      onClick={() => onSelectObsPresentation(btn.context)}
                      className={`flex items-center justify-between p-2.5 rounded-xl border text-left transition-all ${
                        isSelected
                          ? "bg-rose-500/20 border-rose-500 text-white shadow-[0_0_12px_rgba(239,68,68,0.25)] ring-1 ring-rose-500/50"
                          : "bg-white/[0.03] border-white/10 text-white/80 hover:bg-white/8 hover:text-white"
                      }`}
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div
                          className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
                            isSelected
                              ? "bg-rose-500 text-white font-bold"
                              : "bg-white/10 text-white/60"
                          }`}
                        >
                          <Icon className="w-4 h-4" />
                        </div>
                        <div className="min-w-0">
                          <p className="text-xs sm:text-sm font-bold leading-tight flex items-center gap-1.5">
                            <span className="truncate">{btn.label}</span>
                            {isSelected && (
                              <span className="w-1.5 h-1.5 rounded-full bg-rose-400 animate-pulse shrink-0" />
                            )}
                          </p>
                          <p className="text-[11px] text-white/50 mt-0.5 truncate">{btn.desc}</p>
                        </div>
                      </div>
                      {isSelected ? (
                        <span className="text-[10px] font-black uppercase text-rose-300 bg-rose-500/20 px-2 py-0.5 rounded border border-rose-500/40 tracking-wider shrink-0">
                          STREAMING
                        </span>
                      ) : (
                        <span className="text-[10px] font-bold text-white/40 bg-white/5 px-2 py-0.5 rounded border border-white/10 shrink-0">
                          Push
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>

              {/* Live Ceremony & Prize Plate Section */}
              <div className="p-3 rounded-xl bg-white/[0.03] border border-white/10 space-y-2">
                <p className="text-xs font-bold text-white/95 flex items-center gap-1.5">
                  <Trophy className="w-3.5 h-3.5 text-amber-400" />
                  Live Ceremony &amp; Prize Plate
                </p>
                <p className="text-[11px] text-white/50">
                  Broadcast award announcements or trophy reveals directly into the OBS stream.
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
            <div className="space-y-2.5">
              {/* Break Timer Card */}
              <div className="p-2.5 sm:p-3 rounded-xl border border-white/10 bg-white/[0.03] hover:bg-white/[0.05] transition-all flex items-center justify-between gap-2.5">
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="w-8 h-8 rounded-lg bg-amber-500/20 border border-amber-500/30 flex items-center justify-center text-amber-400 shrink-0">
                    <Timer className="w-4 h-4" />
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5">
                      <p className="text-xs sm:text-sm font-bold text-white truncate">Pre-Auction &amp; Break Timer</p>
                      {breakTimerActive && (
                        <span className="text-[9px] px-1.5 py-0.2 rounded bg-amber-400/25 text-amber-300 font-black animate-pulse border border-amber-400/40 shrink-0">
                          ACTIVE
                        </span>
                      )}
                    </div>
                    <p className="text-[11px] text-white/50 truncate">Live countdown with music on stage</p>
                  </div>
                </div>

                <div className="flex items-center gap-1.5 shrink-0">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={onOpenBreakTimer}
                    className="h-8 px-2.5 text-xs font-bold bg-white/5 border-white/15 text-white hover:bg-white/10 rounded-lg"
                  >
                    <Timer className="w-3.5 h-3.5 mr-1 text-amber-400" />
                    {breakTimerActive ? "Stop / Edit" : "Start Timer"}
                  </Button>

                  {breakTimerActive && onToggleBreakMusic && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={onToggleBreakMusic}
                      title={breakTimerMusicMuted ? "Resume music" : "Mute music"}
                      className="h-8 px-2 text-xs bg-white/5 border-white/15 text-white hover:bg-white/10 rounded-lg"
                    >
                      {breakTimerMusicMuted ? (
                        <VolumeX className="w-3.5 h-3.5 text-rose-400" />
                      ) : (
                        <Volume2 className="w-3.5 h-3.5 text-emerald-400" />
                      )}
                    </Button>
                  )}
                </div>
              </div>

              {/* Fortune Wheel Card */}
              <div className="p-2.5 sm:p-3 rounded-xl border border-white/10 bg-white/[0.03] hover:bg-white/[0.05] transition-all flex items-center justify-between gap-2.5">
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="w-8 h-8 rounded-lg bg-purple-500/20 border border-purple-500/30 flex items-center justify-center text-purple-300 shrink-0">
                    <Sparkles className="w-4 h-4" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs sm:text-sm font-bold text-white truncate">Fortune Wheel</p>
                    <p className="text-[11px] text-white/50 truncate">Random team draw lottery animation</p>
                  </div>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={onOpenFortuneWheel}
                  className="h-8 px-3 text-xs font-bold bg-purple-500/15 border border-purple-500/30 text-purple-200 hover:bg-purple-500/25 rounded-lg shrink-0"
                >
                  Open Wheel
                </Button>
              </div>

              {/* Purse Booster Card */}
              <div className="p-2.5 sm:p-3 rounded-xl border border-white/10 bg-white/[0.03] hover:bg-white/[0.05] transition-all flex items-center justify-between gap-2.5">
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="w-8 h-8 rounded-lg bg-yellow-500/20 border border-yellow-500/30 flex items-center justify-center text-yellow-300 shrink-0">
                    <Coins className="w-4 h-4" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs sm:text-sm font-bold text-white truncate">Purse Booster</p>
                    <p className="text-[11px] text-white/50 truncate">Inject bonus purse to all or specific teams</p>
                  </div>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={onOpenPurseBooster}
                  className="h-8 px-3 text-xs font-bold bg-yellow-500/15 border border-yellow-500/30 text-yellow-200 hover:bg-yellow-500/25 rounded-lg shrink-0"
                >
                  Purse Booster
                </Button>
              </div>

              {/* Bring Unsold Pool */}
              <div className="p-2.5 sm:p-3 rounded-xl border border-white/10 bg-white/[0.03] hover:bg-white/[0.05] transition-all flex items-center justify-between gap-2.5">
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="w-8 h-8 rounded-lg bg-orange-500/20 border border-orange-500/30 flex items-center justify-center text-orange-300 shrink-0">
                    <RotateCcw className="w-4 h-4" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs sm:text-sm font-bold text-white truncate">
                      Bring Unsold Back ({unsoldPlayersCount})
                    </p>
                    <p className="text-[11px] text-white/50 truncate">Return unsold players to active draw pool</p>
                  </div>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={bringUnsoldDisabled || unsoldPlayersCount === 0}
                  onClick={onBringUnsold}
                  className="h-8 px-3 text-xs font-bold bg-orange-500/15 border-orange-500/30 text-orange-200 hover:bg-orange-500/25 disabled:opacity-40 rounded-lg shrink-0"
                >
                  Bring Pool
                </Button>
              </div>

              {/* Session Controls */}
              <div className="pt-2.5 border-t border-white/10 space-y-1.5">
                <p className="text-[10px] font-black uppercase tracking-wider text-white/40">
                  Session Control
                </p>

                {mainRoundExhausted && onConcludeAuction ? (
                  <Button
                    variant="outline"
                    onClick={onConcludeAuction}
                    className="w-full h-8.5 sm:h-9 text-xs sm:text-sm font-black bg-white/10 border-white/20 text-white hover:bg-white/15 rounded-lg"
                  >
                    <CheckCircle className="w-3.5 h-3.5 mr-1.5" /> Conclude Auction
                  </Button>
                ) : isPreAuction ? (
                  <Button
                    onClick={onStartResumeAuction}
                    className="w-full h-8.5 sm:h-9 text-xs sm:text-sm font-black bg-emerald-600 hover:bg-emerald-500 text-white shadow-xs rounded-lg"
                  >
                    <Play className="w-3.5 h-3.5 mr-1.5 fill-current" /> Start Live Auction
                  </Button>
                ) : isPaused ? (
                  <Button
                    onClick={onStartResumeAuction}
                    className="w-full h-8.5 sm:h-9 text-xs sm:text-sm font-black bg-emerald-600 hover:bg-emerald-500 text-white shadow-xs rounded-lg"
                  >
                    <Play className="w-3.5 h-3.5 mr-1.5 fill-current" /> Resume Auction
                  </Button>
                ) : isActive ? (
                  <Button
                    variant="outline"
                    onClick={onPauseAuction}
                    className="w-full h-8.5 sm:h-9 text-xs sm:text-sm font-black border-yellow-500/40 bg-yellow-500/15 text-yellow-300 hover:bg-yellow-500/25 rounded-lg"
                  >
                    <Pause className="w-3.5 h-3.5 mr-1.5" /> Pause Auction for Break
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
