import { motion } from "framer-motion";
import { Clock, Lock } from "lucide-react";
import { Button } from "@/components/ui/button";

interface AdminLockWarningProps {
  secondsLeft: number;
  lockMinutes: number;
  onContinue: () => void;
}

export function AdminLockWarning({ secondsLeft, lockMinutes, onContinue }: AdminLockWarningProps) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="fixed inset-0 z-[60] flex items-center justify-center p-4"
      style={{ background: "rgba(0,0,0,0.55)" }}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 12 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        className="w-full max-w-md rounded-2xl border border-amber-500/30 bg-card/95 p-6 shadow-2xl backdrop-blur-sm"
      >
        <div className="mb-4 flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-amber-500/15">
            <Clock className="h-5 w-5 text-amber-400" />
          </div>
          <div>
            <p className="font-semibold text-white">Signing out soon</p>
            <p className="text-xs text-muted-foreground">
              No activity detected — you will be signed out for security.
            </p>
          </div>
        </div>

        <div className="mb-5 rounded-xl border border-border/60 bg-muted/20 px-4 py-5 text-center">
          <p className="text-4xl font-black tabular-nums text-amber-400">{secondsLeft}</p>
          <p className="mt-1 text-xs text-muted-foreground">
            second{secondsLeft !== 1 ? "s" : ""} until sign out
          </p>
        </div>

        <p className="mb-4 text-center text-sm text-muted-foreground">
          Click <span className="font-medium text-foreground">Continue</span> to stay signed in for another{" "}
          {lockMinutes} minute{lockMinutes !== 1 ? "s" : ""}.
        </p>

        <Button
          type="button"
          className="w-full gap-2 bg-amber-500 font-bold text-black hover:bg-amber-400"
          size="lg"
          onClick={onContinue}
        >
          <Lock className="h-4 w-4" />
          Continue
        </Button>
      </motion.div>
    </motion.div>
  );
}
