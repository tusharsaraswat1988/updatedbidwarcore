import { useState, useEffect, useCallback } from "react";
import { useLocation } from "wouter";
import { useQueryClient } from "@tanstack/react-query";
import { useOrganizerAccountAuth } from "@/hooks/use-auth";
import { useOrganizerInactivityLogout } from "@/hooks/use-organizer-inactivity-logout";
import { AdminLockWarning } from "@/components/admin-lock-warning";
import {
  updateOrganizerProfile,
  changeOrganizerPassword,
  setOrganizerPassword,
  logoutOrganizerAccount,
  getOrganizerWaConsentStatus,
  optInOrganizerWaConsent,
  withdrawOrganizerWaConsent,
  type OrganizerWaConsentStatus,
  type OrganizerInfo,
} from "@/lib/auth";
import {
  clearOrganizerAccountAuth,
  patchOrganizerAccountAuthOrganizer,
} from "@/lib/organizer-account-auth-cache";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ImageEditorDialog } from "@/components/image-editor-dialog";
import { cldUrl } from "@/lib/cloudinary";
import {
  ArrowLeft, User, Mail, Lock, CheckCircle2, AlertTriangle,
  Camera, LogOut, RefreshCw, Eye, EyeOff, KeyRound, MessageSquare, Phone,
} from "lucide-react";

// ─── Avatar ───────────────────────────────────────────────────────────────────

function OrganizerAvatar({ organizer, size = 64 }: { organizer: OrganizerInfo; size?: number }) {
  const initials = organizer.name.split(" ").map(w => w[0]).join("").slice(0, 2).toUpperCase();
  const photoSrc = cldUrl(organizer.photoUrl, "avatar");
  if (photoSrc) {
    return (
      <img
        src={photoSrc}
        alt={organizer.name}
        style={{ width: size, height: size }}
        className="rounded-full object-cover border-2 border-border/60"
      />
    );
  }
  return (
    <div
      className="rounded-full bg-primary/10 border-2 border-primary/30 flex items-center justify-center font-display font-black text-primary"
      style={{ width: size, height: size, fontSize: size * 0.36 }}
    >
      {initials}
    </div>
  );
}

// ─── Section: Profile info ────────────────────────────────────────────────────

function ProfileInfoSection({ organizer, onSaved }: { organizer: OrganizerInfo; onSaved: (o: OrganizerInfo) => void }) {
  const [name, setName] = useState(organizer.name);
  const [email, setEmail] = useState(organizer.email ?? "");
  const [photoUrl, setPhotoUrl] = useState(organizer.photoUrl ?? "");
  const [photoPublicId, setPhotoPublicId] = useState(organizer.photoPublicId ?? "");
  const [photoEditorOpen, setPhotoEditorOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    setName(organizer.name);
    setEmail(organizer.email ?? "");
    setPhotoUrl(organizer.photoUrl ?? "");
    setPhotoPublicId(organizer.photoPublicId ?? "");
  }, [organizer.id, organizer.name, organizer.email, organizer.photoUrl, organizer.photoPublicId]);

  const hasChanges =
    name !== organizer.name ||
    email !== (organizer.email ?? "") ||
    photoUrl !== (organizer.photoUrl ?? "");

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) { setError("Name is required."); return; }
    setLoading(true); setError(""); setSaved(false);
    const r = await updateOrganizerProfile({
      name: name.trim(),
      email: email.trim() || null,
      photoUrl: photoUrl || null,
      photoPublicId: photoPublicId || null,
    });
    setLoading(false);
    if (!r.success) { setError(r.error || "Failed to save."); return; }
    setSaved(true);
    if (r.organizer) onSaved(r.organizer);
    setTimeout(() => setSaved(false), 3000);
  }

  return (
    <Card className="border-border/50 bg-card/40">
      <CardHeader className="pb-2">
        <CardTitle className="text-base font-semibold flex items-center gap-2">
          <User className="w-4 h-4 text-muted-foreground" /> Profile Info
        </CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSave} className="space-y-5">
          {/* Avatar + upload */}
          <div className="flex items-center gap-4">
            <div className="relative flex-shrink-0">
              <OrganizerAvatar organizer={{ ...organizer, name, photoUrl: photoUrl || null }} size={56} />
              <button
                type="button"
                onClick={() => setPhotoEditorOpen(true)}
                className="absolute -bottom-1 -right-1 w-6 h-6 rounded-full bg-primary flex items-center justify-center shadow-lg border-2 border-background hover:bg-primary/90 transition-colors"
                title="Change photo"
              >
                <Camera className="w-3 h-3 text-primary-foreground" />
              </button>
            </div>
            <div>
              <p className="text-sm font-medium text-white">{name || organizer.name}</p>
              <button
                type="button"
                onClick={() => setPhotoEditorOpen(true)}
                className="text-xs text-primary hover:underline mt-0.5"
              >
                {photoUrl ? "Change photo" : "Upload photo"}
              </button>
              {photoUrl && (
                <button
                  type="button"
                  onClick={() => { setPhotoUrl(""); setPhotoPublicId(""); }}
                  className="text-xs text-muted-foreground hover:text-destructive ml-3 mt-0.5"
                >
                  Remove
                </button>
              )}
            </div>
          </div>

          <ImageEditorDialog
            open={photoEditorOpen}
            onClose={() => setPhotoEditorOpen(false)}
            initialUrl={photoUrl || undefined}
            aspect={1}
            title="Profile Photo"
            onSave={upload => { setPhotoUrl(upload.url); setPhotoPublicId(upload.publicId); setError(""); }}
          />

          <div className="grid sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground flex items-center gap-1.5">
                <User className="w-3 h-3" /> Full Name *
              </Label>
              <Input
                value={name}
                onChange={e => setName(e.target.value)}
                placeholder="Your name"
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground flex items-center gap-1.5">
                <Mail className="w-3 h-3" /> Email
              </Label>
              <Input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="name@example.com"
              />
            </div>
          </div>

          {error && (
            <p className="text-destructive text-sm flex items-center gap-1.5">
              <AlertTriangle className="w-3.5 h-3.5" /> {error}
            </p>
          )}

          <div className="flex items-center gap-3">
            <Button type="submit" size="sm" disabled={loading || !hasChanges}>
              {loading ? <RefreshCw className="w-3.5 h-3.5 animate-spin mr-1.5" /> : null}
              Save Changes
            </Button>
            {saved && (
              <span className="text-green-400 text-sm flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4" /> Saved
              </span>
            )}
          </div>
        </form>
      </CardContent>
    </Card>
  );
}

