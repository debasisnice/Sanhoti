import { useCallback, useEffect, useRef, useState } from 'react';
import toast from 'react-hot-toast';
import { Plus, Trash2, ExternalLink, Upload, ImageIcon, Calendar, Ticket } from 'lucide-react';
import {
  durgaPujaPageAPI,
  DurgaPujaPageContent,
  DurgaPujaFaq,
  TicketLink,
  subEventsAPI,
} from '../../services/api';
import { SubEvent } from '../../types';
import { formatDateWithTime } from '../../utils/dateUtils';

import { durgaPujaPagePath } from '../../utils/durgaPuja';

/**
 * Admin editor for public /durga-puja-YYYY pages — active or archived years.
 */
export default function AdminDurgaPuja() {
  const [content, setContent] = useState<DurgaPujaPageContent | null>(null);
  const [editYear, setEditYear] = useState<number>(new Date().getFullYear());
  const [activeYear, setActiveYear] = useState<number>(new Date().getFullYear());
  const [availableYears, setAvailableYears] = useState<number[]>([]);
  const [loadingYear, setLoadingYear] = useState(true);
  const [saving, setSaving] = useState(false);
  const [hasImage, setHasImage] = useState(false);
  const [imageVersion, setImageVersion] = useState(0); // cache-buster after upload
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [subEvents, setSubEvents] = useState<SubEvent[]>([]);
  const [subEventImages, setSubEventImages] = useState<Record<string, string>>({});
  const [togglingId, setTogglingId] = useState<string | null>(null);

  const loadYear = useCallback(async (year: number) => {
    setLoadingYear(true);
    setSubEvents([]);
    setSubEventImages({});
    setHasImage(false);
    try {
      const data = await durgaPujaPageAPI.getContent(year);
      setEditYear(year);
      setContent(data);
      try {
        const { hasImage: img } = await durgaPujaPageAPI.hasImage(year);
        setHasImage(img);
      } catch {
        setHasImage(false);
      }
      if (data.linkedEventId) {
        try {
          const all = await subEventsAPI.getByEventId(data.linkedEventId);
          const active = all
            .filter(se => se.is_active !== false)
            .sort((a, b) => {
              const ta = a.sub_event_start_dt ? new Date(a.sub_event_start_dt).getTime() : 0;
              const tb = b.sub_event_start_dt ? new Date(b.sub_event_start_dt).getTime() : 0;
              return ta - tb;
            });
          setSubEvents(active);

          const imagesMap: Record<string, string> = {};
          await Promise.all(
            active.map(async se => {
              if (!se.event_image_path) return;
              try {
                const filenames = await subEventsAPI.getImages(se.sub_event_id);
                if (filenames && filenames.length > 0) {
                  imagesMap[se.sub_event_id] = subEventsAPI.getImageUrl(se.sub_event_id, filenames[0]);
                }
              } catch {
                /* optional */
              }
            })
          );
          setSubEventImages(imagesMap);
        } catch {
          setSubEvents([]);
        }
      }
    } catch {
      toast.error(`Failed to load Durga Puja page for ${year}`);
      setContent(null);
    } finally {
      setLoadingYear(false);
    }
  }, []);

  useEffect(() => {
    const init = async () => {
      try {
        const { years, activeYear: live } = await durgaPujaPageAPI.listYears();
        setAvailableYears(years);
        setActiveYear(live);
        await loadYear(live);
      } catch {
        toast.error('Failed to load Durga Puja page years');
        setLoadingYear(false);
      }
    };
    void init();
  }, [loadYear]);

  const handleYearChange = (year: number) => {
    if (year === editYear || loadingYear) return;
    void loadYear(year);
  };

  const toggleSubEventVisibility = async (subEvent: SubEvent) => {
    const next = !subEvent.show_in_durga_puja_page;
    setTogglingId(subEvent.sub_event_id);
    try {
      await subEventsAPI.setDurgaPujaVisibility(subEvent.sub_event_id, next);
      setSubEvents(prev =>
        prev.map(se =>
          se.sub_event_id === subEvent.sub_event_id ? { ...se, show_in_durga_puja_page: next } : se
        )
      );
      toast.success(next ? 'Sub-event shown on Durga Puja page' : 'Sub-event hidden');
    } catch (error: any) {
      toast.error(error?.response?.data?.error || 'Failed to update visibility');
    } finally {
      setTogglingId(null);
    }
  };

  const handleImageSelected = async (file: File | undefined) => {
    if (!file) return;
    setUploading(true);
    try {
      await durgaPujaPageAPI.uploadImage(editYear, file);
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
      await durgaPujaPageAPI.deleteImage(editYear);
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

  const setTicketLink = (index: number, patch: Partial<TicketLink>) =>
    setContent(c => {
      if (!c) return c;
      const ticketLinks = (c.ticketLinks ?? []).map((t, i) =>
        i === index ? { ...t, ...patch } : t
      );
      return { ...c, ticketLinks };
    });

  const addTicketLink = () =>
    setContent(c =>
      c ? { ...c, ticketLinks: [...(c.ticketLinks ?? []), { label: '', url: '' }] } : c
    );

  const removeTicketLink = (index: number) =>
    setContent(c =>
      c ? { ...c, ticketLinks: (c.ticketLinks ?? []).filter((_, i) => i !== index) } : c
    );

  const handleSave = async () => {
    if (!content) return;
    if (content.startDate && content.endDate && content.endDate < content.startDate) {
      toast.error('End date cannot be before start date');
      return;
    }
    for (const link of content.ticketLinks ?? []) {
      const label = link.label.trim();
      const url = link.url.trim();
      if (!label && !url) continue; // empty rows are dropped by the backend
      if (!label || !url) {
        toast.error('Each ticket link needs both a label and a URL');
        return;
      }
      if (!/^https?:\/\//i.test(url)) {
        toast.error('Ticket link URLs must start with http:// or https://');
        return;
      }
    }
    setSaving(true);
    try {
      // Strip server-managed fields; the rest is the editable patch.
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { updated_at, year: _y, ...patch } = content;
      const saved = await durgaPujaPageAPI.updateContent(editYear, patch);
      setContent(saved);
      toast.success(`Durga Puja ${editYear} page updated`);
    } catch (error: any) {
      toast.error(error?.response?.data?.error || 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  if (loadingYear && !content) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  if (!content) {
    return (
      <div className="max-w-5xl w-full py-12 text-center text-gray-600">
        <p>No Durga Puja page found for the selected year.</p>
      </div>
    );
  }

  const isArchived = editYear !== activeYear;

  const inputCls =
    'w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary-500';

  return (
    <div className="max-w-5xl w-full">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-3xl font-bold text-gray-900">Durga Puja Page</h1>
        <div className="flex items-center gap-3">
          <select
            id="dp-year"
            aria-label="Celebration year"
            className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 disabled:opacity-50"
            value={editYear}
            disabled={loadingYear}
            onChange={e => handleYearChange(Number(e.target.value))}
          >
            {availableYears.map(y => (
              <option key={y} value={y}>
                {y}
                {y === activeYear ? ' (live)' : ''}
              </option>
            ))}
          </select>
          <a
            href={durgaPujaPagePath(editYear)}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-primary-600 hover:text-primary-700 text-sm font-medium whitespace-nowrap"
          >
            View public page <ExternalLink className="w-4 h-4" />
          </a>
        </div>
      </div>
      <p className="text-gray-600 mb-6">
        This content appears on the public <code>{durgaPujaPagePath(editYear)}</code> page (and in what
        Google reads). Use the year selector above to edit archived pages. When you create or update a
        future event whose name contains &quot;Durga&quot;, its dates and venue are synced to the live
        year automatically — you can still override them below. Update each year by June/July.
      </p>
      {content.linkedEventId && (
        <p className="text-sm text-gray-500 mb-4">
          {isArchived && (
            <>
              <span className="text-gray-600">Archived year — </span>
            </>
          )}
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
                src={`${durgaPujaPageAPI.getImageUrl(editYear)}?v=${imageVersion}`}
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

        <div className="border border-gray-200 rounded-lg p-4 bg-gray-50">
          <label className="block text-sm font-medium text-gray-700 mb-1">
            <span className="inline-flex items-center gap-1.5">
              <Ticket className="w-4 h-4 text-primary-600" /> Ticketing on the public page
            </span>
          </label>
          <p className="text-xs text-gray-500 mb-3">
            Choose what the public {content.year} page offers — in-website booking, external link(s),
            both, or switch everything off.
          </p>
          <div className="space-y-2.5">
            <label className="flex items-start gap-2 text-sm text-gray-700">
              <input
                type="checkbox"
                className="mt-0.5 h-4 w-4 accent-primary-600"
                checked={content.showInternalBooking !== false}
                disabled={content.ticketsOff === true}
                onChange={e => set('showInternalBooking', e.target.checked)}
              />
              <span>
                <span className="font-medium">In-website booking</span> — show the “Book Your Seat”
                button (also requires the seat system to be open in Ticket Settings).
              </span>
            </label>
            <label className="flex items-start gap-2 text-sm text-gray-700">
              <input
                type="checkbox"
                className="mt-0.5 h-4 w-4 accent-primary-600"
                checked={content.showExternalTickets !== false}
                disabled={content.ticketsOff === true}
                onChange={e => set('showExternalTickets', e.target.checked)}
              />
              <span>
                <span className="font-medium">External ticket link(s)</span> — show the buttons
                configured below.
              </span>
            </label>
            <label className="flex items-start gap-2 text-sm text-gray-700">
              <input
                type="checkbox"
                className="mt-0.5 h-4 w-4 accent-primary-600"
                checked={content.ticketsOff === true}
                onChange={e => set('ticketsOff', e.target.checked)}
              />
              <span>
                <span className="font-medium">Off</span> — hide the booking buttons and show a
                “Tickets coming soon” message on the public page.
              </span>
            </label>
          </div>
        </div>

        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="block text-sm font-medium text-gray-700">
              <span className="inline-flex items-center gap-1.5">
                <Ticket className="w-4 h-4 text-primary-600" /> Ticket booking links
              </span>
            </label>
            <button
              type="button"
              onClick={addTicketLink}
              className="inline-flex items-center gap-1 text-primary-600 hover:text-primary-700 text-sm font-medium"
            >
              <Plus className="w-4 h-4" /> Add Link
            </button>
          </div>
          <p className="text-xs text-gray-500 mb-3">
            Links to external ticketing sites (Eventbrite, Sulekha, etc.) shown as buttons in the
            "Tickets" section of the public page. Leave empty to show a "Ticket booking opens soon"
            placeholder instead.
          </p>
          {(content.ticketLinks ?? []).length > 0 && (
            <div className="space-y-3 mb-3">
              {(content.ticketLinks ?? []).map((link, i) => (
                <div key={i} className="border border-gray-200 rounded-lg p-3">
                  <div className="flex items-start gap-2">
                    <div className="flex-1 grid grid-cols-1 sm:grid-cols-2 gap-2">
                      <input
                        className={inputCls}
                        value={link.label}
                        onChange={e => setTicketLink(i, { label: e.target.value })}
                        placeholder="Label (e.g. Full Event Pass)"
                      />
                      <input
                        className={inputCls}
                        type="url"
                        value={link.url}
                        onChange={e => setTicketLink(i, { url: e.target.value })}
                        placeholder="https://…"
                      />
                    </div>
                    <button
                      type="button"
                      onClick={() => removeTicketLink(i)}
                      className="text-red-500 hover:text-red-700 p-1"
                      aria-label={`Remove ticket link ${i + 1}`}
                    >
                      <Trash2 className="w-5 h-5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
          <input
            className={inputCls}
            value={content.ticketsNote ?? ''}
            onChange={e => set('ticketsNote', e.target.value)}
            placeholder="Optional note, e.g. Early-bird pricing until Sep 1"
          />
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

      {/* Sub-events with banners shown on the public Durga Puja page */}
      <div className="mt-8 bg-white rounded-xl shadow p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-1">Sub-events on the Durga Puja page</h2>
        <p className="text-gray-600 text-sm mb-4">
          Turn a sub-event on to show it (with its banner) on the public{' '}
          <code>{durgaPujaPagePath(editYear)}</code>{' '}
          page, below Dates &amp; Venue. Sub-events come from the linked Durga Puja event.
        </p>

        {!content.linkedEventId ? (
          <p className="text-sm text-gray-500">
            No Durga Puja event is linked yet. Create or update a "Durga Puja" event with sub-events,
            and they will appear here.
          </p>
        ) : subEvents.length === 0 ? (
          <p className="text-sm text-gray-500">
            The linked event{' '}
            <a
              href={`/events/${content.linkedEventId}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary-600 hover:text-primary-700 underline"
            >
              {content.linkedEventId}
            </a>{' '}
            has no active sub-events yet. Add sub-events to it from the Events admin.
          </p>
        ) : (
          <div className="space-y-3">
            {subEvents.map(se => {
              const banner = subEventImages[se.sub_event_id];
              const on = se.show_in_durga_puja_page === true;
              return (
                <div
                  key={se.sub_event_id}
                  className="flex items-center gap-4 border border-gray-200 rounded-lg p-3"
                >
                  <div className="w-20 h-20 flex-shrink-0 rounded-md bg-gray-50 border border-gray-100 flex items-center justify-center overflow-hidden">
                    {banner ? (
                      <img src={banner} alt={se.sub_event_name} className="w-full h-full object-cover" />
                    ) : (
                      <ImageIcon className="w-6 h-6 text-gray-300" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-gray-900 truncate">{se.sub_event_name}</p>
                    {se.sub_event_start_dt && (
                      <p className="text-sm text-gray-500 flex items-center gap-1">
                        <Calendar className="w-3.5 h-3.5" />
                        {formatDateWithTime(se.sub_event_start_dt)}
                      </p>
                    )}
                    {!banner && (
                      <p className="text-xs text-amber-600 mt-0.5">
                        No banner uploaded — upload one from the Events admin for the best look.
                      </p>
                    )}
                  </div>
                  <button
                    type="button"
                    role="switch"
                    aria-checked={on}
                    disabled={togglingId === se.sub_event_id}
                    onClick={() => toggleSubEventVisibility(se)}
                    className={`relative inline-flex h-6 w-11 flex-shrink-0 items-center rounded-full transition-colors disabled:opacity-50 ${
                      on ? 'bg-primary-600' : 'bg-gray-300'
                    }`}
                    title={on ? 'Shown on Durga Puja page' : 'Hidden'}
                  >
                    <span
                      className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform ${
                        on ? 'translate-x-5' : 'translate-x-0.5'
                      }`}
                    />
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
