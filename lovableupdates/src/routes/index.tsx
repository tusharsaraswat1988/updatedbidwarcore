import { createFileRoute, Link } from "@tanstack/react-router";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Live Auction LED — Demo" },
      { name: "description", content: "LED-first broadcast screen demo for player auctions." },
    ],
  }),
  component: Index,
});

function Index() {
  return (
    <div className="min-h-screen bg-[#070708] text-white flex flex-col items-center justify-center gap-8 p-8 font-['Barlow_Condensed']">
      <div className="text-center">
        <h1 className="font-['Bebas_Neue'] text-6xl md:text-8xl tracking-wider text-[#D4AF37]">
          Live Auction LED
        </h1>
        <p className="mt-3 text-white/60 text-sm md:text-base uppercase tracking-[0.3em] font-mono">
          3 Direction Demo — Pick the Winner
        </p>
      </div>

      <Link
        to="/auction/v1"
        className="px-8 py-4 bg-[#D4AF37] text-black font-bold uppercase tracking-widest text-sm hover:bg-[#FFD700] transition-colors"
      >
        Open Broadcast Stage →
      </Link>

      <p className="text-white/40 text-xs font-mono uppercase tracking-widest text-center max-w-md">
        Best viewed on desktop preview · use bottom switcher to compare V1 / V2 / V3
      </p>
    </div>
  );
}
