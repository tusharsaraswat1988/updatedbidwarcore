import React, { useEffect, useState } from 'react';
import { apiClient } from '../lib/api/client';
import { ActivityEvent } from '../lib/api/types';

export const ActivityTicker = () => {
  const [activities, setActivities] = useState<ActivityEvent[]>([]);

  useEffect(() => {
    apiClient.getActivities().then(setActivities);
  }, []);

  return (
    <div className="bg-slate-800 p-4 rounded-lg text-sm text-yellow-500">
      <strong>Live:</strong> {activities.map(a => a.message).join(' | ')}
    </div>
  );
};
