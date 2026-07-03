const PROGRESS_KEY = "academy:v1:last-lesson";

export type AcademyProgressEntry = {
  slug: string;
  title: string;
  episodeNumber: number;
  thumbnailUrl: string | null;
  updatedAt: string;
};

export function saveAcademyProgress(entry: Omit<AcademyProgressEntry, "updatedAt">): void {
  try {
    localStorage.setItem(
      PROGRESS_KEY,
      JSON.stringify({ ...entry, updatedAt: new Date().toISOString() }),
    );
  } catch {
    /* private browsing / quota */
  }
}

export function readAcademyProgress(): AcademyProgressEntry | null {
  try {
    const raw = localStorage.getItem(PROGRESS_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as AcademyProgressEntry;
    if (!parsed.slug || !parsed.title) return null;
    return parsed;
  } catch {
    return null;
  }
}
