import { useLocation } from "wouter";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { useState, useEffect } from "react";
import { useCreateTournament } from "@workspace/api-client-react";
import { AppLayout } from "@/components/layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { ArrowLeft, Loader2, Hash, Info, X, CalendarDays } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { DatePicker } from "@/components/ui/date-picker";
import { useToast } from "@/hooks/use-toast";
import { SportSelect } from "@/components/sport-select";
import { IndianAmountHint } from "@/components/ui/indian-amount-hint";
import { AUCTION_UNIT_OPTIONS, budgetFieldLabel, minValueFieldLabel, bidIncrementFieldLabel, normalizeAuctionUnit } from "@/lib/format";

const formSchema = z.object({
  name: z.string().min(3, "Name must be at least 3 characters"),
  sport: z.string().min(1, "Select a sport"),
  auctionUnit: z.enum(["rupee", "points"]).default("rupee"),
  venue: z.string().optional(),
  auctionDate: z.string().optional(),
  auctionTime: z.string().optional(),
  organizerName: z.string().optional(),
  basePurse: z.coerce.number().min(0).optional(),
  minBid: z.coerce.number().min(0).optional(),
  bidIncrement: z.coerce.number().min(0).optional(),
  timerSeconds: z.coerce.number().min(5).max(120).optional(),
  minimumSquadSize: z.coerce.number().min(0).max(100).optional(),
  maximumSquadSize: z.coerce.number().min(0).max(100).optional(),
});

function formatMatchDate(iso: string): string {
  const d = new Date(iso + "T00:00:00");
  return d.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
}

// Client-side preview only — server generates the real unique code
function previewAuctionCode(name: string, date: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return "--------";
  const tt = words.length >= 2
    ? (words[0][0] + words[1][0]).toUpperCase()
    : words[0].substring(0, 2).toUpperCase();
  const nn = "XX";
  if (!date) return `${tt}${nn}----`;
  const d = new Date(date);
  if (isNaN(d.getTime())) return `${tt}${nn}----`;
  const dd = String(d.getUTCDate()).padStart(2, "0");
  const mm = String(d.getUTCMonth() + 1).padStart(2, "0");
  return `${tt}${nn}${dd}${mm}`;
}

