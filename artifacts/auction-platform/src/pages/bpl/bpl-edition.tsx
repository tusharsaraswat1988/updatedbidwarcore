import { useEffect, useState } from "react";
import { Link } from "wouter";
import {
  ArrowLeft,
  ChevronRight,
  RefreshCw,
  Trophy,
} from "lucide-react";
import { PublicNavbar } from "@/components/public-navbar";
import { useBranding } from "@/hooks/use-branding";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { BplEditionView } from "@/components/bpl/bpl-edition-view";
import {
  fetchBplEdition,
  fetchPublicBplEditions,
  type BplEdition,
} from "@/lib/bpl-api";

export default function BplEditionPage({ edition: slugOrNum }: { edition: string }) {
  const { brandName } = useBranding();

  const [editionData, setEditionData] = useState<BplEdition | null>(null);
  const [allEditions, setAllEditions] = useState<BplEdition[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadData = async () => {
    if (!slugOrNum) return;
    setLoading(true);
    setError(null);
    try {
      const [editionRes, editionsListRes] = await Promise.all([
        fetchBplEdition(slugOrNum),
        fetchPublicBplEditions().catch(() => []),
      ]);
      setEditionData(editionRes);
      setAllEditions(editionsListRes);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Edition not found");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [slugOrNum]);

  return (
    <div className="lovable-theme min-h-screen bg-gradient-to-b from-[#0a1838] via-[#07132c] to-[#040c1e] text-foreground pt-16 dark relative selection:bg-amber-500 selection:text-black">
      {/* Stadium atmospheric lighting */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden z-0" aria-hidden="true">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[1100px] h-[550px] bg-gradient-to-b from-blue-600/15 via-blue-500/5 to-transparent blur-[140px] rounded-full" />
        <div className="absolute top-1/4 -left-48 w-96 h-96 bg-amber-500/10 blur-[140px] rounded-full" />
        <div className="absolute top-2/3 -right-48 w-96 h-96 bg-blue-500/10 blur-[140px] rounded-full" />
      </div>

      <title>
        {editionData
          ? `${editionData.name} | ${brandName}`
          : `BidWar Premier League | ${brandName}`}
      </title>

      <PublicNavbar />

      <main className="relative z-10 max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12 space-y-8">
        {/* Navigation Breadcrumb back to /bpl */}
        <div className="flex items-center justify-between">
          <Link href="/bpl">
            <Button
              variant="ghost"
              size="sm"
              className="gap-2 text-xs text-slate-400 hover:text-white -ml-2 font-semibold"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              Back to BPL Hub
            </Button>
          </Link>
        </div>

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
        ) : error || !editionData ? (
          <div className="rounded-3xl border border-slate-800 bg-slate-900/40 p-12 text-center space-y-4">
            <Trophy className="w-12 h-12 text-slate-600 mx-auto" />
            <h2 className="text-xl font-bold text-white">Edition Not Found</h2>
            <p className="text-slate-400 text-xs max-w-sm mx-auto">
              We couldn't locate BPL edition '{slugOrNum}'. It may be unpublished or archived.
            </p>
            <div className="pt-2">
              <Link href="/bpl">
                <Button size="sm" variant="outline" className="border-slate-700">
                  Return to BPL Hub
                </Button>
              </Link>
            </div>
          </div>
        ) : (
          <BplEditionView
            edition={editionData}
            allEditions={allEditions}
            isSpecificEditionRoute={true}
          />
        )}
      </main>
    </div>
  );
}
