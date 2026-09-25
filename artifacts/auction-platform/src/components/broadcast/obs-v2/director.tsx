import { createContext, useContext, type ReactNode } from "react";
import type { BroadcastFrame } from "./contracts";

/**
 * HOOK-UP POINT for presentation components.
 *
 * Components read the current broadcast frame from this context.
 */
const FrameContext = createContext<BroadcastFrame | null>(null);

export function BroadcastFrameProvider({
  frame,
  children,
}: {
  frame: BroadcastFrame;
  children: ReactNode;
}) {
  return <FrameContext.Provider value={frame}>{children}</FrameContext.Provider>;
}

export function useBroadcastDirector(): BroadcastFrame {
  const frame = useContext(FrameContext);
  if (!frame) throw new Error("useBroadcastDirector must be used inside BroadcastFrameProvider");
  return frame;
}
