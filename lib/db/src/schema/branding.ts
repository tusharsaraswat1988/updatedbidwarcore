import {
  pgTable,
  serial,
  text,
  boolean,
  real,
  timestamp,
} from "drizzle-orm/pg-core";

export const brandingSettingsTable = pgTable("branding_settings", {
  id: serial("id").primaryKey(),

  // Brand Identity
  brandName: text("brand_name").notNull().default("BidWar"),
  tagline: text("tagline"),
  poweredByText: text("powered_by_text").notNull().default("Powered by BidWar"),
  miniBrandText: text("mini_brand_text").notNull().default("BW"),

  // Visual Assets
  mainLogoUrl: text("main_logo_url"),
  miniLogoUrl: text("mini_logo_url"),
  appIconUrl: text("app_icon_url"),
  splashScreenUrl: text("splash_screen_url"),

  // Colors
  primaryColor: text("primary_color").notNull().default("#F59E0B"),
  secondaryColor: text("secondary_color").notNull().default("#1E293B"),
  accentColor: text("accent_color").notNull().default("#3B82F6"),
  backgroundColor: text("background_color").notNull().default("#080A0F"),
  successColor: text("success_color").notNull().default("#22C55E"),
  dangerColor: text("danger_color").notNull().default("#EF4444"),

  // Typography
  headingFont: text("heading_font").notNull().default("Space Grotesk"),
  bodyFont: text("body_font").notNull().default("Inter"),

  // Public Branding visibility toggles
  showPoweredByViewer: boolean("show_powered_by_viewer").notNull().default(true),
  showPoweredByOwnerApp: boolean("show_powered_by_owner_app").notNull().default(true),
  showBrandingPdf: boolean("show_branding_pdf").notNull().default(true),
  showBrandingPublicLinks: boolean("show_branding_public_links").notNull().default(true),
  showBrandingAuction: boolean("show_branding_auction").notNull().default(true),

  // Watermark
  enableWatermark: boolean("enable_watermark").notNull().default(false),
  watermarkText: text("watermark_text").notNull().default("Powered by BidWar"),
  watermarkOpacity: real("watermark_opacity").notNull().default(0.15),
  watermarkPosition: text("watermark_position").notNull().default("bottom-right"),

  // Logo Animation (MP4, WEBM, GIF — stored as Cloudinary URL with resource_type auto)
  logoAnimationUrl: text("logo_animation_url"),

  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});
