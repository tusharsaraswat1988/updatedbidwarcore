import { useState, useMemo, useRef, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import { Building2, Trophy, Sparkles, ChevronLeft, ChevronRight } from "lucide-react";
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
  const scrollRef = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [startX, setStartX] = useState(0);
  const [scrollLeftState, setScrollLeftState] = useState(0);
  const [dragMoved, setDragMoved] = useState(false);

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

  // Smooth scroll buttons
  const handleScroll = useCallback((dir: -1 | 1) => {
    if (!scrollRef.current) return;
    const scrollAmount = 320 * dir;
    scrollRef.current.scrollBy({ left: scrollAmount, behavior: "smooth" });
  }, []);

  // Mouse Drag to Scroll Handlers
  const onMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!scrollRef.current) return;
    setIsDragging(true);
    setDragMoved(false);
    setStartX(e.pageX - scrollRef.current.offsetLeft);
    setScrollLeftState(scrollRef.current.scrollLeft);
  };

  const onMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!isDragging || !scrollRef.current) return;
    e.preventDefault();
    const x = e.pageX - scrollRef.current.offsetLeft;
    const walk = (x - startX) * 1.5;
    scrollRef.current.scrollLeft = scrollLeftState - walk;
    if (Math.abs(x - startX) > 4) {
      setDragMoved(true);
    }
  };

  const onMouseUpOrLeave = () => {
    setIsDragging(false);
  };

  return (
    <section
      id="our-clients"
      className="relative border-t border-white/10 bg-black/40 py-16 sm:py-20 overflow-hidden select-none"
      aria-labelledby="our-clients-heading"
    >
      {/* Subtle Background Glows */}
      <div className="pointer-events-none absolute -left-40 top-1/2 -translate-y-1/2 h-96 w-96 rounded-full bg-amber-500/5 blur-3xl" />
      <div className="pointer-events-none absolute -right-40 top-1/2 -translate-y-1/2 h-96 w-96 rounded-full bg-amber-500/5 blur-3xl" />

      <div className="relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        {/* Section Header */}
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-8">
          <div className="max-w-2xl">
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

            <p className="mt-2 text-xs sm:text-sm text-muted-foreground leading-relaxed">
              From prominent enterprises and media networks to championship sports organisations,
              BidWar powers live auction draft operations across India.
            </p>
          </div>

          {/* Left/Right Navigation Arrows for Desktop */}
          <div className="hidden sm:flex items-center gap-2 self-end">
            <button
              type="button"
              onClick={() => handleScroll(-1)}
              className="w-9 h-9 rounded-xl border border-white/10 bg-slate-900/80 hover:bg-slate-800 hover:border-amber-400/50 text-slate-300 hover:text-white flex items-center justify-center transition shadow-sm active:scale-95"
              title="Scroll left"
              aria-label="Scroll left"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={() => handleScroll(1)}
              className="w-9 h-9 rounded-xl border border-white/10 bg-slate-900/80 hover:bg-slate-800 hover:border-amber-400/50 text-slate-300 hover:text-white flex items-center justify-center transition shadow-sm active:scale-95"
              title="Scroll right"
              aria-label="Scroll right"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Horizontal Scroll Track (Drag to scroll with mouse, swipe on touch) */}
        <div className="relative -mx-4 px-4 sm:-mx-6 sm:px-6 lg:-mx-8 lg:px-8">
          <div
            ref={scrollRef}
            onMouseDown={onMouseDown}
            onMouseMove={onMouseMove}
            onMouseUp={onMouseUpOrLeave}
            onMouseLeave={onMouseUpOrLeave}
            className={`flex items-stretch gap-4 sm:gap-5 overflow-x-auto py-3 pb-6 scroll-smooth cursor-grab active:cursor-grabbing [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden`}
          >
            {allClients.map((client) => {
              const hasWebsite = Boolean(client.websiteUrl);
              const CardWrapper = hasWebsite ? "a" : "div";
              const wrapperProps = hasWebsite
                ? {
                    href: client.websiteUrl!,
                    target: "_blank",
                    rel: "noopener noreferrer",
                    onClick: (e: React.MouseEvent) => {
                      if (dragMoved) {
                        e.preventDefault();
                      }
                    },
                    title: `Visit ${client.name}`,
                  }
                : {};

              const initials = getInitials(client.name);
              const isOrg = client.clientType === "organisation";

              return (
                <CardWrapper
                  key={client.id}
                  {...wrapperProps}
                  className={`group relative flex flex-col justify-between w-[220px] sm:w-[250px] md:w-[270px] flex-shrink-0 rounded-2xl border border-white/10 bg-gradient-to-b from-card/70 to-card/40 p-4 sm:p-5 backdrop-blur-sm transition-all duration-300 hover:-translate-y-1 hover:border-amber-400/50 hover:shadow-xl hover:shadow-amber-500/5 ${
                    hasWebsite ? "cursor-pointer" : ""
                  }`}
                >
                  {/* Top: Classification Badge Only (No redirect arrow icon) */}
                  <div className="flex items-center justify-start w-full mb-2">
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
                  </div>

                  {/* Middle: Brand Logo or Monogram */}
                  <div className="my-auto py-3 flex items-center justify-center w-full min-h-[90px]">
                    {client.logoUrl ? (
                      <img
                        src={client.logoUrl}
                        alt={client.name}
                        className="max-h-[75px] sm:max-h-[85px] w-auto max-w-[90%] object-contain drop-shadow-md transition-all duration-300 group-hover:scale-105 pointer-events-none"
                        loading="lazy"
                        draggable={false}
                      />
                    ) : (
                      <div className="h-16 w-16 sm:h-18 sm:w-18 rounded-2xl bg-gradient-to-br from-amber-500/20 via-black to-zinc-900 border border-amber-400/30 flex items-center justify-center shadow-inner group-hover:border-amber-400 group-hover:scale-105 transition-all duration-300">
                        <span className="font-display font-black text-lg sm:text-xl tracking-wider text-amber-300">
                          {initials}
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Bottom: Clean Client Name (No extra redirect arrow text) */}
                  <div className="mt-3 pt-3 border-t border-white/5 w-full text-center">
                    <h3 className="font-display font-semibold text-xs sm:text-sm text-foreground group-hover:text-amber-300 transition-colors line-clamp-2 leading-snug">
                      {client.name}
                    </h3>
                  </div>
                </CardWrapper>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
}
