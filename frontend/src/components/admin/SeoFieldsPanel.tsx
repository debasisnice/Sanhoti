import { useEffect, useState } from 'react';
import { Plus, Search, Trash2 } from 'lucide-react';
import { artistsAPI } from '../../services/api';
import type { Artist, SeoFaq } from '../../types';

/**
 * Recommended lengths. Google truncates roughly here in desktop results, so the
 * counters warn rather than block — a slightly long title still works, it just
 * gets cut off in the snippet.
 */
const TITLE_MAX = 60;
const DESC_MAX = 160;

export interface SeoFieldsValue {
  meta_title?: string;
  meta_description?: string;
  image_alt?: string;
  faqs?: SeoFaq[];
  artist_ids?: string[];
}

interface Props {
  value: SeoFieldsValue;
  onChange: (patch: Partial<SeoFieldsValue>) => void;
  /** Preview text shown when meta_title / meta_description are left blank. */
  fallbackTitle?: string;
  fallbackDescription?: string;
  /** Hide the artist picker on record types where performers make no sense. */
  showArtists?: boolean;
  className?: string;
}

const INPUT =
  'w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500';

function Counter({ value, max }: { value: string; max: number }) {
  const len = value.length;
  const tone = len === 0 ? 'text-gray-400' : len > max ? 'text-amber-600' : 'text-green-600';
  return (
    <span className={`text-xs font-medium ${tone}`}>
      {len}/{max}
      {len > max ? ' — may be truncated in Google' : ''}
    </span>
  );
}

/**
 * Shared SEO block for admin create/edit forms (events, sub-events).
 *
 * Everything here feeds the public page's `<title>`, meta description, image
 * alt text, FAQ rich result, and performer schema — so what an admin types is
 * what search engines index. Each field carries inline guidance because these
 * are the fields most often left blank, and a blank field means a generated
 * fallback rather than something written for the query the page should win.
 */
