export function UmpireServeReceiveBar({
  serverLabel,
  receiverLabel,
}: {
  serverLabel: string;
  receiverLabel: string;
}) {
  return (
    <div className="shrink-0 mx-3 rounded-2xl border border-white/15 bg-white/5 px-4 py-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="rounded-xl bg-[#ffd700]/10 border border-[#ffd700]/30 px-4 py-3 text-center">
          <p className="text-[#ffd700] text-xs font-bold tracking-[0.2em] uppercase mb-1">
            Serving
          </p>
          <p className="text-white text-lg sm:text-xl font-black">
            🟡 {serverLabel}
          </p>
        </div>
        <div className="rounded-xl bg-[#4fc3f7]/10 border border-[#4fc3f7]/30 px-4 py-3 text-center">
          <p className="text-[#4fc3f7] text-xs font-bold tracking-[0.2em] uppercase mb-1">
            Receiving
          </p>
          <p className="text-white text-lg sm:text-xl font-black">
            👁 {receiverLabel}
          </p>
        </div>
      </div>
    </div>
  );
}
