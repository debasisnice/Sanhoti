import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { Plus, Trash2, ExternalLink } from 'lucide-react';
import { durgaPujaPageAPI, DurgaPujaPageContent, DurgaPujaFaq } from '../../services/api';

/**
 * Admin editor for the public /durga-puja landing page.
 * Update dates and venue each year (ideally by June/July, before other
 * organizations publish theirs) — the URL never changes.
 */
export default function AdminDurgaPuja() {
  const [content, setContent] = useState<DurgaPujaPageContent | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const load = async () => {
      try {
        const data = await durgaPujaPageAPI.getContent();
        setContent(data);
      } catch {
        toast.error('Failed to load Durga Puja page content');
      }
    };
    load();
  }, []);

  const set = <K extends keyof DurgaPujaPageContent>(key: K, value: DurgaPujaPageContent[K]) =>
    setContent(c => (c ? { ...c, [key]: value } : c));

  const setFaq = (index: number, patch: Partial<DurgaPujaFaq>) =>
    setContent(c => {
      if (!c) return c;
      const faqs = c.faqs.map((f, i) => (i === index ? { ...f, ...patch } : f));
      return { ...c, faqs };
    });

  const addFaq = () =>
    setContent(c => (c ? { ...c, faqs: [...c.faqs, { question: '', answer: '' }] } : c));

  const removeFaq = (index: number) =>
    setContent(c => (c ? { ...c, faqs: c.faqs.filter((_, i) => i !== index) } : c));

  const handleSave = async () => {
    if (!content) return;
    if (content.startDate && content.endDate && content.endDate < content.startDate) {
      toast.error('End date cannot be before start date');
      return;
    }
    setSaving(true);
    try {
      const { updated_at, ...patch } = content;
      const saved = await durgaPujaPageAPI.updateContent(patch);
      setContent(saved);
      toast.success('Durga Puja page updated');
    } catch (error: any) {
      toast.error(error?.response?.data?.error || 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  if (!content) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  const inputCls =
    'w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary-500';

  return (
    <div className="max-w-3xl">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Durga Puja Page</h1>
        <a
          href="/durga-puja"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 text-primary-600 hover:text-primary-700 text-sm font-medium"
        >
          View public page <ExternalLink className="w-4 h-4" />
        </a>
      </div>
      <p className="text-gray-600 mb-6">
        This content appears on the public <code>/durga-puja</code> page (and in what Google reads).
        Update the dates and venue each year — ideally by June/July.
      </p>

      <div className="space-y-5 bg-white rounded-xl shadow p-6">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Intro paragraph</label>
          <textarea
            className={inputCls}
            rows={4}
            value={content.intro}
            onChange={e => set('intro', e.target.value)}
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Dates (as shown to visitors)
          </label>
          <input
            className={inputCls}
            value={content.datesText}
            onChange={e => set('datesText', e.target.value)}
            placeholder="October 16–21, 2026 (Shashthi through Vijayadashami)"
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Start date (for Google)
            </label>
            <input
              type="date"
              className={inputCls}
              value={content.startDate}
              onChange={e => set('startDate', e.target.value)}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              End date (for Google)
            </label>
            <input
              type="date"
              className={inputCls}
              value={content.endDate}
              onChange={e => set('endDate', e.target.value)}
            />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Venue name</label>
          <input
            className={inputCls}
            value={content.venueName}
            onChange={e => set('venueName', e.target.value)}
            placeholder="Estancia High School, Costa Mesa"
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Venue city</label>
            <input
              className={inputCls}
              value={content.venueCity}
              onChange={e => set('venueCity', e.target.value)}
              placeholder="Costa Mesa"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Venue note</label>
            <input
              className={inputCls}
              value={content.venueNote}
              onChange={e => set('venueNote', e.target.value)}
              placeholder="Schedule will be announced on our Events page."
            />
          </div>
        </div>

        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="block text-sm font-medium text-gray-700">
              FAQs (shown on the page and eligible for Google rich results)
            </label>
            <button
              type="button"
              onClick={addFaq}
              className="inline-flex items-center gap-1 text-primary-600 hover:text-primary-700 text-sm font-medium"
            >
              <Plus className="w-4 h-4" /> Add FAQ
            </button>
          </div>
          <div className="space-y-4">
            {content.faqs.map((faq, i) => (
              <div key={i} className="border border-gray-200 rounded-lg p-3">
                <div className="flex items-start gap-2">
                  <div className="flex-1 space-y-2">
                    <input
                      className={inputCls}
                      value={faq.question}
                      onChange={e => setFaq(i, { question: e.target.value })}
                      placeholder="Question"
                    />
                    <textarea
                      className={inputCls}
                      rows={2}
                      value={faq.answer}
                      onChange={e => setFaq(i, { answer: e.target.value })}
                      placeholder="Answer"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={() => removeFaq(i)}
                    className="text-red-500 hover:text-red-700 p-1"
                    aria-label={`Remove FAQ ${i + 1}`}
                  >
                    <Trash2 className="w-5 h-5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="pt-2">
          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className="bg-primary-600 text-white px-6 py-2.5 rounded-lg font-semibold hover:bg-primary-700 transition-colors disabled:opacity-50"
          >
            {saving ? 'Saving…' : 'Save Changes'}
          </button>
          {content.updated_at && (
            <span className="ml-3 text-sm text-gray-500">
              Last updated {new Date(content.updated_at).toLocaleString()}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
