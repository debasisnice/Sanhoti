import { Clock, UtensilsCrossed } from 'lucide-react';
import type { EventMenu } from '../types';

/** Meals worth rendering — a meal with no name is an unfinished admin row. */
export function usableMeals(menu: EventMenu | undefined) {
  return (menu?.meals ?? []).filter(m => m?.name?.trim());
}

/**
 * schema.org Menu node for an event's food.
 *
 * Emitted as a standalone node rather than nested in the Event: schema.org's
 * Event type has no `hasMenu` property (only FoodEstablishment does), so
 * nesting it would be invalid. The real SEO value is the dish names rendered
 * as text on the page; this makes the same content machine-readable.
 */
export function buildMenuJsonLd(
  menu: EventMenu | undefined,
  opts: { name: string; url: string }
): Record<string, unknown> | null {
  const meals = usableMeals(menu);
  if (meals.length === 0) return null;
  return {
    '@context': 'https://schema.org',
    '@type': 'Menu',
    '@id': `${opts.url}#menu`,
    name: `${opts.name} — menu`,
    url: opts.url,
    inLanguage: 'en-US',
    ...(menu?.intro ? { description: menu.intro } : {}),
    hasMenuSection: meals.map(meal => ({
      '@type': 'MenuSection',
      name: [meal.name, meal.hours].filter(Boolean).join(' · '),
      ...(meal.description ? { description: meal.description } : {}),
      hasMenuSection: (meal.categories ?? [])
        .filter(c => c?.label && (c.items ?? []).length > 0)
        .map(cat => ({
          '@type': 'MenuSection',
          name: cat.label,
          hasMenuItem: cat.items.map(item => ({ '@type': 'MenuItem', name: item })),
        })),
    })),
  };
}

/**
 * Renders an event's food menu. Shared by the event detail page, the sub-event
 * page and the aggregated food page so the markup stays consistent.
 */
export default function MenuDisplay({
  menu,
  heading = 'Food & menu',
  className = '',
}: {
  menu: EventMenu | undefined;
  heading?: string;
  className?: string;
}) {
  const meals = usableMeals(menu);
  if (meals.length === 0) return null;

  const notes = [
    menu?.vegetarian && { label: 'Vegetarian', text: menu.vegetarian },
    menu?.kidsMenu && { label: 'Kids', text: menu.kidsMenu },
    menu?.allergyNotice && { label: 'Allergies', text: menu.allergyNotice },
  ].filter(Boolean) as { label: string; text: string }[];

  return (
    <section className={className}>
      <h2 className="flex items-center gap-2 text-2xl font-bold text-gray-900 mb-2">
        <UtensilsCrossed className="w-6 h-6 text-primary-600" /> {heading}
      </h2>
      {menu?.intro && <p className="text-gray-600 mb-5">{menu.intro}</p>}

      <div className="grid gap-6 md:grid-cols-2">
        {meals.map((meal, i) => (
          <article
            key={`${meal.name}-${i}`}
            className="bg-white rounded-2xl shadow-lg p-6"
            style={meal.bgColor ? { backgroundColor: meal.bgColor } : undefined}
          >
            <h3 className="font-bold text-gray-900 text-lg">{meal.name}</h3>
            {meal.hours && (
              <p className="flex items-center gap-1.5 text-sm text-primary-700 font-medium mt-1 mb-3">
                <Clock className="w-4 h-4 shrink-0" /> {meal.hours}
              </p>
            )}
            {meal.description && <p className="text-gray-600 text-sm mb-3">{meal.description}</p>}
            <div className="space-y-3">
              {(meal.categories ?? [])
                .filter(c => c?.label && (c.items ?? []).length > 0)
                .map((cat, ci) => (
                  <div key={`${cat.label}-${ci}`}>
                    <h4
                      className="text-sm font-semibold mb-1"
                      style={{ color: cat.color || '#B8860B' }}
                    >
                      {cat.label}
                    </h4>
                    <ul className="flex flex-wrap gap-2">
                      {cat.items.map(item => (
                        <li
                          key={item}
                          className="text-xs font-medium text-gray-700 bg-gray-100 px-3 py-1 rounded-full"
                        >
                          {item}
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
            </div>
          </article>
        ))}
      </div>

      {notes.length > 0 && (
        <div className="mt-5 grid gap-2 sm:grid-cols-3">
          {notes.map(n => (
            <p key={n.label} className="text-sm text-gray-600">
              <span className="font-semibold text-gray-800">{n.label}:</span> {n.text}
            </p>
          ))}
        </div>
      )}
    </section>
  );
}
