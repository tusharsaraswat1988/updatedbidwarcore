import { useState, useMemo } from "react";
import { User } from "lucide-react";

interface PlayerAvatarProps {
  name?: string | null;
  photoUrl?: string | null;
  accentColor?: string;
  className?: string;
  grayscale?: boolean;
}

export function PlayerAvatar({
  name,
  photoUrl,
  accentColor = "#3b82f6",
  className = "w-20 h-28 rounded-xl",
  grayscale = false,
}: PlayerAvatarProps) {
  const [loadFailed, setLoadFailed] = useState(false);

  const initials = useMemo(() => {
    if (!name?.trim()) return "?";
    const parts = name.trim().split(/\s+/);
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  }, [name]);

  const hasValidPhoto = Boolean(photoUrl && !loadFailed);

  return (
    <div
      className={`${className} relative bg-[#241d4c] border border-[#4a4478] flex-shrink-0 overflow-hidden flex items-center justify-center select-none shadow-inner`}
      style={{
        background: hasValidPhoto
          ? undefined
          : `radial-gradient(circle at 50% 35%, ${accentColor}25 0%, #1e1845 85%)`,
      }}
    >
      {hasValidPhoto ? (
        <img
          src={photoUrl!}
          alt={name ?? "Player"}
          onError={() => setLoadFailed(true)}
          className={`w-full h-full object-cover ${grayscale ? "grayscale opacity-75" : "opacity-100"}`}
          loading="eager"
        />
      ) : (
        <div className="flex flex-col items-center justify-center p-2 text-center">
          <div
            className="w-10 h-10 rounded-full flex items-center justify-center border font-display font-black text-sm tracking-wider shadow-md mb-1"
            style={{
              backgroundColor: `${accentColor}20`,
              borderColor: `${accentColor}50`,
              color: accentColor,
            }}
          >
            {initials}
          </div>
          <span className="text-[9px] uppercase tracking-widest text-[#a8a0c4] font-bold line-clamp-1">
            ROSTER
          </span>
        </div>
      )}
    </div>
  );
}