export default function SeoFieldsPanel({
  value,
  onChange,
  fallbackTitle,
  fallbackDescription,
  showArtists = true,
  className = '',
}: Props) {
  const [artists, setArtists] = useState<Artist[]>([]);
  const [artistFilter, setArtistFilter] = useState('');

  useEffect(() => {
    if (!showArtists) return;
    let cancelled = false;
    artistsAPI
      .getAll()
      .then(list => {
        if (!cancelled) setArtists(list);
      })
      .catch(() => {
        if (!cancelled) setArtists([]);
      });
    return () => {
      cancelled = true;
    };
  }, [showArtists]);

  const faqs = value.faqs ?? [];
  const selectedArtists = value.artist_ids ?? [];

  const updateFaq = (index: number, patch: Partial<SeoFaq>) => {
    const next = faqs.map((f, i) => (i === index ? { ...f, ...patch } : f));
    onChange({ faqs: next });
  };

  const visibleArtists = artistFilter.trim()
    ? artists.filter(a => a.name.toLowerCase().includes(artistFilter.trim().toLowerCase()))
    : artists;

  return (
    <div className={`border border-gray-200 rounded-lg p-4 bg-gray-50 space-y-5 ${className}`}>
      <div>
        <h4 className="text-sm font-semibold text-gray-900">Search engine optimization</h4>
        <p className="text-xs text-gray-500 mt-0.5">
          These fields control how this page appears in Google. Leave a field blank to use the
          auto-generated value shown beneath it.
        </p>
      </div>

      {/* ---- meta title ---- */}
      <div>
        <div className="flex items-center justify-between mb-1">
          <label className="block text-xs font-medium text-gray-700">
            Page title (Google search headline)
          </label>
          <Counter value={value.meta_title ?? ''} max={TITLE_MAX} />
        </div>
        <input
          type="text"
          className={INPUT}
          value={value.meta_title ?? ''}
          onChange={e => onChange({ meta_title: e.target.value })}
          placeholder="e.g. Akriti Kakar Live in Concert — Durga Puja 2026, Costa Mesa CA"
        />
        <p className="text-xs text-gray-500 mt-1">
          Put the exact words people search first — artist or festival name, then the location.
          {fallbackTitle && !value.meta_title?.trim() && (
            <>
              {' '}
              Currently using: <span className="italic">{fallbackTitle}</span>
            </>
          )}
        </p>
      </div>

      {/* ---- meta description ---- */}
      <div>
        <div className="flex items-center justify-between mb-1">
          <label className="block text-xs font-medium text-gray-700">
            Meta description (grey text under the title)
          </label>
          <Counter value={value.meta_description ?? ''} max={DESC_MAX} />
        </div>
        <textarea
          rows={2}
          className={INPUT}
          value={value.meta_description ?? ''}
          onChange={e => onChange({ meta_description: e.target.value })}
          placeholder="One sentence: who is performing / what is happening, where, and when. Include the city."
        />
        <p className="text-xs text-gray-500 mt-1">
          This is the sales pitch in search results. Mention the city and county — it is how local
          searches match.
          {fallbackDescription && !value.meta_description?.trim() && (
            <>
              {' '}
              Currently using: <span className="italic">{fallbackDescription}</span>
            </>
          )}
        </p>
      </div>

      {/* ---- image alt ---- */}
      <div>
        <label className="block text-xs font-medium text-gray-700 mb-1">
          Image alt text (describes the flyer/photo)
        </label>
        <input
          type="text"
          className={INPUT}
          value={value.image_alt ?? ''}
          onChange={e => onChange({ image_alt: e.target.value })}
          placeholder="e.g. Akriti Kakar performing live at Sanhoti Durga Puja in Costa Mesa, CA"
        />
        <p className="text-xs text-gray-500 mt-1">
          Describe what is actually in the image. Used by screen readers and by Google Images, which
          is a real source of traffic for event photos.
        </p>
      </div>

      {/* ---- artists ---- */}
      {showArtists && (
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">
            Performing artists
          </label>
          <p className="text-xs text-gray-500 mb-2">
            Linking an artist connects this event to their <code>/artists/…</code> page, so a search
            for the artist's name can reach Sanhoti. Create artists under Admin → Artists.
          </p>
          {artists.length > 0 ? (
            <>
              {artists.length > 8 && (
                <div className="relative mb-2">
                  <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    className={`${INPUT} pl-9`}
                    placeholder="Filter artists…"
                    value={artistFilter}
                    onChange={e => setArtistFilter(e.target.value)}
                  />
                </div>
              )}
              <div className="max-h-44 overflow-y-auto border border-gray-200 rounded-lg bg-white divide-y">
                {visibleArtists.map(a => {
                  const checked = selectedArtists.includes(a.artist_id);
                  return (
                    <label
                      key={a.artist_id}
                      className="flex items-center gap-3 px-3 py-2 cursor-pointer hover:bg-gray-50"
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={e =>
                          onChange({
                            artist_ids: e.target.checked
                              ? [...selectedArtists, a.artist_id]
                              : selectedArtists.filter(id => id !== a.artist_id),
                          })
                        }
                        className="rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                      />
                      <span className="text-sm text-gray-800">{a.name}</span>
                      {a.is_active === false && (
                        <span className="text-xs text-amber-600">(inactive)</span>
                      )}
                    </label>
                  );
                })}
                {visibleArtists.length === 0 && (
                  <p className="px-3 py-2 text-sm text-gray-500">No artists match that filter.</p>
                )}
              </div>
            </>
          ) : (
            <p className="text-sm text-gray-500 bg-white border border-gray-200 rounded-lg px-3 py-2">
              No artists created yet. Add them under Admin → Artists to unlock artist-name search
              traffic.
            </p>
          )}
        </div>
      )}

      {/* ---- FAQs ---- */}
      <div>
        <div className="flex items-center justify-between mb-1">
          <label className="block text-xs font-medium text-gray-700">
            Frequently asked questions
          </label>
          <button
            type="button"
            onClick={() => onChange({ faqs: [...faqs, { question: '', answer: '' }] })}
            className="inline-flex items-center gap-1 text-xs font-medium text-primary-700 hover:underline"
          >
            <Plus className="w-3.5 h-3.5" /> Add question
          </button>
        </div>
        <p className="text-xs text-gray-500 mb-2">
          Questions and answers here are published as structured data and can appear directly in
          Google results. Write the questions the way an attendee would actually ask them.
        </p>
        <div className="space-y-3">
          {faqs.map((faq, i) => (
            <div key={i} className="bg-white border border-gray-200 rounded-lg p-3 space-y-2">
              <div className="flex gap-2">
                <input
                  type="text"
                  className={INPUT}
                  value={faq.question}
                  onChange={e => updateFaq(i, { question: e.target.value })}
                  placeholder="e.g. Is parking free at the venue?"
                />
                <button
                  type="button"
                  onClick={() => onChange({ faqs: faqs.filter((_, idx) => idx !== i) })}
                  className="text-red-500 hover:text-red-700 p-2 shrink-0"
                  aria-label="Remove question"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
              <textarea
                rows={2}
                className={INPUT}
                value={faq.answer}
                onChange={e => updateFaq(i, { answer: e.target.value })}
                placeholder="A complete, self-contained answer in one or two sentences."
              />
            </div>
          ))}
          {faqs.length === 0 && (
            <p className="text-sm text-gray-500">
              No FAQs yet. Even two or three help this page win long-tail searches.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
