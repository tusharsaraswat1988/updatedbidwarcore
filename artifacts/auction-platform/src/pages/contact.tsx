import { useEffect, useMemo, useState } from "react";
import { Mail, Phone, MessageCircle, Clock, Send } from "lucide-react";
import { PublicNavbar } from "@/components/public-navbar";

type InquiryType = "demo" | "pricing" | "support" | "partnership" | "other";

type ContactFormState = {
  fullName: string;
  email: string;
  phone: string;
  inquiryType: InquiryType;
  subject: string;
  message: string;
  consent: boolean;
};

type SubmitResponse = {
  success?: boolean;
  referenceId?: string;
  message?: string;
  error?: string;
};

const INITIAL_FORM: ContactFormState = {
  fullName: "",
  email: "",
  phone: "",
  inquiryType: "demo",
  subject: "",
  message: "",
  consent: false,
};

export default function ContactPage() {
  const [form, setForm] = useState<ContactFormState>(INITIAL_FORM);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successState, setSuccessState] = useState<{ referenceId: string; message: string } | null>(null);

  const canSubmit = useMemo(() => {
    return (
      form.fullName.trim().length >= 2 &&
      form.email.trim().length > 0 &&
      form.subject.trim().length >= 3 &&
      form.message.trim().length >= 10 &&
      form.consent
    );
  }, [form]);

  useEffect(() => {
    const prev = document.title;
    document.title = "Contact Us | BidWar - India's Live Sports Auction Platform";

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
      "Contact BidWar support team. Submit your query for demo, pricing, support, or partnership and get a response within 24 hours.",
    );

    return () => {
      document.title = prev;
      if (meta) meta.setAttribute("content", prevContent);
      if (created && meta?.parentNode) meta.parentNode.removeChild(meta);
    };
  }, []);

  function updateField<K extends keyof ContactFormState>(key: K, value: ContactFormState[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setErrorMessage(null);
    setSuccessState(null);

    if (!canSubmit) {
      setErrorMessage("Please fill all required fields before submitting.");
      return;
    }

    setIsSubmitting(true);
    try {
      const response = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });

      const data = (await response.json().catch(() => null)) as SubmitResponse | null;

      if (!response.ok || !data?.success || !data.referenceId) {
        setErrorMessage(data?.error ?? "Unable to submit your request. Please try again.");
        return;
      }

      setSuccessState({
        referenceId: data.referenceId,
        message: data.message ?? "Thanks! We received your request.",
      });
      setForm(INITIAL_FORM);
    } catch {
      setErrorMessage("Network issue while submitting. Please try again in a moment.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="min-h-screen bg-[#09090b] text-white pt-16">
      <PublicNavbar />

      <div className="border-b border-white/8 py-14 px-6">
        <div className="max-w-5xl mx-auto">
          <div className="text-primary text-xs font-bold uppercase tracking-widest mb-3">Get in touch</div>
          <h1 className="font-display font-black text-4xl md:text-5xl text-white leading-tight mb-3">
            Contact Us
          </h1>
          <p className="text-white/50 text-sm max-w-xl">
            Submit your requirement and our support team will connect with you quickly.
          </p>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-6 py-14">
        <div className="grid md:grid-cols-2 gap-10 items-start">
          <div className="space-y-6">
            <h2 className="font-display font-bold text-lg text-white">How we can help</h2>
            <p className="text-sm text-white/60 leading-relaxed">
              Use the form to request demo, pricing, setup help, or partnership discussion.
              We usually respond within 24 hours.
            </p>

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
            </div>

            <div className="flex items-center gap-2.5 text-xs text-white/50">
              <Clock className="w-3.5 h-3.5 text-green-400 flex-shrink-0" />
              Typical response time: within 24 hours.
            </div>
          </div>

          <div className="space-y-6">
            <h2 className="font-display font-bold text-lg text-white">Send us your query</h2>

            <form onSubmit={handleSubmit} className="rounded-xl border border-border/50 bg-white/[0.02] p-5 space-y-4">
              <div className="grid sm:grid-cols-2 gap-3">
                <label className="space-y-1.5">
                  <span className="text-xs text-muted-foreground">Full Name *</span>
                  <input
                    value={form.fullName}
                    onChange={(e) => updateField("fullName", e.target.value)}
                    className="w-full px-3 py-2 rounded-lg bg-black/30 border border-border/60 text-sm text-white outline-none focus:border-primary/60"
                    placeholder="Enter your name"
                    required
                  />
                </label>
                <label className="space-y-1.5">
                  <span className="text-xs text-muted-foreground">Email *</span>
                  <input
                    type="email"
                    value={form.email}
                    onChange={(e) => updateField("email", e.target.value)}
                    className="w-full px-3 py-2 rounded-lg bg-black/30 border border-border/60 text-sm text-white outline-none focus:border-primary/60"
                    placeholder="you@example.com"
                    required
                  />
                </label>
              </div>

              <div className="grid sm:grid-cols-2 gap-3">
                <label className="space-y-1.5">
                  <span className="text-xs text-muted-foreground">Phone (optional)</span>
                  <input
                    value={form.phone}
                    onChange={(e) => updateField("phone", e.target.value)}
                    className="w-full px-3 py-2 rounded-lg bg-black/30 border border-border/60 text-sm text-white outline-none focus:border-primary/60"
                    placeholder="+91"
                  />
                </label>
                <label className="space-y-1.5">
                  <span className="text-xs text-muted-foreground">Inquiry Type *</span>
                  <select
                    value={form.inquiryType}
                    onChange={(e) => updateField("inquiryType", e.target.value as InquiryType)}
                    className="w-full px-3 py-2 rounded-lg bg-black/30 border border-border/60 text-sm text-white outline-none focus:border-primary/60"
                  >
                    <option value="demo">Demo Request</option>
                    <option value="pricing">Pricing</option>
                    <option value="support">Support</option>
                    <option value="partnership">Partnership</option>
                    <option value="other">Other</option>
                  </select>
                </label>
              </div>

              <label className="space-y-1.5 block">
                <span className="text-xs text-muted-foreground">Subject *</span>
                <input
                  value={form.subject}
                  onChange={(e) => updateField("subject", e.target.value)}
                  className="w-full px-3 py-2 rounded-lg bg-black/30 border border-border/60 text-sm text-white outline-none focus:border-primary/60"
                  placeholder="How can we help?"
                  required
                />
              </label>

              <label className="space-y-1.5 block">
                <span className="text-xs text-muted-foreground">Message *</span>
                <textarea
                  value={form.message}
                  onChange={(e) => updateField("message", e.target.value)}
                  className="w-full min-h-[120px] px-3 py-2 rounded-lg bg-black/30 border border-border/60 text-sm text-white outline-none focus:border-primary/60"
                  placeholder="Share your requirement in detail."
                  required
                />
              </label>

              <label className="flex items-start gap-2 text-xs text-white/70">
                <input
                  type="checkbox"
                  checked={form.consent}
                  onChange={(e) => updateField("consent", e.target.checked)}
                  className="mt-0.5"
                />
                I agree to be contacted by BidWar support regarding this query.
              </label>

              {errorMessage && (
                <p className="text-xs text-red-300 rounded-lg border border-red-400/30 bg-red-500/10 px-3 py-2">
                  {errorMessage}
                </p>
              )}

              {successState && (
                <p className="text-xs text-green-200 rounded-lg border border-green-400/30 bg-green-500/10 px-3 py-2">
                  {successState.message} Reference ID: <span className="font-semibold">{successState.referenceId}</span>
                </p>
              )}

              <button
                type="submit"
                disabled={isSubmitting || !canSubmit}
                className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-primary text-black text-sm font-semibold disabled:opacity-60 disabled:cursor-not-allowed"
              >
                <Send className="w-4 h-4" />
                {isSubmitting ? "Submitting..." : "Submit Request"}
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}
