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
import { ArrowLeft, Loader2, Hash } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const formSchema = z.object({
  name: z.string().min(3, "Name must be at least 3 characters"),
  sport: z.string().min(1, "Select a sport"),
  venue: z.string().optional(),
  auctionDate: z.string().optional(),
  organizerName: z.string().optional(),
  basePurse: z.coerce.number().min(0).optional(),
  minBid: z.coerce.number().min(0).optional(),
  bidIncrement: z.coerce.number().min(0).optional(),
  timerSeconds: z.coerce.number().min(5).max(120).optional(),
  minimumSquadSize: z.coerce.number().min(0).max(100).optional(),
  maximumSquadSize: z.coerce.number().min(0).max(100).optional(),
});

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

// Fetch sports list from API for the dropdown
function useSportsList() {
  const [sports, setSports] = useState<{ id: number; name: string; slug: string }[]>([]);
  useEffect(() => {
    fetch("/api/sports")
      .then(r => r.json())
      .then((data: { id: number; name: string; slug: string }[]) => setSports(data))
      .catch(() => {});
  }, []);
  return sports;
}

export default function NewTournament() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const createTournament = useCreateTournament();
  const sports = useSportsList();

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: "",
      sport: "cricket",
      venue: "",
      auctionDate: "",
      organizerName: "",
      basePurse: 10000000,
      minBid: 10000,
      bidIncrement: 5000,
      timerSeconds: 15,
      minimumSquadSize: 0,
      maximumSquadSize: 0,
    },
  });

  const watchedName = form.watch("name");
  const watchedDate = form.watch("auctionDate");
  const codePreview = previewAuctionCode(watchedName, watchedDate ?? "");

  function onSubmit(values: z.infer<typeof formSchema>) {
    createTournament.mutate(
      { data: values },
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
                          <Select onValueChange={field.onChange} value={field.value}>
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder="Select a sport" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              {sports.length > 0
                                ? sports.map(s => (
                                    <SelectItem key={s.slug} value={s.slug}>{s.name}</SelectItem>
                                  ))
                                : (
                                  <>
                                    <SelectItem value="cricket">Cricket</SelectItem>
                                    <SelectItem value="football">Football</SelectItem>
                                    <SelectItem value="kabaddi">Kabaddi</SelectItem>
                                    <SelectItem value="badminton">Badminton</SelectItem>
                                    <SelectItem value="volleyball">Volleyball</SelectItem>
                                    <SelectItem value="esports">E-Sports</SelectItem>
                                    <SelectItem value="other">Other</SelectItem>
                                  </>
                                )
                              }
                            </SelectContent>
                          </Select>
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
                            <Input type="date" {...field} />
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
                  <div className="grid grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="basePurse"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Total Points Per Team (₹)</FormLabel>
                          <FormControl>
                            <Input type="number" {...field} />
                          </FormControl>
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
                          <FormLabel>Min Value of a Player (₹)</FormLabel>
                          <FormControl>
                            <Input type="number" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="bidIncrement"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Default Bid Increment (₹)</FormLabel>
                          <FormControl>
                            <Input type="number" {...field} />
                          </FormControl>
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
