/** Reorderable home page content sections (between the fixed hero and CTA). */
export const DEFAULT_HOME_SECTION_ORDER = ['about', 'highlights', 'charity', 'offer'] as const;

export const HOME_SECTION_LABELS: Record<string, string> = {
  about: 'About Us',
  highlights: 'Highlights',
  charity: 'Charity Events',
  offer: 'What We Offer',
};

/**
 * Resolve a saved order into a valid, complete ordering: keep known keys in the
 * saved order, append any default sections the saved list is missing, and drop
 * unknown keys. This keeps the page working if sections are added/removed later.
 */
export function resolveHomeSectionOrder(saved?: string[]): string[] {
  const defaults = [...DEFAULT_HOME_SECTION_ORDER] as string[];
  const validSaved = (saved ?? []).filter((k) => defaults.includes(k));
  const missing = defaults.filter((k) => !validSaved.includes(k));
  return [...validSaved, ...missing];
}
