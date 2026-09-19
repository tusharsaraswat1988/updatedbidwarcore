import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { ExternalLink, Building2, Briefcase, Trophy, Sparkles } from "lucide-react";
import { clientKeys } from "@/lib/initial-data/query-keys";
import { useHomeInitialData } from "@/lib/initial-data/initial-data-provider";
import type { ClientRecord } from "@/lib/initial-data/types";

const FALLBACK_CLIENTS: ClientRecord[] = [
  {
    id: 1,
    name: "Vyapari Network",
    clientType: "brand",
    displayOrder: 0,
    active: true,
  },
  {
    id: 2,
    name: "Rotary Shine",
    clientType: "organisation",
    displayOrder: 1,
    active: true,
  },
  {
    id: 3,
    name: "SJMAA (St. John's Marhauli Alumni Association)",
    clientType: "organisation",
    displayOrder: 2,
    active: true,
  },
  {
    id: 4,
    name: "Lions Diamond Varanasi",
    clientType: "organisation",
    displayOrder: 3,
    active: true,
  },
  {
    id: 5,
    name: "Heritage Hospitals",
    clientType: "brand",
    displayOrder: 4,
    active: true,
  },
  {
    id: 6,
    name: "Good Morning",
    clientType: "brand",
    displayOrder: 5,
    active: true,
  },
  {
    id: 7,
    name: "Live VNS Studio",
    clientType: "brand",
    displayOrder: 6,
    active: true,
  },
  {
    id: 8,
    name: "KV Tech Media",
    clientType: "brand",
    displayOrder: 7,
    active: true,
  },
];

function getInitials(name: string): string {
  const words = name
    .replace(/[()]/g, "")
    .split(/\s+/)
    .filter(Boolean);
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return (words[0][0] + (words[1]?.[0] || "")).toUpperCase();
}

