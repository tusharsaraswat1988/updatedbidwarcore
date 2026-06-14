import { useState, useEffect, useRef } from "react";
import { useRoute } from "wouter";
import { useBranding } from "@/hooks/use-branding";
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
import { Trophy, CheckCircle2, User, Lock, CalendarX, Users, MessageSquare, Search, Loader2, CalendarDays, Upload, Pencil, X } from "lucide-react";
import { ImageEditorDialog } from "@/components/image-editor-dialog";
import { motion, AnimatePresence } from "framer-motion";
import { parseIndianMobile, sanitizeMobileInput } from "@workspace/api-base/mobile";
import { parseOptionalEmail } from "@workspace/api-base/email";
import { OptionalEmailField } from "@/components/optional-email-field";
import { PlayerGenderSelect } from "@/components/player-gender-select";

// ─── Types ────────────────────────────────────────────────────────────────────
interface SportRole { id: number; sportId: number; roleName: string; displayOrder: number; }
interface SpecOption { id: number; groupId: number; optionName: string; displayOrder: number; }
interface SpecGroup { id: number; roleId: number; groupName: string; displayOrder: number; optional: boolean; options: SpecOption[]; }
interface GlobalPlayerLookup {
  id: number;
  name: string;
  mobileNumber: string | null;
  city: string | null;
  age: number | null;
  gender?: string | null;
  role: string | null;
  photoUrl: string | null;
  battingStyle: string | null;
  bowlingStyle: string | null;
  specialization: string | null;
  jerseyNumber?: string | null;
  achievements?: string | null;
  cricheroUrl?: string | null;
  appearanceCount?: number;
}

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
  const { brandName, poweredByText, logos } = useBranding();
  const [submitted, setSubmitted] = useState(false);
  const [waConsent, setWaConsent] = useState(false);
  const [waLink, setWaLink] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [emailError, setEmailError] = useState("");

  // Mobile lookup state (Phase 5)
  const [mobileLookedUp, setMobileLookedUp] = useState(false);
  const [lookupLoading, setLookupLoading] = useState(false);
  const [foundProfile, setFoundProfile] = useState<GlobalPlayerLookup | null>(null);
  const [photoEditorOpen, setPhotoEditorOpen] = useState(false);
  const mobileDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [form, setForm] = useState({
    name: "",
    mobileNumber: "",
    email: "",
    city: "",
    role: "",
    age: "",
    gender: "",
    jerseyNumber: "",
    achievements: "",
    availabilityDates: "",
    cricheroUrl: "",
    categoryId: "",
    photoUrl: "",
    battingStyle: "",
    bowlingStyle: "",
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

  // Default availability to all match dates when schedule exists
  useEffect(() => {
    const matchDates = (tournament as { matchDates?: string | null } | undefined)?.matchDates;
    if (matchDates) {
      setForm(prev => ({
        ...prev,
        availabilityDates: prev.availabilityDates || matchDates,
      }));
    }
  }, [(tournament as { matchDates?: string | null } | undefined)?.matchDates]);

  // Spec groups for selected role
  const selectedRole = roles.find(r => r.roleName === form.role);
  const specs = useRoleSpecs(selectedRole?.id);

  // Reset spec selections when role changes
  useEffect(() => { setSpecSelections({}); }, [form.role]);

  // Pre-fill dynamic spec group selections from previously-stored values
  // Maps battingStyle→group[0], bowlingStyle→group[1], specialization→group[2]
  useEffect(() => {
    if (!foundProfile || specs.length === 0) return;
    const previousValues = [
      foundProfile.battingStyle,
      foundProfile.bowlingStyle,
      foundProfile.specialization,
    ];
    const sortedGroups = [...specs].sort((a, b) => a.displayOrder - b.displayOrder);
    setSpecSelections(prev => {
      const next = { ...prev };
      sortedGroups.forEach((group, idx) => {
        if (idx >= previousValues.length) return;
        const prev_val = previousValues[idx];
        if (!prev_val) return;
        // Only pre-fill if not already chosen and the option exists in this group
        if (next[group.id]) return;
        const matchingOption = group.options.find(
          opt => opt.optionName.toLowerCase() === prev_val.toLowerCase(),
        );
        if (matchingOption) {
          next[group.id] = matchingOption.optionName;
        }
      });
      return next;
    });
  }, [specs, foundProfile]);

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
    const sanitized = sanitizeMobileInput(val);
    f("mobileNumber", sanitized);
    setMobileLookedUp(false);
    setFoundProfile(null);
    if (mobileDebounceRef.current) clearTimeout(mobileDebounceRef.current);
    if (sanitized.length >= 10) {
      mobileDebounceRef.current = setTimeout(async () => {
        setLookupLoading(true);
        try {
          const res = await fetch(`/api/global-players/search?q=${encodeURIComponent(sanitized)}&limit=1`);
          const data: GlobalPlayerLookup[] = await res.json();
          const match = Array.isArray(data)
            ? data.find(p => p.mobileNumber && p.mobileNumber.replace(/\D/g, "") === sanitized)
            : undefined;
          if (match) {
            setFoundProfile(match);
            setForm(prev => ({
              ...prev,
              name: prev.name || match.name,
              city: prev.city || (match.city ?? ""),
              age: prev.age || (match.age ? String(match.age) : ""),
              gender: prev.gender || (match.gender ?? ""),
              role: prev.role || (match.role ?? ""),
              photoUrl: prev.photoUrl || (match.photoUrl ?? ""),
              battingStyle: prev.battingStyle || (match.battingStyle ?? ""),
              bowlingStyle: prev.bowlingStyle || (match.bowlingStyle ?? ""),
              specialization: prev.specialization || (match.specialization ?? ""),
              jerseyNumber: prev.jerseyNumber || (match.jerseyNumber ?? ""),
              achievements: prev.achievements || (match.achievements ?? ""),
              cricheroUrl: prev.cricheroUrl || (match.cricheroUrl ?? ""),
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
    const mobileResult = parseIndianMobile(form.mobileNumber);
    if (!mobileResult.ok) {
      setErrorMsg(mobileResult.error);
      return;
    }
    setErrorMsg(null);
    setEmailError("");

    const emailResult = parseOptionalEmail(form.email);
    if (!emailResult.ok) {
      setEmailError(emailResult.error);
      return;
    }

    // Serialize spec selections into existing style fields (up to 3 groups)
    const sortedSpecs = [...specs].sort((a, b) => a.displayOrder - b.displayOrder);
    const battingStyle = sortedSpecs[0] ? (specSelections[sortedSpecs[0].id] || undefined) : (form.battingStyle || undefined);
    const bowlingStyle = sortedSpecs[1] ? (specSelections[sortedSpecs[1].id] || undefined) : (form.bowlingStyle || undefined);
    const specialization = sortedSpecs[2] ? (specSelections[sortedSpecs[2].id] || undefined) : (form.specialization || undefined);

    try {
      await registerPlayer.mutateAsync({
        tournamentId,
        data: {
          name: form.name,
          mobileNumber: mobileResult.normalized,
          email: emailResult.email || undefined,
          city: form.city || undefined,
          role: form.role || undefined,
          battingStyle: battingStyle || undefined,
          bowlingStyle: bowlingStyle || undefined,
          specialization: specialization || undefined,
          age: form.age ? parseInt(form.age) : undefined,
          gender: form.gender === "M" || form.gender === "F" ? form.gender : undefined,
          jerseyNumber: form.jerseyNumber || undefined,
          achievements: form.achievements || undefined,
          availabilityDates: form.availabilityDates || undefined,
          cricheroUrl: form.cricheroUrl || undefined,
          categoryId: form.categoryId ? parseInt(form.categoryId) : undefined,
          photoUrl: form.photoUrl || undefined,
          basePrice: 100000,
          whatsappConsent: waConsent,
        },
      });
      setSubmitted(true);
      refetchStatus();
    } catch (err: any) {
      const data = err?.data ?? err?.response?.data;
      if (data?.field === "email") {
        setEmailError(data.error || "Please enter a valid email address");
        return;
      }
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
      <div className="min-h-[100dvh] bg-[#09090b] flex flex-col items-center justify-start sm:justify-center px-3 py-6 sm:p-4">
        <div className="w-full max-w-lg">
          {/* Header */}
          <div className="text-center mb-6 sm:mb-8">
            {(tournament as { logoUrl?: string | null } | undefined)?.logoUrl ? (
              <img src={(tournament as { logoUrl?: string | null }).logoUrl!} alt={tournament?.name} className="h-16 w-16 object-contain mx-auto mb-4 rounded-xl" />
            ) : (
              <Trophy className="w-12 h-12 text-primary mx-auto mb-4" />
            )}
            <h1 className="text-2xl sm:text-3xl font-display font-black text-white leading-tight px-1">
              {tournament?.name || brandName}
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
                        setSubmitted(false); setWaConsent(false); setErrorMsg(null); setEmailError("");
                        setFoundProfile(null); setMobileLookedUp(false);
                        setForm({
                          name: "", mobileNumber: "", email: "", city: "", role: roles[0]?.roleName ?? "", age: "", jerseyNumber: "",
                          achievements: "", availabilityDates: (tournament as { matchDates?: string | null } | undefined)?.matchDates ?? "",
                          cricheroUrl: "", categoryId: "", photoUrl: "", battingStyle: "", bowlingStyle: "", specialization: "",
                        });
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
                  <CardContent className="p-4 sm:p-6">
                    <form onSubmit={handleSubmit} className="space-y-4 sm:space-y-5">
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
                            placeholder="10-digit mobile (e.g. 9876543210)"
                            type="tel"
                            className="pr-8 h-11 sm:h-9 text-base"
                            inputMode="numeric"
                            autoComplete="tel"
                            maxLength={10}
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

                      <OptionalEmailField
                        id="register-email"
                        value={form.email}
                        onChange={v => { f("email", v); if (emailError) setEmailError(""); }}
                        error={emailError || undefined}
                        inputClassName="h-11 sm:h-9 text-base"
                      />

                      <div className="space-y-2">
                        <Label>Full Name *</Label>
                        <Input required value={form.name} onChange={e => f("name", e.target.value)} placeholder="Your full name" className="h-11 sm:h-9" autoComplete="name" />
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                        <div className="space-y-2">
                          <Label>City</Label>
                          <Input value={form.city} onChange={e => f("city", e.target.value)} placeholder="Mumbai" className="h-11 sm:h-9" autoComplete="address-level2" />
                        </div>
                        <div className="space-y-2">
                          <Label>Age</Label>
                          <Input type="number" inputMode="numeric" value={form.age} onChange={e => f("age", e.target.value)} placeholder="25" className="h-11 sm:h-9" />
                        </div>
                        <PlayerGenderSelect
                          value={form.gender}
                          onChange={(v) => f("gender", v)}
                          triggerClassName="h-11 sm:h-9"
                        />
                      </div>

                      {/* Dynamic role dropdown */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label>Role *</Label>
                          <Select value={form.role} onValueChange={v => f("role", v)}>
                            <SelectTrigger className="h-11 sm:h-9"><SelectValue placeholder="Select role" /></SelectTrigger>
                            <SelectContent className="dark max-h-[min(50dvh,320px)]">
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
                          <Input value={form.jerseyNumber} onChange={e => f("jerseyNumber", e.target.value)} placeholder="7" inputMode="numeric" className="h-11 sm:h-9" />
                        </div>
                      </div>

                      {/* Dynamic spec groups — same logic as admin form */}
                      {specs.length > 0 ? (
                        <div className="space-y-3 p-3 sm:p-4 rounded-lg border border-border bg-muted/20">
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
                                <SelectTrigger className="h-11 sm:h-9">
                                  <SelectValue placeholder={`Select ${group.groupName}`} />
                                </SelectTrigger>
                                <SelectContent className="dark max-h-[min(50dvh,320px)]">
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
                      ) : (["cricket", "other", ""].includes(sportSlug ?? "cricket") ? (
                        /* Fallback free-text fields for cricket / other / unknown sports */
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                          <div className="space-y-2">
                            <Label>Batting Style</Label>
                            <Input value={form.battingStyle} onChange={e => f("battingStyle", e.target.value)} placeholder="Right-hand bat" className="h-11 sm:h-9" />
                          </div>
                          <div className="space-y-2">
                            <Label>Bowling Style</Label>
                            <Input value={form.bowlingStyle} onChange={e => f("bowlingStyle", e.target.value)} placeholder="Right-arm fast" className="h-11 sm:h-9" />
                          </div>
                          <div className="space-y-2 sm:col-span-2">
                            <Label>Specialization</Label>
                            <Input value={form.specialization} onChange={e => f("specialization", e.target.value)} placeholder="Power hitter, Death bowler..." className="h-11 sm:h-9" />
                          </div>
                        </div>
                      ) : null)}

                      {(() => {
                        const matchDates: string[] = ((tournament as { matchDates?: string | null } | undefined)?.matchDates || "").split(",").filter(Boolean);
                        if (matchDates.length === 0) return null;
                        const selectedDates: string[] = (form.availabilityDates || "").split(",").filter(Boolean);
                        const selectedSet = new Set<string>(selectedDates);
                        function toggleAvailDate(iso: string) {
                          const next = new Set<string>(selectedSet);
                          if (next.has(iso)) next.delete(iso); else next.add(iso);
                          const kept: string[] = [];
                          next.forEach((v: string) => { if (matchDates.includes(v)) kept.push(v); });
                          f("availabilityDates", kept.join(","));
                        }
                        return (
                          <div className="space-y-2">
                            <Label className="flex items-center gap-1.5">
                              <CalendarDays className="w-3.5 h-3.5 text-amber-400" />
                              Match Availability
                            </Label>
                            <p className="text-xs text-muted-foreground">Select the match days you will be available to play.</p>
                            <div className="flex flex-col sm:flex-row sm:flex-wrap gap-2">
                              {matchDates.map((iso: string) => {
                                const label = new Date(iso + "T00:00:00").toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
                                const checked = selectedSet.has(iso);
                                return (
                                  <label
                                    key={iso}
                                    className={`flex items-center gap-2 cursor-pointer text-sm px-3 py-2.5 min-h-11 rounded-md border transition-colors ${checked ? "border-amber-500/60 bg-amber-500/10 text-amber-300" : "border-border hover:bg-muted/50 text-muted-foreground"}`}
                                  >
                                    <input
                                      type="checkbox"
                                      checked={checked}
                                      onChange={() => toggleAvailDate(iso)}
                                      className="accent-amber-400 h-4 w-4 shrink-0"
                                    />
                                    {label}
                                  </label>
                                );
                              })}
                            </div>
                          </div>
                        );
                      })()}

                      <div className="space-y-2">
                        <Label>Achievements / Bio</Label>
                        <Input value={form.achievements} onChange={e => f("achievements", e.target.value)} placeholder="Player of Season 2024, 500+ runs..." className="h-11 sm:h-9" />
                      </div>

                      <div className="space-y-2">
                        <Label>Crichero Profile URL</Label>
                        <Input value={form.cricheroUrl} onChange={e => f("cricheroUrl", e.target.value)} placeholder="https://crichero.com/player/..." type="url" inputMode="url" className="h-11 sm:h-9" />
                      </div>

                      <div className="space-y-2">
                        <Label>Player Photo (optional)</Label>
                        <div className="flex gap-3 items-start">
                          <div className="w-14 h-14 sm:w-12 sm:h-12 rounded-lg border border-border bg-muted/30 flex items-center justify-center overflow-hidden flex-shrink-0">
                            {form.photoUrl ? (
                              <img
                                src={form.photoUrl}
                                alt="Preview"
                                className="w-full h-full object-cover"
                                onError={e => { (e.currentTarget as HTMLImageElement).style.display = "none"; }}
                              />
                            ) : (
                              <User className="w-5 h-5 text-muted-foreground/40" />
                            )}
                          </div>
                          <div className="flex-1 space-y-1.5">
                            <div className="flex flex-col sm:flex-row flex-wrap items-stretch sm:items-center gap-2">
                              <Button
                                type="button"
                                size="sm"
                                variant="outline"
                                className="h-11 sm:h-7 text-sm sm:text-xs gap-1.5 w-full sm:w-auto"
                                onClick={() => setPhotoEditorOpen(true)}
                              >
                                {form.photoUrl ? <><Pencil className="w-3.5 h-3.5" /> Edit Photo</> : <><Upload className="w-3.5 h-3.5" /> Upload Photo</>}
                              </Button>
                              {form.photoUrl && (
                                <Button
                                  type="button"
                                  size="sm"
                                  variant="ghost"
                                  className="h-11 sm:h-7 text-sm sm:text-xs text-destructive hover:text-destructive hover:bg-destructive/10 gap-1.5 w-full sm:w-auto"
                                  onClick={() => f("photoUrl", "")}
                                >
                                  <X className="w-3.5 h-3.5" /> Remove
                                </Button>
                              )}
                            </div>
                            <p className="text-xs text-muted-foreground">Upload, crop, enhance or remove the background.</p>
                          </div>
                        </div>
                        <ImageEditorDialog
                          open={photoEditorOpen}
                          onClose={() => setPhotoEditorOpen(false)}
                          initialUrl={form.photoUrl || undefined}
                          aspect={1}
                          title="Player Photo"
                          onSave={url => f("photoUrl", url)}
                        />
                      </div>

                      {categories && categories.length > 0 && (
                        <div className="space-y-2">
                          <Label>Preferred Category</Label>
                          <Select value={form.categoryId} onValueChange={v => f("categoryId", v)}>
                            <SelectTrigger className="h-11 sm:h-9"><SelectValue placeholder="Select category (optional)" /></SelectTrigger>
                            <SelectContent className="dark max-h-[min(50dvh,320px)]">
                              {categories.map(c => (
                                <SelectItem key={c.id} value={String(c.id)}>{c.name}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      )}

                      {/* WhatsApp consent */}
                      <div className="space-y-2">
                        <label className="flex items-start gap-3 cursor-pointer group min-h-11 py-1">
                          <input
                            type="checkbox"
                            checked={waConsent}
                            onChange={e => setWaConsent(e.target.checked)}
                            className="mt-0.5 h-5 w-5 rounded border-border accent-primary cursor-pointer shrink-0"
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
                        className="w-full h-12 sm:h-12 text-base font-bold sticky bottom-0 sm:static"
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

          <div className="mt-6 sm:mt-8 flex flex-col items-center gap-2 pb-[max(1rem,env(safe-area-inset-bottom))]">
            {logos.mini && <img src={logos.mini} alt={brandName} className="h-6 w-auto opacity-30" />}
            <p className="text-[11px] text-muted-foreground/40 uppercase tracking-widest">{poweredByText}</p>
          </div>
        </div>
      </div>
    </FullscreenLayout>
  );
}
