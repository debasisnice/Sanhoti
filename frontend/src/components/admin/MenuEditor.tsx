import { useState } from 'react';
import { ChevronDown, ChevronRight, ExternalLink, Plus, Trash2, UtensilsCrossed } from 'lucide-react';
import type { EventMenu, MenuCategory, MenuMeal } from '../../types';

const INPUT =
  'w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500';

interface Props {
  value: EventMenu | undefined;
  onChange: (menu: EventMenu) => void;
  /**
   * Durga Puja events keep their menu on the Durga Puja page so there is only
   * one place to edit it. When true, this renders a pointer there instead of a
   * second editor that would silently compete with it.
   */
  durgaPujaLink?: string;
  className?: string;
}

const EMPTY_MENU: EventMenu = { intro: '', meals: [] };

/**
 * Food & menu editor, shared by the event and sub-event forms.
 *
 * Mirrors the Durga Puja page's food editor (meals → labelled categories →
 * dishes) so both produce the same shape, and one renderer plus one schema
 * builder can serve every page. Collapsed by default: most events have no menu
 * and shouldn't be cluttered by an empty editor.
 */
export default function MenuEditor({ value, onChange, durgaPujaLink, className = '' }: Props) {
  const menu = value ?? EMPTY_MENU;
  const meals = menu.meals ?? [];
  const dishCount = meals.reduce(
    (n, m) => n + (m.categories ?? []).reduce((c, cat) => c + (cat.items?.length ?? 0), 0),
    0
  );
  // Open automatically when a menu already exists, so existing content is visible.
  const [open, setOpen] = useState(meals.length > 0);

  /**
   * Raw text of the dish field currently being typed into.
   *
   * The dish input stores an array but displays a joined string, so without
   * this it round-trips parse -> serialise on every keystroke and any character
   * the parser discards becomes impossible to type: a comma leaves an empty
   * trailing segment that `filter(Boolean)` drops, and a trailing space is
   * removed by `trim`. Holding the raw text while the field has focus lets the
   * admin type "Luchi, Alur Dom" normally.
   *
   * One entry is enough — only one input can hold focus, and moving focus (or
   * clicking any button) fires blur first, so the draft is always cleared
   * before a category or meal can be added or removed underneath it.
   */
  const [dishDraft, setDishDraft] = useState<{ key: string; text: string } | null>(null);

  const patch = (p: Partial<EventMenu>) => onChange({ ...menu, ...p });
  const setMeals = (next: MenuMeal[]) => patch({ meals: next });
  const updateMeal = (i: number, p: Partial<MenuMeal>) =>
    setMeals(meals.map((m, idx) => (idx === i ? { ...m, ...p } : m)));
  const updateCategory = (mi: number, ci: number, p: Partial<MenuCategory>) =>
    updateMeal(mi, {
      categories: (meals[mi].categories ?? []).map((c, idx) => (idx === ci ? { ...c, ...p } : c)),
    });

  if (durgaPujaLink) {
    return (
      <div className={`rounded-lg border border-blue-200 bg-blue-50 p-4 ${className}`}>
        <div className="flex items-start gap-3">
          <UtensilsCrossed className="w-5 h-5 text-blue-600 shrink-0 mt-0.5" />
          <div>
            <h4 className="text-sm font-semibold text-gray-900">Food &amp; menu</h4>
            <p className="text-sm text-gray-600 mt-1">
              This is a Durga Puja event, so its menu is managed on the Durga Puja page — that keeps
              a single source of truth rather than two menus that could disagree.
            </p>
            <a
              href={durgaPujaLink}
              className="inline-flex items-center gap-1.5 mt-2 text-sm font-medium text-blue-700 hover:underline"
            >
              Edit the Durga Puja menu <ExternalLink className="w-3.5 h-3.5" />
            </a>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={`rounded-lg border border-gray-200 bg-gray-50 ${className}`}>
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between gap-3 px-4 py-3 text-left"
      >
        <span className="flex items-center gap-2">
          <UtensilsCrossed className="w-4 h-4 text-primary-600" />
          <span className="text-sm font-semibold text-gray-900">Food &amp; menu</span>
          <span className="text-xs text-gray-500">
            {meals.length === 0
              ? 'optional'
              : `${meals.length} meal${meals.length === 1 ? '' : 's'} · ${dishCount} dish${
                  dishCount === 1 ? '' : 'es'
                }`}
          </span>
        </span>
        {open ? (
          <ChevronDown className="w-4 h-4 text-gray-400" />
        ) : (
          <ChevronRight className="w-4 h-4 text-gray-400" />
        )}
      </button>

      {open && (
        <div className="px-4 pb-4 space-y-4">
          <p className="text-xs text-gray-500">
            Listing the actual dishes gives this page specific, unique content — which is what wins
            searches like &ldquo;bengali food orange county&rdquo;. Leave empty if no food is served.
          </p>

          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Intro (optional)</label>
            <textarea
              rows={2}
              className={INPUT}
              value={menu.intro ?? ''}
              onChange={e => patch({ intro: e.target.value })}
              placeholder="One or two lines about the food at this event."
            />
          </div>

          <div className="space-y-4">
            {meals.map((meal, mi) => (
              <div key={mi} className="bg-white border border-gray-200 rounded-lg p-3 space-y-3">
                <div className="flex gap-2">
                  <input
                    type="text"
                    className={INPUT}
                    value={meal.name}
                    onChange={e => updateMeal(mi, { name: e.target.value })}
                    placeholder="Meal — e.g. Saturday Lunch"
                  />
                  <input
                    type="text"
                    className={`${INPUT} sm:w-48`}
                    value={meal.hours ?? ''}
                    onChange={e => updateMeal(mi, { hours: e.target.value })}
                    placeholder="12:30–2:00 PM"
                  />
                  <button
                    type="button"
                    onClick={() => setMeals(meals.filter((_, idx) => idx !== mi))}
                    className="text-red-500 hover:text-red-700 p-2 shrink-0"
                    aria-label="Remove meal"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>

                <input
                  type="text"
                  className={INPUT}
                  value={meal.description ?? ''}
                  onChange={e => updateMeal(mi, { description: e.target.value })}
                  placeholder="Optional detail shown under the meal title"
                />

                <div className="space-y-2 pl-3 border-l-2 border-gray-100">
                  {(meal.categories ?? []).map((cat, ci) => (
                    <div key={ci} className="space-y-1">
                      <div className="flex gap-2">
                        <input
                          type="text"
                          className={`${INPUT} sm:w-56`}
                          value={cat.label}
                          onChange={e => updateCategory(mi, ci, { label: e.target.value })}
                          placeholder="Category — e.g. Non-Veg, Veg, Kids Meal"
                        />
                        <input
                          type="text"
                          className={INPUT}
                          // Show the raw text while this field is being typed
                          // into; fall back to the stored array otherwise.
                          value={
                            dishDraft?.key === `${mi}:${ci}`
                              ? dishDraft.text
                              : (cat.items ?? []).join(', ')
                          }
                          onChange={e => {
                            const raw = e.target.value;
                            setDishDraft({ key: `${mi}:${ci}`, text: raw });
                            // The parsed array is still committed on every
                            // keystroke, so submitting without blurring first
                            // loses nothing.
                            updateCategory(mi, ci, {
                              items: raw
                                .split(',')
                                .map(x => x.trim())
                                .filter(Boolean),
                            });
                          }}
                          onBlur={() => setDishDraft(null)}
                          placeholder="Dishes, comma separated — e.g. Goat Biriyani, Butter Naan"
                        />
                        <button
                          type="button"
                          onClick={() =>
                            updateMeal(mi, {
                              categories: (meal.categories ?? []).filter((_, idx) => idx !== ci),
                            })
                          }
                          className="text-red-500 hover:text-red-700 p-2 shrink-0"
                          aria-label="Remove category"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  ))}
                  <button
                    type="button"
                    onClick={() =>
                      updateMeal(mi, {
                        categories: [...(meal.categories ?? []), { label: '', items: [] }],
                      })
                    }
                    className="inline-flex items-center gap-1 text-xs font-medium text-primary-700 hover:underline"
                  >
                    <Plus className="w-3.5 h-3.5" /> Add category
                  </button>
                </div>
              </div>
            ))}
          </div>

          <button
            type="button"
            onClick={() => setMeals([...meals, { name: '', categories: [] }])}
            className="inline-flex items-center gap-1.5 text-sm font-medium text-primary-700 hover:underline"
          >
            <Plus className="w-4 h-4" /> Add meal
          </button>

          <div className="grid gap-3 sm:grid-cols-3 pt-2 border-t border-gray-200">
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Vegetarian note</label>
              <input
                type="text"
                className={INPUT}
                value={menu.vegetarian ?? ''}
                onChange={e => patch({ vegetarian: e.target.value })}
                placeholder="Veg options at every service"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Kids note</label>
              <input
                type="text"
                className={INPUT}
                value={menu.kidsMenu ?? ''}
                onChange={e => patch({ kidsMenu: e.target.value })}
                placeholder="Kids meal available"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Allergy note</label>
              <input
                type="text"
                className={INPUT}
                value={menu.allergyNotice ?? ''}
                onChange={e => patch({ allergyNotice: e.target.value })}
                placeholder="Contact us about allergies"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
