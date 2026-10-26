import { useState, useEffect, useRef, useMemo, useCallback } from "react";
import { useRoute } from "wouter";
import "@/styles/registration-experience.css";
import { useBranding } from "@/hooks/use-branding";
import type { RegistrationStatus, Tournament } from "@workspace/api-client-react";
import { normalizeRegistrationCode } from "@workspace/api-base/registration-url";
import { FullscreenLayout } from "@/components/layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CheckCircle2, User, MessageSquare, Loader2, Upload, Pencil, X } from "lucide-react";
import { ImageEditorDialog } from "@/components/image-editor-dialog";
import {
  PLAYER_PHOTO_ASPECT,
  PLAYER_PHOTO_EXPORT_MAX_MB,
  PLAYER_PHOTO_WIDTH,
} from "@/lib/player-photo";
import { parseIndianMobile, sanitizeMobileInput, mobilesMatch } from "@workspace/api-base/mobile";
import { parseOptionalEmail } from "@workspace/api-base/email";
import { OptionalEmailField } from "@/components/optional-email-field";
import { CityAutocomplete } from "@/components/city-autocomplete";
import { JerseySizeSelect } from "@/components/jersey-size-select";
import { PlayerGenderSelect } from "@/components/player-gender-select";
import type { JerseySize } from "@workspace/api-base/jersey-size";
import { RegistrationPaymentFormSection } from "@/components/registration-payment/registration-payment-form-section";
import { RegistrationPageHeader, type RegistrationHeaderFact } from "@/components/registration-page-header";
import { RegLabel, RegNotice, RegSection, registrationSelectContentClass } from "@/components/registration/registration-chrome";
import {
  changedAutofillFieldIds,
  changedSpecFieldIds,
  mergeGlobalProfile,
  mergeTournamentProfile,
  projectSpecSelections,
} from "@/lib/registration-autofill";
import { PoweredByBidWarLink } from "@/components/powered-by-bidwar-link";
import type { PaymentVerificationMethod } from "@workspace/api-base/registration-payment";
import { parseRegistrationDeclarationPoints } from "@workspace/api-base/registration-declaration";
import {
  parsePlayerRegistrationMode,
  publicRegistrationCategoryIdPayload,
  shouldShowPublicCategorySelect,
  type RegistrationCategoryMode,
} from "@workspace/api-base/player-registration-mode";
import {
  buildRegistrationFieldVisibility,
  type RegistrationFieldsConfig,
  type RegistrationOptionalFieldKey,
} from "@workspace/api-base/registration-fields";
import { formatIndianRupee } from "@/lib/format";
import {
  applySpecificationsToSelections,
  buildSpecificationsPayload,
} from "@/lib/player-specifications";
import { getSportCapabilities } from "@/lib/sport-capabilities";
import { formatTimeLabel } from "@/components/ui/time-picker";

/** Format YYYY-MM-DD as DD-MM-YYYY without timezone shifting. */
function formatIsoDateDdMmYyyy(value: string | null | undefined): string {
  const trimmed = value?.trim() ?? "";
  if (!trimmed) return "";
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(trimmed);
  if (!match) return trimmed;
  return `${match[3]}-${match[2]}-${match[1]}`;
}

function formatAuctionDateTimeForDisplay(
  auctionDate: string | null | undefined,
  auctionTime: string | null | undefined,
): string {
  const datePart = formatIsoDateDdMmYyyy(auctionDate);
  const timePart = auctionTime?.trim() ? formatTimeLabel(auctionTime.trim()) : "";
  if (datePart && timePart) return `${datePart} at ${timePart}`;
  return datePart || timePart;
}

function formatMatchDatesForDisplay(matchDates: string | null | undefined): string {
  if (!matchDates?.trim()) return "";
  return matchDates
    .split(",")
    .map((part) => formatIsoDateDdMmYyyy(part))
    .filter(Boolean)
    .join(", ");
}

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
  specifications?: { specGroupId: number; groupName?: string; value: string }[];
  jerseyNumber?: string | null;
  jerseySize?: string | null;
  achievements?: string | null;
  cricheroUrl?: string | null;
  availabilityDates?: string | null;
  categoryId?: number | null;
  teamId?: number | null;
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
  const [specsRoleId, setSpecsRoleId] = useState<number | undefined>(undefined);
  useEffect(() => {
    if (!roleId) {
      setSpecs([]);
      setSpecsRoleId(undefined);
      return;
    }
    fetch(`/api/sports/roles/${roleId}/specs`)
      .then(r => r.json())
      .then((d: SpecGroup[]) => {
        setSpecs(d);
        setSpecsRoleId(roleId);
      })
      .catch(() => {
        setSpecs([]);
        setSpecsRoleId(roleId);
      });
  }, [roleId]);
  return { specs, specsRoleId };
}

function RegistrationFrame({
  children,
  wide = false,
  center = false,
}: {
  children: React.ReactNode;
  wide?: boolean;
  center?: boolean;
}) {
  return (
    <FullscreenLayout className="registration-experience" backdrop={false}>
      <div className={`reg-shell${wide ? " reg-shell--wide" : ""}${center ? " reg-shell--center" : ""}`}>
        {children}
        <footer className="reg-footer">
          <PoweredByBidWarLink variant="footer" />
        </footer>
      </div>
    </FullscreenLayout>
  );
}

