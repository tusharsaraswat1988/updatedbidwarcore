/** Photo + name row for cricket lineup pickers. */

export function ScoringPlayerAvatar({
  name,
  photoUrl,
  size = "sm",
}: {
  name: string;
  photoUrl?: string | null;
  size?: "sm" | "md";
}) {
  const dim = size === "md" ? "w-10 h-10" : "w-8 h-8";

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
  role,
}: {
  name: string;
  photoUrl?: string | null;
  role?: string | null;
}) {
  return (
    <span className="flex items-center gap-3 flex-1 min-w-0">
      <ScoringPlayerAvatar name={name} photoUrl={photoUrl} />
      <span className="text-sm truncate">{name}</span>
      {role ? (
        <span className="text-[10px] text-muted-foreground uppercase shrink-0">{role}</span>
      ) : null}
    </span>
  );
}
