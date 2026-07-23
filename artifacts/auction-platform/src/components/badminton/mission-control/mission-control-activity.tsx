import { cn } from "@/lib/utils";
import { hubCardClass } from "@/components/badminton/page-chrome";

export type ActivityEvent = {
  id: string;
  at: number;
  text: string;
};

export function MissionControlActivityFeed({ events }: { events: ActivityEvent[] }) {
  if (events.length === 0) return null;

  return (
    <section className={cn(hubCardClass, "p-3 space-y-2")} aria-label="Live activity">
      <h2 className="text-[10px] font-bold uppercase tracking-widest text-white/45">
        Live activity
      </h2>
      <ul className="space-y-1.5 max-h-40 overflow-y-auto">
        {events.slice(0, 12).map((e) => (
          <li key={e.id} className="text-xs text-white/70 flex gap-2">
            <span className="text-white/35 tabular-nums shrink-0">
              {new Date(e.at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
            </span>
            <span>{e.text}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}
