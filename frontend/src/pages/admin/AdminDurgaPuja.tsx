import { useEffect, useRef, useState } from 'react';
import toast from 'react-hot-toast';
import { Plus, Trash2, ExternalLink, Upload, ImageIcon } from 'lucide-react';
import { durgaPujaPageAPI, DurgaPujaPageContent, DurgaPujaFaq } from '../../services/api';

/**
 * Admin editor for the public /durga-puja landing page.
 * Update dates and venue each year (ideally by June/July, before other
 * organizations publish theirs) — the URL never changes.
 */
export default function AdminDurgaPuja() {
  const [content, setContent] = useState<DurgaPujaPageContent | null>(null);
  const [saving, setSaving] = useState(false);
  const [hasImage, setHasImage] = useState(false);
  const [imageVersion, setImageVersion] = useState(0); // cache-buster after upload
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const load = async () => {
      try {
        const data = await durgaPujaPageAPI.getContent();
        setContent(data);
      } catch {
        toast.error('Failed to load Durga Puja page content');
      }
      try {
        const { hasImage } = await durgaPujaPageAPI.hasImage();
        setHasImage(hasImage);
      } catch {
        // ignore
      }
    };
    load();
  }, []);

  const handleImageSelected = async (file: File | undefined) => {
    if (!file) return;
    setUploading(true);
    try {
      await durgaPujaPageAPI.uploadImage(file);
      setHasImage(true);
      setImageVersion(v => v + 1);
      toast.success('Image uploaded');
    } catch (error: any) {
      toast.error(error?.response?.data?.error || 'Failed to upload image');
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleImageDelete = async () => {
    try {
      await durgaPujaPageAPI.deleteImage();
      setHasImage(false);
      toast.success('Image removed');
    } catch {
      toast.error('Failed to remove image');
    }
  };

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
        When you create or update a future event whose name contains "Durga", its dates and venue
        are synced here automatically — you can still override them below. Update each year by
        June/July.
      </p>
      {content.linkedEventId && (
        <p className="text-sm text-gray-500 mb-4">
          Dates/venue last synced from event{' '}
          <a
            href={`/events/${content.linkedEventId}`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-primary-600 hover:text-primary-700 underline"
          >
            {content.linkedEventId}
          </a>
          .
        </p>
      )}

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
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Page image (shown below Dates &amp; Venue on the public page — e.g. the flyer)
          </label>
          {hasImage ? (
            <div className="mb-3">
              <img
                src={`${durgaPujaPageAPI.getImageUrl()}?v=${imageVersion}`}
                alt="Durga Puja page"
                className="max-h-64 rounded-lg border border-gray-200 object-contain bg-gray-50"
              />
            </div>
          ) : (
            <div className="mb-3 flex items-center gap-2 text-gray-400 text-sm">
              <ImageIcon className="w-5 h-5" /> No image uploaded yet
            </div>
          )}
          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/png,image/gif,image/webp"
            className="hidden"
            onChange={e => handleImageSelected(e.target.files?.[0])}
          />
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
              className="inline-flex items-center gap-2 bg-white border-2 border-primary-600 text-primary-600 px-4 py-2 rounded-lg font-medium hover:bg-primary-50 transition-colors disabled:opacity-50"
            >
              <Upload className="w-4 h-4" />
              {uploading ? 'Uploading…' : hasImage ? 'Change Image' : 'Upload Image'}
            </button>
            {hasImage && (
              <button
                type="button"
                onClick={handleImageDelete}
                className="inline-flex items-center gap-2 text-red-600 hover:text-red-700 px-3 py-2 font-medium"
              >
                <Trash2 className="w-4 h-4" /> Remove
              </button>
            )}
          </div>
          <p className="text-xs text-gray-500 mt-1">
            JPEG/PNG/WebP/GIF, max 20MB. Uploading a new image replaces the current one.
          </p>
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
