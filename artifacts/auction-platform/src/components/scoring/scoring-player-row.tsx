/** Photo + name row for cricket lineup pickers. */

import { User, UserRound } from "lucide-react";
import { mapStoredGenderToPortrait } from "@workspace/api-base/player-gender";

export function ScoringPlayerAvatar({
  name,
  photoUrl,
  gender,
  size = "sm",
}: {
  name: string;
  photoUrl?: string | null;
  gender?: string | null;
  size?: "sm" | "md";
}) {
  const dim = size === "md" ? "w-10 h-10" : "w-8 h-8";
  const iconDim = size === "md" ? "w-5 h-5" : "w-4 h-4";

  if (photoUrl) {
    return (
      <img
        src={photoUrl}
        alt=""
        className={`${dim} rounded-lg object-cover flex-none`}
        loading="lazy"
      />
    );
  }

  const portraitGender = mapStoredGenderToPortrait(gender);
  if (portraitGender === "female") {
    return (
      <div
        className={`${dim} rounded-lg bg-muted flex items-center justify-center flex-none`}
      >
        <UserRound className={`${iconDim} text-muted-foreground`} aria-hidden />
      </div>
    );
  }
  if (portraitGender === "male") {
    return (
      <div
        className={`${dim} rounded-lg bg-muted flex items-center justify-center flex-none`}
      >
        <User className={`${iconDim} text-muted-foreground`} aria-hidden />
      </div>
    );
  }

  return (
    <div
      className={`${dim} rounded-lg bg-muted flex items-center justify-center font-semibold text-muted-foreground flex-none text-xs`}
    >
      {name.charAt(0).toUpperCase()}
    </div>
  );
}

export function ScoringPlayerLabel({
  name,
  photoUrl,
  gender,
  role,
}: {
  name: string;
  photoUrl?: string | null;
  gender?: string | null;
  role?: string | null;
}) {
  return (
    <span className="flex items-center gap-3 flex-1 min-w-0">
      <ScoringPlayerAvatar name={name} photoUrl={photoUrl} gender={gender} />
      <span className="text-sm truncate">{name}</span>
      {role ? (
        <span className="text-[10px] text-muted-foreground uppercase shrink-0">{role}</span>
      ) : null}
    </span>
  );
}
