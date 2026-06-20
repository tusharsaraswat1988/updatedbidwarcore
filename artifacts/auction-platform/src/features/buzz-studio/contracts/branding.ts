/**
 * Buzz Studio — Branding Contract
 *
 * Reusable branding block attached to every template contract.
 * Controls tournament logos, sponsor marks, watermark visibility,
 * and footer text overrides.
 *
 * Each template receives a BuzzBranding object. If absent, the
 * BidwarCanvas default branding is used.
 *
 * No rendering logic. No imports from application code.
 */

export interface BuzzBranding {
  /**
   * Tournament or organizer logo URL.
   * Displayed in headers or footers depending on the template layout.
   */
  tournamentLogoUrl?: string;

  /**
   * Primary sponsor logo URL.
   * Rendered in the sponsor slot when present.
   */
  sponsorLogoUrl?: string;

  /**
   * Sponsor display name (e.g. "Powered by Acme Corp").
   * Used as alt text and in text-only sponsor slots.
   */
  sponsorName?: string;

  /**
   * Overrides the default "Powered by BidWar" footer text.
   * Useful for white-label deployments.
   */
  poweredByText?: string;

  /**
   * Controls whether the BIDWAR watermark is shown behind content.
   * @default false
   */
  watermarkEnabled?: boolean;

  /**
   * Primary brand color override (hex string).
   * When provided, replaces defaultBuzzTheme.primaryGold in the template.
   * Must be a valid CSS color value.
   */
  primaryColor?: string;

  /**
   * Social handle shown in the footer (e.g. "@bidwar.app").
   * Optional — not rendered if absent.
   */
  socialHandle?: string;

  /**
   * Custom tagline shown in the footer instead of "From Auction to Champion".
   */
  tagline?: string;
}
