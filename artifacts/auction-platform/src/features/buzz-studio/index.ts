export { BidwarCanvas } from "./canvas/BidwarCanvas";

export { defaultBuzzTheme } from "./theme/buzz-theme";
export type { BuzzTheme } from "./theme/buzz-theme-types";

export type { PlayerAsset, TeamAsset, TournamentAsset } from "./types/media-types";

export { BIDWAR_WATERMARK } from "./assets/watermark";
export {
  PLAYER_IMAGE_PLACEHOLDER,
  TEAM_LOGO_PLACEHOLDER,
  TOURNAMENT_BANNER_PLACEHOLDER,
  QR_PLACEHOLDER,
} from "./assets/placeholders";

/* ─── Asset Engine ─────────────────────────────────────────────────────── */

export type {
  ResolutionTier,
  ResolutionScore,
  TransparencyStatus,
  TransparencyResult,
  AssetIssueCode,
  RecommendationCode,
  AssetIssue,
  AssetRecommendation,
  AssetHealthScore,
  AssetDescriptor,
  AssetKind,
  MonogramResult,
  EnhancementOperation,
  EnhancementStatus,
  EnhancementStep,
  EnhancementPipelineResult,
} from "./asset-engine/asset-types";

export {
  scoreResolution,
  betterResolution,
  describeTier,
  isAcceptableResolution,
} from "./asset-engine/image-quality";

export {
  teamMonogram,
  playerMonogram,
  monogramFor,
} from "./asset-engine/monogram-generator";

export {
  analyzeAsset,
  detectTransparencySupport,
  batchAnalyze,
} from "./asset-engine/asset-analyzer";

export {
  OPERATION_REGISTRY,
  buildPipeline,
  planEnhancement,
  executeStub,
  summarisePipeline,
  isPipelineEmpty,
} from "./asset-engine/enhancement-pipeline";

/* ─── Design System ────────────────────────────────────────────────────── */

export { Typography } from "./design-system/typography";
export { Gradients } from "./design-system/gradients";

export {
  SportBadge,
  CaptainBadge,
  MvpBadge,
  WinnerBadge,
  SoldBadge,
  RankingBadge,
  getSportMeta,
  getSportLabel,
  getSportEmoji,
} from "./design-system/badges";
export type { SportMeta, SportBadgeProps, SoldBadgeProps, WinnerBadgeProps, RankingBadgeProps } from "./design-system/badges";

export {
  PlayerFrame,
  TeamFrame,
  LogoFrame,
  AvatarFrame,
} from "./design-system/frames";
export type { PlayerFrameProps, TeamFrameProps, LogoFrameProps, AvatarFrameProps, FrameSize } from "./design-system/frames";

export {
  LogoSlot,
  PlayerSlot,
  TeamSlot,
  AvatarSlot,
} from "./design-system/logo-slots";
export type { LogoSlotProps, PlayerSlotProps, TeamSlotProps, AvatarSlotProps } from "./design-system/logo-slots";

export {
  StatCard,
  StatRow,
  PriceDisplay,
} from "./design-system/stat-cards";
export type { StatCardProps, StatRowProps, PriceDisplayProps } from "./design-system/stat-cards";

/* ─── Sport Types ──────────────────────────────────────────────────────── */

export { SportType } from "./types/sport-types";

/* ─── Templates ────────────────────────────────────────────────────────── */

export { PlayerSpotlight } from "./templates/player-spotlight/PlayerSpotlight";
export type { PlayerSpotlightData } from "./templates/player-spotlight/PlayerSpotlight.types";
// getPlayerDisplayInitials / getTeamDisplayInitials are the only unique exports
// from PlayerSpotlight.utils — sport helpers are already exported above from
// the design system (their canonical home).
export {
  getPlayerDisplayInitials,
  getTeamDisplayInitials,
} from "./templates/player-spotlight/PlayerSpotlight.utils";

export { SoldPlayer } from "./templates/sold-player/SoldPlayer";
export { formatSoldPrice, formatBidCount } from "./templates/sold-player/SoldPlayer.utils";

export { TopBuys } from "./templates/top-buys/TopBuys";
export { formatTopBuyPrice, resolveRank, compactGridCols } from "./templates/top-buys/TopBuys.utils";

export { TeamSquad } from "./templates/team-squad/TeamSquad";
export { formatSquadPlayerPrice, rosterGridColumns, squadCounts } from "./templates/team-squad/TeamSquad.utils";

/* ─── Contracts ────────────────────────────────────────────────────────── */

