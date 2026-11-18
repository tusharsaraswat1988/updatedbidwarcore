import React, { useEffect, useState } from 'react';
import { apiClient } from '../lib/api/client';
import { ActivityEvent } from '../lib/api/types';

export const ActivityTicker = () => {
  const [activities, setActivities] = useState<ActivityEvent[]>([]);

  useEffect(() => {
    apiClient.getActivities().then(setActivities);
  }, []);

  return (
    <div className="bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 p-3 rounded-lg flex items-center gap-3 overflow-hidden text-sm text-slate-800 dark:text-slate-300">
      <span className="flex items-center gap-1.5 text-red-500 font-bold uppercase tracking-wider text-[10px]">
        <span className="relative flex h-2 w-2">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
          <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500"></span>
        </span>
        Live
      </span>
      <div className="whitespace-nowrap overflow-hidden text-ellipsis">
        {activities.map(a => a.message).join(' • ')}
      </div>
    </div>
  );
};
