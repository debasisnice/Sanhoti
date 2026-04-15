/** Suggested example for the admin hero-banner field (placeholder only). */
export const DEFAULT_HOME_HERO_BANNER_MESSAGE = 'শুভ নববর্ষ';

/** Show the hero card only when settings contain non-empty text after trim. */
export function resolveHomeHeroBannerMessage(raw: string | undefined | null): string | null {
  if (raw === undefined || raw === null) return null;
  const t = raw.trim();
  return t.length > 0 ? t : null;
}

/** Fallback copy when settings have no saved text (or empty string). */
export const DEFAULT_HOME_STATEMENTS = {
  about: `Sanhoti is a registered 501(c)(3) nonprofit organization committed to serving the community through cultural enrichment, education, and charitable initiatives. Based in Orange County, California, Sanhoti works to promote cultural awareness, community engagement, and social well-being for individuals and families across diverse backgrounds.

Founded in 2025, Sanhoti's mission is to foster an inclusive and supportive community by preserving cultural heritage while advancing charitable causes. Through community programs, educational activities, and cultural events, we aim to strengthen social bonds, support community needs, and create opportunities for learning and collaboration.

Our organization actively contributes to charitable efforts such as community outreach, food drives, and social support initiatives, ensuring that our impact extends beyond cultural celebration into meaningful service.

Sanhoti is dedicated to inclusivity, equity, and community service. We welcome and serve individuals of all races, religions, and ethnicities, creating a space where diversity is respected, celebrated, and uplifted.`,

  vision: `To build a diverse, inclusive, and socially responsible community where cultural heritage is preserved, shared, and used as a bridge to inspire learning, unity, and charitable impact for present and future generations.`,

  mission: `Sanhoti is a nonprofit organization organized exclusively for charitable, educational, and cultural purposes under Section 501(c)(3) of the Internal Revenue Code.

Our mission is to promote cultural awareness, advance education, and serve the broader community by organizing programs, events, and initiatives that foster inclusion, community engagement, and social well-being.`,

  purpose: `Sanhoti is organized and shall be operated exclusively for charitable and educational purposes, including but not limited to:

- Promoting cultural education and awareness through community events, workshops, and programs.
- Advancing educational initiatives that support learning, arts, and cultural understanding.
- Conducting charitable activities such as community outreach, food drives, and support programs for underserved populations.
- Fostering community development by creating inclusive opportunities for engagement across diverse populations.
- Supporting collaborations with other nonprofit and community organizations to further charitable and educational goals.

No part of the net earnings of the organization shall inure to the benefit of, or be distributable to, its members, directors, officers, or other private persons, except that the organization shall be authorized and empowered to pay reasonable compensation for services rendered and to make payments and distributions in furtherance of the purposes set forth herein.`,
} as const;

export type HomeStatementKey = keyof typeof DEFAULT_HOME_STATEMENTS;
