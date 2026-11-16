import { useState, useEffect, useCallback } from "react";

const STORAGE_KEY = "bidwar_fan_favorites";

/**
 * useFanFavorites
 * Zero-friction client-side storage for spectator tournament bookmarks.
 * No login required. Defensively handles corrupted/stale localStorage data.
 */
export function useFanFavorites() {
  const [favoriteIds, setFavoriteIds] = useState<number[]>(() => {
    if (typeof window === "undefined") return [];
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return [];
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        return parsed.filter((id): id is number => typeof id === "number" && id > 0);
      }
      return [];
    } catch {
      return [];
    }
  });

  const saveFavorites = useCallback((next: number[]) => {
    setFavoriteIds(next);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    } catch {
      // Storage quota or sandboxed iframe safety
    }
  }, []);

  const isFavorite = useCallback(
    (id: number) => favoriteIds.includes(id),
    [favoriteIds]
  );

  const toggleFavorite = useCallback(
    (id: number, e?: React.MouseEvent) => {
      if (e) {
        e.preventDefault();
        e.stopPropagation();
      }
      setFavoriteIds((prev) => {
        const next = prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id];
        try {
          localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
        } catch {
          // Ignore storage write error
        }
        return next;
      });
    },
    []
  );

  return {
    favoriteIds,
    favoritesCount: favoriteIds.length,
    isFavorite,
    toggleFavorite,
  };
}
