/** Branded startup loader — matches index.html #bidwar-boot-splash (inline critical CSS). */
export function BootSplash({ label = "Loading BidWar" }: { label?: string }) {
  return (
    <div
      id="bidwar-boot-splash"
      role="status"
      aria-live="polite"
      aria-busy="true"
      aria-label={label}
    >
      <img src="/favicon.svg" alt="" width={64} height={64} decoding="async" />
      <div className="bidwar-boot-spinner" aria-hidden="true" />
    </div>
  );
}
