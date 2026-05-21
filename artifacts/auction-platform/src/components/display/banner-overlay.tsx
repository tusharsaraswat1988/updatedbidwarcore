import { memo } from "react";
import { motion } from "framer-motion";
import { ImageOff } from "lucide-react";

/**
 * BannerOverlay — full-screen broadcast banner for felicitation moments,
 * announcements, chief guest welcome, winner reveals, etc.
 *
 * Covers the entire LED screen (absolute inset-0, z-50) so all auction UI
 * disappears while the banner is active. Smooth fade-in/out via
 * AnimatePresence in OverlayManager.
 *
 * fit modes:
 *  "cover"   — image fills the entire screen (Crop to Fill, default)
 *  "contain" — image is letterboxed to preserve full frame
 */
export const BannerOverlay = memo(function BannerOverlay({
  bannerUrl,
  fit,
}: {
  bannerUrl: string | null | undefined;
  fit: string | null | undefined;
}) {
  const isCover = !fit || fit === "cover";

  return (
    <div className="absolute inset-0 bg-black z-50 flex items-center justify-center overflow-hidden">
      {bannerUrl ? (
        <motion.img
          key={bannerUrl}
          src={bannerUrl}
          alt="Main Banner"
          initial={{ opacity: 0, scale: isCover ? 1.04 : 1 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.55, ease: [0.25, 0.46, 0.45, 0.94] }}
          className="absolute inset-0 w-full h-full"
          style={{
            objectFit: isCover ? "cover" : "contain",
            objectPosition: "center",
          }}
          draggable={false}
        />
      ) : (
        <div className="flex flex-col items-center gap-4 text-white/25 select-none">
          <ImageOff className="w-20 h-20" strokeWidth={1} />
          <p className="text-lg font-semibold tracking-wide">No banner uploaded</p>
          <p className="text-sm">Upload a banner in Tournament Settings &rarr; Broadcast</p>
        </div>
      )}
    </div>
  );
});
