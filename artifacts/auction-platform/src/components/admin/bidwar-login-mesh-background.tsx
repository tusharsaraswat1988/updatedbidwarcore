type BidWarLoginMeshBackgroundProps = {
  stage: "intro" | "passwordPrompt" | "authenticating";
};

/**
 * BidWar Super Admin Seamless Full-Viewport Ambient Mesh Background
 *
 * Implements a luxurious warm Pearl Ivory foundation (#F8F7F2) with champagne-gold
 * atmospheric lighting, warm ivory gradients (#F1EFE7), and soft ambient radiance.
 * Completely free of blue/cyan hues and visible textures.
 */
export function BidWarLoginMeshBackground({ stage }: BidWarLoginMeshBackgroundProps) {
  const isActive = stage !== "intro";

  return (
    <div className="fixed inset-0 w-full h-full overflow-hidden pointer-events-none select-none z-0">
      {/* 1. Seamless Warm Pearl Ivory Foundation */}
      <div className="absolute inset-0 bg-[#F8F7F2]" />

      {/* 2. Unified Full-Viewport Atmospheric Gradient (Warm Champagne & Ivory) */}
      <div
        className="absolute inset-0"
        style={{
          background: `
            radial-gradient(circle 900px at 50% 25%, rgba(246, 241, 230, 0.95) 0%, rgba(248, 247, 242, 0.8) 65%, transparent 100%),
            radial-gradient(ellipse 1200px 800px at 50% 50%, rgba(240, 232, 218, 0.4) 0%, rgba(248, 247, 242, 1) 85%),
            radial-gradient(circle 700px at 85% 90%, rgba(230, 195, 130, 0.08) 0%, transparent 60%),
            radial-gradient(circle 700px at 15% 90%, rgba(240, 215, 160, 0.07) 0%, transparent 60%)
          `,
        }}
      />

      {/* 3. Ambient Floating Meshes (Smooth 110px blur, warm champagne radiance) */}
      <div className="login-mesh login-mesh-a" />
      <div className="login-mesh login-mesh-b" />
      <div className="login-mesh login-mesh-c" />

      {/* 4. Warm Champagne Ambient Lighting Directly Behind Neural Core */}
      <div
        className={`pointer-events-none absolute left-1/2 top-1/2 h-96 w-96 -translate-x-1/2 -translate-y-1/2 rounded-full bg-[radial-gradient(circle,rgba(255,_220,_135,_0.2)_0%,rgba(240,_205,_140,_0.1)_40%,transparent_70%)] blur-3xl transition-all duration-[900ms] ease-out ${
          isActive
            ? "scale-125 opacity-80"
            : "scale-100 opacity-60"
        }`}
      />
    </div>
  );
}
