import { memo, useState } from "react";
import {
  ClipboardCheck,
  FileSpreadsheet,
  Download,
  CheckCircle2,
  Sliders,
  Monitor,
  PhoneCall,
  ExternalLink,
  ShieldCheck,
  Copy,
  Check,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

const CHECKLIST_ITEMS = [
  { id: "wifi", title: "Dedicated Wi-Fi + Mobile Hotspot Backup", desc: "Keep a secondary 5G hotspot ready in case hotel or hall venue Wi-Fi stutters." },
  { id: "screen", title: "Test Projector / Stage TV via HDMI", desc: "Open the BidWar Live Viewer on the second screen and press F11 for seamless full-screen LED graphics." },
  { id: "audio", title: "Audio Sound Effects & Auctioneer Mic", desc: "Test the 'Hammer / Sold' sound and gong chime over the venue PA system." },
  { id: "paddles", title: "Team Paddle & Access Code Assignment", desc: "Confirm all team captains have their registered team name and optional owner bidding PIN." },
  { id: "purses", title: "Verify Team Purse Balances", desc: "Double-check team purse limits (e.g. 10 Lakhs, 50 Lakhs) before opening the first lot." },
  { id: "dryrun", title: "Run 2-3 Dummy Player Bids", desc: "Place sample bids with dummy test players, then click 'Reset Session' before official launch." },
  { id: "power", title: "Auctioneer Laptop Power Supply", desc: "Ensure the operator and auctioneer laptops are plugged into continuous power." },
  { id: "roster", title: "Final Player Roster Verified", desc: "Ensure all registered players are grouped into categories with their approved base prices." },
];

const CSV_SAMPLE_HEADER = "SerialNo,PlayerName,Role,Category,BasePrice,MobileNumber,Age,City";
const CSV_SAMPLE_ROWS = [
  "1,Rohit Sharma,Batsman,Platinum,100000,9876543210,32,Mumbai",
  "2,Jasprit Bumrah,Fast Bowler,Platinum,100000,9876543211,28,Ahmedabad",
  "3,Hardik Pandya,All-Rounder,Gold,75000,9876543212,29,Baroda",
  "4,Rishabh Pant,Wicket Keeper,Gold,75000,9876543213,26,Delhi",
  "5,Shubman Gill,Batsman,Silver,50000,9876543214,24,Chandigarh",
];

export const OrganiserToolkit = memo(function OrganiserToolkit() {
  const [checkedIds, setCheckedIds] = useState<Record<string, boolean>>({});
  const [copiedCsv, setCopiedCsv] = useState(false);

  function toggleCheck(id: string) {
    setCheckedIds((prev) => ({ ...prev, [id]: !prev[id] }));
  }

  function handleDownloadCsv() {
    const csvContent = [CSV_SAMPLE_HEADER, ...CSV_SAMPLE_ROWS].join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", "bidwar_player_roster_template.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  function handleCopyCsv() {
    const csvContent = [CSV_SAMPLE_HEADER, ...CSV_SAMPLE_ROWS].join("\n");
    navigator.clipboard.writeText(csvContent);
    setCopiedCsv(true);
    setTimeout(() => setCopiedCsv(false), 2000);
  }

  const checkedCount = Object.values(checkedIds).filter(Boolean).length;

  return (
    <section className="space-y-6">
      <div>
        <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-primary mb-1">
          <ShieldCheck className="h-4 w-4" />
          Free Resources & Downloads
        </div>
        <h2 className="text-xl sm:text-2xl font-black text-foreground tracking-tight">
          Tournament Organiser Toolkit
        </h2>
        <p className="text-sm text-muted-foreground mt-1 max-w-xl">
          Practical templates, checklists, and display setups used by tournament directors to run smooth IPL-style auctions.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {/* Tool 1: Auction Day Checklist */}
        <div className="flex flex-col justify-between rounded-xl border border-border/80 bg-card/30 p-5 hover:border-primary/40 hover:bg-card/50 transition-all shadow-sm">
          <div>
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-amber-500/10 text-amber-400 mb-3">
              <ClipboardCheck className="h-5 w-5" />
            </div>
            <h3 className="font-bold text-foreground text-base">Auction Day Checklist</h3>
            <p className="text-xs text-muted-foreground mt-1.5 leading-relaxed">
              8 essential sanity checks before commencing live bidding to avoid venue or tech surprises.
            </p>
          </div>

          <Dialog>
            <DialogTrigger asChild>
              <Button variant="outline" size="sm" className="mt-4 gap-1.5 w-full text-xs font-semibold">
                Open Checklist
              </Button>
            </DialogTrigger>
            <DialogContent className="max-h-[90vh] max-w-lg overflow-y-auto">
              <DialogHeader>
                <DialogTitle className="flex items-center justify-between">
                  <span>Auction Day Readiness Checklist</span>
                  <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-primary/10 text-primary">
                    {checkedCount} / {CHECKLIST_ITEMS.length} Checked
                  </span>
                </DialogTitle>
                <DialogDescription>
                  Review these checkpoints before inviting team captains to the auction floor.
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-3 pt-2">
                {CHECKLIST_ITEMS.map((item) => {
                  const isDone = !!checkedIds[item.id];
                  return (
                    <button
                      type="button"
                      key={item.id}
                      onClick={() => toggleCheck(item.id)}
                      className={`w-full flex items-start gap-3 rounded-lg border p-3 text-left transition-colors ${
                        isDone
                          ? "border-emerald-500/40 bg-emerald-500/10"
                          : "border-border/60 bg-card/40 hover:border-border"
                      }`}
                    >
                      <div className="mt-0.5">
                        {isDone ? (
                          <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                        ) : (
                          <div className="h-4 w-4 rounded border border-muted-foreground/40" />
                        )}
                      </div>
                      <div>
                        <p className={`text-xs font-bold ${isDone ? "text-emerald-300 line-through" : "text-foreground"}`}>
                          {item.title}
                        </p>
                        <p className="text-[11px] text-muted-foreground mt-0.5 leading-snug">{item.desc}</p>
                      </div>
                    </button>
                  );
                })}
              </div>
            </DialogContent>
          </Dialog>
        </div>

        {/* Tool 2: Player CSV Import Template */}
        <div className="flex flex-col justify-between rounded-xl border border-border/80 bg-card/30 p-5 hover:border-primary/40 hover:bg-card/50 transition-all shadow-sm">
          <div>
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-400 mb-3">
              <FileSpreadsheet className="h-5 w-5" />
            </div>
            <h3 className="font-bold text-foreground text-base">Player Roster Template</h3>
            <p className="text-xs text-muted-foreground mt-1.5 leading-relaxed">
              Pre-formatted Excel & CSV template ready for 1-click bulk import into your BidWar tournament.
            </p>
          </div>

          <Dialog>
            <DialogTrigger asChild>
              <Button variant="outline" size="sm" className="mt-4 gap-1.5 w-full text-xs font-semibold">
                View & Download
              </Button>
            </DialogTrigger>
            <DialogContent className="max-h-[90vh] max-w-xl overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Player Roster Excel / CSV Template</DialogTitle>
                <DialogDescription>
                  Download this structure, paste your players from Google Sheets or Excel, and import directly into BidWar.
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-4 pt-2">
                <div className="overflow-x-auto rounded-lg border border-border bg-black/40 p-3 font-mono text-[11px] text-muted-foreground">
                  <div className="text-amber-400 font-bold pb-2">{CSV_SAMPLE_HEADER}</div>
                  {CSV_SAMPLE_ROWS.map((row, idx) => (
                    <div key={`csv-row-${idx}`} className="py-0.5 border-t border-border/20">
                      {row}
                    </div>
                  ))}
                </div>

                <div className="flex flex-wrap gap-2 justify-end">
                  <Button variant="outline" size="sm" onClick={handleCopyCsv} className="gap-1.5">
                    {copiedCsv ? <Check className="h-4 w-4 text-emerald-400" /> : <Copy className="h-4 w-4" />}
                    {copiedCsv ? "Copied!" : "Copy Format"}
                  </Button>
                  <Button size="sm" onClick={handleDownloadCsv} className="gap-1.5">
                    <Download className="h-4 w-4" /> Download .CSV File
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        {/* Tool 3: Bidding Increments Guide */}
        <div className="flex flex-col justify-between rounded-xl border border-border/80 bg-card/30 p-5 hover:border-primary/40 hover:bg-card/50 transition-all shadow-sm">
          <div>
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-500/10 text-blue-400 mb-3">
              <Sliders className="h-5 w-5" />
            </div>
            <h3 className="font-bold text-foreground text-base">Bidding Increment Slabs</h3>
            <p className="text-xs text-muted-foreground mt-1.5 leading-relaxed">
              Standard bid slabs (e.g. +5k up to 1L, +10k up to 5L, +25k above) used to keep auctions lively and fair.
            </p>
          </div>

          <Dialog>
            <DialogTrigger asChild>
              <Button variant="outline" size="sm" className="mt-4 gap-1.5 w-full text-xs font-semibold">
                View Slabs Guide
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle>Recommended Bid Increment Slabs</DialogTitle>
                <DialogDescription>
                  Configure these in BidWar Tournament Settings → Auction Rules to match your purse size.
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-3 pt-2 text-xs">
                <div className="rounded-lg border border-border p-3 bg-card/40 space-y-1">
                  <div className="font-bold text-amber-300">Small Budget Leagues (Purse &lt; 5 Lakhs)</div>
                  <ul className="list-disc pl-4 text-muted-foreground space-y-0.5">
                    <li>Base price to 50k: +2,000 increments</li>
                    <li>50k to 1.5 Lakhs: +5,000 increments</li>
                    <li>Above 1.5 Lakhs: +10,000 increments</li>
                  </ul>
                </div>

                <div className="rounded-lg border border-border p-3 bg-card/40 space-y-1">
                  <div className="font-bold text-emerald-300">Medium & Franchise Leagues (Purse 10L - 50L)</div>
                  <ul className="list-disc pl-4 text-muted-foreground space-y-0.5">
                    <li>Base price to 1 Lakh: +5,000 increments</li>
                    <li>1 Lakh to 5 Lakhs: +10,000 increments</li>
                    <li>Above 5 Lakhs: +25,000 or +50,000 increments</li>
                  </ul>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        {/* Tool 4: Stage Projector Setup */}
        <div className="flex flex-col justify-between rounded-xl border border-border/80 bg-card/30 p-5 hover:border-primary/40 hover:bg-card/50 transition-all shadow-sm">
          <div>
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-purple-500/10 text-purple-400 mb-3">
              <Monitor className="h-5 w-5" />
            </div>
            <h3 className="font-bold text-foreground text-base">Stage Display Setup</h3>
            <p className="text-xs text-muted-foreground mt-1.5 leading-relaxed">
              Dual-monitor setup: operator controls on laptop, full-screen live LED graphics on stage projector.
            </p>
          </div>

          <Dialog>
            <DialogTrigger asChild>
              <Button variant="outline" size="sm" className="mt-4 gap-1.5 w-full text-xs font-semibold">
                Setup Steps
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle>Dual-Monitor Stage Display</DialogTitle>
                <DialogDescription>
                  How to broadcast real-time bids, player cards, and team purse gauges to a projector screen.
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-2.5 pt-2 text-xs text-muted-foreground">
                <div className="flex items-start gap-2.5">
                  <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary/15 text-[10px] font-bold text-primary">1</span>
                  <p><strong className="text-foreground">Connect HDMI:</strong> Plug your projector or LED wall cable into your laptop. Set display mode to <em>&quot;Extend These Displays&quot;</em> in Windows display settings.</p>
                </div>
                <div className="flex items-start gap-2.5">
                  <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary/15 text-[10px] font-bold text-primary">2</span>
                  <p><strong className="text-foreground">Open Live Stage URL:</strong> Drag your browser window to the projector monitor and navigate to your tournament&apos;s Live Viewer URL.</p>
                </div>
                <div className="flex items-start gap-2.5">
                  <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary/15 text-[10px] font-bold text-primary">3</span>
                  <p><strong className="text-foreground">Press F11:</strong> Full-screen the window. All navigation headers hide automatically, revealing cinema-grade LED graphics with automatic pulse animations.</p>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Organiser 1-on-1 Walkthrough Callout Banner */}
      <div className="relative overflow-hidden rounded-2xl border border-primary/25 bg-gradient-to-r from-primary/10 via-card/50 to-primary/5 p-6 sm:p-8">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6">
          <div className="space-y-1.5 max-w-xl">
            <span className="text-[10px] font-bold uppercase tracking-widest text-amber-400">
              Personalized Onboarding Support
            </span>
            <h3 className="text-lg sm:text-xl font-bold text-foreground">
              Want a 15-Minute Rehearsal Auction with Our Team?
            </h3>
            <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed">
              If you have an upcoming tournament and want zero stress on auction day, our team will walk you through a private demo auction with your real player categories.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3 shrink-0">
            <Button size="sm" asChild className="gap-2 font-bold shadow-md bg-emerald-600 hover:bg-emerald-700 text-white">
              <a
                href="https://wa.me/918707488250?text=Hi%20BidWar%2C%20I%20am%20organising%20a%20tournament%20auction%20and%20need%20a%20walkthrough."
                target="_blank"
                rel="noopener noreferrer"
              >
                <PhoneCall className="h-4 w-4" />
                WhatsApp (+91-8707488250)
              </a>
            </Button>
            <Button variant="outline" size="sm" asChild className="gap-1.5 border-primary/40 hover:border-primary">
              <a href="tel:+918707488250">
                <PhoneCall className="h-3.5 w-3.5 text-primary" />
                Call +91-8707488250
              </a>
            </Button>
          </div>
        </div>
      </div>
    </section>
  );
});