export function OurClientsSection() {
  const initialData = useHomeInitialData();
  const [selectedFilter, setSelectedFilter] = useState<"all" | "brand" | "organisation">("all");

  const { data: clientsData } = useQuery({
    queryKey: clientKeys.active,
    queryFn: async () => {
      const res = await fetch("/api/clients");
      if (!res.ok) throw new Error("Failed to load clients");
      return (await res.json()) as ClientRecord[];
    },
    initialData: initialData?.clients && initialData.clients.length > 0 ? initialData.clients : undefined,
    staleTime: 30_000,
  });

  const allClients = useMemo(() => {
    const list = clientsData && clientsData.length > 0 ? clientsData : FALLBACK_CLIENTS;
    return list.filter((c) => c.active !== false);
  }, [clientsData]);

  const filteredClients = useMemo(() => {
    if (selectedFilter === "all") return allClients;
    return allClients.filter((c) => c.clientType === selectedFilter);
  }, [allClients, selectedFilter]);

  const brandCount = allClients.filter((c) => c.clientType === "brand").length;
  const orgCount = allClients.filter((c) => c.clientType === "organisation").length;

  return (
    <section
      id="our-clients"
      className="relative border-t border-white/10 bg-black/40 py-16 sm:py-20 overflow-hidden"
      aria-labelledby="our-clients-heading"
    >
      {/* Subtle Background Glows */}
      <div className="pointer-events-none absolute -left-40 top-1/2 -translate-y-1/2 h-96 w-96 rounded-full bg-amber-500/5 blur-3xl" />
      <div className="pointer-events-none absolute -right-40 top-1/2 -translate-y-1/2 h-96 w-96 rounded-full bg-amber-500/5 blur-3xl" />

      <div className="relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        {/* Section Header */}
        <div className="text-center max-w-3xl mx-auto">
          <div className="inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-3.5 py-1 text-[11px] font-bold uppercase tracking-[0.24em] text-primary font-mono mb-3">
            <Sparkles className="w-3 h-3 text-amber-400" />
            OUR CLIENTS
          </div>

          <h2
            id="our-clients-heading"
            className="font-display text-2xl sm:text-3xl md:text-4xl font-bold tracking-tight text-white"
          >
            Trusted by Leading <span className="gold-text">Brands &amp; Organisations</span>
          </h2>

          <p className="mt-3 text-xs sm:text-sm text-muted-foreground leading-relaxed">
            From prominent enterprises and media networks to championship sports organisations,
            BidWar powers live auction draft operations across India.
          </p>

          {/* Filter Pills */}
          <div className="mt-6 inline-flex flex-wrap items-center justify-center gap-1.5 p-1 rounded-xl bg-card/60 border border-white/10 backdrop-blur-sm">
            <button
              type="button"
              onClick={() => setSelectedFilter("all")}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition ${
                selectedFilter === "all"
                  ? "bg-primary text-primary-foreground shadow"
                  : "text-muted-foreground hover:text-white hover:bg-white/5"
              }`}
            >
              All Clients ({allClients.length})
            </button>

            {brandCount > 0 && (
              <button
                type="button"
                onClick={() => setSelectedFilter("brand")}
                className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition ${
                  selectedFilter === "brand"
                    ? "bg-amber-500/20 text-amber-300 border border-amber-500/40"
                    : "text-muted-foreground hover:text-white hover:bg-white/5"
                }`}
              >
                <Briefcase className="w-3 h-3" />
                <span>Companies &amp; Brands</span>
              </button>
            )}

            {orgCount > 0 && (
              <button
                type="button"
                onClick={() => setSelectedFilter("organisation")}
                className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition ${
                  selectedFilter === "organisation"
                    ? "bg-sky-500/20 text-sky-300 border border-sky-500/40"
                    : "text-muted-foreground hover:text-white hover:bg-white/5"
                }`}
              >
                <Trophy className="w-3 h-3" />
                <span>Auction Organisations</span>
              </button>
            )}
          </div>
        </div>

        {/* Clients Grid */}
        <div className="mt-10 grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3.5 sm:gap-4 lg:gap-5">
          {filteredClients.map((client) => {
            const hasWebsite = Boolean(client.websiteUrl);
            const CardWrapper = hasWebsite ? "a" : "div";
            const wrapperProps = hasWebsite
              ? {
                  href: client.websiteUrl!,
                  target: "_blank",
                  rel: "noopener noreferrer",
                  title: `Visit ${client.name}`,
                }
              : {};

            const initials = getInitials(client.name);
            const isOrg = client.clientType === "organisation";

            return (
              <CardWrapper
                key={client.id}
                {...wrapperProps}
                className={`group relative flex flex-col justify-between rounded-2xl border border-white/10 bg-gradient-to-b from-card/60 to-card/30 p-4 sm:p-5 backdrop-blur-sm transition-all duration-300 hover:-translate-y-1 hover:border-amber-400/50 hover:shadow-xl hover:shadow-amber-500/5 ${
                  hasWebsite ? "cursor-pointer" : ""
                }`}
              >
                {/* Type Badge & External Link Icon */}
                <div className="flex items-center justify-between gap-2 w-full mb-3">
                  <span
                    className={`inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider font-mono ${
                      isOrg
                        ? "bg-sky-500/10 text-sky-400 border border-sky-500/30"
                        : "bg-amber-500/10 text-amber-300 border border-amber-500/30"
                    }`}
                  >
                    {isOrg ? <Trophy className="w-2.5 h-2.5" /> : <Building2 className="w-2.5 h-2.5" />}
                    {isOrg ? "Organisation" : "Brand"}
                  </span>

                  {hasWebsite && (
                    <span className="text-muted-foreground/40 group-hover:text-amber-400 transition-colors">
                      <ExternalLink className="w-3.5 h-3.5" />
                    </span>
                  )}
                </div>

                {/* Logo or Stylized Monogram */}
                <div className="my-auto py-2 flex items-center justify-center w-full min-h-[64px]">
                  {client.logoUrl ? (
                    <img
                      src={client.logoUrl}
                      alt={client.name}
                      className="max-h-14 sm:max-h-16 w-auto max-w-[85%] object-contain filter grayscale group-hover:grayscale-0 transition-all duration-300"
                      loading="lazy"
                    />
                  ) : (
                    <div className="h-14 w-14 sm:h-16 sm:w-16 rounded-2xl bg-gradient-to-br from-amber-500/20 via-black to-zinc-900 border border-amber-400/30 flex items-center justify-center shadow-inner group-hover:border-amber-400 group-hover:scale-105 transition-all duration-300">
                      <span className="font-display font-black text-base sm:text-lg tracking-wider text-amber-300">
                        {initials}
                      </span>
                    </div>
                  )}
                </div>

                {/* Name & Optional Link */}
                <div className="mt-3 pt-3 border-t border-white/5 w-full text-center">
                  <h3 className="font-display font-semibold text-xs sm:text-sm text-foreground group-hover:text-amber-300 transition-colors line-clamp-2 leading-snug">
                    {client.name}
                  </h3>

                  {hasWebsite && (
                    <div className="mt-1 text-[11px] text-muted-foreground group-hover:text-primary transition-colors flex items-center justify-center gap-1">
                      <span>Visit Website</span>
                      <span className="text-[10px]">↗</span>
                    </div>
                  )}
                </div>
              </CardWrapper>
            );
          })}
        </div>
      </div>
    </section>
  );
}
