import { wrapEmailLayout } from "./base-layout";

export type OrganiserWelcomeTemplateParams = {
  name: string;
  appUrl: string;
};

export function organiserWelcomeEmail(params: OrganiserWelcomeTemplateParams): {
  subject: string;
  html: string;
} {
  const firstName = params.name.trim().split(/\s+/)[0] || params.name;

  const bodyHtml = `
    <p style="margin:0 0 12px;">Hi ${firstName},</p>
    <p style="margin:0 0 12px;">Welcome to <strong>BidWar</strong> — India's platform for live player auctions and tournament management.</p>
    <p style="margin:0 0 12px;">Your organiser account is ready. You can create tournaments, manage teams and players, and run professional live auctions from your dashboard.</p>
    <p style="margin:0;">Sign in anytime to get started.</p>
  `;

  return {
    subject: "Welcome to BidWar — your organiser account is ready",
    html: wrapEmailLayout({
      preheader: "Your BidWar organiser account is ready. Create your first tournament today.",
      title: "Welcome to BidWar",
      bodyHtml,
      ctaLabel: "Go to Dashboard",
      ctaUrl: `${params.appUrl}/organizer`,
      footerNote: "You received this email because you registered as a tournament organiser on BidWar.",
    }),
  };
}
