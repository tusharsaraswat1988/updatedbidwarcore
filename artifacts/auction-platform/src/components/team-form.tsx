import { useState, useEffect } from "react";
import {
  useCreateTeam,
  useUpdateTeam,
  getListTeamsQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Pencil, Upload, Wand2, AlertTriangle, Image as ImageIcon, X, Wallet } from "lucide-react";
import type { AuctionUnit } from "@workspace/api-base/auction-unit";
import { IndianAmountHint } from "@/components/ui/indian-amount-hint";
import { parseIndianMobile, sanitizeMobileInput } from "@workspace/api-base/mobile";
import { parseOptionalEmail } from "@workspace/api-base/email";
import { OptionalEmailField } from "@/components/optional-email-field";
import { ImageEditorDialog } from "@/components/image-editor-dialog";

export function generateShortCode(name: string): string {
  const words = name.trim().toUpperCase().split(/\s+/).filter(Boolean);
  if (words.length === 0) return "";
  if (words.length === 1) return words[0].slice(0, 3);
  const initials = words.map(w => w[0]).join("");
  return initials.slice(0, 3);
}

export function makeUniqueCode(base: string, taken: Set<string>): string {
  if (!taken.has(base)) return base;
  for (let i = 2; i <= 9; i++) {
    const candidate = (base.slice(0, 2) + i).toUpperCase();
    if (!taken.has(candidate)) return candidate;
  }
  for (let i = 65; i <= 90; i++) {
    const candidate = (base.slice(0, 2) + String.fromCharCode(i)).toUpperCase();
    if (!taken.has(candidate)) return candidate;
  }
  return base;
}

const DEFAULT_TEAM_COLORS = [
  "#3B82F6", "#EF4444", "#22C55E", "#F59E0B", "#A855F7", "#EC4899",
  "#06B6D4", "#F97316", "#14B8A6", "#8B5CF6", "#E11D48", "#84CC16",
  "#0EA5E9", "#D97706", "#10B981", "#6366F1",
] as const;

function normalizeHexColor(color: string | null | undefined): string | null {
  if (!color) return null;
  const trimmed = color.trim();
  if (!trimmed) return null;
  const hex = trimmed.startsWith("#") ? trimmed : `#${trimmed}`;
  return hex.toUpperCase();
}

export function pickNextTeamColor(usedColors: (string | null | undefined)[]): string {
  const used = new Set(
    usedColors.map(normalizeHexColor).filter((c): c is string => !!c),
  );
  const available = DEFAULT_TEAM_COLORS.find(c => !used.has(c));
  if (available) return available;
  const index = used.size % DEFAULT_TEAM_COLORS.length;
  return DEFAULT_TEAM_COLORS[index];
}

