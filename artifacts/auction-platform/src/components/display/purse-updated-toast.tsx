import { motion, AnimatePresence } from "framer-motion";

export function PurseUpdatedToast({ teamName }: { teamName: string }) {
  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 12 }}
        className="pointer-events-none fixed bottom-10 left-1/2 z-[60] -translate-x-1/2 rounded-xl border border-emerald-400/30 bg-black/75 px-6 py-3 text-center shadow-2xl backdrop-blur-md"
      >
        <p className="text-lg font-bold tracking-wide text-emerald-300">
          {teamName} Purse Updated
        </p>
      </motion.div>
    </AnimatePresence>
  );
}
