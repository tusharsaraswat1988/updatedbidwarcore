import { useState, useEffect, useMemo } from "react";
import { motion } from "framer-motion";
import { Calendar, Clock, MapPin, Sparkles, ChevronRight, Trophy } from "lucide-react";
import type { DeviceTier } from "@/hooks/useLiveBidLayout";

interface PreAuctionCountdownCardProps {
  auctionDate?: string | null;
  auctionTime?: string | null;
  venue?: string | null;
  city?: string | null;
  sport?: string | null;
  teamColor?: string;
  tier?: DeviceTier;
  onOpenWarRoom?: () => void;
}

interface TimeRemaining {
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
  isPast: boolean;
  isValid: boolean;
}

function calculateTimeRemaining(targetTimestamp: number | null): TimeRemaining {
  if (!targetTimestamp || isNaN(targetTimestamp)) {
    return { days: 0, hours: 0, minutes: 0, seconds: 0, isPast: false, isValid: false };
  }
  const now = Date.now();
  const diff = targetTimestamp - now;

  if (diff <= 0) {
    return { days: 0, hours: 0, minutes: 0, seconds: 0, isPast: true, isValid: true };
  }

  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  const hours = Math.floor((diff / (1000 * 60 * 60)) % 24);
  const minutes = Math.floor((diff / (1000 * 60)) % 60);
  const seconds = Math.floor((diff / 1000) % 60);

  return { days, hours, minutes, seconds, isPast: false, isValid: true };
}

