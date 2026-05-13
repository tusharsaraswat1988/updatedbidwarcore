import { useState } from "react";
import { useRoute } from "wouter";
import {
  useGetTournament,
  useListCategories,
  useRegisterPlayer,
  useGetRegistrationStatus,
  getGetTournamentQueryKey,
  getListCategoriesQueryKey,
  getGetRegistrationStatusQueryKey,
} from "@workspace/api-client-react";
import { FullscreenLayout } from "@/components/layout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Trophy, CheckCircle2, User, Lock, CalendarX, Users } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

export default function PlayerRegister() {
  const [, params] = useRoute("/tournament/:id/register");
  const tournamentId = parseInt(params?.id || "0");
  const [submitted, setSubmitted] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [form, setForm] = useState({
    name: "",
    mobileNumber: "",
    city: "",
    role: "batsman",
    battingStyle: "",
    bowlingStyle: "",
    specialization: "",
    age: "",
    jerseyNumber: "",
    achievements: "",
    availabilityDates: "",
    cricheroUrl: "",
    categoryId: "",
    photoUrl: "",
  });

  const { data: tournament } = useGetTournament(tournamentId, {
    query: { queryKey: getGetTournamentQueryKey(tournamentId), enabled: !!tournamentId },
  });
  const { data: categories } = useListCategories(tournamentId, {
    query: { queryKey: getListCategoriesQueryKey(tournamentId), enabled: !!tournamentId },
  });
  const { data: status, refetch: refetchStatus } = useGetRegistrationStatus(tournamentId, {
    query: {
      queryKey: getGetRegistrationStatusQueryKey(tournamentId),
      enabled: !!tournamentId,
      refetchInterval: 30000,
    },
  });
  const registerPlayer = useRegisterPlayer();

  const isClosed = status && !status.open;
  const closedReason = status?.reason;
  const remaining = status?.limit != null ? Math.max(0, status.limit - status.currentCount) : null;

  function formatDeadline(d: string | null | undefined) {
    if (!d) return "";
    try {
      return new Date(d + "T00:00:00").toLocaleDateString("en-IN", {
        day: "numeric", month: "long", year: "numeric",
      });
    } catch { return d; }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErrorMsg(null);
    try {
      await registerPlayer.mutateAsync({
        tournamentId,
        data: {
          name: form.name,
          mobileNumber: form.mobileNumber || undefined,
          city: form.city || undefined,
          role: form.role as any,
          battingStyle: form.battingStyle || undefined,
          bowlingStyle: form.bowlingStyle || undefined,
          specialization: form.specialization || undefined,
          age: form.age ? parseInt(form.age) : undefined,
          jerseyNumber: form.jerseyNumber || undefined,
          achievements: form.achievements || undefined,
          availabilityDates: form.availabilityDates || undefined,
          cricheroUrl: form.cricheroUrl || undefined,
          categoryId: form.categoryId ? parseInt(form.categoryId) : undefined,
          photoUrl: form.photoUrl || undefined,
          basePrice: 100000,
        },
      });
      setSubmitted(true);
      refetchStatus();
    } catch (err: any) {
      const data = err?.data;
      if (data && typeof data === "object" && data.reason) {
        setErrorMsg(
          data.reason === "deadline_passed"
            ? "Registration closed: the deadline has passed."
            : "Registration closed: the player limit has been reached.",
        );
        refetchStatus();
      } else {
        setErrorMsg(err?.message || "Submission failed. Please try again.");
      }
    }
  }

  const f = (key: string, val: string) => setForm(prev => ({ ...prev, [key]: val }));

  return (
    <FullscreenLayout>
      <div className="min-h-screen bg-[#09090b] flex flex-col items-center justify-center p-4">
        <div className="w-full max-w-lg">
          {/* Header */}
          <div className="text-center mb-8">
            {tournament?.logoUrl ? (
              <img src={tournament.logoUrl} alt={tournament.name} className="h-16 w-16 object-contain mx-auto mb-4 rounded-xl" />
            ) : (
              <Trophy className="w-12 h-12 text-primary mx-auto mb-4" />
            )}
            <h1 className="text-3xl font-display font-black text-white">
              {tournament?.name || "BidWar"}
            </h1>
            <p className="text-muted-foreground mt-1">Player Registration</p>
          </div>

          <AnimatePresence mode="wait">
            {isClosed ? (
              <motion.div key="closed" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
                <Card className="border-destructive/40 bg-destructive/10">
                  <CardContent className="p-10 text-center">
                    {closedReason === "deadline_passed" ? (
                      <CalendarX className="w-16 h-16 text-destructive mx-auto mb-4" />
                    ) : (
                      <Lock className="w-16 h-16 text-destructive mx-auto mb-4" />
                    )}
                    <h2 className="text-2xl font-bold text-destructive mb-2">Registration Closed</h2>
                    <p className="text-muted-foreground">
                      {closedReason === "deadline_passed"
                        ? <>The registration window closed on <span className="font-semibold text-foreground">{formatDeadline(status?.deadline)}</span>.</>
                        : <>This tournament has reached its limit of <span className="font-semibold text-foreground">{status?.limit}</span> registered players.</>}
                    </p>
                    <p className="text-xs text-muted-foreground mt-4">
                      Please contact the tournament organizer for more details.
                    </p>
                  </CardContent>
                </Card>
              </motion.div>
            ) : submitted ? (
              <motion.div
                key="success"
                initial={{ scale: 0.8, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                className="text-center"
              >
                <Card className="border-green-500/40 bg-green-500/10">
                  <CardContent className="p-10">
                    <CheckCircle2 className="w-16 h-16 text-green-400 mx-auto mb-4" />
                    <h2 className="text-2xl font-bold text-green-400 mb-2">Registration Successful!</h2>
                    <p className="text-muted-foreground">
                      Your registration has been received. The organizer will contact you with further details.
                    </p>
                    <Button
                      className="mt-6"
                      variant="outline"
                      onClick={() => { setSubmitted(false); setErrorMsg(null); setForm({ name: "", mobileNumber: "", city: "", role: "batsman", battingStyle: "", bowlingStyle: "", specialization: "", age: "", jerseyNumber: "", achievements: "", availabilityDates: "", cricheroUrl: "", categoryId: "", photoUrl: "" }); }}
                    >
                      Register Another Player
                    </Button>
                  </CardContent>
                </Card>
              </motion.div>
            ) : (
              <motion.div key="form" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
                {/* Status banner: deadline + slots remaining */}
                {status && (status.deadline || status.limit != null) && (
                  <div className="mb-4 flex flex-wrap items-center justify-center gap-3 text-xs">
                    {status.deadline && (
                      <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-amber-500/15 border border-amber-500/30 text-amber-300">
                        <CalendarX className="w-3.5 h-3.5" /> Closes on {formatDeadline(status.deadline)}
                      </span>
                    )}
                    {status.limit != null && (
                      <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-blue-500/15 border border-blue-500/30 text-blue-300">
                        <Users className="w-3.5 h-3.5" /> {remaining} of {status.limit} slots left
                      </span>
                    )}
                  </div>
                )}

                <Card className="border-border">
                  <CardContent className="p-6">
                    <form onSubmit={handleSubmit} className="space-y-5">
                      <div className="flex items-center gap-2 mb-2">
                        <User className="w-5 h-5 text-primary" />
                        <h2 className="font-bold text-lg">Your Details</h2>
                      </div>

                      {errorMsg && (
                        <div className="p-3 rounded-md border border-destructive/40 bg-destructive/10 text-sm text-destructive">
                          {errorMsg}
                        </div>
                      )}

                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2 col-span-2">
                          <Label>Full Name *</Label>
                          <Input required value={form.name} onChange={e => f("name", e.target.value)} placeholder="Your full name" />
                        </div>
                        <div className="space-y-2">
                          <Label>Mobile Number *</Label>
                          <Input required value={form.mobileNumber} onChange={e => f("mobileNumber", e.target.value)} placeholder="+91 98765 43210" type="tel" />
                        </div>
                        <div className="space-y-2">
                          <Label>City</Label>
                          <Input value={form.city} onChange={e => f("city", e.target.value)} placeholder="Mumbai" />
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label>Role *</Label>
                          <Select value={form.role} onValueChange={v => f("role", v)}>
                            <SelectTrigger><SelectValue /></SelectTrigger>
                            <SelectContent className="dark">
                              {["batsman","bowler","all-rounder","wicketkeeper","midfielder","forward","defender","goalkeeper","other"].map(r => (
                                <SelectItem key={r} value={r} className="capitalize">{r}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-2">
                          <Label>Age</Label>
                          <Input type="number" value={form.age} onChange={e => f("age", e.target.value)} placeholder="25" />
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label>Batting Style</Label>
                          <Input value={form.battingStyle} onChange={e => f("battingStyle", e.target.value)} placeholder="Right-hand bat" />
                        </div>
                        <div className="space-y-2">
                          <Label>Bowling Style</Label>
                          <Input value={form.bowlingStyle} onChange={e => f("bowlingStyle", e.target.value)} placeholder="Right-arm fast" />
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label>Specialization</Label>
                          <Input value={form.specialization} onChange={e => f("specialization", e.target.value)} placeholder="Power hitter" />
                        </div>
                        <div className="space-y-2">
                          <Label>Jersey Number</Label>
                          <Input value={form.jerseyNumber} onChange={e => f("jerseyNumber", e.target.value)} placeholder="7" />
                        </div>
                      </div>

                      <div className="space-y-2">
                        <Label>Availability Dates</Label>
                        <Input value={form.availabilityDates} onChange={e => f("availabilityDates", e.target.value)} placeholder="18, 19, 20 March 2025" />
                      </div>

                      <div className="space-y-2">
                        <Label>Achievements / Bio</Label>
                        <Input value={form.achievements} onChange={e => f("achievements", e.target.value)} placeholder="Player of Season 2024, 500+ runs..." />
                      </div>

                      <div className="space-y-2">
                        <Label>Crichero Profile URL</Label>
                        <Input value={form.cricheroUrl} onChange={e => f("cricheroUrl", e.target.value)} placeholder="https://crichero.com/player/..." />
                      </div>

                      <div className="space-y-2">
                        <Label>Photo URL (optional)</Label>
                        <Input value={form.photoUrl} onChange={e => f("photoUrl", e.target.value)} placeholder="https://..." />
                      </div>

                      {categories && categories.length > 0 && (
                        <div className="space-y-2">
                          <Label>Preferred Category</Label>
                          <Select value={form.categoryId} onValueChange={v => f("categoryId", v)}>
                            <SelectTrigger><SelectValue placeholder="Select category (optional)" /></SelectTrigger>
                            <SelectContent className="dark">
                              {categories.map(c => (
                                <SelectItem key={c.id} value={String(c.id)}>{c.name}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      )}

                      <Button
                        type="submit"
                        size="lg"
                        className="w-full h-12 text-base font-bold"
                        disabled={registerPlayer.isPending}
                      >
                        {registerPlayer.isPending ? "Submitting..." : "Submit Registration"}
                      </Button>
                    </form>
                  </CardContent>
                </Card>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </FullscreenLayout>
  );
}