export type {
  ContractMetadata,
  ContractSportInfo,
  ContractPlayerInfo,
  ContractTeamInfo,
  ContractPriceInfo,
  BuzzBranding,
  PlayerSpotlightContract,
  SoldPlayerContract,
  TopBuyContract,
  TopBuysListContract,
  TeamRevealContract,
  TeamSquadContract,
  TeamSquadPlayerEntry,
  SquadPlayerStatus,
  AuctionSummaryContract,
  MvpCardContract,
  TournamentLaunchContract,
} from "./contracts/index";

export {
  fromPlayerSpotlightData,
  mapAuctionPlayerToSpotlightContract,
  mapAuctionPlayerToSoldPlayerContract,
  mapAuctionSaleToTopBuyContract,
  mapAuctionSalesToTopBuysListContract,
  mapAuctionTeamToRevealContract,
  mapAuctionResultToSummaryContract,
  mapPlayerStatsToMvpCardContract,
  mapTournamentToLaunchContract,
} from "./contracts/index";

/* ─── Template Registry ────────────────────────────────────────────────── */

export { BuzzTemplateType } from "./registry/template-types";
export { BuzzTemplateCategory } from "./registry/template-categories";

export type {
  BuzzTemplateDefinition,
  BuzzTemplatePreview,
  BuzzTemplateRegistryEntry,
} from "./registry/registry-types";

export {
  buzzTemplateRegistry,
  getTemplateById,
  getTemplatesByCategory,
  getEnabledTemplates,
  getComingSoonTemplates,
  templateExists,
} from "./registry/template-registry";

/* ─── Live Data Providers ──────────────────────────────────────────────── */

export type {
  BuzzStudioTournamentSnapshot,
  BuzzStudioLiveDataSource,
} from "./providers/provider-types";

export {
  toSportType,
  snapshotFromTournamentData,
  buildContractBranding,
  brandingContextFromTournament,
  buildTeamById,
  buildPlayerById,
  buildBidCountByPlayer,
  resolvePlayerDesignation,
  resolveTeamCaptain,
  countSquadPlayers,
  apiBuzzStudioDataSource,
} from "./providers/provider-types";

export {
  getPlayerSpotlightContracts,
  mapPlayerSpotlightFromSnapshot,
} from "./providers/player-spotlight-provider";

export {
  getSoldPlayerContracts,
  mapSoldPlayersFromSnapshot,
} from "./providers/sold-player-provider";

export {
  getTopBuysContract,
  mapTopBuysFromSnapshot,
} from "./providers/top-buys-provider";

export {
  getTeamRevealContracts,
  mapTeamRevealFromSnapshot,
} from "./providers/team-reveal-provider";

export {
  getTeamSquadContracts,
  mapTeamSquadFromSnapshot,
} from "./providers/team-squad-provider";

/* ─── Render Pipeline ──────────────────────────────────────────────────── */

export { RenderFormat, RenderStatus, ShareChannel } from "./rendering/index";

export type {
  RenderJob,
  RenderJobSubmission,
  RenderResult,
  StoredAsset,
  AssetStorageProvider,
  ShareMetadata,
  ShareRequest,
} from "./rendering/index";

export {
  NotImplementedError,
  createRenderJob,
  submitRenderJob,
  pollRenderStatus,
  storeRenderResult,
  createShareMetadata,
  getShareByJobId,
  runFullPipeline,
  isRenderComplete,
  isRenderFailed,
  isRenderPending,
  BUZZ_EXPORT_DIMENSIONS,
  isBuzzAspectRatio,
  resolveBuzzExportDimensions,
  pickRenderContext,
  canvasH,
  canvasW,
  posterSpacing,
  isLandscapePoster,
  isTallPoster,
  heroTitleSize,
  heroLogoSize,
  secondaryLabelSize,
  bodyLabelSize,
  TEMPLATE_LAYOUT_SCHEMAS,
  getTemplateLayout,
  getTemplateLayoutSchema,
  backgroundImageKeyForRatio,
  POSTER_TOKENS,
} from "./rendering/index";

export type {
  BuzzRenderMode,
  BuzzAspectRatio,
  BuzzTemplateRenderProps,
  BuzzRenderContext,
  PosterSpacing,
  PosterZoneId,
  PosterZoneRect,
  PosterZoneStackSpec,
  PosterZoneSpec,
  TemplateLayoutDefinition,
  TemplateLayoutSchema,
} from "./rendering/index";

/* ─── Creative Jobs ────────────────────────────────────────────────────── */

export type {
  CreativeJob,
  CreativeJobMetadata,
  CreativeJobStatus,
  CreateCreativeJobRequest,
} from "./jobs/index";

export {
  createCreativeJob,
  listCreativeJobs,
  getCreativeJob,
  canDownloadCreative,
  CREATIVE_JOB_STATUS_LABELS,
} from "./jobs/index";
