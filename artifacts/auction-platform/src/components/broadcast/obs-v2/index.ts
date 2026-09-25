/**
 * BIDWAR — BROADCAST OVERLAY V2
 * Authoritative Visual Foundation & Broadcast Composition System
 * Powered by the Lovable Modular Broadcast Design System
 */

// Lovable modular design system contracts and components
export * from "./contracts";
export * from "./format";
export * from "./primitives";
export * from "./director";
export * from "./BroadcastStage";
export * from "./ScaledStage";
export * from "./header/Header";
export * from "./lower/Cricket";
export * from "./lower/Scenes";
export * from "./footer/Footer";
export * from "./preview/fixtures";

// Authoritative data adapters for V2
export * from "./auction-v2-adapter";
export * from "./cricket-v2-adapter";

// Core stage and live stages
export * from "./obs-v2-stage";
export * from "./obs-v2-live-stage";
export * from "./obs-v2-live-adapter";
export * from "./use-obs-v2-live";

// Transient event system
export * from "./obs-v2-events";
export * from "./obs-v2-event-adapter";
export * from "./use-obs-v2-events";
export * from "./obs-v2-event-graphic";
export * from "./obs-v2-broadcast-message";

// Supporting primitives & types
export * from "./obs-v2-tokens";
export * from "./obs-v2-canvas";
export * from "./obs-v2-surface";
export * from "./obs-v2-rail";
export * from "./obs-v2-typography";
export * from "./obs-v2-header";
export * from "./obs-v2-camera-zone";
export * from "./obs-v2-overlay-layer";
export * from "./obs-v2-scorebug";
export * from "./types";

// ── V2 Feature Restorations ────────────────────────────────────────────────

// Overlay components (broadcast message chyron + neutral footer)
export * from "./overlay/BroadcastMessageV2";
export * from "./overlay/NeutralFooterV2";

// Mid-screen broadcast slates (6 types)
export * from "./slates/SlateShell";
export * from "./slates/MidScreenSlatesV2";

// Operator Dock (director controls, ?dock=1)
export * from "./OperatorDockV2";
