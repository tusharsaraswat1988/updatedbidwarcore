import React from 'react';
import { TournamentCard } from './TournamentCard';
import { TournamentSummary } from '../../../lib/api/types';

export const TournamentSection = ({
  title,
  icon: Icon,
  tournaments,
  emptyMessage,
}: {
  title: string;
  icon: React.ElementType;
  tournaments: TournamentSummary[];
  emptyMessage?: string;
}) => {
  if (tournaments.length === 0) {
    if (!emptyMessage) return null;
    return (
      <section className="mb-12">
        <div className="flex items-center gap-3 mb-6">
          <div className="p-2 rounded-xl bg-slate-100 dark:bg-white/[0.04]">
            <Icon size={20} className="text-amber-500" />
          </div>
          <h2 className="font-display text-xl font-bold text-slate-900 dark:text-white">{title}</h2>
        </div>
        <div className="rounded-2xl border border-dashed border-slate-200 dark:border-white/10 p-8 text-center text-sm text-slate-500 dark:text-slate-400">
          {emptyMessage}
        </div>
      </section>
    );
  }

  return (
    <section className="mb-12">
      <div className="flex items-center gap-3 mb-6">
        <div className="p-2 rounded-xl bg-slate-100 dark:bg-white/[0.04]">
          <Icon size={20} className="text-amber-500" />
        </div>
        <h2 className="font-display text-xl font-bold text-slate-900 dark:text-white">{title}</h2>
        <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-bold text-slate-600 dark:bg-white/[0.06] dark:text-slate-400">
          {tournaments.length}
        </span>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
        {tournaments.map((t) => (
          <TournamentCard key={t.id} t={t} />
        ))}
      </div>
    </section>
  );
};
