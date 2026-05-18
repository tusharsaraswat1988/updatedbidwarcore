import { useState, useEffect, useRef } from "react";
import { useRoute } from "wouter";
import {
  useGetTournament,
  useListCategories,
  useRegisterPlayer,
  useGetRegistrationStatus,
  getGetTournamentQueryKey,
  getListCategoriesQueryKey,
  getGetRegistrationStatusQueryKey,
  PlayerInputRole,
} from "@workspace/api-client-react";
import { FullscreenLayout } from "@/components/layout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Trophy, CheckCircle2, User, Lock, CalendarX, Users, MessageSquare, Search, Loader2 } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

// ─── Types ────────────────────────────────────────────────────────────────────
interface SportRole { id: number; sportId: number; roleName: string; displayOrder: number; }
interface SpecOption { id: number; groupId: number; optionName: string; displayOrder: number; }
interface SpecGroup { id: number; roleId: number; groupName: string; displayOrder: number; optional: boolean; options: SpecOption[]; }
interface GlobalPlayer { id: string; canonicalName: string; mobileNumber: string | null; city: string | null; age: number | null; photoUrl: string | null; }

// ─── Hooks ────────────────────────────────────────────────────────────────────
function useSportRoles(sportSlug: string | undefined) {
  const [roles, setRoles] = useState<SportRole[]>([]);
  useEffect(() => {
    if (!sportSlug) return;
    fetch(`/api/sports/by-slug/${encodeURIComponent(sportSlug)}/roles`)
      .then(r => r.json())
      .then((d: SportRole[]) => setRoles(d))
      .catch(() => {});
  }, [sportSlug]);
  return roles;
}

function useRoleSpecs(roleId: number | undefined) {
  const [specs, setSpecs] = useState<SpecGroup[]>([]);
  useEffect(() => {
    if (!roleId) { setSpecs([]); return; }
    fetch(`/api/sports/roles/${roleId}/specs`)
      .then(r => r.json())
      .then((d: SpecGroup[]) => setSpecs(d))
      .catch(() => {});
  }, [roleId]);
  return specs;
}

