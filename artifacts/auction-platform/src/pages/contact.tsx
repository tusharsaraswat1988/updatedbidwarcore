import { useEffect } from "react";
import { useLocation } from "wouter";
import { ArrowLeft, Mail, Phone, MapPin, Globe, MessageCircle, Gavel, Clock } from "lucide-react";

export default function ContactPage() {
  const [, navigate] = useLocation();

  useEffect(() => {
    const prev = document.title;
    document.title = "Contact Us | BidWar — India's Live Sports Auction Platform";

    let meta = document.querySelector<HTMLMetaElement>('meta[name="description"]');
    const created = !meta;
    if (created) {
      meta = document.createElement("meta");
      meta.setAttribute("name", "description");
      document.head.appendChild(meta);
    }
    const prevContent = meta?.getAttribute("content") ?? "";
    meta?.setAttribute(
      "content",
      "Contact BidWar for support, queries, or partnership. Email us or reach us on WhatsApp. Operated by CWP Detailers & Motors, Varanasi, India.",
    );

    return () => {
      document.title = prev;
      if (meta) meta.setAttribute("content", prevContent);
      if (created && meta?.parentNode) meta.parentNode.removeChild(meta);
    };
  }, []);

  return (
    <div className="min-h-screen bg-[#09090b] text-white">
      {/* Header */}
      <header className="sticky top-0 z-20 border-b border-white/8 bg-[#09090b]/90 backdrop-blur-xl">
        <div className="max-w-5xl mx-auto px-6 h-14 flex items-center justify-between gap-4">
          <button
            onClick={() => navigate("/")}
            className="flex items-center gap-2 text-sm text-muted-foreground hover:text-white transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            Back
          </button>
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-[#FF3C00] flex items-center justify-center">
              <Gavel className="w-3.5 h-3.5 text-white" />
            </div>
            <span className="font-display font-black text-base tracking-tight">BidWar</span>
          </div>
          <a
            href="mailto:bidwarsupport@gmail.com"
            className="text-xs text-muted-foreground hover:text-white transition-colors"
          >
            Email us
          </a>
        </div>
      </header>

      {/* Hero */}
      <div className="border-b border-white/8 py-14 px-6">
        <div className="max-w-5xl mx-auto">
          <div className="text-primary text-xs font-bold uppercase tracking-widest mb-3">Get in touch</div>
          <h1 className="font-display font-black text-4xl md:text-5xl text-white leading-tight mb-3">
            Contact Us
          </h1>
          <p className="text-white/50 text-sm max-w-xl">
            Have a question, need support, or want to partner with us? Reach out — we respond within 24 hours.
          </p>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-5xl mx-auto px-6 py-14">
        <div className="grid md:grid-cols-2 gap-10">

          {/* Contact details */}
          <div className="space-y-6">
            <h2 className="font-display font-bold text-lg text-white">Contact Information</h2>

            <div className="space-y-4">
              <a
                href="mailto:bidwarsupport@gmail.com"
                className="flex items-start gap-4 p-4 rounded-xl border border-border/50 bg-white/[0.02] hover:border-border transition-colors group"
              >
                <div className="w-9 h-9 rounded-lg bg-white/5 border border-border/50 flex items-center justify-center flex-shrink-0 group-hover:border-primary/40 transition-colors">
                  <Mail className="w-4 h-4 text-primary" />
                </div>
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/60 mb-0.5">Support Email</p>
                  <p className="text-sm text-white font-medium">bidwarsupport@gmail.com</p>
                </div>
              </a>

              <a
                href="https://wa.me/918707488250"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-start gap-4 p-4 rounded-xl border border-border/50 bg-white/[0.02] hover:border-green-500/40 transition-colors group"
              >
                <div className="w-9 h-9 rounded-lg bg-green-500/10 border border-green-500/20 flex items-center justify-center flex-shrink-0 group-hover:border-green-500/40 transition-colors">
                  <MessageCircle className="w-4 h-4 text-green-400" />
                </div>
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/60 mb-0.5">WhatsApp / Phone</p>
                  <p className="text-sm text-white font-medium">+91 8707488250</p>
                </div>
              </a>

              <a
                href="https://bidwar.in"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-start gap-4 p-4 rounded-xl border border-border/50 bg-white/[0.02] hover:border-border transition-colors group"
              >
                <div className="w-9 h-9 rounded-lg bg-white/5 border border-border/50 flex items-center justify-center flex-shrink-0 group-hover:border-primary/40 transition-colors">
                  <Globe className="w-4 h-4 text-primary" />
                </div>
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/60 mb-0.5">Website</p>
                  <p className="text-sm text-white font-medium">https://bidwar.in</p>
                </div>
              </a>

              <div className="flex items-start gap-4 p-4 rounded-xl border border-border/50 bg-white/[0.02]">
                <div className="w-9 h-9 rounded-lg bg-white/5 border border-border/50 flex items-center justify-center flex-shrink-0">
                  <MapPin className="w-4 h-4 text-muted-foreground" />
                </div>
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/60 mb-0.5">Address</p>
                  <p className="text-sm text-white font-medium leading-relaxed">
                    Gurudham Colony, Bhelupura,<br />
                    Varanasi, Uttar Pradesh, India
                  </p>
                </div>
              </div>
            </div>

            {/* Response time badge */}
            <div className="flex items-center gap-2.5 text-xs text-white/50">
              <Clock className="w-3.5 h-3.5 text-green-400 flex-shrink-0" />
              Typically responds within 24 hours.
            </div>
          </div>

          {/* Business details */}
          <div className="space-y-6">
            <h2 className="font-display font-bold text-lg text-white">Business Details</h2>

            <div className="rounded-xl border border-border/50 bg-white/[0.02] divide-y divide-border/40">
              {[
                { label: "Business Name", value: "CWP Detailers & Motors" },
                { label: "Proprietor", value: "Tushar Saraswat" },
                { label: "GSTIN", value: "09BYWPS9468R3ZG" },
                { label: "Website", value: "https://bidwar.in" },
                { label: "Jurisdiction", value: "Varanasi, Uttar Pradesh, India" },
              ].map(({ label, value }) => (
                <div key={label} className="px-4 py-3 flex justify-between gap-4 text-sm">
                  <span className="text-muted-foreground flex-shrink-0">{label}</span>
                  <span className="text-white text-right">{value}</span>
                </div>
              ))}
            </div>

            <div className="rounded-xl border border-border/40 bg-white/[0.01] px-5 py-4">
              <p className="text-xs text-white/40 leading-relaxed">
                BidWar is operated and billed by CWP Detailers &amp; Motors. For billing disputes,
                subscription queries, or invoice requests, include your tournament ID or registered
                email in your message.
              </p>
            </div>

            {/* Quick links */}
            <div>
              <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground/60 mb-3">Legal</p>
              <div className="flex flex-wrap gap-x-4 gap-y-2">
                {[
                  { label: "Privacy Policy", href: "/legal/privacy" },
                  { label: "Terms & Conditions", href: "/legal/terms" },
                  { label: "Refund Policy", href: "/legal/refund" },
                  { label: "Disclaimer", href: "/legal/disclaimer" },
                ].map(l => (
                  <a
                    key={l.label}
                    href={l.href}
                    className="text-xs text-muted-foreground hover:text-white transition-colors underline underline-offset-2"
                  >
                    {l.label}
                  </a>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
