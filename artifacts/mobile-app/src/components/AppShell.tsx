import type { ReactNode } from "react";

type Props = {
  children: ReactNode;
  className?: string;
};

export function AppShell({ children, className = "" }: Props) {
  return (
    <div className={`h-full flex flex-col bg-[#09090b] safe-top safe-bottom ${className}`}>
      {children}
    </div>
  );
}

export function BrandMark({ size = "lg" }: { size?: "sm" | "lg" }) {
  const box = size === "lg" ? "w-20 h-20 text-3xl" : "w-12 h-12 text-lg";
  return (
    <div
      className={`${box} rounded-2xl mx-auto flex items-center justify-center font-display font-black bg-amber-400/20 text-amber-400 border border-amber-400/30`}
    >
      BW
    </div>
  );
}
