import { useEffect, useState } from "react";
import { Link } from "wouter";
import {
  ChevronRight,
  Crown,
  RefreshCw,
  Trophy,
} from "lucide-react";
import { PublicNavbar } from "@/components/public-navbar";
import { useBranding } from "@/hooks/use-branding";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { BplEditionView } from "@/components/bpl/bpl-edition-view";
import {
  fetchActiveBplEdition,
  fetchPublicBplEditions,
  type BplEdition,
} from "@/lib/bpl-api";

export default function BplHubPage() {
  const { brandName } = useBranding();

  const [activeEdition, setActiveEdition] = useState<BplEdition | null>(null);
  const [allEditions, setAllEditions] = useState<BplEdition[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadData = async () => {
    setLoading(true);
    setError(null);
    try {
      const [activeRes, editionsRes] = await Promise.all([
        fetchActiveBplEdition(),
        fetchPublicBplEditions().catch(() => []),
      ]);
      setActiveEdition(activeRes.edition);
      setAllEditions(editionsRes);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to load BPL data");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  return (
    <div className="lovable-theme min-h-screen bg-slate-950 text-foreground pt-16 dark">
      <title>
        {activeEdition
          ? `${activeEdition.name} | ${brandName}`
          : `BidWar Premier League | ${brandName}`}
      </title>

      <PublicNavbar />

      {/* Main Container */}
      <main className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12">
        {loading ? (
          <div className="space-y-8">
            <div className="rounded-3xl border border-slate-800 bg-slate-900/50 p-8 sm:p-14 space-y-6">
              <Skeleton className="h-6 w-48 mx-auto" />
              <Skeleton className="h-12 w-3/4 mx-auto" />
              <Skeleton className="h-8 w-64 mx-auto" />
              <div className="flex justify-center gap-4 pt-4">
                <Skeleton className="h-11 w-40" />
                <Skeleton className="h-11 w-40" />
              </div>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <Skeleton className="h-28 rounded-xl" />
              <Skeleton className="h-28 rounded-xl" />
              <Skeleton className="h-28 rounded-xl" />
              <Skeleton className="h-28 rounded-xl" />
            </div>
          </div>
        ) : error ? (
          <div className="rounded-2xl border border-red-500/20 bg-red-500/10 p-8 text-center space-y-4">
            <p className="text-red-400 text-sm font-medium">{error}</p>
            <Button
              variant="outline"
              size="sm"
              onClick={loadData}
              className="gap-2 border-slate-700"
            >
              <RefreshCw className="w-3.5 h-3.5" /> Retry
            </Button>
          </div>
        ) : !activeEdition ? (
          /* Empty / Archive Announcement State */
          <div className="rounded-3xl border border-slate-800 bg-slate-900/40 p-12 sm:p-16 text-center space-y-6">
            <div className="w-16 h-16 rounded-2xl bg-orange-500/10 border border-orange-500/20 flex items-center justify-center mx-auto text-orange-400">
              <Crown className="w-8 h-8" />
            </div>
            <div className="space-y-2 max-w-lg mx-auto">
              <h2 className="text-2xl font-black uppercase text-white tracking-tight">
                BidWar Premier League
              </h2>
              <p className="text-sm text-slate-400 leading-relaxed">
                The next edition of BidWar Premier League is currently being prepared. Check back shortly for confirmed tournament dates and franchise announcements.
              </p>
            </div>
            <div className="pt-2">
              <Link href="/upcoming-auctions">
                <Button variant="outline" className="gap-2 border-slate-700 text-slate-300">
                  Explore Upcoming Tournaments <ChevronRight className="w-4 h-4" />
                </Button>
              </Link>
            </div>
          </div>
        ) : (
          /* Production-Grade BPL Edition Presentation View */
          <BplEditionView
            edition={activeEdition}
            allEditions={allEditions}
            isSpecificEditionRoute={false}
          />
        )}
      </main>
    </div>
  );
}