export default function PlayerRegister() {
  const [, params] = useRoute("/register/:code");
  const registrationCode = params?.code ? normalizeRegistrationCode(params.code) : "";
  const { brandName } = useBranding();
  const [contextLoading, setContextLoading] = useState(true);
  const [contextError, setContextError] = useState<string | null>(null);
  const [tournament, setTournament] = useState<Tournament | null>(null);
  const [status, setStatus] = useState<RegistrationStatus | null>(null);
  const [registerPending, setRegisterPending] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [waConsent, setWaConsent] = useState(false);
  const [declarationAccepted, setDeclarationAccepted] = useState(false);
  const [waLink, setWaLink] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [emailError, setEmailError] = useState("");
  const [photoError, setPhotoError] = useState("");

  // Mobile lookup state (Phase 5)
  const [mobileLookedUp, setMobileLookedUp] = useState(false);
  const [lookupLoading, setLookupLoading] = useState(false);
  const [foundProfile, setFoundProfile] = useState<GlobalPlayerLookup | null>(null);
  const [existingRegistration, setExistingRegistration] = useState<GlobalPlayerLookup | null>(null);
  const [registrationUpdated, setRegistrationUpdated] = useState(false);
  const [photoEditorOpen, setPhotoEditorOpen] = useState(false);
  const mobileDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const photoFieldRef = useRef<HTMLDivElement>(null);
  const errorNoticeRef = useRef<HTMLDivElement>(null);

  const [form, setForm] = useState({
    name: "",
    mobileNumber: "",
    email: "",
    city: "",
    role: "",
    age: "",
    gender: "",
    jerseyNumber: "",
    jerseySize: "" as JerseySize | "",
    achievements: "",
    availabilityDates: "",
    cricheroUrl: "",
    photoUrl: "",
    photoPublicId: "",
    battingStyle: "",
    bowlingStyle: "",
    specialization: "",
    categoryId: "",
    teamId: "",
  });

  // Spec group selections: groupId → chosen optionName
  const [specSelections, setSpecSelections] = useState<Record<number, string>>({});
  const [autofillKeys, setAutofillKeys] = useState<string[] | null>(null);
  const [welcomeBack, setWelcomeBack] = useState(false);
  const lookupGenRef = useRef(0);
  const expectSpecAutofillRef = useRef(false);
  const specAutofillProfileIdRef = useRef<number | null>(null);
  const autofillClearRef = useRef<number | null>(null);
  const autofillKeysRef = useRef<string[]>([]);
  const formRef = useRef(form);
  formRef.current = form;
  const specSelectionsRef = useRef(specSelections);
  specSelectionsRef.current = specSelections;

  function clearAutofillTimer() {
    if (autofillClearRef.current != null) {
      window.clearTimeout(autofillClearRef.current);
      autofillClearRef.current = null;
    }
  }

  function resetAutofillReveal() {
    clearAutofillTimer();
    autofillKeysRef.current = [];
    expectSpecAutofillRef.current = false;
    specAutofillProfileIdRef.current = null;
    setAutofillKeys(null);
    setWelcomeBack(false);
  }

  function noteAutofill(keys: string[], gen: number) {
    if (lookupGenRef.current !== gen || keys.length === 0) return;
    const merged = [...autofillKeysRef.current];
    let changed = false;
    for (const key of keys) {
      if (!merged.includes(key)) {
        merged.push(key);
        changed = true;
      }
    }
    if (!changed) return;
    autofillKeysRef.current = merged;
    setAutofillKeys(merged);
    setWelcomeBack(true);
    clearAutofillTimer();
    const visibleFor = 2600 + Math.max(0, merged.length - 1) * 120;
    autofillClearRef.current = window.setTimeout(() => {
      if (lookupGenRef.current !== gen) return;
      autofillKeysRef.current = [];
      setAutofillKeys(null);
    }, visibleFor);
  }

  useEffect(() => () => clearAutofillTimer(), []);
  const [utrNumber, setUtrNumber] = useState("");
  const [paymentScreenshotUrl, setPaymentScreenshotUrl] = useState("");
  const [paymentScreenshotPublicId, setPaymentScreenshotPublicId] = useState("");
  const [selectedBidValue, setSelectedBidValue] = useState("");

  const loadContext = useCallback(async () => {
    if (!registrationCode) {
      setContextError("Invalid registration link.");
      setTournament(null);
      setStatus(null);
      setContextLoading(false);
      return;
    }
    setContextLoading(true);
    setContextError(null);
    try {
      const res = await fetch(`/api/register/${encodeURIComponent(registrationCode)}/context`);
      if (!res.ok) {
        setContextError("Registration link not found. Ask your organizer for the correct link.");
        setTournament(null);
        setStatus(null);
        return;
      }
      const data = await res.json() as { tournament: Tournament; registration: RegistrationStatus };
      setTournament(data.tournament);
      setStatus(data.registration);
    } catch {
      setContextError("Could not load registration form. Please try again.");
      setTournament(null);
      setStatus(null);
    } finally {
      setContextLoading(false);
    }
  }, [registrationCode]);

  useEffect(() => {
    void loadContext();
  }, [loadContext]);

  const refetchStatus = loadContext;

  // Dynamic roles from sport master table
  const sportSlug = (tournament as { sport?: string } | undefined)?.sport;
  const sportCaps = getSportCapabilities(sportSlug);
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
  const { specs, specsRoleId } = useRoleSpecs(selectedRole?.id);

  // Reset spec selections when role changes
  useEffect(() => { setSpecSelections({}); }, [form.role]);

  // Pre-fill dynamic spec group selections from normalized or legacy values
  useEffect(() => {
    const source = existingRegistration ?? foundProfile;
    const specsReady = specsRoleId != null && specsRoleId === selectedRole?.id;
    if (specs.length === 0) {
      if (expectSpecAutofillRef.current && specsReady && source && specAutofillProfileIdRef.current === source.id) {
        expectSpecAutofillRef.current = false;
      }
      return;
    }
    if (!source) return;
    const { legacyForm, extraSelections } = applySpecificationsToSelections(
      specs,
      source.specifications?.map((s) => ({ specGroupId: s.specGroupId, value: s.value })),
      {
        battingStyle: source.battingStyle ?? "",
        bowlingStyle: source.bowlingStyle ?? "",
        specialization: source.specialization ?? "",
      },
    );
    setForm((prev) => ({
      ...prev,
      battingStyle: legacyForm.battingStyle ?? prev.battingStyle,
      bowlingStyle: legacyForm.bowlingStyle ?? prev.bowlingStyle,
      specialization: legacyForm.specialization ?? prev.specialization,
    }));
    setSpecSelections((prev) => projectSpecSelections(prev, specs, extraSelections, legacyForm));
    if (
      expectSpecAutofillRef.current
      && specsReady
      && specAutofillProfileIdRef.current === source.id
    ) {
      const gen = lookupGenRef.current;
      const projected = projectSpecSelections(specSelectionsRef.current, specs, extraSelections, legacyForm);
      const ids = changedSpecFieldIds(specSelectionsRef.current, projected);
      expectSpecAutofillRef.current = false;
      if (ids.length) noteAutofill(ids, gen);
    }
  }, [specs, specsRoleId, foundProfile, existingRegistration, form.role, selectedRole?.id]);

  const canUpdateExisting = !!existingRegistration;
  const registrationClosed = !!(status && !status.open);
  const profileUpdatesAllowed = status?.profileUpdatesAllowed !== false;
  /** Closed registration + matched player: only photo/role/specs editable (if setup). */
  const closedSelfUpdateMode = registrationClosed && canUpdateExisting;
  const closedUpdateEditable = closedSelfUpdateMode && profileUpdatesAllowed;
  const closedUpdateReadOnly = closedSelfUpdateMode && !profileUpdatesAllowed;
  /** Identity / contact fields locked in closed self-update (shown, not editable). */
  const identityFieldsLocked = closedSelfUpdateMode;
  const closedReason = status?.reason;
  const remaining = status?.limit != null ? Math.max(0, status.limit - status.currentCount) : null;

  const scoringMode = parsePlayerRegistrationMode(
    status?.playerRegistrationMode ?? tournament?.playerRegistrationMode,
  ) === "scoring";
  const categoryMode = (status?.registrationCategoryMode
    ?? tournament?.registrationCategoryMode) as RegistrationCategoryMode | undefined;
  const publicCategories = status?.categories ?? [];
  const teams = (
    (status as { teams?: Array<{ id: number; name: string; shortName?: string | null; logoUrl?: string | null }> } | undefined)?.teams ?? []
  );
  const showCategorySelect = scoringMode && shouldShowPublicCategorySelect(categoryMode ?? "hidden")
    && publicCategories.length > 0;

  const paymentEnabled = !scoringMode && (
    status?.enableRegistrationPayment === true || tournament?.enableRegistrationPayment === true
  );
  const registrationFee = status?.registrationFee ?? tournament?.registrationFee ?? 0;
  const upiId = status?.upiId ?? tournament?.upiId ?? "";
  const verificationMethod = (
    status?.paymentVerificationMethod ?? tournament?.paymentVerificationMethod ?? "utr"
  ) as PaymentVerificationMethod;
  const paymentConfigured = paymentEnabled && registrationFee > 0 && !!upiId.trim() && !!verificationMethod;

  const playerBidValueMode = !scoringMode && (
    (status as { bidValueMode?: string } | undefined)?.bidValueMode === "player"
    || (tournament as { bidValueMode?: string } | undefined)?.bidValueMode === "player"
  );
  const bidValueOptions = (
    (status as { bidValueOptions?: number[] } | undefined)?.bidValueOptions
    ?? (tournament as { bidValueOptions?: number[] } | undefined)?.bidValueOptions
    ?? []
  ).filter((n) => Number.isFinite(n) && n > 0);

  const declarationPoints = useMemo(() => {
    const fromStatus = status?.registrationDeclarationPoints;
    if (fromStatus?.length) return fromStatus;
    const tournamentEnabled = (tournament as { enableRegistrationDeclaration?: boolean } | undefined)?.enableRegistrationDeclaration;
    const tournamentText = (tournament as { registrationDeclarationText?: string | null } | undefined)?.registrationDeclarationText;
    if (status?.enableRegistrationDeclaration || tournamentEnabled) {
      return parseRegistrationDeclarationPoints(
        status?.registrationDeclarationText ?? tournamentText,
      );
    }
    return [];
  }, [status, tournament]);

  const declarationRequired = declarationPoints.length > 0;

  const fieldVisibility = useMemo(() => {
    const fromStatus = (status as {
      registrationFieldVisibility?: Record<RegistrationOptionalFieldKey, boolean>;
    } | null)?.registrationFieldVisibility;
    if (fromStatus) return fromStatus;
    return buildRegistrationFieldVisibility(
      (tournament as { registrationFields?: RegistrationFieldsConfig } | null)?.registrationFields,
      sportSlug,
    );
  }, [status, tournament, sportSlug]);

  const showEmail = fieldVisibility.email;
  const showCity = fieldVisibility.city;
  const showAge = fieldVisibility.age;
  const showGender = fieldVisibility.gender;
  const showJersey = fieldVisibility.jerseyNumber || fieldVisibility.jerseySize;
  const showAchievements = fieldVisibility.achievements;
  const showCrichero = sportCaps.hasLegacyCricketSpecs && fieldVisibility.cricheroUrl;
  const showMatchAvailability = fieldVisibility.matchAvailability;
  const showWhatsappConsent = fieldVisibility.whatsappConsent;
  const showProfileDetails = showCity || showAge || showGender;

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
  function armAutofill(gen: number, profileId: number, before: typeof form, after: typeof form) {
    if (lookupGenRef.current !== gen) return;
    specAutofillProfileIdRef.current = profileId;
    expectSpecAutofillRef.current = true;
    const ids = changedAutofillFieldIds(before, after);
    if (ids.length) noteAutofill(ids, gen);
  }

  function handleMobileChange(val: string) {
    const sanitized = sanitizeMobileInput(val);
    lookupGenRef.current += 1;
    resetAutofillReveal();
    f("mobileNumber", sanitized);
    setMobileLookedUp(false);
    setFoundProfile(null);
    setExistingRegistration(null);
    if (mobileDebounceRef.current) clearTimeout(mobileDebounceRef.current);
    if (sanitized.length >= 10) {
      mobileDebounceRef.current = setTimeout(async () => {
        const gen = lookupGenRef.current;
        if (!registrationCode) return;
        setLookupLoading(true);
        try {
          const registrationClosedNow = status && !status.open;
          const sportQ = tournament?.sport ? `&sport=${encodeURIComponent(tournament.sport)}` : "";
          const tournamentLookupPromise = fetch(
            `/api/register/${encodeURIComponent(registrationCode)}/lookup?mobile=${encodeURIComponent(sanitized)}`,
          );
          const globalLookupPromise = registrationClosedNow
            ? Promise.resolve(null)
            : fetch(`/api/global-players/search?q=${encodeURIComponent(sanitized)}&limit=1${sportQ}`);

          const [globalRes, tournamentRes] = await Promise.all([
            globalLookupPromise,
            tournamentLookupPromise,
          ]);

          if (globalRes) {
            const data: GlobalPlayerLookup[] = await globalRes.json();
            const match = Array.isArray(data) && data.length > 0
              ? (sanitized.length >= 10 ? data[0] : data.find(p => p.name && sanitized.length >= 2))
              : undefined;
            if (match) setFoundProfile(match);

            const tournamentLookup = await tournamentRes.json() as {
              registered?: boolean;
              player?: GlobalPlayerLookup;
            };
            if (tournamentLookup.registered && tournamentLookup.player) {
              setExistingRegistration(tournamentLookup.player);
              const tp = tournamentLookup.player;
              const before = formRef.current;
              const after = mergeTournamentProfile(before, tp);
              setForm(prev => mergeTournamentProfile(prev, tp));
              armAutofill(gen, tp.id, before, after);
            } else if (match) {
              const before = formRef.current;
              const after = mergeGlobalProfile(before, match);
              setForm(prev => mergeGlobalProfile(prev, match));
              armAutofill(gen, match.id, before, after);
            }
          } else {
            const tournamentLookup = await tournamentRes.json() as {
              registered?: boolean;
              player?: GlobalPlayerLookup;
            };
            if (tournamentLookup.registered && tournamentLookup.player) {
              setExistingRegistration(tournamentLookup.player);
              const tp = tournamentLookup.player;
              const before = formRef.current;
              const after = mergeTournamentProfile(before, tp);
              setForm(prev => mergeTournamentProfile(prev, tp));
              armAutofill(gen, tp.id, before, after);
            }
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
    if (closedUpdateReadOnly) {
      setErrorMsg(scoringMode
        ? "Profile updates are locked. Contact your organiser."
        : "Profile updates are locked because the auction has started. Contact your organiser.");
      return;
    }
    const mobileResult = parseIndianMobile(form.mobileNumber);
    if (!mobileResult.ok) {
      setErrorMsg(mobileResult.error);
      return;
    }
    setErrorMsg(null);
    setEmailError("");
    setPhotoError("");

    const emailResult = showEmail && !closedSelfUpdateMode
      ? parseOptionalEmail(form.email)
      : { ok: true as const, email: null };
    if (!emailResult.ok) {
      setEmailError(emailResult.error);
      return;
    }

    const sortedSpecs = [...specs].sort((a, b) => a.displayOrder - b.displayOrder);
    const specifications = buildSpecificationsPayload(
      sortedSpecs,
      {
        battingStyle: form.battingStyle,
        bowlingStyle: form.bowlingStyle,
        specialization: form.specialization,
      },
      specSelections,
    );
    const battingStyle = sortedSpecs[0]
      ? (specSelections[sortedSpecs[0].id] || form.battingStyle || undefined)
      : (form.battingStyle || undefined);
    const bowlingStyle = sortedSpecs[1]
      ? (specSelections[sortedSpecs[1].id] || form.bowlingStyle || undefined)
      : (form.bowlingStyle || undefined);
    const specialization = sortedSpecs[2]
      ? (specSelections[sortedSpecs[2].id] || form.specialization || undefined)
      : (form.specialization || undefined);

    if (!closedSelfUpdateMode && paymentConfigured) {
      const needsUtr = verificationMethod === "utr" || verificationMethod === "utr_and_screenshot";
      const needsScreenshot = verificationMethod === "screenshot" || verificationMethod === "utr_and_screenshot";
      if (needsUtr && !utrNumber.trim()) {
        setErrorMsg("Please enter your UTR number after completing payment.");
        return;
      }
      if (needsScreenshot && !paymentScreenshotUrl.trim()) {
        setErrorMsg("Please upload your payment screenshot.");
        return;
      }
    }

    if (!closedSelfUpdateMode && declarationRequired && !declarationAccepted) {
      setErrorMsg("Please accept the declaration to continue.");
      return;
    }

    if (!form.photoUrl.trim()) {
      setPhotoError("Player photo is required. Please upload your photo before submitting.");
      photoFieldRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
      return;
    }

    for (const group of specs) {
      if (!group.optional && !specSelections[group.id]?.trim()) {
        setErrorMsg(`${group.groupName} is required.`);
        return;
      }
    }

    if (playerBidValueMode && !existingRegistration) {
      const parsedBid = parseInt(selectedBidValue, 10);
      if (!Number.isFinite(parsedBid) || !bidValueOptions.includes(parsedBid)) {
        setErrorMsg("Please select your bid value.");
        return;
      }
    }

    try {
      setRegisterPending(true);
      const closedPayload = closedSelfUpdateMode
        ? {
            name: form.name || existingRegistration?.name || "Player",
            mobileNumber: mobileResult.normalized,
            role: form.role || undefined,
            battingStyle: battingStyle || undefined,
            bowlingStyle: bowlingStyle || undefined,
            specialization: specialization || undefined,
            specifications: specifications.length > 0 ? specifications : undefined,
            photoUrl: form.photoUrl || undefined,
            photoPublicId: form.photoPublicId || undefined,
          }
        : {
            name: form.name,
            mobileNumber: mobileResult.normalized,
            email: showEmail ? (emailResult.email || undefined) : undefined,
            city: showCity ? (form.city || undefined) : undefined,
            role: form.role || undefined,
            battingStyle: battingStyle || undefined,
            bowlingStyle: bowlingStyle || undefined,
            specialization: specialization || undefined,
            specifications: specifications.length > 0 ? specifications : undefined,
            age: showAge && form.age ? parseInt(form.age) : undefined,
            gender: showGender && (form.gender === "M" || form.gender === "F") ? form.gender : undefined,
            jerseyNumber: fieldVisibility.jerseyNumber ? (form.jerseyNumber || undefined) : undefined,
            jerseySize: fieldVisibility.jerseySize ? (form.jerseySize || undefined) : undefined,
            achievements: showAchievements ? (form.achievements || undefined) : undefined,
            availabilityDates: showMatchAvailability ? (form.availabilityDates || undefined) : undefined,
            cricheroUrl: showCrichero ? (form.cricheroUrl || undefined) : undefined,
            photoUrl: form.photoUrl || undefined,
            photoPublicId: form.photoPublicId || undefined,
            categoryId: publicRegistrationCategoryIdPayload(showCategorySelect, form.categoryId),
            teamId: form.teamId ? parseInt(form.teamId, 10) : undefined,
            basePrice: scoringMode ? undefined : (playerBidValueMode ? undefined : (tournament?.minBid ?? 100000)),
            selectedBidValue: !scoringMode && playerBidValueMode && !existingRegistration
              ? parseInt(selectedBidValue, 10)
              : undefined,
            whatsappConsent: showWhatsappConsent ? waConsent : undefined,
            registrationDeclarationAccepted: declarationRequired ? declarationAccepted : undefined,
            utrNumber: utrNumber.trim() || undefined,
            paymentScreenshotUrl: paymentScreenshotUrl.trim() || undefined,
            paymentScreenshotPublicId: paymentScreenshotPublicId.trim() || undefined,
          };
      const res = await fetch(`/api/register/${encodeURIComponent(registrationCode)}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(closedPayload),
      });
      const result = await res.json().catch(() => ({}));
      if (!res.ok) {
        if (result?.code === "PROFILE_UPDATES_LOCKED") {
          setErrorMsg(result.error || "Profile updates are locked. Contact your organiser.");
          void refetchStatus();
          return;
        }
        if (result?.field === "email") {
          setEmailError(result.error || "Please enter a valid email address");
          return;
        }
        if (result?.field === "photoUrl") {
          setPhotoError(result.error || "Player photo is required.");
          photoFieldRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
          return;
        }
        if (result?.field === "registrationDeclarationAccepted") {
          setErrorMsg(result.error || "Please accept the declaration to continue.");
          return;
        }
        if (result && typeof result === "object" && result.reason && !existingRegistration) {
          setErrorMsg(
            result.reason === "deadline_passed"
              ? "Registration closed: the deadline has passed."
              : "Registration closed: the player limit has been reached.",
          );
          void refetchStatus();
          return;
        }
        setErrorMsg(result?.error || "Submission failed. Please try again.");
        return;
      }
      setRegistrationUpdated(!!result.updated);
      setSubmitted(true);
      if (!result.updated) void refetchStatus();
    } catch (err: any) {
      setErrorMsg(err?.message || "Submission failed. Please try again.");
    } finally {
      setRegisterPending(false);
    }
  }

  const f = (key: string, val: string) => setForm(prev => ({ ...prev, [key]: val }));

  useEffect(() => {
    if (!errorMsg) return;
    errorNoticeRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
  }, [errorMsg]);

  if (contextLoading) {
    return (
      <RegistrationFrame center>
        <div className="reg-panel text-center">
          <Loader2 className="w-8 h-8 animate-spin text-primary mx-auto" />
          <p className="text-sm text-muted-foreground mt-3">Loading registration form…</p>
        </div>
      </RegistrationFrame>
    );
  }

  if (contextError || !tournament || !status) {
    return (
      <RegistrationFrame center>
        <div className="reg-panel text-center space-y-3">
          <h1 className="reg-status-title">Registration unavailable</h1>
          <p className="text-sm text-muted-foreground">
            {contextError ?? "Registration link not found. Ask your organizer for the correct link."}
          </p>
        </div>
      </RegistrationFrame>
    );
  }

  function autofillAttrs(id: string): {
    className: string;
    style?: React.CSSProperties;
    autofilled: boolean;
  } {
    const index = autofillKeys?.indexOf(id) ?? -1;
    if (index < 0) return { className: "", autofilled: false };
    return {
      className: "reg-autofill",
      style: { "--autofill-delay": `${index * 120}ms` } as React.CSSProperties,
      autofilled: true,
    };
  }

  function renderMatchAvailability() {
    const matchDates: string[] = ((tournament as { matchDates?: string | null }).matchDates || "").split(",").filter(Boolean);
    if (matchDates.length === 0) return null;
    const selectedDates: string[] = (form.availabilityDates || "").split(",").filter(Boolean);
    const selectedSet = new Set<string>(selectedDates);
    function toggleAvailDate(iso: string) {
      if (identityFieldsLocked) return;
      const next = new Set<string>(selectedSet);
      if (next.has(iso)) next.delete(iso); else next.add(iso);
      const kept: string[] = [];
      next.forEach((v: string) => { if (matchDates.includes(v)) kept.push(v); });
      f("availabilityDates", kept.join(","));
    }
    const availabilityAuto = autofillAttrs("availability");
    return (
      <div className={availabilityAuto.className ? `reg-field ${availabilityAuto.className}` : "reg-field"} style={availabilityAuto.style}>
        <RegLabel marker="optional" locked={identityFieldsLocked} autofilled={availabilityAuto.autofilled}>Match availability</RegLabel>
        {identityFieldsLocked ? <p className="reg-hint">To change availability, contact your organiser.</p> : null}
        <div className="reg-chips">
          {matchDates.map((iso: string) => {
            const label = new Date(iso + "T00:00:00").toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
            const checked = selectedSet.has(iso);
            return (
              <label key={iso} className="reg-chip" data-checked={checked ? "true" : "false"}>
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={() => toggleAvailDate(iso)}
                  disabled={identityFieldsLocked}
                />
                {label}
              </label>
            );
          })}
        </div>
      </div>
    );
  }

  const auctionDateLine = formatAuctionDateTimeForDisplay(
    tournament.auctionDate,
    (tournament as { auctionTime?: string | null }).auctionTime,
  );
  const matchDatesLine = formatMatchDatesForDisplay(
    (tournament as { matchDates?: string | null }).matchDates,
  );
  const headerFacts: RegistrationHeaderFact[] = [];
  if (status.deadline) {
    headerFacts.push({
      label: registrationClosed ? "Registration closed" : "Closes",
      value: formatDeadline(status.deadline),
    });
  }
  if (paymentConfigured) {
    headerFacts.push({ label: "Fee", value: formatIndianRupee(registrationFee) });
  }
  if (auctionDateLine) headerFacts.push({ label: "Auction", value: auctionDateLine });
  if (matchDatesLine) headerFacts.push({ label: "Match dates", value: matchDatesLine });

  const showConfirmSection = !closedSelfUpdateMode && (
    declarationRequired || showWhatsappConsent || (paymentEnabled && paymentConfigured)
  );
  const confirmTitle = paymentConfigured && declarationRequired
    ? "Declaration and payment"
    : paymentConfigured
      ? "Payment"
      : declarationRequired
        ? "Declaration"
        : "Updates";

  const nameAuto = autofillAttrs("name");
  const cityAuto = autofillAttrs("city");
  const ageAuto = autofillAttrs("age");
  const genderAuto = autofillAttrs("gender");
  const roleAuto = autofillAttrs("role");
  const battingAuto = autofillAttrs("battingStyle");
  const bowlingAuto = autofillAttrs("bowlingStyle");
  const specializationAuto = autofillAttrs("specialization");
  const jerseyNumberAuto = autofillAttrs("jerseyNumber");
  const jerseySizeAuto = autofillAttrs("jerseySize");
  const achievementsAuto = autofillAttrs("achievements");
  const cricheroAuto = autofillAttrs("crichero");
  const photoAuto = autofillAttrs("photo");
  const teamAuto = autofillAttrs("team");
  const categoryAuto = autofillAttrs("category");

  return (
    <RegistrationFrame wide>
      <div className="reg-layout">
        <aside className="reg-aside">
          <RegistrationPageHeader
            tournamentName={tournament.name}
            tournamentLogoUrl={(tournament as { logoUrl?: string | null }).logoUrl}
            sponsorLogosJson={(tournament as { sponsorLogos?: string | null }).sponsorLogos}
            brandNameFallback={brandName}
            registeredCount={status.currentCount}
            registrationLimit={status.limit}
            subtitle="Player Registration"
            tagline={scoringMode ? "Register for this tournament" : undefined}
            facts={headerFacts}
          />
        </aside>

        <div className="reg-main">
          {registrationClosed && !canUpdateExisting && !submitted ? (
            <div className="space-y-3">
              <div className="reg-panel text-center space-y-3">
                <h2 className="reg-status-title">Registration closed</h2>
                <p className="text-sm text-muted-foreground">
                  {closedReason === "deadline_passed"
                    ? <>The registration window closed on <span className="font-semibold text-foreground">{formatDeadline(status.deadline)}</span>.</>
                    : <>This tournament has reached its limit of <span className="font-semibold text-foreground">{status.limit}</span> registered players.</>}
                </p>
                <p className="text-sm text-muted-foreground">
                  New registrations are not accepted. Already registered? Update your photo and sports details below.
                </p>
              </div>
              <section className="reg-section">
                <div className="reg-fields">
                  <div>
                    <h2 className="reg-subhead">Already registered?</h2>
                    <p className="reg-hint mt-1">Enter the mobile number you registered with to view or update your profile.</p>
                  </div>
                  <div className="reg-field">
                    <RegLabel htmlFor="register-mobile-closed" marker="required">Mobile number</RegLabel>
                    <div className="relative">
                      <Input
                        id="register-mobile-closed"
                        value={form.mobileNumber}
                        onChange={e => handleMobileChange(e.target.value)}
                        type="tel"
                        inputMode="numeric"
                        autoComplete="tel"
                        maxLength={10}
                        aria-describedby="register-mobile-closed-status"
                      />
                      {lookupLoading ? (
                        <Loader2 className="absolute right-3 top-3.5 w-4 h-4 animate-spin text-primary" aria-hidden="true" />
                      ) : null}
                    </div>
                    <div id="register-mobile-closed-status" aria-live="polite">
                      {lookupLoading ? <p className="reg-hint">Looking up your registration…</p> : null}
                      {!lookupLoading && mobileLookedUp && !existingRegistration && form.mobileNumber.length >= 10 ? (
                        <RegNotice tone="pending">No registration found for this mobile. Contact your organiser if you need help.</RegNotice>
                      ) : null}
                    </div>
                  </div>
                  {errorMsg ? <RegNotice tone="error">{errorMsg}</RegNotice> : null}
                </div>
              </section>
            </div>
          ) : submitted ? (
            <div className="reg-panel text-center">
              {registrationUpdated ? (
                <>
                  <CheckCircle2 className="w-12 h-12 mx-auto mb-3" style={{ color: "var(--reg-success)" }} aria-hidden="true" />
                  <h2 className="reg-status-title">Registration updated</h2>
                  <p className="text-sm text-muted-foreground mt-2">
                    {scoringMode
                      ? "Your profile details have been saved."
                      : "Your profile details have been saved. Your auction status was not changed."}
                  </p>
                </>
              ) : paymentConfigured ? (
                <>
                  <h2 className="reg-status-title">Registration submitted</h2>
                  <p className="mt-3">
                    <RegNotice tone="pending">Payment verification pending. The organizer still needs to confirm your payment.</RegNotice>
                  </p>
                  <p className="text-sm text-muted-foreground mt-4">
                    Your registration has been received. The organizer will verify your payment and contact you with further details.
                  </p>
                </>
              ) : (
                <>
                  <CheckCircle2 className="w-12 h-12 mx-auto mb-3" style={{ color: "var(--reg-success)" }} aria-hidden="true" />
                  <h2 className="reg-status-title">Registration successful</h2>
                  <p className="text-sm text-muted-foreground mt-2">
                    {scoringMode
                      ? "You're registered for this tournament. The organizer will assign teams and share match details."
                      : "Your registration has been received. The organizer will contact you with further details."}
                  </p>
                </>
              )}
              {(auctionDateLine || matchDatesLine) ? (
                <dl className="reg-meta-list">
                  {auctionDateLine ? (
                    <div>
                      <dt>Auction date</dt>
                      <dd>{auctionDateLine}</dd>
                    </div>
                  ) : null}
                  {matchDatesLine ? (
                    <div>
                      <dt>Tournament / match dates</dt>
                      <dd>{matchDatesLine}</dd>
                    </div>
                  ) : null}
                </dl>
              ) : null}
              {waConsent && waLink ? (
                <div className="mt-6 p-4 rounded-xl border text-sm text-left space-y-3" style={{ borderColor: "var(--reg-success-border)", background: "var(--reg-success-bg)" }}>
                  <p className="font-semibold" style={{ color: "var(--reg-success)" }}>WhatsApp updates activate karein</p>
                  <p className="reg-hint">Tap the button below to send &quot;hello&quot; on WhatsApp — the bot will confirm your subscription.</p>
                  <a
                    href={waLink}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center justify-center gap-2 w-full min-h-12 rounded-xl bg-[#25D366] text-white font-bold text-sm hover:bg-[#1da851] transition-colors"
                  >
                    <MessageSquare className="w-4 h-4" /> Subscribe on WhatsApp
                  </a>
                </div>
              ) : null}
              <Button
                className="mt-4 min-h-12"
                variant="outline"
                onClick={() => {
                  setSubmitted(false); setWaConsent(false); setDeclarationAccepted(false); setErrorMsg(null); setEmailError(""); setPhotoError("");
                  setUtrNumber(""); setPaymentScreenshotUrl(""); setPaymentScreenshotPublicId("");
                  setFoundProfile(null); setExistingRegistration(null); setMobileLookedUp(false); setRegistrationUpdated(false);
                  resetAutofillReveal();
                  setForm({
                    name: "", mobileNumber: "", email: "", city: "", role: roles[0]?.roleName ?? "", age: "", gender: "", jerseyNumber: "", jerseySize: "",
                    achievements: "", availabilityDates: (tournament as { matchDates?: string | null }).matchDates ?? "",
                    cricheroUrl: "", photoUrl: "", photoPublicId: "", battingStyle: "", bowlingStyle: "", specialization: "", categoryId: "", teamId: "",
                  });
                  setSpecSelections({});
                }}
              >
                {registrationClosed ? "Update another profile" : "Register another player"}
              </Button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="reg-fields">
              {errorMsg ? (
                <div ref={errorNoticeRef}>
                  <RegNotice tone="error">{errorMsg}</RegNotice>
                </div>
              ) : null}

              {closedSelfUpdateMode ? (
                <RegNotice tone="pending">
                  Registration is closed. You can {closedUpdateEditable ? "update your photo, role, and sports specs" : "view your registration"}.
                  {closedUpdateEditable
                    ? " Other details are locked — contact your organiser to change them."
                    : scoringMode
                      ? " Profile edits are locked — contact your organiser."
                      : " Profile edits are locked because the auction has started — contact your organiser."}
                </RegNotice>
              ) : null}

              <RegSection
                step="1"
                title={closedSelfUpdateMode ? "Your registration" : "Personal details"}
                description={identityFieldsLocked ? "These details are locked. Contact your organiser to change them." : undefined}
              >
                <div className="reg-field">
                  <RegLabel htmlFor="register-mobile" marker="required" locked={identityFieldsLocked}>Mobile number</RegLabel>
                  <div className="relative">
                    <Input
                      id="register-mobile"
                      required
                      value={form.mobileNumber}
                      onChange={e => handleMobileChange(e.target.value)}
                      type="tel"
                      inputMode="numeric"
                      autoComplete="tel"
                      maxLength={10}
                      disabled={identityFieldsLocked}
                      readOnly={identityFieldsLocked}
                      aria-describedby="register-mobile-status"
                    />
                    {lookupLoading ? (
                      <Loader2 className="absolute right-3 top-3.5 w-4 h-4 animate-spin text-primary" aria-hidden="true" />
                    ) : null}
                  </div>
                  <div id="register-mobile-status" aria-live="polite">
                    {lookupLoading ? <p className="reg-hint">Checking your mobile number in our player database…</p> : null}
                    {!lookupLoading && existingRegistration ? (
                      <RegNotice tone="pending">
                        {closedSelfUpdateMode
                          ? closedUpdateEditable
                            ? "You're already registered. Update photo, role, and sports specs below."
                            : "You're already registered. Profile is view-only — contact your organiser to make changes."
                          : scoringMode
                            ? "You're already registered in this tournament. Update your profile below — team assignment won't change."
                            : "You're already registered in this tournament. Update your profile below — auction status and team assignment won't change."}
                      </RegNotice>
                    ) : null}
                    {welcomeBack ? (
                      <div className="reg-welcome">
                        <CheckCircle2 className="reg-welcome-icon" aria-hidden="true" />
                        <p>
                          <strong>Welcome back! Your details are filled in.</strong>
                          <span>Please review and edit if needed.</span>
                        </p>
                      </div>
                    ) : null}
                  </div>
                  {closedSelfUpdateMode ? (
                    <Button
                      type="button"
                      variant="ghost"
                      className="min-h-11 self-start px-0"
                      onClick={() => {
                        setExistingRegistration(null);
                        setFoundProfile(null);
                        setMobileLookedUp(false);
                        resetAutofillReveal();
                        setErrorMsg(null);
                        setForm(prev => ({
                          ...prev,
                          mobileNumber: "",
                          name: "",
                          email: "",
                          city: "",
                          age: "",
                          gender: "",
                          role: roles[0]?.roleName ?? "",
                          photoUrl: "",
                          photoPublicId: "",
                          battingStyle: "",
                          bowlingStyle: "",
                          specialization: "",
                          jerseyNumber: "",
                          jerseySize: "",
                          achievements: "",
                          cricheroUrl: "",
                          availabilityDates: (tournament as { matchDates?: string | null }).matchDates ?? "",
                          categoryId: "",
                        }));
                        setSpecSelections({});
                      }}
                    >
                      Use a different mobile
                    </Button>
                  ) : null}
                </div>

                {showEmail ? (
                  <OptionalEmailField
                    id="register-email"
                    value={form.email}
                    onChange={v => { if (!identityFieldsLocked) { f("email", v); if (emailError) setEmailError(""); } }}
                    error={emailError || undefined}
                    hint=""
                    disabled={identityFieldsLocked}
                  />
                ) : null}

                <div className={nameAuto.className ? `reg-field ${nameAuto.className}` : "reg-field"} style={nameAuto.style}>
                  <RegLabel htmlFor="register-name" marker="required" locked={identityFieldsLocked} autofilled={nameAuto.autofilled}>Full name</RegLabel>
                  <Input
                    id="register-name"
                    required
                    value={form.name}
                    onChange={e => f("name", e.target.value)}
                    autoComplete="name"
                    disabled={identityFieldsLocked}
                    readOnly={identityFieldsLocked}
                  />
                  {identityFieldsLocked ? <p className="reg-hint">To change this, contact your organiser.</p> : null}
                </div>

                {showProfileDetails ? (
                  <div className="reg-grid-3">
                    {showCity ? (
                      <div className={cityAuto.className ? `reg-field ${cityAuto.className}` : "reg-field"} style={cityAuto.style}>
                        <RegLabel htmlFor="register-city" marker="optional" locked={identityFieldsLocked} autofilled={cityAuto.autofilled}>City</RegLabel>
                        <CityAutocomplete
                          id="register-city"
                          value={form.city}
                          onChange={v => { if (!identityFieldsLocked) f("city", v); }}
                          disabled={identityFieldsLocked}
                          showHint={false}
                        />
                      </div>
                    ) : null}
                    {showAge ? (
                      <div className={ageAuto.className ? `reg-field ${ageAuto.className}` : "reg-field"} style={ageAuto.style}>
                        <RegLabel htmlFor="register-age" marker="optional" locked={identityFieldsLocked} autofilled={ageAuto.autofilled}>Age</RegLabel>
                        <Input
                          id="register-age"
                          type="number"
                          inputMode="numeric"
                          value={form.age}
                          onChange={e => f("age", e.target.value)}
                          disabled={identityFieldsLocked}
                          readOnly={identityFieldsLocked}
                        />
                      </div>
                    ) : null}
                    {showGender ? (
                      <PlayerGenderSelect
                        id="register-gender"
                        value={form.gender}
                        onChange={(v) => { if (!identityFieldsLocked) f("gender", v); }}
                        marker="optional"
                        contentClassName={registrationSelectContentClass}
                        disabled={identityFieldsLocked}
                        className={genderAuto.className || undefined}
                        style={genderAuto.style}
                        autofilled={genderAuto.autofilled}
                      />
                    ) : null}
                  </div>
                ) : null}
                {showProfileDetails && identityFieldsLocked ? (
                  <p className="reg-hint">To change these details, contact your organiser.</p>
                ) : null}
              </RegSection>

              <RegSection
                step="2"
                title="Playing profile"
                description={closedUpdateReadOnly ? "This profile is view only." : undefined}
              >
                {closedSelfUpdateMode ? (
                  <p className="reg-hint">
                    {closedUpdateEditable
                      ? "You can edit your photo, role, and sports specs."
                      : scoringMode
                        ? "View only."
                        : "View only — the auction has started."}
                  </p>
                ) : null}

                <div className={roleAuto.className ? `reg-field ${roleAuto.className}` : "reg-field"} style={roleAuto.style}>
                  <RegLabel htmlFor="register-role" marker="required" autofilled={roleAuto.autofilled}>Role</RegLabel>
                  <Select
                    value={form.role}
                    onValueChange={v => f("role", v)}
                    disabled={closedUpdateReadOnly}
                  >
                    <SelectTrigger id="register-role"><SelectValue placeholder="Select role" /></SelectTrigger>
                    <SelectContent className={registrationSelectContentClass}>
                      {roles.length > 0
                        ? roles.map(r => (
                            <SelectItem key={r.id} value={r.roleName}>{r.roleName}</SelectItem>
                          ))
                        : (
                          <SelectItem value="Player">Player</SelectItem>
                        )
                      }
                    </SelectContent>
                  </Select>
                </div>

                {specs.length > 0 ? (
                  [...specs].sort((a, b) => a.displayOrder - b.displayOrder).map(group => {
                    const specAuto = autofillAttrs(`spec:${group.id}`);
                    return (
                    <div key={group.id} className={specAuto.className ? `reg-field ${specAuto.className}` : "reg-field"} style={specAuto.style}>
                      <RegLabel htmlFor={`register-spec-${group.id}`} marker={group.optional ? "optional" : "required"} autofilled={specAuto.autofilled}>
                        {group.groupName}
                      </RegLabel>
                      {group.options.length > 0 ? (
                        <Select
                          value={specSelections[group.id] ?? ""}
                          onValueChange={v => setSpecSelections(prev => ({ ...prev, [group.id]: v }))}
                          disabled={closedUpdateReadOnly}
                        >
                          <SelectTrigger id={`register-spec-${group.id}`}>
                            <SelectValue placeholder={`Select ${group.groupName}`} />
                          </SelectTrigger>
                          <SelectContent className={registrationSelectContentClass}>
                            {group.options.map(opt => (
                              <SelectItem key={opt.id} value={opt.optionName}>
                                {opt.optionName}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      ) : (
                        <Input
                          id={`register-spec-${group.id}`}
                          value={specSelections[group.id] ?? ""}
                          onChange={e => setSpecSelections(prev => ({ ...prev, [group.id]: e.target.value }))}
                          disabled={closedUpdateReadOnly}
                          readOnly={closedUpdateReadOnly}
                        />
                      )}
                    </div>
                    );
                  })
                ) : sportCaps.hasLegacyCricketSpecs ? (
                  <div className="reg-grid-2">
                    <div className={battingAuto.className ? `reg-field ${battingAuto.className}` : "reg-field"} style={battingAuto.style}>
                      <RegLabel htmlFor="register-batting" marker="optional" autofilled={battingAuto.autofilled}>Batting style</RegLabel>
                      <Select
                        value={form.battingStyle || "unset"}
                        onValueChange={v => f("battingStyle", v === "unset" ? "" : v)}
                        disabled={closedUpdateReadOnly}
                      >
                        <SelectTrigger id="register-batting">
                          <SelectValue placeholder="Select batting style" />
                        </SelectTrigger>
                        <SelectContent className={registrationSelectContentClass}>
                          <SelectItem value="unset">Select batting style</SelectItem>
                          <SelectItem value="Right Hand Bat">Right Hand Bat</SelectItem>
                          <SelectItem value="Left Hand Bat">Left Hand Bat</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className={bowlingAuto.className ? `reg-field ${bowlingAuto.className}` : "reg-field"} style={bowlingAuto.style}>
                      <RegLabel htmlFor="register-bowling" marker="optional" autofilled={bowlingAuto.autofilled}>Bowling style</RegLabel>
                      <Select
                        value={form.bowlingStyle || "unset"}
                        onValueChange={v => f("bowlingStyle", v === "unset" ? "" : v)}
                        disabled={closedUpdateReadOnly}
                      >
                        <SelectTrigger id="register-bowling">
                          <SelectValue placeholder="Select bowling style" />
                        </SelectTrigger>
                        <SelectContent className={registrationSelectContentClass}>
                          <SelectItem value="unset">Select bowling style</SelectItem>
                          <SelectItem value="Right-arm fast">Right-arm fast</SelectItem>
                          <SelectItem value="Right-arm medium">Right-arm medium</SelectItem>
                          <SelectItem value="Right-arm spin">Right-arm spin</SelectItem>
                          <SelectItem value="Left-arm fast">Left-arm fast</SelectItem>
                          <SelectItem value="Left-arm spin">Left-arm spin</SelectItem>
                          <SelectItem value="None">None</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className={specializationAuto.className ? `reg-field reg-span-2 ${specializationAuto.className}` : "reg-field reg-span-2"} style={specializationAuto.style}>
                      <RegLabel htmlFor="register-specialization" marker="optional" autofilled={specializationAuto.autofilled}>Specialization</RegLabel>
                      <Input
                        id="register-specialization"
                        value={form.specialization}
                        onChange={e => f("specialization", e.target.value)}
                        disabled={closedUpdateReadOnly}
                        readOnly={closedUpdateReadOnly}
                      />
                    </div>
                  </div>
                ) : null}

                {playerBidValueMode && !existingRegistration && bidValueOptions.length > 0 ? (
                  <div className="reg-field">
                    <RegLabel htmlFor="register-bid" marker="required">Bid value</RegLabel>
                    <Select value={selectedBidValue} onValueChange={setSelectedBidValue} required>
                      <SelectTrigger id="register-bid">
                        <SelectValue placeholder="Choose your bid value" />
                      </SelectTrigger>
                      <SelectContent className={registrationSelectContentClass}>
                        {bidValueOptions.map((amount) => (
                          <SelectItem key={amount} value={String(amount)}>
                            {formatIndianRupee(amount)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                ) : null}

                {showJersey ? (
                  <div className="reg-field">
                    <div className="reg-grid-2">
                      {fieldVisibility.jerseyNumber ? (
                        <div className={jerseyNumberAuto.className ? `reg-field ${jerseyNumberAuto.className}` : "reg-field"} style={jerseyNumberAuto.style}>
                          <RegLabel htmlFor="register-jersey-number" marker="optional" locked={identityFieldsLocked} autofilled={jerseyNumberAuto.autofilled}>Jersey number</RegLabel>
                          <Input
                            id="register-jersey-number"
                            value={form.jerseyNumber}
                            onChange={e => f("jerseyNumber", e.target.value)}
                            inputMode="numeric"
                            disabled={identityFieldsLocked}
                            readOnly={identityFieldsLocked}
                          />
                        </div>
                      ) : null}
                      {fieldVisibility.jerseySize ? (
                        <JerseySizeSelect
                          id="register-jersey-size"
                          value={form.jerseySize}
                          onChange={v => { if (!identityFieldsLocked) f("jerseySize", v); }}
                          marker="optional"
                          contentClassName={registrationSelectContentClass}
                          disabled={identityFieldsLocked}
                          className={jerseySizeAuto.className || undefined}
                          style={jerseySizeAuto.style}
                          autofilled={jerseySizeAuto.autofilled}
                        />
                      ) : null}
                    </div>
                    {identityFieldsLocked ? <p className="reg-hint">To change jersey details, contact your organiser.</p> : null}
                  </div>
                ) : null}

                {!scoringMode && showMatchAvailability ? renderMatchAvailability() : null}

                {showAchievements ? (
                  <div className={achievementsAuto.className ? `reg-field ${achievementsAuto.className}` : "reg-field"} style={achievementsAuto.style}>
                    <RegLabel htmlFor="register-achievements" marker="optional" locked={identityFieldsLocked} autofilled={achievementsAuto.autofilled}>Achievements / bio</RegLabel>
                    <Input
                      id="register-achievements"
                      value={form.achievements}
                      onChange={e => f("achievements", e.target.value)}
                      disabled={identityFieldsLocked}
                      readOnly={identityFieldsLocked}
                    />
                    {identityFieldsLocked ? <p className="reg-hint">To change this, contact your organiser.</p> : null}
                  </div>
                ) : null}

                {showCrichero ? (
                  <div className={cricheroAuto.className ? `reg-field ${cricheroAuto.className}` : "reg-field"} style={cricheroAuto.style}>
                    <RegLabel htmlFor="register-crichero" marker="optional" locked={identityFieldsLocked} autofilled={cricheroAuto.autofilled}>Crichero profile URL</RegLabel>
                    {identityFieldsLocked ? <p className="reg-hint">To change this, contact your organiser.</p> : null}
                    <Input
                      id="register-crichero"
                      value={form.cricheroUrl}
                      onChange={e => f("cricheroUrl", e.target.value)}
                      type="url"
                      inputMode="url"
                      disabled={identityFieldsLocked}
                      readOnly={identityFieldsLocked}
                    />
                  </div>
                ) : null}

                <div ref={photoFieldRef} className={photoAuto.className ? `reg-field ${photoAuto.className}` : "reg-field"} style={photoAuto.style}>
                  <RegLabel marker="required" locked={closedUpdateReadOnly} autofilled={photoAuto.autofilled}>Player photo</RegLabel>
                  <div className="reg-photo">
                    <div className="reg-photo-preview" data-invalid={photoError ? "true" : "false"}>
                      {form.photoUrl ? (
                        <img
                          src={form.photoUrl}
                          alt="Player photo preview"
                          onError={e => { (e.currentTarget as HTMLImageElement).style.display = "none"; }}
                        />
                      ) : (
                        <User className="w-5 h-5" aria-hidden="true" />
                      )}
                    </div>
                    <div className="reg-photo-actions">
                      {!closedUpdateReadOnly ? (
                        <>
                          <Button
                            type="button"
                            variant="outline"
                            className="min-h-11"
                            onClick={() => setPhotoEditorOpen(true)}
                          >
                            {form.photoUrl ? <><Pencil className="w-4 h-4" /> Replace photo</> : <><Upload className="w-4 h-4" /> Upload photo</>}
                          </Button>
                          {form.photoUrl ? (
                            <Button
                              type="button"
                              variant="ghost"
                              className="min-h-11 text-destructive hover:text-destructive"
                              onClick={() => { f("photoUrl", ""); f("photoPublicId", ""); }}
                            >
                              <X className="w-4 h-4" /> Remove
                            </Button>
                          ) : null}
                        </>
                      ) : null}
                    </div>
                  </div>
                  {photoError ? (
                    <p id="register-photo-error" className="text-sm text-destructive" role="alert">{photoError}</p>
                  ) : closedUpdateReadOnly ? (
                    <p id="register-photo-hint" className="reg-hint">To change your photo, contact your organiser.</p>
                  ) : null}
                  <ImageEditorDialog
                    open={photoEditorOpen}
                    onClose={() => setPhotoEditorOpen(false)}
                    initialUrl={form.photoUrl || undefined}
                    aspect={PLAYER_PHOTO_ASPECT}
                    title="Player Photo"
                    exportMaxWidthOrHeight={PLAYER_PHOTO_WIDTH}
                    exportMaxSizeMB={PLAYER_PHOTO_EXPORT_MAX_MB}
                    exportHint="Higher resolution for sharp LED display — use a clear, well-lit photo."
                    onSave={upload => {
                      f("photoUrl", upload.url);
                      f("photoPublicId", upload.publicId);
                      setPhotoError("");
                    }}
                  />
                </div>

                {scoringMode && (showCategorySelect || showMatchAvailability || teams.length > 0) ? (
                  <div className="reg-fields">
                    <h3 className="reg-subhead">Tournament details</h3>
                    {teams.length > 0 ? (
                      <div className={teamAuto.className ? `reg-field ${teamAuto.className}` : "reg-field"} style={teamAuto.style}>
                        <RegLabel htmlFor="register-team" marker="optional" locked={identityFieldsLocked} autofilled={teamAuto.autofilled}>Team</RegLabel>
                        <Select
                          value={form.teamId || "none"}
                          onValueChange={(v) => f("teamId", v === "none" ? "" : v)}
                          disabled={identityFieldsLocked}
                        >
                          <SelectTrigger id="register-team">
                            <SelectValue placeholder="Select team (optional)" />
                          </SelectTrigger>
                          <SelectContent className={registrationSelectContentClass}>
                            <SelectItem value="none">Not in a team / assign later</SelectItem>
                            {teams.map((t) => (
                              <SelectItem key={t.id} value={String(t.id)}>
                                {t.name} {t.shortName ? `(${t.shortName})` : ""}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    ) : null}
                    {showCategorySelect ? (
                      <div className={categoryAuto.className ? `reg-field ${categoryAuto.className}` : "reg-field"} style={categoryAuto.style}>
                        <RegLabel htmlFor="register-category" marker="optional" autofilled={categoryAuto.autofilled}>Category</RegLabel>
                        <Select
                          value={form.categoryId || "none"}
                          onValueChange={(v) => f("categoryId", v === "none" ? "" : v)}
                          disabled={identityFieldsLocked}
                        >
                          <SelectTrigger id="register-category">
                            <SelectValue placeholder="Select category (optional)" />
                          </SelectTrigger>
                          <SelectContent className={registrationSelectContentClass}>
                            <SelectItem value="none">Assign later</SelectItem>
                            {publicCategories.map((cat: { id: number; name: string }) => (
                              <SelectItem key={cat.id} value={String(cat.id)}>
                                {cat.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    ) : null}
                    {showMatchAvailability ? renderMatchAvailability() : null}
                  </div>
                ) : null}
              </RegSection>

              {showConfirmSection ? (
                <RegSection
                  step="3"
                  title={confirmTitle}
                >
                  {declarationRequired ? (
                    <div className="reg-field">
                      <ol className="reg-declaration">
                        {declarationPoints.map((point: string, i: number) => (
                          <li key={i}>{point}</li>
                        ))}
                      </ol>
                      <label className="reg-check" htmlFor="register-declaration">
                        <input
                          id="register-declaration"
                          type="checkbox"
                          checked={declarationAccepted}
                          onChange={e => setDeclarationAccepted(e.target.checked)}
                        />
                        <span className="text-sm font-medium text-foreground">
                          I have read and accept all of the above declarations
                        </span>
                      </label>
                    </div>
                  ) : null}

                  {showWhatsappConsent ? (
                    <label className="reg-check" htmlFor="register-whatsapp">
                      <input
                        id="register-whatsapp"
                        type="checkbox"
                        checked={waConsent}
                        onChange={e => setWaConsent(e.target.checked)}
                      />
                      <span className="text-sm text-muted-foreground">
                        {scoringMode
                          ? "Main tournament ke WhatsApp updates chahiye? (schedule, results). STOP reply karke kabhi bhi unsubscribe kar sakte hain."
                          : "Main tournament ke WhatsApp updates chahiye? (auction alerts, schedule, results). STOP reply karke kabhi bhi unsubscribe kar sakte hain."}
                      </span>
                    </label>
                  ) : null}

                  {paymentEnabled && paymentConfigured ? (
                    <RegistrationPaymentFormSection
                      registrationFee={registrationFee}
                      upiId={upiId}
                      verificationMethod={verificationMethod}
                      utrNumber={utrNumber}
                      paymentScreenshotUrl={paymentScreenshotUrl}
                      onUtrChange={setUtrNumber}
                      onScreenshotChange={(url, publicId) => {
                        setPaymentScreenshotUrl(url);
                        setPaymentScreenshotPublicId(publicId ?? "");
                      }}
                      tournamentName={tournament.name}
                      disabled={registerPending}
                    />
                  ) : null}
                </RegSection>
              ) : null}

              <div className="reg-actions">
                {declarationRequired && !declarationAccepted && !closedSelfUpdateMode ? (
                  <p id="register-submit-hint" className="reg-hint">Accept the declaration above to submit your registration.</p>
                ) : null}
                {closedUpdateReadOnly ? (
                  <RegNotice tone="info">Updates are locked — contact your organiser to change your photo or details.</RegNotice>
                ) : (
                  <Button
                    type="submit"
                    className="w-full min-h-12 text-base font-bold"
                    disabled={registerPending || (!closedSelfUpdateMode && declarationRequired && !declarationAccepted)}
                    aria-describedby={declarationRequired && !declarationAccepted ? "register-submit-hint" : undefined}
                  >
                    {registerPending ? (
                      <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Submitting…</>
                    ) : existingRegistration ? (
                      closedSelfUpdateMode ? "Update photo and specs" : "Update registration"
                    ) : (
                      "Submit registration"
                    )}
                  </Button>
                )}
              </div>
            </form>
          )}
        </div>
      </div>
    </RegistrationFrame>
  );
}
