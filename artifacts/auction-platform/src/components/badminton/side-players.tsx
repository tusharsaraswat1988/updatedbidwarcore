import type { BadmintonPlayerSlot, BadmintonSideInfo } from "@workspace/badminton-core";
import { getSidePlayerSlots, isPairSide } from "@workspace/badminton-core";
import { cn } from "@/lib/utils";

type PhotoSize = "sm" | "md" | "lg";

const photoSizeClass: Record<PhotoSize, string> = {
  sm: "w-12 h-12 rounded-lg",
  md: "w-20 h-20 rounded-xl",
  lg: "w-28 h-28 rounded-2xl",
};

export function SidePlayerPhotos({
  info,
  matchKind,
  side = "left",
  size = "lg",
  flash = false,
  gameWinFlash = false,
}: {
  info: BadmintonSideInfo;
  matchKind?: string;
  side?: "left" | "right";
  size?: PhotoSize;
  flash?: boolean;
  gameWinFlash?: boolean;
}) {
  const players = getSidePlayerSlots(info);
  const isPair = isPairSide(info, matchKind);
  const isLeft = side === "left";

  if (!isPair) {
    const player = players[0];
    return (
      <PlayerPhoto
        player={player}
        side={side}
        size={size}
        flash={flash}
        gameWinFlash={gameWinFlash}
      />
    );
  }

  return (
    <div className={cn("flex gap-2", size === "lg" ? "flex-row" : "flex-col")}>
      {players.slice(0, 2).map((player, index) => (
        <PlayerPhoto
          key={`${player.label}-${index}`}
          player={player}
          side={side}
          size={size === "lg" ? "md" : "sm"}
          flash={flash}
          gameWinFlash={gameWinFlash}
        />
      ))}
    </div>
  );
}

function PlayerPhoto({
  player,
  side,
  size,
  flash,
  gameWinFlash,
}: {
  player: BadmintonPlayerSlot;
  side: "left" | "right";
  size: PhotoSize;
  flash?: boolean;
  gameWinFlash?: boolean;
}) {
  const isLeft = side === "left";
  const sizeClass = photoSizeClass[size];

  if (player.photoUrl) {
    return (
      <img
        src={player.photoUrl}
        alt={player.label}
        loading="lazy"
        decoding="async"
        className={cn(
          sizeClass,
          "object-cover border-2 transition-all duration-300",
          flash ? "border-white scale-105 shadow-2xl shadow-white/30" :
          isLeft ? "border-[#00e5ff]/30" : "border-[#ff6b6b]/30",
          gameWinFlash && "border-[#ffd700] shadow-2xl shadow-[#ffd700]/40",
        )}
      />
    );
  }

  return (
    <div
      className={cn(
        sizeClass,
        "flex items-center justify-center border-2 transition-all",
        isLeft ? "bg-[#0d2560]/80 border-[#00e5ff]/20" : "bg-[#2d0a3a]/80 border-[#ff6b6b]/20",
        flash && "scale-105 border-white/60",
      )}
    >
      <span className={cn(
        "font-black text-white/30",
        size === "lg" ? "text-4xl" : size === "md" ? "text-2xl" : "text-lg",
      )}>
        {(player.shortLabel?.charAt(0) || player.label?.charAt(0) || "?").toUpperCase()}
      </span>
    </div>
  );
}

export function SidePlayerNames({
  info,
  matchKind,
  side = "left",
  className,
  stacked = false,
}: {
  info: BadmintonSideInfo;
  matchKind?: string;
  side?: "left" | "right";
  className?: string;
  stacked?: boolean;
}) {
  const players = getSidePlayerSlots(info);
  const isPair = isPairSide(info, matchKind);
  const isLeft = side === "left";

  if (!isPair) {
    return (
      <h2 className={cn("text-3xl font-black text-white leading-tight tracking-tight", className)}>
        {info.label}
      </h2>
    );
  }

  if (stacked) {
    return (
      <div className={cn("flex flex-col gap-0.5", !isLeft && "items-end", className)}>
        {players.slice(0, 2).map((player, index) => (
          <p
            key={`${player.label}-${index}`}
            className={cn(
              "font-bold text-white leading-tight",
              isPair && index === 1 ? "text-white/80" : "",
            )}
          >
            {player.label}
          </p>
        ))}
      </div>
    );
  }

  return (
    <h2 className={cn("font-black text-white leading-tight tracking-tight", className ?? "text-2xl")}>
      {info.label}
    </h2>
  );
}

export function SidePlayerShortLabels({
  info,
  matchKind,
  className,
}: {
  info: BadmintonSideInfo;
  matchKind?: string;
  className?: string;
}) {
  const players = getSidePlayerSlots(info);
  const isPair = isPairSide(info, matchKind);

  if (!isPair) {
    return <span className={className}>{info.shortLabel}</span>;
  }

  return (
    <span className={className}>
      {players.slice(0, 2).map((p) => p.shortLabel).join(" / ")}
    </span>
  );
}