export default function PlayerRegister() {
  const [, params] = useRoute("/tournament/:id/register");
  const tournamentId = parseInt(params?.id || "0");
  const [submitted, setSubmitted] = useState(false);
  const [waConsent, setWaConsent] = useState(false);
  const [waLink, setWaLink] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Mobile lookup state (Phase 5)
  const [mobileLookedUp, setMobileLookedUp] = useState(false);
  const [lookupLoading, setLookupLoading] = useState(false);
  const [foundProfile, setFoundProfile] = useState<GlobalPlayer | null>(null);
  const mobileDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [form, setForm] = useState({
    name: "",
    mobileNumber: "",
    city: "",
    role: "",
    age: "",
    jerseyNumber: "",
    achievements: "",
    availabilityDates: "",
    cricheroUrl: "",
    categoryId: "",
    photoUrl: "",
    specialization: "",
  });

  // Spec group selections: groupId → chosen optionName
  const [specSelections, setSpecSelections] = useState<Record<number, string>>({});

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

  // Dynamic roles from sport master table
  const sportSlug = (tournament as { sport?: string } | undefined)?.sport;
  const roles = useSportRoles(sportSlug);

  // Set default role once roles load
  useEffect(() => {
    if (roles.length > 0 && !form.role) {
      setForm(prev => ({ ...prev, role: roles[0].roleName }));
    }
  }, [roles]);

  // Spec groups for selected role
  const selectedRole = roles.find(r => r.roleName === form.role);
  const specs = useRoleSpecs(selectedRole?.id);

  // Reset spec selections when role changes
  useEffect(() => { setSpecSelections({}); }, [form.role]);

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

  useEffect(() => {
    void fetch("/api/consent/wa-link").then(r => r.json()).then((d: { link?: string | null }) => {
      if (d.link) setWaLink(d.link);
    }).catch(() => {});
  }, []);

  // Mobile number lookup with debounce
  function handleMobileChange(val: string) {
    f("mobileNumber", val);
    setMobileLookedUp(false);
    setFoundProfile(null);
    if (mobileDebounceRef.current) clearTimeout(mobileDebounceRef.current);
    if (val.replace(/\D/g, "").length >= 10) {
      mobileDebounceRef.current = setTimeout(async () => {
        setLookupLoading(true);
        try {
          const res = await fetch(`/api/global-players/search?q=${encodeURIComponent(val)}&limit=1`);
          const data: GlobalPlayer[] = await res.json();
          const match = Array.isArray(data)
            ? data.find(p => p.mobileNumber && p.mobileNumber.replace(/\D/g, "") === val.replace(/\D/g, ""))
            : undefined;
          if (match) {
            setFoundProfile(match);
            setForm(prev => ({
              ...prev,
              name: prev.name || match.canonicalName,
              city: prev.city || (match.city ?? ""),
              age: prev.age || (match.age ? String(match.age) : ""),
              photoUrl: prev.photoUrl || (match.photoUrl ?? ""),
            }));
          }
        } catch { /* ignore */ } finally {
          setLookupLoading(false);
          setMobileLookedUp(true);
        }
      }, 600);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.mobileNumber.trim()) {
      setErrorMsg("Mobile number is required.");
      return;
    }
    setErrorMsg(null);

    // Serialize spec selections into existing style fields (up to 3 groups)
    const sortedSpecs = [...specs].sort((a, b) => a.displayOrder - b.displayOrder);
    const battingStyle = sortedSpecs[0] ? (specSelections[sortedSpecs[0].id] ?? form.role) : undefined;
    const bowlingStyle = sortedSpecs[1] ? (specSelections[sortedSpecs[1].id] ?? undefined) : undefined;
    const specialization = sortedSpecs[2] ? (specSelections[sortedSpecs[2].id] ?? form.specialization ?? undefined) : (form.specialization || undefined);

    try {
      await registerPlayer.mutateAsync({
        tournamentId,
        data: {
          name: form.name,
          mobileNumber: form.mobileNumber.trim(),
          city: form.city || undefined,
          role: form.role as PlayerInputRole,
          battingStyle: battingStyle || undefined,
          bowlingStyle: bowlingStyle || undefined,
          specialization: specialization || undefined,
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
            {(tournament as { logoUrl?: string | null } | undefined)?.logoUrl ? (
              <img src={(tournament as { logoUrl?: string | null }).logoUrl!} alt={tournament?.name} className="h-16 w-16 object-contain mx-auto mb-4 rounded-xl" />
            ) : (
              <Trophy className="w-12 h-12 text-primary mx-auto mb-4" />
            )}
            <h1 className="text-3xl font-display font-black text-white">
              {tournament?.name || "BidWar"}
            </h1>
            <p className="text-muted-foreground mt-1">Player Registration</p>
            {(tournament as { auctionCode?: string | null } | undefined)?.auctionCode && (
              <p className="text-xs font-mono text-amber-400 mt-1">
                Code: {(tournament as { auctionCode?: string | null }).auctionCode}
              </p>
            )}
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
                    {waConsent && waLink && (
                      <div className="mt-6 p-4 rounded-xl border border-green-500/30 bg-green-500/8 text-sm space-y-3">
                        <p className="font-semibold text-green-300">WhatsApp updates activate karein</p>
                        <p className="text-xs text-muted-foreground">Tap the button below to send "hello" on WhatsApp — the bot will confirm your subscription.</p>
                        <a
                          href={waLink}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center justify-center gap-2 w-full py-3 rounded-xl bg-[#25D366] text-white font-bold text-sm hover:bg-[#1da851] transition-colors"
                        >
                          <MessageSquare className="w-4 h-4" /> Subscribe on WhatsApp
                        </a>
                      </div>
                    )}
                    <Button
                      className="mt-4"
                      variant="outline"
                      onClick={() => {
                        setSubmitted(false); setWaConsent(false); setErrorMsg(null);
                        setFoundProfile(null); setMobileLookedUp(false);
                        setForm({ name: "", mobileNumber: "", city: "", role: roles[0]?.roleName ?? "", age: "", jerseyNumber: "", achievements: "", availabilityDates: "", cricheroUrl: "", categoryId: "", photoUrl: "", specialization: "" });
                        setSpecSelections({});
                      }}
                    >
                      Register Another Player
                    </Button>
                  </CardContent>
                </Card>
              </motion.div>
            ) : (
              <motion.div key="form" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
                {/* Status banner */}
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

                      {/* Mobile first — triggers global player lookup */}
                      <div className="space-y-2">
                        <Label>Mobile Number *</Label>
                        <div className="relative">
                          <Input
                            required
                            value={form.mobileNumber}
                            onChange={e => handleMobileChange(e.target.value)}
                            placeholder="+91 98765 43210"
                            type="tel"
                            className="pr-8"
                          />
                          {lookupLoading && (
                            <Loader2 className="absolute right-2.5 top-2.5 w-4 h-4 animate-spin text-muted-foreground" />
                          )}
                          {!lookupLoading && mobileLookedUp && (
                            <Search className={`absolute right-2.5 top-2.5 w-4 h-4 ${foundProfile ? "text-green-500" : "text-muted-foreground"}`} />
                          )}
                        </div>
                        {foundProfile && (
                          <p className="text-xs text-green-400">
                            Profile found — details pre-filled from your previous registration.
                          </p>
                        )}
                      </div>

                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2 col-span-2">
                          <Label>Full Name *</Label>
                          <Input required value={form.name} onChange={e => f("name", e.target.value)} placeholder="Your full name" />
                        </div>
                        <div className="space-y-2">
                          <Label>City</Label>
                          <Input value={form.city} onChange={e => f("city", e.target.value)} placeholder="Mumbai" />
                        </div>
                        <div className="space-y-2">
                          <Label>Age</Label>
                          <Input type="number" value={form.age} onChange={e => f("age", e.target.value)} placeholder="25" />
                        </div>
                      </div>

                      {/* Dynamic role dropdown */}
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label>Role *</Label>
                          <Select value={form.role} onValueChange={v => f("role", v)}>
                            <SelectTrigger><SelectValue placeholder="Select role" /></SelectTrigger>
                            <SelectContent className="dark">
                              {roles.length > 0
                                ? roles.map(r => (
                                    <SelectItem key={r.id} value={r.roleName}>{r.roleName}</SelectItem>
                                  ))
                                : (
                                  // Fallback while loading
                                  ["Batsman","Bowler","All-Rounder","Wicketkeeper","Player"].map(r => (
                                    <SelectItem key={r} value={r}>{r}</SelectItem>
                                  ))
                                )
                              }
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-2">
                          <Label>Jersey Number</Label>
                          <Input value={form.jerseyNumber} onChange={e => f("jerseyNumber", e.target.value)} placeholder="7" />
                        </div>
                      </div>

                      {/* Dynamic spec groups (Phase 4) */}
                      {specs.length > 0 && (
                        <div className="space-y-3 p-4 rounded-lg border border-border bg-muted/20">
                          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                            {form.role} Specifications
                          </p>
                          {specs.map(group => (
                            <div key={group.id} className="space-y-1.5">
                              <Label className="text-sm">
                                {group.groupName}
                                {!group.optional && <span className="text-destructive ml-0.5">*</span>}
                              </Label>
                              <Select
                                value={specSelections[group.id] ?? ""}
                                onValueChange={v => setSpecSelections(prev => ({ ...prev, [group.id]: v }))}
                              >
                                <SelectTrigger>
                                  <SelectValue placeholder={`Select ${group.groupName}`} />
                                </SelectTrigger>
                                <SelectContent className="dark">
                                  {group.options.map(opt => (
                                    <SelectItem key={opt.id} value={opt.optionName}>
                                      {opt.optionName}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </div>
                          ))}
                        </div>
                      )}

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

                      {/* WhatsApp consent */}
                      <div className="space-y-2">
                        <label className="flex items-start gap-3 cursor-pointer group">
                          <input
                            type="checkbox"
                            checked={waConsent}
                            onChange={e => setWaConsent(e.target.checked)}
                            className="mt-1 h-4 w-4 rounded border-border accent-primary cursor-pointer"
                          />
                          <span className="text-xs text-muted-foreground group-hover:text-foreground transition-colors leading-relaxed">
                            Main tournament ke WhatsApp updates chahiye? (auction alerts, schedule, results). STOP reply karke kabhi bhi unsubscribe kar sakte hain.
                          </span>
                        </label>
                        {waLink && (
                          <a
                            href={waLink}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-2 text-xs font-medium text-primary hover:underline pl-7"
                          >
                            WhatsApp pe subscribe karein (optional)
                          </a>
                        )}
                      </div>

                      <Button
                        type="submit"
                        size="lg"
                        className="w-full h-12 text-base font-bold"
                        disabled={registerPlayer.isPending}
                      >
                        {registerPlayer.isPending ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Submitting...</> : "Submit Registration"}
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