// ─── Section: Change password ─────────────────────────────────────────────────

function ChangePasswordSection({ organizer, onSaved }: { organizer: OrganizerInfo; onSaved: (o: OrganizerInfo) => void }) {
  const hasPassword = !!organizer.hasPassword;
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNext, setShowNext] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (next.length < 6) { setError("New password must be at least 6 characters."); return; }
    if (next !== confirm) { setError("Passwords do not match."); return; }
    setLoading(true); setError("");

    let r: { success: boolean; error?: string };
    if (hasPassword) {
      if (!current) { setError("Please enter your current password."); setLoading(false); return; }
      r = await changeOrganizerPassword({ currentPassword: current, newPassword: next });
    } else {
      r = await setOrganizerPassword(next);
    }

    setLoading(false);
    if (!r.success) { setError(r.error || "Failed to update password."); return; }
    setDone(true);
    setCurrent(""); setNext(""); setConfirm("");
    if ("organizer" in r && r.organizer) onSaved(r.organizer as OrganizerInfo);
    setTimeout(() => setDone(false), 4000);
  }

  return (
    <Card className="border-border/50 bg-card/40">
      <CardHeader className="pb-2">
        <CardTitle className="text-base font-semibold flex items-center gap-2">
          <KeyRound className="w-4 h-4 text-muted-foreground" />
          {hasPassword ? "Change Password" : "Set a Password"}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {!hasPassword && (
          <p className="text-sm text-muted-foreground mb-4">
            You signed in with Google. Set a password so you can also log in with your email directly.
          </p>
        )}
        <form onSubmit={handleSubmit} className="space-y-4">
          {hasPassword && (
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground flex items-center gap-1.5">
                <Lock className="w-3 h-3" /> Current Password
              </Label>
              <div className="relative">
                <Input
                  type={showCurrent ? "text" : "password"}
                  value={current}
                  onChange={e => setCurrent(e.target.value)}
                  placeholder="Your current password"
                  autoComplete="current-password"
                  className="pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowCurrent(v => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  {showCurrent ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>
          )}

          <div className="grid sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground flex items-center gap-1.5">
                <Lock className="w-3 h-3" /> {hasPassword ? "New Password" : "Password"} *
              </Label>
              <div className="relative">
                <Input
                  type={showNext ? "text" : "password"}
                  value={next}
                  onChange={e => setNext(e.target.value)}
                  placeholder="Min 6 characters"
                  autoComplete="new-password"
                  className="pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowNext(v => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  {showNext ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Confirm *</Label>
              <div className="relative">
                <Input
                  type={showConfirm ? "text" : "password"}
                  value={confirm}
                  onChange={e => setConfirm(e.target.value)}
                  placeholder="Repeat password"
                  autoComplete="new-password"
                  className="pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowConfirm(v => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  {showConfirm ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>
          </div>

          {error && (
            <p className="text-destructive text-sm flex items-center gap-1.5">
              <AlertTriangle className="w-3.5 h-3.5" /> {error}
            </p>
          )}

          <div className="flex items-center gap-3">
            <Button type="submit" size="sm" disabled={loading}>
              {loading ? <RefreshCw className="w-3.5 h-3.5 animate-spin mr-1.5" /> : null}
              {hasPassword ? "Update Password" : "Set Password"}
            </Button>
            {done && (
              <span className="text-green-400 text-sm flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4" /> Password updated
              </span>
            )}
          </div>
        </form>
      </CardContent>
    </Card>
  );
}

