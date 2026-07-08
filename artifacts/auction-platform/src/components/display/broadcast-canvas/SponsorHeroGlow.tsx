/** Layered premium glow behind sponsor hero logo. */
export function SponsorHeroGlow() {
  return (
    <div
      aria-hidden
      style={{
        position: "absolute",
        left: "50%",
        top: "50%",
        transform: "translate(-50%, -50%)",
        width: 480,
        height: 480,
        pointerEvents: "none",
      }}
    >
      <div className="sponsor-glow-dark-fade" />
      <div className="sponsor-glow-gold sponsor-glow-breath" />
      <div className="sponsor-glow-white" />
    </div>
  );
}
