import React from 'react';
import { useRoute } from 'wouter';

export const TournamentDetail = () => {
  const [match, params] = useRoute('/tournament/:slug');
  
  if (!match) return <div>404</div>;

  return (
    <main className="p-6">
      <h1 className="text-3xl font-bold">Tournament: {params.slug}</h1>
      <p>Detail view coming soon.</p>
    </main>
  );
};
