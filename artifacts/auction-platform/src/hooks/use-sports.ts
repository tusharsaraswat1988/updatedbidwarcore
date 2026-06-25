import { useState, useEffect, useMemo } from "react";

export type SportOption = {
  id?: number;
  name: string;
  slug: string;
  active?: boolean;
};

const FALLBACK_SPORTS: SportOption[] = [
  { name: "Cricket", slug: "cricket" },
  { name: "Football", slug: "football" },
  { name: "Kabaddi", slug: "kabaddi" },
  { name: "Badminton", slug: "badminton" },
  { name: "Volleyball", slug: "volleyball" },
  { name: "E-Sports", slug: "esports" },
  { name: "Other", slug: "other" },
];

/** Ensure the current tournament sport stays selectable even if deactivated in admin. */
export function sportOptionsWithCurrent(
  sports: SportOption[],
  currentSlug?: string | null,
): SportOption[] {
  const base = sports.length > 0 ? sports : FALLBACK_SPORTS;
  const slug = currentSlug?.trim().toLowerCase();
  if (!slug || base.some((s) => s.slug === slug)) return base;
  const label = slug
    .split("-")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
  return [...base, { slug, name: `${label} (inactive)` }];
}

export function useSports() {
  const [sports, setSports] = useState<SportOption[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetch("/api/sports")
      .then((r) => r.json())
      .then((data: SportOption[]) => {
        if (!cancelled && Array.isArray(data)) setSports(data);
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return { sports, loading, fallbackSports: FALLBACK_SPORTS };
}

export function useSportOptions(currentSlug?: string | null) {
  const { sports, loading } = useSports();
  const options = useMemo(
    () => sportOptionsWithCurrent(sports, currentSlug),
    [sports, currentSlug],
  );
  return { options, loading };
}
