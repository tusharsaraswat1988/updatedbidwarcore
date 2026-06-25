import { useRoute, useLocation } from "wouter";
import { motion } from "framer-motion";
import { PublicNavbar } from "@/components/public-navbar";

type PolicySlug = "terms" | "privacy" | "acceptable-use" | "disclaimer" | "refund";

type Section = { heading: string; body: string };

type Policy = {
  title: string;
  subtitle: string;
  sections: Section[];
};

const CONTACT_BLOCK = `BidWar
Website: bidwar.in
Instagram / Facebook: @bidwar.in  ·  YouTube: @bidwarofficial
Support: bidwarsupport@gmail.com  ·  +91 8707488250
Billing Entity: CWP Detailers & Motors  ·  GSTIN: 09BYWPS9468R3ZG
Proprietor: Tushar Saraswat  ·  tusharsaraswat1988@gmail.com
Address: Gurudham Colony, Bhelupura, Varanasi, Uttar Pradesh, India
Jurisdiction: Varanasi, Uttar Pradesh, India`;

const POLICIES: Record<PolicySlug, Policy> = {
  terms: {
    title: "Terms and Conditions",
    subtitle: "Governing the use of BidWar and all related services",
    sections: [
      {
        heading: "Introduction",
        body: "These Terms & Conditions govern the use of BidWar and all related services, websites, software systems, APIs, dashboards, and associated technologies.",
      },
      {
        heading: "Nature of Service",
        body: "BidWar acts solely as a technology platform and software provider. BidWar does not participate in financial settlements, player contracts, sponsorship agreements, prize distribution, tournament liabilities, or disputes between organizers, teams, sponsors, or players.",
      },
      {
        heading: "Eligibility",
        body: "Accounts should be operated by tournament organizers or authorized adults only.",
      },
      {
        heading: "User Roles",
        body: "BidWar may support multiple operational roles including Super Admin, Tournament Organizer, Auction Operator, Team Owner, Viewer, Reseller, and Subaccounts.",
      },
      {
        heading: "Acceptable Usage",
        body: "Users shall not use BidWar for gambling, betting, illegal gaming, fraudulent operations, abusive conduct, unauthorized access attempts, software piracy, or unlawful activities.",
      },
      {
        heading: "Payments & Billing",
        body: "Payments may be processed through UPI, Razorpay, bank transfer, subscriptions, manual billing, or other approved payment mechanisms under CWP Detailers & Motors.",
      },
      {
        heading: "Refunds",
        body: "All software subscriptions, onboarding fees, activation charges, customization services, and software access payments are generally non-refundable once activated or delivered.",
      },
      {
        heading: "Operational Disclaimer",
        body: "BidWar shall not be responsible for internet failures, broadcast delays, timer mismatches, accidental bids, operator errors, streaming lag, cloud outages, device incompatibility, or third-party API failures.",
      },
      {
        heading: "Organizer Responsibility",
        body: "Tournament organizers remain solely responsible for player verification, rule enforcement, sponsorship handling, legal compliance, prize distribution, and tournament operations.",
      },
      {
        heading: "Audit Logs & Monitoring",
        body: "BidWar may maintain audit logs including bid history, operator activity, login timestamps, IP records, and operational changes. Such records may be treated as authoritative operational records.",
      },
      {
        heading: "Reseller Terms",
        body: "Resellers and white-label operators remain solely responsible for their customers, commitments, pricing structures, operational practices, and compliance obligations.",
      },
      {
        heading: "Intellectual Property",
        body: "All software systems, designs, interfaces, branding, source code, auction mechanisms, APIs, platform assets, and proprietary technologies remain the exclusive intellectual property of BidWar and/or CWP Detailers & Motors.",
      },
      {
        heading: "Termination Rights",
        body: "BidWar reserves the right to suspend, restrict, or terminate any account involved in misuse, abuse, illegal activity, policy violations, security threats, or unauthorized duplication without prior notice.",
      },
      {
        heading: "Limitation of Liability",
        body: "To the maximum extent permitted under applicable law, the liability of BidWar shall not exceed the amount paid by the concerned user for the relevant subscription or service.",
      },
      {
        heading: "Force Majeure",
        body: "BidWar shall not be liable for delays or failures caused by events beyond reasonable control including internet outages, natural disasters, governmental restrictions, cyberattacks, or infrastructure failures.",
      },
      {
        heading: "Jurisdiction",
        body: "All disputes shall be subject exclusively to the jurisdiction of courts located in Varanasi, Uttar Pradesh, India.",
      },
      { heading: "Contact Information", body: CONTACT_BLOCK },
    ],
  },

  privacy: {
    title: "Privacy Policy",
    subtitle: "How BidWar collects, uses, and protects your information",
    sections: [
      {
        heading: "Introduction",
        body: "This Privacy Policy explains how BidWar collects, uses, stores, processes, and protects information collected from users of the BidWar platform and associated services.",
      },
      {
        heading: "Nature of Platform",
        body: "BidWar is a SaaS-based sports auction and tournament management platform operated under CWP Detailers & Motors for small and medium scale sports tournament management and non-monetary player auction operations.",
      },
      {
        heading: "Information We Collect",
        body: "BidWar may collect user names, mobile numbers, email addresses, IP addresses, device information, player details, tournament data, team information, logos, media uploads, login activity, bid history, and operational logs.",
      },
      {
        heading: "Authentication Systems",
        body: "Users may access BidWar using OTP verification, email/password login, Google login, social login integrations, or administrator-created accounts.",
      },
      {
        heading: "Use of Information",
        body: "Collected data may be used for account authentication, tournament operations, software functionality, technical support, analytics, communication, security monitoring, fraud prevention, and service improvements.",
      },
      {
        heading: "Data Storage & Security",
        body: "Data may be stored using cloud infrastructure and third-party hosting providers. While reasonable security practices are implemented, BidWar cannot guarantee absolute security, uninterrupted availability, or protection against all cyber threats.",
      },
      {
        heading: "Third-Party Services",
        body: "BidWar may integrate with payment gateways, analytics services, broadcast systems, cloud hosting providers, and external APIs. Such services operate under their own independent terms and policies.",
      },
      {
        heading: "User Responsibility",
        body: "Users are solely responsible for ensuring that all uploaded content, player information, tournament details, logos, images, and operational data are lawful, accurate, and authorized.",
      },
      {
        heading: "No Gambling Usage",
        body: "BidWar strictly prohibits usage of the platform for gambling, betting, wagering, illegal gaming, or any unlawful financial activity.",
      },
      {
        heading: "Data Retention",
        body: "BidWar may retain operational records, audit logs, bid history, and account data for operational, security, compliance, and dispute resolution purposes.",
      },
      {
        heading: "Policy Updates",
        body: "BidWar reserves the right to modify this Privacy Policy at any time without prior notice. Continued usage of the platform shall constitute acceptance of updated terms.",
      },
      {
        heading: "Google User Data",
        body: "If users choose Google Sign-In, BidWar may receive basic profile information including name, email address, and profile image solely for authentication and account access purposes.\n\nBidWar does not sell Google user data to third parties.",
      },
      { heading: "Contact Information", body: CONTACT_BLOCK },
    ],
  },

  "acceptable-use": {
    title: "Acceptable Use Policy",
    subtitle: "Permitted and prohibited usage standards for all BidWar users",
    sections: [
      {
        heading: "Introduction",
        body: "This Acceptable Use Policy defines the permitted and prohibited usage standards applicable to all BidWar users and associated entities.",
      },
      {
        heading: "Prohibited Activities",
        body: "Users may not use BidWar for gambling, betting, illegal gaming operations, fraudulent activities, hacking attempts, software piracy, unauthorized access, unlawful tournaments, abusive content distribution, or intellectual property violations.",
      },
      {
        heading: "System Integrity",
        body: "Users shall not attempt to disrupt, overload, reverse engineer, copy, duplicate, or interfere with the technical infrastructure of BidWar.",
      },
      {
        heading: "Content Responsibility",
        body: "Users remain solely responsible for all uploaded content including logos, player data, tournament materials, images, and operational records.",
      },
      {
        heading: "Reseller Conduct",
        body: "Resellers and subaccount operators must ensure compliance with all BidWar policies and applicable laws.",
      },
      {
        heading: "Enforcement",
        body: "Violation of this policy may result in suspension, restriction, termination, legal action, or permanent banning from the platform.",
      },
      { heading: "Contact Information", body: CONTACT_BLOCK },
    ],
  },

  disclaimer: {
    title: "Disclaimer",
    subtitle: "Limitations and conditions of BidWar platform use",
    sections: [
      {
        heading: "Introduction",
        body: "BidWar is provided on an 'as-is' and 'as-available' basis without warranties of uninterrupted or error-free operation.",
      },
      {
        heading: "Technical Limitations",
        body: "BidWar does not guarantee uninterrupted platform availability, real-time synchronization accuracy, broadcast continuity, or complete error-free performance.",
      },
      {
        heading: "Auction Operations",
        body: "Tournament organizers and operators are solely responsible for validating bids, player entries, auction decisions, team allocations, and final operational outcomes.",
      },
      {
        heading: "Broadcast & Streaming",
        body: "BidWar shall not be liable for timer mismatches, screen sync failures, display lag, projector issues, internet disruptions, stream delays, or third-party broadcasting interruptions.",
      },
      {
        heading: "Third-Party Dependencies",
        body: "Certain features may rely on third-party APIs, hosting providers, payment gateways, analytics systems, and cloud infrastructure beyond the direct control of BidWar.",
      },
      {
        heading: "No Gambling Usage",
        body: "BidWar is strictly intended for sports tournament management and non-monetary player auction activities only. Any gambling, betting, or wagering usage is strictly prohibited.",
      },
      {
        heading: "Limitation of Liability",
        body: "BidWar shall not be liable for indirect, incidental, financial, reputational, or consequential damages arising from the use or inability to use the platform.",
      },
      { heading: "Contact Information", body: CONTACT_BLOCK },
    ],
  },

  refund: {
    title: "Refund and Cancellation Policy",
    subtitle: "Governing all payments, subscriptions, and service transactions",
    sections: [
      {
        heading: "Introduction",
        body: "This Refund & Cancellation Policy governs all payments, subscriptions, onboarding fees, and service transactions related to BidWar.",
      },
      {
        heading: "Non-Refundable Services",
        body: "Software subscriptions, onboarding charges, activation fees, customization services, reseller access, and operational setup charges are generally non-refundable once initiated or delivered.",
      },
      {
        heading: "Refund Exceptions",
        body: "Refunds, if any, shall be issued solely at the discretion of BidWar management after internal review.",
      },
      {
        heading: "Duplicate or Failed Transactions",
        body: "Users experiencing duplicate deductions or failed payment transactions may contact support for verification and resolution.",
      },
      {
        heading: "Subscription Cancellation",
        body: "Users may discontinue usage of the platform at any time. However, cancellation shall not automatically entitle users to refunds for unused service periods.",
      },
      {
        heading: "Chargeback Protection",
        body: "Unauthorized chargebacks, payment reversals, or fraudulent payment disputes may result in immediate suspension or permanent termination of platform access.",
      },
      { heading: "Contact Information", body: CONTACT_BLOCK },
    ],
  },
};

