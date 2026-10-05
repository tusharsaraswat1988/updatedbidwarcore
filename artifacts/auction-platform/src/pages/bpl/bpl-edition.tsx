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
    <div className="lovable-theme min-h-screen bg-slate-950 text-foreground pt-16 dark">
      <title>
        {editionData
          ? `${editionData.name} | ${brandName}`
          : `BidWar Premier League | ${brandName}`}
      </title>

      <PublicNavbar />

      <main className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12 space-y-8">
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