export default function NewTournament() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const createTournament = useCreateTournament();
  const [matchDatesArr, setMatchDatesArr] = useState<string[]>([]);
  const [datePickerVal, setDatePickerVal] = useState("");

  function addMatchDate() {
    if (!datePickerVal || matchDatesArr.includes(datePickerVal)) return;
    setMatchDatesArr(prev => [...prev, datePickerVal].sort());
    setDatePickerVal("");
  }
  function removeMatchDate(d: string) {
    setMatchDatesArr(prev => prev.filter(x => x !== d));
  }

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: "",
      sport: "cricket",
      venue: "",
      auctionDate: "",
      auctionTime: "",
      organizerName: "",
      auctionUnit: "rupee" as const,
      basePurse: 10000000,
      minBid: 10000,
      bidIncrement: 5000,
      timerSeconds: 10,
      minimumSquadSize: 0,
      maximumSquadSize: 0,
    },
  });

  const watchedName = form.watch("name");
  const watchedDate = form.watch("auctionDate");
  const codePreview = previewAuctionCode(watchedName, watchedDate ?? "");

  function onSubmit(values: z.infer<typeof formSchema>) {
    createTournament.mutate(
      { data: { ...values, matchDates: matchDatesArr.length > 0 ? matchDatesArr.join(",") : undefined } },
      {
        onSuccess: (data) => {
          toast({
            title: "Tournament created",
            description: `Auction code: ${(data as { auctionCode?: string | null }).auctionCode ?? "—"}`,
          });
          setLocation(`/tournament/${data.id}`);
        },
        onError: () => {
          toast({
            title: "Error",
            description: "Failed to create tournament.",
            variant: "destructive",
          });
        },
      }
    );
  }

  return (
    <AppLayout>
      <div className="max-w-2xl mx-auto space-y-6">
        <Button variant="ghost" onClick={() => setLocation("/")} className="gap-2">
          <ArrowLeft className="w-4 h-4" />
          Back to Dashboard
        </Button>

        <Card>
          <CardHeader>
            <CardTitle className="text-2xl">Create New Tournament</CardTitle>
            <CardDescription>Set up the core parameters for your auction event.</CardDescription>
          </CardHeader>
          <CardContent>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                <div className="space-y-4">
                  <FormField
                    control={form.control}
                    name="name"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Tournament Name</FormLabel>
                        <FormControl>
                          <Input placeholder="e.g. Rotary Cricket League" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  {/* Auction Code Preview */}
                  <div className="space-y-2">
                    <label className="text-sm font-medium flex items-center gap-1.5">
                      <Hash className="w-3.5 h-3.5 text-amber-400" />
                      Auction Code (auto-generated)
                    </label>
                    <div className="flex items-center gap-2">
                      <Input
                        readOnly
                        value={codePreview}
                        className="font-mono tracking-widest text-amber-400 bg-amber-500/5 border-amber-500/30 cursor-not-allowed w-40"
                      />
                      <p className="text-xs text-muted-foreground">
                        Preview — final code assigned on create
                      </p>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="sport"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Sport</FormLabel>
                          <FormControl>
                            <SportSelect
                              value={field.value}
                              onValueChange={field.onChange}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="auctionDate"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Auction Date</FormLabel>
                          <FormControl>
                            <DatePicker
                              value={field.value ?? ""}
                              onChange={field.onChange}
                              placeholder="Select auction date"
                              disablePastDates
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="auctionTime"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Auction Time</FormLabel>
                          <FormControl>
                            <Input type="time" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="venue"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Venue (Optional)</FormLabel>
                          <FormControl>
                            <Input placeholder="e.g. Grand Hotel, Mumbai" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="organizerName"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Organizer (Optional)</FormLabel>
                          <FormControl>
                            <Input placeholder="Your organization name" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                </div>

                <div className="space-y-4 pt-4 border-t border-border">
                  <h3 className="text-lg font-medium">Financial Rules</h3>
                  <FormField
                    control={form.control}
                    name="auctionUnit"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Units</FormLabel>
                        <Select value={field.value} onValueChange={field.onChange}>
                          <FormControl>
                            <SelectTrigger><SelectValue /></SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {AUCTION_UNIT_OPTIONS.map((option) => (
                              <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <div className="grid grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="basePurse"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>{budgetFieldLabel(normalizeAuctionUnit(form.watch("auctionUnit")))}</FormLabel>
                          <FormControl>
                            <Input type="number" {...field} />
                          </FormControl>
                          <IndianAmountHint value={field.value} unit={normalizeAuctionUnit(form.watch("auctionUnit"))} />
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="timerSeconds"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Bid Timer (seconds)</FormLabel>
                          <FormControl>
                            <Input type="number" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="minBid"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>{minValueFieldLabel(normalizeAuctionUnit(form.watch("auctionUnit")))}</FormLabel>
                          <FormControl>
                            <Input type="number" {...field} />
                          </FormControl>
                          <IndianAmountHint value={field.value} />
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="bidIncrement"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>{bidIncrementFieldLabel(normalizeAuctionUnit(form.watch("auctionUnit")))}</FormLabel>
                          <FormControl>
                            <Input type="number" {...field} />
                          </FormControl>
                          <IndianAmountHint value={field.value} />
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                </div>

                <div className="space-y-4 pt-4 border-t border-border">
                  <div>
                    <h3 className="text-lg font-medium">Squad Rules</h3>
                    <p className="text-sm text-muted-foreground mt-0.5">
                      Control team size limits and reserve purse protection. Set 0 to disable.
                    </p>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="minimumSquadSize"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Minimum Squad Size</FormLabel>
                          <FormControl>
                            <Input type="number" min={0} max={100} {...field} />
                          </FormControl>
                          <p className="text-xs text-muted-foreground mt-1">
                            Reserve purse is held back for each unfilled slot.
                          </p>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="maximumSquadSize"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Maximum Squad Size</FormLabel>
                          <FormControl>
                            <Input type="number" min={0} max={100} {...field} />
                          </FormControl>
                          <p className="text-xs text-muted-foreground mt-1">
                            Hard cap — teams cannot bid once they reach this limit.
                          </p>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                </div>

                <div className="space-y-4 pt-4 border-t border-border">
                  <div>
                    <h3 className="text-lg font-medium flex items-center gap-2">
                      <CalendarDays className="w-4 h-4 text-amber-400" />
                      Match Schedule
                      <Badge variant="outline" className="text-xs font-normal">Optional</Badge>
                    </h3>
                    <p className="text-sm text-muted-foreground mt-1.5 flex items-start gap-2">
                      <Info className="w-4 h-4 mt-0.5 shrink-0 text-blue-400" />
                      Add the dates when matches will be played. When set, player availability will be collected as per-match-day checkboxes instead of a free-text field — making it easy to know which players are available on which day. Leave empty to hide availability from all forms.
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <Input
                      type="date"
                      value={datePickerVal}
                      onChange={e => setDatePickerVal(e.target.value)}
                      className="w-auto"
                      onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); addMatchDate(); } }}
                    />
                    <Button type="button" variant="outline" onClick={addMatchDate} disabled={!datePickerVal}>
                      Add Date
                    </Button>
                  </div>
                  {matchDatesArr.length > 0 && (
                    <div className="flex flex-wrap gap-2">
                      {matchDatesArr.map(d => (
                        <Badge key={d} variant="secondary" className="gap-1.5 pr-1.5 text-sm">
                          {formatMatchDate(d)}
                          <button type="button" onClick={() => removeMatchDate(d)} className="ml-0.5 hover:text-destructive rounded-sm">
                            <X className="w-3 h-3" />
                          </button>
                        </Badge>
                      ))}
                    </div>
                  )}
                </div>

                <Button type="submit" className="w-full" disabled={createTournament.isPending}>
                  {createTournament.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Create Tournament
                </Button>
              </form>
            </Form>
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}