const NAV_LINKS: { slug: PolicySlug; label: string }[] = [
  { slug: "terms", label: "Terms & Conditions" },
  { slug: "privacy", label: "Privacy Policy" },
  { slug: "acceptable-use", label: "Acceptable Use" },
  { slug: "disclaimer", label: "Disclaimer" },
  { slug: "refund", label: "Refund Policy" },
];

export default function LegalPage() {
  const [, params] = useRoute("/legal/:slug");
  const [, navigate] = useLocation();
  const slug = (params?.slug ?? "terms") as PolicySlug;
  const policy = POLICIES[slug] ?? POLICIES["terms"];

  return (
    <div className="min-h-screen bg-[#09090b] text-white pt-16">
      {/* Top bar */}
      <PublicNavbar />

      <div className="max-w-6xl mx-auto px-6 py-10 flex gap-10">
        {/* Sidebar nav */}
        <aside className="hidden lg:block w-52 flex-shrink-0">
          <div className="sticky top-24 space-y-1">
            <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-3 px-3">
              Legal Documents
            </p>
            {NAV_LINKS.map(link => (
              <button
                key={link.slug}
                onClick={() => navigate(`/legal/${link.slug}`)}
                className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-colors ${
                  slug === link.slug
                    ? "bg-white/8 text-white font-semibold"
                    : "text-muted-foreground hover:text-white hover:bg-white/5"
                }`}
              >
                {link.label}
              </button>
            ))}
          </div>
        </aside>

        {/* Mobile policy picker */}
        <div className="lg:hidden w-full mb-6">
          <select
            value={slug}
            onChange={e => navigate(`/legal/${e.target.value}`)}
            className="w-full bg-card border border-border rounded-lg px-3 py-2 text-sm text-foreground"
          >
            {NAV_LINKS.map(link => (
              <option key={link.slug} value={link.slug}>{link.label}</option>
            ))}
          </select>
        </div>

        {/* Content */}
        <motion.main
          key={slug}
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.25 }}
          className="flex-1 min-w-0 max-w-3xl"
        >
          <div className="mb-8">
            <h1 className="font-display font-black text-3xl md:text-4xl text-white leading-tight">
              {policy.title}
            </h1>
            <p className="text-muted-foreground mt-2 text-sm">{policy.subtitle}</p>
            <div className="mt-3 h-px bg-white/8" />
          </div>

          <div className="space-y-8">
            {policy.sections.map((section, i) => (
              <section key={i}>
                <h2 className="font-display font-bold text-base text-white mb-2">
                  {section.heading}
                </h2>
                <p className="text-sm text-white/70 leading-relaxed whitespace-pre-line">
                  {section.body}
                </p>
              </section>
            ))}
          </div>

          <div className="mt-12 pt-6 border-t border-white/8 flex flex-wrap gap-3">
            {NAV_LINKS.filter(l => l.slug !== slug).map(link => (
              <button
                key={link.slug}
                onClick={() => navigate(`/legal/${link.slug}`)}
                className="text-xs text-muted-foreground hover:text-white transition-colors underline underline-offset-2"
              >
                {link.label}
              </button>
            ))}
          </div>
        </motion.main>
      </div>
    </div>
  );
}