export function TeamForm({
  tournamentId,
  team,
  existingShortCodes,
  existingTeamColors,
  basePurse = 0,
  onClose,
  purseLabel = "Purse",
  formatShortAmount = (amount) => String(amount ?? 0),
  amountUnit = "INR",
  variant = "auction",
}: {
  tournamentId: number;
  team?: any;
  existingShortCodes: string[];
  existingTeamColors: (string | null | undefined)[];
  /** Required for Auction variant; ignored in Sports (backend defaults purse). */
  basePurse?: number;
  onClose: () => void;
  purseLabel?: string;
  formatShortAmount?: (amount: number | null | undefined) => string;
  amountUnit?: AuctionUnit;
  /** Sports hides Auction purse UI — identity/contact fields only. */
  variant?: "auction" | "sports";
}) {
  const qc = useQueryClient();
  const createTeam = useCreateTeam();
  const updateTeam = useUpdateTeam();
  const isNew = !team;
  const showPurse = variant === "auction";
  const defaultNewColor = pickNextTeamColor(existingTeamColors);

  const [form, setForm] = useState({
    name: team?.name || "",
    shortCode: team?.shortCode || "",
    ownerName: team?.ownerName || "",
    ownerMobile: team?.ownerMobile ? sanitizeMobileInput(team.ownerMobile) : "",
    ownerEmail: team?.ownerEmail || "",
    ownerPhotoUrl: team?.ownerPhotoUrl && !team.ownerPhotoUrl.startsWith("data:") ? team.ownerPhotoUrl : "",
    ownerPhotoPublicId: team?.ownerPhotoPublicId ?? "",
    color: team?.color || defaultNewColor,
    purse: team?.purse || basePurse,
    logoUrl: team?.logoUrl && !team.logoUrl.startsWith("data:") ? team.logoUrl : "",
    logoPublicId: team?.logoPublicId ?? "",
  });
  const [shortCodeManuallyEdited, setShortCodeManuallyEdited] = useState(!isNew);
  const [logoEditorOpen, setLogoEditorOpen] = useState(false);
  const [ownerPhotoEditorOpen, setOwnerPhotoEditorOpen] = useState(false);
  const [error, setError] = useState("");
  const [ownerEmailError, setOwnerEmailError] = useState("");

  const takenCodes = new Set(
    existingShortCodes.filter(c => !team || c !== team.shortCode)
  );

  useEffect(() => {
    if (isNew && !shortCodeManuallyEdited && form.name) {
      const base = generateShortCode(form.name);
      const unique = makeUniqueCode(base, takenCodes);
      setForm(f => ({ ...f, shortCode: unique }));
    }
  }, [form.name, isNew, shortCodeManuallyEdited]);

  useEffect(() => {
    setForm({
      name: team?.name || "",
      shortCode: team?.shortCode || "",
      ownerName: team?.ownerName || "",
      ownerMobile: team?.ownerMobile ? sanitizeMobileInput(team.ownerMobile) : "",
      ownerEmail: team?.ownerEmail || "",
      ownerPhotoUrl: team?.ownerPhotoUrl && !team.ownerPhotoUrl.startsWith("data:") ? team.ownerPhotoUrl : "",
      ownerPhotoPublicId: team?.ownerPhotoPublicId ?? "",
      color: team?.color || pickNextTeamColor(existingTeamColors),
      purse: team?.purse || basePurse,
      logoUrl: team?.logoUrl && !team.logoUrl.startsWith("data:") ? team.logoUrl : "",
      logoPublicId: team?.logoPublicId ?? "",
    });
    setShortCodeManuallyEdited(!isNew);
    setError("");
    setOwnerEmailError("");
  }, [team?.id, team?.ownerPhotoUrl, team?.logoUrl, team?.name, team?.ownerName, team?.ownerMobile, team?.ownerEmail, team?.shortCode, team?.color, team?.purse, basePurse, isNew, existingTeamColors]);

  const shortCodeDuplicate = takenCodes.has(form.shortCode.toUpperCase());

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setOwnerEmailError("");
    const mobileResult = parseIndianMobile(form.ownerMobile);
    if (!mobileResult.ok) {
      setError(mobileResult.error);
      return;
    }
    const ownerEmailResult = parseOptionalEmail(form.ownerEmail);
    if (!ownerEmailResult.ok) {
      setOwnerEmailError(ownerEmailResult.error);
      return;
    }
    if (shortCodeDuplicate) {
      setError(`Short code "${form.shortCode.toUpperCase()}" is already taken by another team`);
      return;
    }
    const payload = {
      name: form.name.trim(),
      shortCode: form.shortCode.trim().toUpperCase(),
      ownerName: form.ownerName.trim(),
      ownerMobile: mobileResult.normalized,
      ownerEmail: ownerEmailResult.email || "",
      ownerPhotoUrl: form.ownerPhotoUrl.trim() || "",
      ownerPhotoPublicId: form.ownerPhotoPublicId.trim() || undefined,
      color: form.color,
      logoUrl: form.logoUrl.trim() || "",
      logoPublicId: form.logoPublicId.trim() || undefined,
      // Sports: omit purse — create defaults from tournament; update leaves purse untouched.
      ...(showPurse ? { purse: form.purse } : {}),
    };
    try {
      if (team) {
        await updateTeam.mutateAsync({ tournamentId, teamId: team.id, data: payload });
      } else {
        await createTeam.mutateAsync({ tournamentId, data: payload });
      }
      await qc.invalidateQueries({ queryKey: getListTeamsQueryKey(tournamentId) });
      onClose();
    } catch (err: any) {
      const body = err?.response?.data;
      if (body?.field === "ownerEmail") {
        setOwnerEmailError(body.error || "Please enter a valid email address");
        return;
      }
      setError(body?.error || err?.message || "Failed to save team");
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {error && (
        <div className="flex items-center gap-2 rounded-md bg-destructive/10 border border-destructive/30 px-3 py-2 text-sm text-destructive">
          <AlertTriangle className="w-4 h-4 flex-shrink-0" />
          {error}
        </div>
      )}

      {/* Team Name (full width) */}
      <div className="space-y-2">
        <Label>Team Name <span className="text-destructive">*</span></Label>
        <Input
          value={form.name}
          onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
          required
          placeholder="Mumbai Hawks"
        />
      </div>

      {/* Short Code — auto-generated, editable */}
      <div className="space-y-2">
        <Label className="flex items-center gap-1.5">
          Short Code <span className="text-destructive">*</span>
          {isNew && !shortCodeManuallyEdited && (
            <span className="text-[10px] font-normal text-primary flex items-center gap-0.5">
              <Wand2 className="w-3 h-3" /> auto-generated
            </span>
          )}
        </Label>
        <div className="relative">
          <Input
            value={form.shortCode}
            onChange={e => {
              setShortCodeManuallyEdited(true);
              setForm(f => ({ ...f, shortCode: e.target.value.toUpperCase() }));
            }}
            required
            placeholder="CSK"
            maxLength={5}
            className={shortCodeDuplicate ? "border-destructive focus-visible:ring-destructive" : ""}
          />
          {isNew && shortCodeManuallyEdited && (
            <button
              type="button"
              className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] text-primary hover:text-primary/80 flex items-center gap-0.5"
              onClick={() => {
                setShortCodeManuallyEdited(false);
                const base = generateShortCode(form.name);
                const unique = makeUniqueCode(base, takenCodes);
                setForm(f => ({ ...f, shortCode: unique }));
              }}
            >
              <Wand2 className="w-3 h-3" /> reset
            </button>
          )}
        </div>
        {shortCodeDuplicate && (
          <p className="text-xs text-destructive flex items-center gap-1">
            <AlertTriangle className="w-3 h-3" />
            This code is already used — please choose a different one
          </p>
        )}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>Owner Name <span className="text-destructive">*</span></Label>
          <Input value={form.ownerName} onChange={e => setForm(f => ({ ...f, ownerName: e.target.value }))} required placeholder="Ravi Mehta" />
        </div>
        <div className="space-y-2">
          <Label>Owner Mobile <span className="text-destructive">*</span></Label>
          <Input
            type="tel"
            inputMode="numeric"
            autoComplete="tel"
            value={form.ownerMobile}
            onChange={e => setForm(f => ({ ...f, ownerMobile: sanitizeMobileInput(e.target.value) }))}
            required
            placeholder="10-digit mobile (e.g. 9876543210)"
            maxLength={10}
          />
          <p className="text-xs text-muted-foreground">Digits only — must start with 6, 7, 8, or 9.</p>
        </div>
      </div>

      <OptionalEmailField
        id="owner-email"
        label="Owner Email Address (Optional)"
        value={form.ownerEmail}
        onChange={v => { setForm(f => ({ ...f, ownerEmail: v })); if (ownerEmailError) setOwnerEmailError(""); }}
        error={ownerEmailError || undefined}
      />

      <div className="space-y-2">
        <Label>Owner Photo <span className="text-xs font-normal text-muted-foreground">(optional)</span></Label>
        <div className="flex items-start gap-3">
          {form.ownerPhotoUrl ? (
            <img
              src={form.ownerPhotoUrl}
              alt="Owner"
              className="h-12 w-12 flex-shrink-0 rounded-full border border-border object-cover"
              onError={e => { (e.currentTarget as HTMLImageElement).style.display = "none"; }}
            />
          ) : (
            <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-full border border-dashed border-border bg-muted/30">
              <ImageIcon className="h-5 w-5 text-muted-foreground/40" />
            </div>
          )}
          <div className="flex-1 space-y-1.5">
            <div className="flex flex-wrap items-center gap-1.5">
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="h-8 gap-1.5"
                onClick={() => setOwnerPhotoEditorOpen(true)}
              >
                {form.ownerPhotoUrl ? <><Pencil className="w-3.5 h-3.5" /> Change Photo</> : <><Upload className="w-3.5 h-3.5" /> Upload Photo</>}
              </Button>
              {form.ownerPhotoUrl && (
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  className="h-8 gap-1 text-xs text-destructive hover:bg-destructive/10 hover:text-destructive"
                  onClick={() => setForm(f => ({ ...f, ownerPhotoUrl: "", ownerPhotoPublicId: "" }))}
                >
                  <X className="w-3.5 h-3.5" /> Remove
                </Button>
              )}
            </div>
            <p className="text-xs text-muted-foreground">Shown on team reports when uploaded.</p>
          </div>
        </div>
        <ImageEditorDialog
          open={ownerPhotoEditorOpen}
          onClose={() => setOwnerPhotoEditorOpen(false)}
          initialUrl={form.ownerPhotoUrl || undefined}
          aspect={1}
          title="Owner Photo"
          onSave={upload => setForm(f => ({ ...f, ownerPhotoUrl: upload.url, ownerPhotoPublicId: upload.publicId }))}
        />
      </div>

      <div className={showPurse ? "grid grid-cols-1 sm:grid-cols-2 gap-4" : "grid grid-cols-1 gap-4"}>
        <div className="space-y-2">
          <Label>Team Color</Label>
          <div className="flex items-center gap-3">
            <input type="color" value={form.color} onChange={e => setForm(f => ({ ...f, color: e.target.value }))} className="w-12 h-10 rounded cursor-pointer border border-border bg-transparent" />
            <Input value={form.color} onChange={e => setForm(f => ({ ...f, color: e.target.value }))} placeholder="#3B82F6" className="font-mono" />
          </div>
        </div>
        {/* Purse — Auction only, and only when editing an existing team */}
        {showPurse && !isNew && (
          <div className="space-y-2">
            <Label>{purseLabel.replace("Team Budget", "Purse")} <span className="text-destructive">*</span></Label>
            <Input type="number" value={form.purse} onChange={e => setForm(f => ({ ...f, purse: parseInt(e.target.value) || 0 }))} required />
            <IndianAmountHint value={form.purse} unit={amountUnit} />
          </div>
        )}
      </div>

      {/* Purse info for new Auction teams */}
      {showPurse && isNew && (
        <div className="flex items-center gap-2 rounded-md bg-muted/20 border border-border/50 px-3 py-2 text-xs text-muted-foreground">
          <Wallet className="w-3.5 h-3.5 flex-shrink-0" />
          Purse automatically set to <span className="text-foreground font-semibold ml-1">{formatShortAmount(basePurse)}</span>
          <span className="ml-1">(from Auction Hub settings)</span>
        </div>
      )}

      <div className="space-y-2">
        <Label>Team Logo</Label>
        <div className="flex items-start gap-3">
          <div className="w-12 h-12 rounded-lg border border-border bg-muted/30 flex items-center justify-center overflow-hidden flex-shrink-0">
            {form.logoUrl ? (
              <img
                src={form.logoUrl}
                alt="Logo"
                className="w-full h-full object-contain"
                onError={e => { (e.currentTarget as HTMLImageElement).style.display = "none"; }}
              />
            ) : (
              <ImageIcon className="w-5 h-5 text-muted-foreground/40" />
            )}
          </div>
          <div className="flex-1 space-y-1.5">
            <div className="flex flex-wrap items-center gap-1.5">
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="h-8 gap-1.5"
                onClick={() => setLogoEditorOpen(true)}
              >
                {form.logoUrl ? <><Pencil className="w-3.5 h-3.5" /> Edit Logo</> : <><Upload className="w-3.5 h-3.5" /> Upload Logo</>}
              </Button>
              {form.logoUrl && (
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  className="h-8 text-xs text-destructive hover:text-destructive hover:bg-destructive/10 gap-1"
                  onClick={() => setForm(f => ({ ...f, logoUrl: "", logoPublicId: "" }))}
                >
                  <X className="w-3.5 h-3.5" /> Remove
                </Button>
              )}
            </div>
          </div>
        </div>
        <ImageEditorDialog
          open={logoEditorOpen}
          onClose={() => setLogoEditorOpen(false)}
          initialUrl={form.logoUrl || undefined}
          aspect={1}
          title="Team Logo"
          onSave={upload => setForm(f => ({ ...f, logoUrl: upload.url, logoPublicId: upload.publicId }))}
        />
      </div>

      <div className="flex gap-3 pt-4">
        <Button
          type="submit"
          className="flex-1"
          disabled={createTeam.isPending || updateTeam.isPending || shortCodeDuplicate}
        >
          {team ? "Update Team" : "Add Team"}
        </Button>
        <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
      </div>
    </form>
  );
}