export function PreAuctionCountdownCard({
  auctionDate,
  auctionTime,
  venue,
  city,
  sport = "cricket",
  teamColor = "#eab308",
  tier = "laptop",
  onOpenWarRoom,
}: PreAuctionCountdownCardProps) {
  // Parse target auction timestamp
  const targetTimestamp = useMemo(() => {
    if (!auctionDate) return null;
    const timeStr = auctionTime && auctionTime.trim() ? auctionTime.trim() : "00:00:00";
    // Handle both YYYY-MM-DD and full ISO strings
    const dateFormatted = auctionDate.includes("T") ? auctionDate : `${auctionDate}T${timeStr.length === 5 ? `${timeStr}:00` : timeStr}`;
    const parsed = new Date(dateFormatted).getTime();
    return isNaN(parsed) ? null : parsed;
  }, [auctionDate, auctionTime]);

  const [timeLeft, setTimeLeft] = useState<TimeRemaining>(() => calculateTimeRemaining(targetTimestamp));

  useEffect(() => {
    setTimeLeft(calculateTimeRemaining(targetTimestamp));
    if (!targetTimestamp) return;

    const timer = setInterval(() => {
      setTimeLeft(calculateTimeRemaining(targetTimestamp));
    }, 1000);

    return () => clearInterval(timer);
  }, [targetTimestamp]);

  // Formatted date string (e.g. "Saturday, 29 Nov 2026")
  const formattedDate = useMemo(() => {
    if (!auctionDate) return "Date to be announced";
    try {
      const d = new Date(auctionDate.includes("T") ? auctionDate : `${auctionDate}T12:00:00`);
      if (isNaN(d.getTime())) return auctionDate;
      return new Intl.DateTimeFormat("en-IN", {
        weekday: "short",
        day: "numeric",
        month: "short",
        year: "numeric",
      }).format(d);
    } catch {
      return auctionDate;
    }
  }, [auctionDate]);

  // Formatted time string (e.g. "3:00 PM")
  const formattedTime = useMemo(() => {
    if (!auctionTime) return null;
    try {
      const [hStr, mStr] = auctionTime.split(":");
      const h = parseInt(hStr, 10);
      const m = parseInt(mStr || "0", 10);
      if (isNaN(h)) return auctionTime;
      const period = h >= 12 ? "PM" : "AM";
      const displayH = h % 12 === 0 ? 12 : h % 12;
      const displayM = m < 10 ? `0${m}` : m;
      return `${displayH}:${displayM} ${period}`;
    } catch {
      return auctionTime;
    }
  }, [auctionTime]);

  const locationText = useMemo(() => {
    const parts = [venue?.trim(), city?.trim()].filter(Boolean);
    return parts.length > 0 ? parts.join(", ") : "Venue to be announced";
  }, [venue, city]);

  const isCompact = tier === "mobile";

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: "easeOut" }}
      className={`w-full rounded-2xl sm:rounded-3xl bg-gradient-to-b from-[#221a4f] to-[#18123c] border border-[#4a4478] ${
        isCompact ? "p-4" : "p-6"
      } shadow-2xl relative overflow-hidden flex flex-col justify-between`}
    >
      {/* Background ambient gold/team shimmer */}
      <div
        className="absolute -right-16 -top-16 w-56 h-56 rounded-full pointer-events-none opacity-20 blur-3xl"
        style={{ backgroundColor: teamColor }}
      />
      <div className="absolute -left-12 -bottom-12 w-44 h-44 rounded-full pointer-events-none opacity-10 blur-2xl bg-amber-500" />

      {/* Header Tag */}
      <div className="flex items-center justify-between mb-4 relative z-10">
        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-400/10 border border-amber-400/30 text-amber-300">
          <Calendar className="w-3.5 h-3.5" />
          <span className="text-[11px] font-black uppercase tracking-wider">
            {timeLeft.isPast ? "Auction Commencing Soon" : "Pre-Auction Strategy Hub"}
          </span>
        </div>
        <div className="flex items-center gap-1 text-[11px] font-semibold text-[#a8a0c4] capitalize">
          <Trophy className="w-3.5 h-3.5 text-amber-400" />
          <span>{sport} Auction</span>
        </div>
      </div>

      {/* Main Countdown or Scheduled Status */}
      <div className="relative z-10 my-1">
        {timeLeft.isValid && !timeLeft.isPast ? (
          <div>
            <p className="text-xs font-semibold text-[#a8a0c4] text-center mb-2.5">
              Time Remaining Until Auction Starts
            </p>
            <div className="grid grid-cols-4 gap-2 sm:gap-3 max-w-sm sm:max-w-md mx-auto">
              <CountdownBlock label="DAYS" value={timeLeft.days} />
              <CountdownBlock label="HOURS" value={timeLeft.hours} />
              <CountdownBlock label="MINS" value={timeLeft.minutes} />
              <CountdownBlock label="SECS" value={timeLeft.seconds} highlight />
            </div>
          </div>
        ) : (
          <div className="text-center py-4 px-3 rounded-2xl bg-[#140e2e]/60 border border-[#3d3670]">
            <p className="font-display font-black text-xl sm:text-2xl text-amber-300">
              {timeLeft.isPast ? "AUCTION DAY HAS ARRIVED" : "AUCTION COMING SOON"}
            </p>
            <p className="text-xs text-[#a8a0c4] mt-1">
              {timeLeft.isPast
                ? "Organiser is preparing stage. Lot 1 will open shortly."
                : "Schedule date will be published soon by the organiser."}
            </p>
          </div>
        )}
      </div>

      {/* Event Details: Date, Time & Venue */}
      <div className="mt-4 pt-3.5 border-t border-[#3d3670]/60 relative z-10 flex flex-wrap items-center justify-between gap-2.5 text-xs">
        <div className="flex items-center gap-2 text-[#e2dff5]">
          <Calendar className="w-4 h-4 text-amber-400 shrink-0" />
          <span className="font-bold">{formattedDate}</span>
          {formattedTime && (
            <span className="inline-flex items-center gap-1 text-[#a8a0c4] font-medium border-l border-[#4a4478] pl-2">
              <Clock className="w-3.5 h-3.5 text-amber-400/80" />
              {formattedTime}
            </span>
          )}
        </div>

        <div className="flex items-center gap-1.5 text-[#a8a0c4] truncate max-w-full">
          <MapPin className="w-3.5 h-3.5 text-amber-400/80 shrink-0" />
          <span className="truncate font-medium">{locationText}</span>
        </div>
      </div>

      {/* Primary Action CTA: Open Pre-Auction War Room */}
      {onOpenWarRoom && (
        <div className="mt-4 pt-3 border-t border-[#3d3670]/60 relative z-10">
          <motion.button
            onClick={onOpenWarRoom}
            whileHover={{ scale: 1.01 }}
            whileTap={{ scale: 0.98 }}
            className="w-full py-3 px-4 rounded-xl sm:rounded-2xl font-display font-black text-sm sm:text-base flex items-center justify-between transition-all shadow-lg group cursor-pointer"
            style={{
              backgroundColor: teamColor,
              color: "#0f0c20",
              boxShadow: `0 4px 20px ${teamColor}33`,
            }}
          >
            <div className="flex items-center gap-2.5 text-left">
              <span className="p-1 rounded-lg bg-black/15 text-black">
                <Sparkles className="w-4 h-4" />
              </span>
              <div>
                <p className="leading-tight font-black tracking-wide">OPEN PRE-AUCTION WAR ROOM</p>
                <p className="text-[10px] sm:text-[11px] font-semibold opacity-80 leading-none mt-0.5">
                  Shortlist priority targets & simulate budget allocation
                </p>
              </div>
            </div>
            <ChevronRight className="w-5 h-5 transition-transform group-hover:translate-x-1 shrink-0" />
          </motion.button>
        </div>
      )}
    </motion.div>
  );
}

function CountdownBlock({
  label,
  value,
  highlight = false,
}: {
  label: string;
  value: number;
  highlight?: boolean;
}) {
  const displayVal = value < 10 ? `0${value}` : `${value}`;

  return (
    <div className="flex flex-col items-center justify-center p-2 sm:p-2.5 rounded-xl bg-[#140e2e]/80 border border-[#4a4478] shadow-inner text-center">
      <span
        className={`font-display font-black text-2xl sm:text-3xl tracking-tight leading-none ${
          highlight ? "text-amber-400" : "text-white"
        }`}
      >
        {displayVal}
      </span>
      <span className="text-[9px] sm:text-[10px] font-bold text-[#8f88b5] tracking-widest uppercase mt-1">
        {label}
      </span>
    </div>
  );
}