// ─── Section: WhatsApp Consent ───────────────────────────────────────────────

function OrganizerWhatsAppConsentSection({ organizer }: { organizer: OrganizerInfo }) {
  const [status, setStatus] = useState<OrganizerWaConsentStatus | null>(null);
  const [loading, setLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState("");
  const [successMsg, setSuccessMsg] = useState("");

  const loadStatus = useCallback(async () => {
    setLoading(true);
    const res = await getOrganizerWaConsentStatus();
    setLoading(false);
    if (res.success && res.data) {
      setStatus(res.data);
    } else {
      setError(res.error || "Failed to load WhatsApp consent status.");
    }
  }, []);

  useEffect(() => {
    void loadStatus();
  }, [loadStatus]);

  async function handleToggleConsent() {
    if (!status) return;
    setActionLoading(true);
    setError("");
    setSuccessMsg("");

    if (status.whatsappConsent) {
      const res = await withdrawOrganizerWaConsent();
      setActionLoading(false);
      if (res.success) {
        setStatus(prev => prev ? { ...prev, whatsappConsent: false, whatsappConsentAt: null } : null);
        setSuccessMsg("WhatsApp updates turned off.");
        setTimeout(() => setSuccessMsg(""), 3000);
      } else {
        setError(res.error || "Failed to withdraw consent.");
      }
    } else {
      const res = await optInOrganizerWaConsent();
      setActionLoading(false);
      if (res.success) {
        setStatus(prev => prev ? { ...prev, whatsappConsent: true, whatsappConsentAt: new Date().toISOString() } : null);
        setSuccessMsg("WhatsApp updates activated successfully!");
        setTimeout(() => setSuccessMsg(""), 3000);
      } else {
        setError(res.error || "Failed to opt in. Make sure your phone number is verified.");
      }
    }
  }

  const isOptedIn = status?.whatsappConsent === true;

  return (
    <Card className="border-border/50 bg-card/40">
      <CardHeader className="pb-2">
        <CardTitle className="text-base font-semibold flex items-center justify-between">
          <div className="flex items-center gap-2">
            <MessageSquare className="w-4 h-4 text-emerald-500" />
            WhatsApp Notification Consent
          </div>
          {status && (
            <span
              className={`text-[11px] px-2 py-0.5 rounded-full font-semibold border ${
                isOptedIn
                  ? "bg-emerald-500/15 text-emerald-400 border-emerald-500/30"
                  : "bg-muted text-muted-foreground border-border/50"
              }`}
            >
              {isOptedIn ? "Active" : "Not Enabled"}
            </span>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4 pt-1">
        <p className="text-xs text-muted-foreground leading-relaxed">
          Receive real-time tournament alerts, auction status reminders, player registration notifications, and match schedules directly on your registered WhatsApp number.
        </p>

        <div className="rounded-lg border border-border/40 bg-muted/10 p-3 space-y-2 text-xs">
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground flex items-center gap-1.5">
              <Phone className="w-3.5 h-3.5" /> Registered Mobile:
            </span>
            <span className="font-medium text-foreground">
              {organizer.mobile || "No mobile number configured"}
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">Mobile Verification:</span>
            <span className={organizer.phoneVerified ? "text-emerald-400 font-medium" : "text-amber-400 font-medium"}>
              {organizer.phoneVerified ? "Verified" : "Pending Verification"}
            </span>
          </div>
          {status?.whatsappConsentAt && (
            <div className="flex items-center justify-between text-[11px]">
              <span className="text-muted-foreground">Consent Granted:</span>
              <span className="text-muted-foreground">
                {new Date(status.whatsappConsentAt).toLocaleDateString("en-IN", {
                  day: "numeric",
                  month: "short",
                  year: "numeric",
                })}
              </span>
            </div>
          )}
        </div>

        {error && (
          <p className="text-destructive text-sm flex items-center gap-1.5">
            <AlertTriangle className="w-3.5 h-3.5" /> {error}
          </p>
        )}

        {successMsg && (
          <p className="text-emerald-400 text-sm flex items-center gap-1.5">
            <CheckCircle2 className="w-3.5 h-3.5" /> {successMsg}
          </p>
        )}

        <div className="flex items-center gap-3 pt-1">
          <Button
            type="button"
            size="sm"
            variant={isOptedIn ? "outline" : "default"}
            disabled={loading || actionLoading || !organizer.mobile}
            onClick={handleToggleConsent}
            className={!isOptedIn ? "bg-emerald-600 hover:bg-emerald-500 text-white" : ""}
          >
            {actionLoading ? (
              <RefreshCw className="w-3.5 h-3.5 animate-spin mr-1.5" />
            ) : (
              <MessageSquare className="w-3.5 h-3.5 mr-1.5" />
            )}
            {isOptedIn ? "Withdraw WhatsApp Consent" : "Opt In to WhatsApp Updates"}
          </Button>

          {!organizer.mobile && (
            <span className="text-xs text-amber-400">
              Configure your mobile number first.
            </span>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function OrganizerProfilePage() {
  const [, navigate] = useLocation();
  const queryClient = useQueryClient();
  const { organizer, isLoggedIn, isLoading } = useOrganizerAccountAuth();

  useEffect(() => {
    if (isLoading) return;
    if (!isLoggedIn) {
      navigate("/organizer?next=/organizer/profile");
    }
  }, [isLoading, isLoggedIn, navigate]);

  async function handleLogout() {
    await logoutOrganizerAccount();
    clearOrganizerAccountAuth(queryClient);
    navigate("/organizer");
  }

  function handleOrganizerSaved(next: OrganizerInfo) {
    patchOrganizerAccountAuthOrganizer(queryClient, next);
  }

  const {
    warningVisible,
    warningSecondsLeft,
    continueSession,
    lockMinutes,
  } = useOrganizerInactivityLogout({
    enabled: isLoggedIn,
  });

  if (isLoading) {
    return <div className="lovable-theme min-h-screen dark" />;
  }

  if (!organizer) return null;

  return (
    <div className="lovable-theme min-h-screen text-foreground dark">
      {/* Header */}
      <div className="border-b border-border/50 bg-background/75 sticky top-0 backdrop-blur-xl z-10">
        <div className="max-w-2xl mx-auto px-6 h-14 flex items-center gap-3">
          <button
            onClick={() => navigate("/organizer")}
            className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors text-sm"
          >
            <ArrowLeft className="w-4 h-4" />
            Dashboard
          </button>
          <div className="w-px h-5 bg-border/60" />
          <span className="font-semibold text-sm text-foreground">Account Settings</span>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-6 py-8 space-y-6">
        {/* Avatar + name header */}
        <div className="flex items-center gap-4">
          <OrganizerAvatar organizer={organizer} size={64} />
          <div>
            <h1 className="font-display font-black text-2xl text-foreground leading-tight">{organizer.name}</h1>
            <p className="text-sm text-muted-foreground">{organizer.email ?? organizer.mobile ?? ""}</p>
          </div>
        </div>

        <ProfileInfoSection organizer={organizer} onSaved={handleOrganizerSaved} />
        <OrganizerWhatsAppConsentSection organizer={organizer} />
        <ChangePasswordSection organizer={organizer} onSaved={handleOrganizerSaved} />

        {/* Sign out */}
        <div className="pt-2 border-t border-border/30">
          <Button
            variant="ghost"
            size="sm"
            className="text-destructive hover:text-destructive gap-1.5"
            onClick={handleLogout}
          >
            <LogOut className="w-4 h-4" /> Sign Out
          </Button>
        </div>
      </div>

      {warningVisible && (
        <AdminLockWarning
          secondsLeft={warningSecondsLeft}
          lockMinutes={lockMinutes}
          onContinue={continueSession}
        />
      )}
    </div>
  );
}
