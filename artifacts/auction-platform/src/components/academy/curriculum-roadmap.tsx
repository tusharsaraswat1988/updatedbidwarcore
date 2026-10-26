import { memo, useState } from "react";
import { Link } from "wouter";
import {
  CheckCircle2,
  Clock,
  Flame,
  Layers,
  Monitor,
  Sparkles,
  Users,
  Send,
  MessageSquare,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

interface RoadmapModule {
  episode: number;
  title: string;
  description: string;
  duration: string;
  category: string;
  icon: React.ElementType;
  status: "available" | "in_production" | "planned";
  slug?: string;
}

const ROADMAP_MODULES: RoadmapModule[] = [
  {
    episode: 1,
    title: "Tournament Setup & Basic Settings",
    description:
      "Step-by-step setup: league details, franchise rules, team slots, and preparing for auction day.",
    duration: "5 min",
    category: "Getting Started",
    icon: Layers,
    status: "available",
    slug: "how-to-create-your-first-tournament-in-bidwar-bidwar-academy-episode-1",
  },
  {
    episode: 2,
    title: "Player Roster Import & Category Management",
    description:
      "Bulk upload players via Excel/CSV, assign roles (Batsman, Bowler, All-Rounder), set base prices, and upload player photos.",
    duration: "7 min",
    category: "Player Setup",
    icon: Users,
    status: "in_production",
  },
  {
    episode: 3,
    title: "Team Wallets, Purse Caps & Bid Increment Rules",
    description:
      "Configure franchise purse balances, squad size limits (min/max), and customized bid increment slabs (5k, 10k, 50k jumps).",
    duration: "6 min",
    category: "Auction Rules",
    icon: Flame,
    status: "in_production",
  },
  {
    episode: 4,
    title: "Auction Day Command Center: Big Screen LED & TV Setup",
    description:
      "How to set up dual monitors: Auctioneer bidding console on laptop and full-screen live LED graphics on stage projector.",
    duration: "8 min",
    category: "Live Bidding",
    icon: Monitor,
    status: "planned",
  },
  {
    episode: 5,
    title: "Unsold Player Re-Auctions & Accelerated Rounds",
    description:
      "Manage unsold pools, run accelerated bidding rounds, handle tie-breaks, and finalize official team squads.",
    duration: "6 min",
    category: "Advanced Workflows",
    icon: Sparkles,
    status: "planned",
  },
];

export const CurriculumRoadmap = memo(function CurriculumRoadmap() {
  const [topicName, setTopicName] = useState("");
  const [topicDetails, setTopicDetails] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);

  function handleSuggestSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!topicName.trim()) return;
    setSubmitted(true);
    setTimeout(() => {
      setTopicName("");
      setTopicDetails("");
      setSubmitted(false);
      setDialogOpen(false);
    }, 1800);
  }

  return (
    <section className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-primary mb-1">
            <Sparkles className="h-4 w-4" />
            Comprehensive Learning Track
          </div>
          <h2 className="text-xl sm:text-2xl font-black text-foreground tracking-tight">
            BidWar Masterclass Curriculum
          </h2>
          <p className="text-sm text-muted-foreground mt-1 max-w-xl">
            A structured, 5-part video series covering everything from your initial tournament draft to final squad celebrations.
          </p>
        </div>

        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button variant="outline" size="sm" className="gap-2 border-primary/30 hover:border-primary">
              <MessageSquare className="h-4 w-4 text-primary" />
              Request a Topic
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Suggest an Academy Tutorial</DialogTitle>
              <DialogDescription>
                Is there a specific tournament workflow or auction format you want us to cover? We record tutorials weekly.
              </DialogDescription>
            </DialogHeader>
            {submitted ? (
              <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-6 text-center space-y-2">
                <CheckCircle2 className="mx-auto h-8 w-8 text-emerald-400" />
                <p className="text-sm font-bold text-emerald-300">Thank you for your suggestion!</p>
                <p className="text-xs text-muted-foreground">Our production team will review this for upcoming episodes.</p>
              </div>
            ) : (
              <form onSubmit={handleSuggestSubmit} className="space-y-4 pt-2">
                <div className="space-y-2">
                  <label className="text-xs font-semibold text-foreground">Topic or Feature</label>
                  <Input
                    placeholder="e.g. Box Cricket Auction with 8 teams & silent bids"
                    value={topicName}
                    onChange={(e) => setTopicName(e.target.value)}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-semibold text-foreground">Details or Questions (Optional)</label>
                  <Textarea
                    rows={3}
                    placeholder="What specific challenges are you facing during your auction?"
                    value={topicDetails}
                    onChange={(e) => setTopicDetails(e.target.value)}
                  />
                </div>
                <DialogFooter className="pt-2">
                  <Button type="submit" className="gap-2 w-full sm:w-auto">
                    <Send className="h-4 w-4" /> Submit Request
                  </Button>
                </DialogFooter>
              </form>
            )}
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {ROADMAP_MODULES.map((mod) => {
          const Icon = mod.icon;
          const isAvailable = mod.status === "available";
          const isInProd = mod.status === "in_production";

          return (
            <div
              key={`roadmap-ep-${mod.episode}`}
              className={`relative flex flex-col justify-between rounded-xl border p-5 transition-all ${
                isAvailable
                  ? "border-primary/40 bg-card/40 hover:border-primary/60 shadow-sm"
                  : "border-border/60 bg-card/20 hover:border-border/80 opacity-90"
              }`}
            >
              <div>
                <div className="flex items-center justify-between gap-2 mb-3">
                  <span className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-amber-400">
                    <span className="flex h-6 w-6 items-center justify-center rounded-md bg-primary/15 text-primary text-xs font-black">
                      {mod.episode}
                    </span>
                    Episode {mod.episode}
                  </span>

                  {isAvailable ? (
                    <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/15 px-2.5 py-0.5 text-[11px] font-semibold text-emerald-400">
                      <CheckCircle2 className="h-3 w-3" /> Published
                    </span>
                  ) : isInProd ? (
                    <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/15 px-2.5 py-0.5 text-[11px] font-semibold text-amber-400">
                      <Clock className="h-3 w-3 animate-spin" /> In Production
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 rounded-full bg-muted/60 px-2.5 py-0.5 text-[11px] font-medium text-muted-foreground">
                      Planned
                    </span>
                  )}
                </div>

                <div className="flex items-start gap-3 mb-2">
                  <div className="rounded-lg bg-primary/10 p-2 text-primary shrink-0 mt-0.5">
                    <Icon className="h-4 w-4" />
                  </div>
                  <div>
                    <h3 className="font-bold text-foreground text-sm sm:text-base leading-snug">
                      {mod.title}
                    </h3>
                    <span className="text-[11px] text-primary/80 font-medium">{mod.category}</span>
                  </div>
                </div>

                <p className="text-xs text-muted-foreground leading-relaxed mt-2 line-clamp-3">
                  {mod.description}
                </p>
              </div>

              <div className="mt-4 pt-4 border-t border-border/40 flex items-center justify-between text-xs text-muted-foreground">
                <span className="flex items-center gap-1">
                  <Clock className="h-3 w-3" /> {mod.duration}
                </span>

                {isAvailable && mod.slug ? (
                  <Link
                    href={`/academy/${mod.slug}`}
                    className="font-bold text-primary hover:underline inline-flex items-center gap-1"
                  >
                    Watch Tutorial →
                  </Link>
                ) : (
                  <span className="text-muted-foreground/70 text-[11px] italic">Coming shortly</span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
});
