import { useCallback, useEffect, useRef, useState } from 'react';
import toast from 'react-hot-toast';
import { Plus, Trash2, ExternalLink, Upload, ImageIcon, Calendar, Ticket, FileText } from 'lucide-react';
import {
  durgaPujaPageAPI,
  DurgaPujaPageContent,
  DurgaPujaFaq,
  TicketLink,
  DurgaPujaSectionToggles,
  subEventsAPI,
} from '../../services/api';
import { SubEvent } from '../../types';
import { formatDateWithTime } from '../../utils/dateUtils';
import { durgaPujaPagePath } from '../../utils/durgaPuja';
import { isDurgaPujaSectionPublic } from '../../utils/durgaPujaSectionVisibility';

const INPUT_CLS =
  'w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary-500';

/** Light background colors an admin can assign to a card (meal / schedule day / venue). */
const CARD_BG_COLORS: { name: string; value: string }[] = [
  { name: 'Red', value: '#fef2f2' },
  { name: 'Orange', value: '#fff7ed' },
  { name: 'Amber', value: '#fffbeb' },
  { name: 'Yellow', value: '#fefce8' },
  { name: 'Green', value: '#f0fdf4' },
  { name: 'Teal', value: '#f0fdfa' },
  { name: 'Blue', value: '#eff6ff' },
  { name: 'Purple', value: '#faf5ff' },
  { name: 'Pink', value: '#fdf2f8' },
];

/** Curated, readable colors an admin can assign to a menu category (label + dots). */
const MENU_CATEGORY_COLORS: { name: string; value: string }[] = [
  { name: 'Red', value: '#dc2626' },
  { name: 'Green', value: '#16a34a' },
  { name: 'Orange', value: '#ea580c' },
  { name: 'Blue', value: '#2563eb' },
  { name: 'Purple', value: '#7c3aed' },
  { name: 'Teal', value: '#0d9488' },
  { name: 'Pink', value: '#db2777' },
  { name: 'Amber', value: '#d97706' },
];

/** Reusable light-background color picker for a card (meal / schedule day / venue). */
function CardBgColorField({
  value,
  onChange,
}: {
  value?: string;
  onChange: (v: string | undefined) => void;
}) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-xs font-medium text-gray-600">Card color</span>
      <span
        className="w-5 h-5 rounded border border-gray-300 flex-shrink-0"
        style={{ backgroundColor: value || '#ffffff' }}
      />
      <select
        className="border border-gray-300 rounded-lg px-2 py-1.5 text-sm"
        value={value ?? ''}
        onChange={(e) => onChange(e.target.value || undefined)}
      >
        <option value="">Default</option>
        {CARD_BG_COLORS.map((c) => (
          <option key={c.value} value={c.value}>
            {c.name}
          </option>
        ))}
      </select>
    </div>
  );
}

/** Recommended volunteer categories (also used as Google Form checkbox options). */
const DEFAULT_VOLUNTEER_CATEGORIES = [
  'Puja',
  'Decoration',
  'Food service',
  'Guest welcome',
  'Ticketing',
  'Logistics',
  'Parking',
  'Cultural program',
  'Photography',
  'Social media',
  'Cleanup',
];

const HIGHLIGHT_ICON_OPTIONS = [
  'sparkles',
  'music',
  'utensils',
  'users',
  'calendar',
  'ticket',
  'heart',
  'baby',
  'store',
  'party',
];

/** Upload/paste a single image for a category; stores the resulting URL. */
function AssetImageField({
  year,
  category,
  value,
  onChange,
  label,
}: {
  year: number;
  category: string;
  value?: string;
  onChange: (url: string) => void;
  label?: string;
}) {
  const [uploading, setUploading] = useState(false);
  const ref = useRef<HTMLInputElement>(null);
  const upload = async (file?: File) => {
    if (!file) return;
    setUploading(true);
    try {
      const { url } = await durgaPujaPageAPI.uploadAsset(year, category, file);
      onChange(url);
      toast.success('Image uploaded');
    } catch (e: any) {
      toast.error(e?.response?.data?.error || 'Upload failed');
    } finally {
      setUploading(false);
      if (ref.current) ref.current.value = '';
    }
  };
  return (
    <div>
      {label && <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>}
      {value && (
        <img
          src={value}
          alt=""
          className="max-h-40 rounded-lg border border-gray-200 object-contain bg-gray-50 mb-2"
        />
      )}
      <div className="flex items-center gap-2">
        <input
          ref={ref}
          type="file"
          accept="image/jpeg,image/png,image/gif,image/webp"
          className="hidden"
          onChange={e => upload(e.target.files?.[0])}
        />
        <button
          type="button"
          onClick={() => ref.current?.click()}
          disabled={uploading}
          className="inline-flex items-center gap-1 bg-white border-2 border-primary-600 text-primary-600 px-3 py-1.5 rounded-lg text-sm font-medium hover:bg-primary-50 disabled:opacity-50"
        >
          <Upload className="w-4 h-4" />
          {uploading ? 'Uploading…' : 'Upload'}
        </button>
        {value && (
          <button
            type="button"
            onClick={() => onChange('')}
            className="text-red-500 hover:text-red-700 text-sm"
          >
            Remove
          </button>
        )}
      </div>
      <input
        className={`${INPUT_CLS} mt-2`}
        value={value || ''}
        placeholder="…or paste an image URL"
        onChange={e => onChange(e.target.value)}
      />
    </div>
  );
}

/** Upload/manage a list of images for a category. */
function AssetImageList({
  year,
  category,
  value,
  onChange,
}: {
  year: number;
  category: string;
  value?: string[];
  onChange: (urls: string[]) => void;
}) {
  const items = value ?? [];
  const [uploading, setUploading] = useState(false);
  const ref = useRef<HTMLInputElement>(null);
  const upload = async (file?: File) => {
    if (!file) return;
    setUploading(true);
    try {
      const { url } = await durgaPujaPageAPI.uploadAsset(year, category, file);
      onChange([...items, url]);
    } catch (e: any) {
      toast.error(e?.response?.data?.error || 'Upload failed');
    } finally {
      setUploading(false);
      if (ref.current) ref.current.value = '';
    }
  };
  return (
    <div>
      {items.length > 0 && (
        <div className="flex flex-wrap gap-3 mb-2">
          {items.map((src, i) => (
            <div key={i} className="relative">
              <img src={src} alt="" className="w-24 h-24 object-cover rounded-lg border border-gray-200" />
              <button
                type="button"
                onClick={() => onChange(items.filter((_, idx) => idx !== i))}
                className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-0.5"
                aria-label="Remove image"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          ))}
        </div>
      )}
      <input
        ref={ref}
        type="file"
        accept="image/jpeg,image/png,image/gif,image/webp"
        className="hidden"
        onChange={e => upload(e.target.files?.[0])}
      />
      <button
        type="button"
        onClick={() => ref.current?.click()}
        disabled={uploading}
        className="inline-flex items-center gap-1 text-primary-600 text-sm font-medium disabled:opacity-50"
      >
        <Plus className="w-4 h-4" />
        {uploading ? 'Uploading…' : 'Add image'}
      </button>
    </div>
  );
}

/** Simple editable list of strings. */
function StringListEditor({
  value,
  onChange,
  placeholder,
}: {
  value?: string[];
  onChange: (v: string[]) => void;
  placeholder?: string;
}) {
  const items = value ?? [];
  return (
    <div className="space-y-2">
      {items.map((it, i) => (
        <div key={i} className="flex gap-2">
          <input
            className={INPUT_CLS}
            value={it}
            placeholder={placeholder}
            onChange={e => onChange(items.map((v, idx) => (idx === i ? e.target.value : v)))}
          />
          <button
            type="button"
            onClick={() => onChange(items.filter((_, idx) => idx !== i))}
            className="text-red-500 hover:text-red-700 p-1"
            aria-label="Remove item"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      ))}
      <button
        type="button"
        onClick={() => onChange([...items, ''])}
        className="inline-flex items-center gap-1 text-primary-600 text-sm font-medium"
      >
        <Plus className="w-4 h-4" /> Add
      </button>
    </div>
  );
}

/** Collapsible editor block with a per-section visibility toggle. */
function EditorSection({
  title,
  sectionKey,
  visible,
  publicVisible,
  onToggle,
  toggleLabel = 'Show this section on the public page',
  children,
}: {
  title: string;
  sectionKey: keyof DurgaPujaSectionToggles;
  visible: boolean;
  /** True when this section is currently rendered on the public Durga Puja page. */
  publicVisible?: boolean;
  onToggle: (key: keyof DurgaPujaSectionToggles, val: boolean) => void;
  /** Label for the visibility checkbox (some sections repurpose it). */
  toggleLabel?: string;
  children: React.ReactNode;
}) {
  const statusLabel = publicVisible
    ? 'Live on site'
    : visible
      ? 'Not on site yet'
      : 'Hidden';
  const statusClass = publicVisible
    ? 'text-green-700'
    : visible
      ? 'text-amber-600'
      : 'text-gray-400';

  return (
    <details
      className={`rounded-xl shadow group border ${
        publicVisible ? 'bg-green-50 border-green-200' : 'bg-white border-gray-100'
      }`}
    >
      <summary className="cursor-pointer select-none px-6 py-4 font-semibold text-gray-900 flex items-center justify-between gap-3">
        <span>{title}</span>
        <span className={`text-xs font-medium shrink-0 ${statusClass}`}>{statusLabel}</span>
      </summary>
      <div className="px-6 pb-6 space-y-4 border-t border-gray-100 pt-4">
        <label className="flex items-center gap-2 text-sm text-gray-700">
          <input
            type="checkbox"
            className="h-4 w-4 accent-primary-600"
            checked={visible}
            onChange={e => onToggle(sectionKey, e.target.checked)}
          />
          {toggleLabel}
        </label>
        {children}
      </div>
    </details>
  );
}

function FieldLabel({ children }: { children: React.ReactNode }) {
  return <label className="block text-sm font-medium text-gray-700 mb-1">{children}</label>;
}

/**
 * Admin editor for the full public /durga-puja-YYYY festival page — all 16 sections.
 */
export default function AdminDurgaPuja() {
  const [content, setContent] = useState<DurgaPujaPageContent | null>(null);
  const [editYear, setEditYear] = useState<number>(new Date().getFullYear());
  const [activeYear, setActiveYear] = useState<number>(new Date().getFullYear());
  const [availableYears, setAvailableYears] = useState<number[]>([]);
  const [loadingYear, setLoadingYear] = useState(true);
  const [saving, setSaving] = useState(false);
  const [hasImage, setHasImage] = useState(false);
  const [imageVersion, setImageVersion] = useState(0);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [subEvents, setSubEvents] = useState<SubEvent[]>([]);
  const [subEventImages, setSubEventImages] = useState<Record<string, string>>({});
  const [togglingId, setTogglingId] = useState<string | null>(null);
  const [hasSponsorshipPdf, setHasSponsorshipPdf] = useState(false);
  const [uploadingPdf, setUploadingPdf] = useState(false);
  const pdfInputRef = useRef<HTMLInputElement>(null);

  const loadYear = useCallback(async (year: number) => {
    setLoadingYear(true);
    setSubEvents([]);
    setSubEventImages({});
    setHasImage(false);
    setHasSponsorshipPdf(false);
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
      try {
        const { hasPdf } = await durgaPujaPageAPI.hasSponsorshipPdf(year);
        setHasSponsorshipPdf(hasPdf);
      } catch {
        setHasSponsorshipPdf(false);
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

  const handlePdfSelected = async (file: File | undefined) => {
    if (!file) return;
    if (!/\.pdf$/i.test(file.name)) {
      toast.error('Please choose a PDF file');
      return;
    }
    setUploadingPdf(true);
    try {
      await durgaPujaPageAPI.uploadSponsorshipPdf(editYear, file);
      setHasSponsorshipPdf(true);
      toast.success('Sponsorship prospectus uploaded');
    } catch (error: any) {
      toast.error(error?.response?.data?.error || 'Failed to upload PDF');
    } finally {
      setUploadingPdf(false);
      if (pdfInputRef.current) pdfInputRef.current.value = '';
    }
  };

  const handlePdfDelete = async () => {
    try {
      await durgaPujaPageAPI.deleteSponsorshipPdf(editYear);
      setHasSponsorshipPdf(false);
      toast.success('Sponsorship prospectus removed');
    } catch {
      toast.error('Failed to remove PDF');
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

  // ---- Generic content setters ----
  const set = <K extends keyof DurgaPujaPageContent>(key: K, value: DurgaPujaPageContent[K]) =>
    setContent(c => (c ? { ...c, [key]: value } : c));

  const patchObj = (key: keyof DurgaPujaPageContent, patch: Record<string, unknown>) =>
    setContent(c =>
      c ? { ...c, [key]: { ...((c[key] as Record<string, unknown>) ?? {}), ...patch } } : c
    );

  const toggleSection = (key: keyof DurgaPujaSectionToggles, val: boolean) =>
    setContent(c => (c ? { ...c, sections: { ...(c.sections ?? {}), [key]: val } } : c));

  // Top-level array helpers
  const arr = (key: keyof DurgaPujaPageContent): any[] =>
    ((content?.[key] as any[]) ?? []);
  const updateItem = (key: keyof DurgaPujaPageContent, index: number, patch: Record<string, unknown>) =>
    setContent(c => {
      if (!c) return c;
      const list = [...((c[key] as any[]) ?? [])];
      list[index] = { ...list[index], ...patch };
      return { ...c, [key]: list };
    });
  const addItem = (key: keyof DurgaPujaPageContent, item: unknown) =>
    setContent(c => (c ? { ...c, [key]: [...((c[key] as any[]) ?? []), item] } : c));
  const removeItem = (key: keyof DurgaPujaPageContent, index: number) =>
    setContent(c => (c ? { ...c, [key]: ((c[key] as any[]) ?? []).filter((_, i) => i !== index) } : c));

  // Nested-object array helpers (e.g. food.meals, puja.timings)
  const nestedArr = (objKey: keyof DurgaPujaPageContent, arrKey: string): any[] =>
    (((content?.[objKey] as any)?.[arrKey] as any[]) ?? []);
  const updateNestedItem = (
    objKey: keyof DurgaPujaPageContent,
    arrKey: string,
    index: number,
    patch: Record<string, unknown>
  ) =>
    setContent(c => {
      if (!c) return c;
      const obj: any = { ...((c[objKey] as any) ?? {}) };
      const list = [...((obj[arrKey] as any[]) ?? [])];
      list[index] = { ...list[index], ...patch };
      obj[arrKey] = list;
      return { ...c, [objKey]: obj };
    });
  const addNestedItem = (objKey: keyof DurgaPujaPageContent, arrKey: string, item: unknown) =>
    setContent(c => {
      if (!c) return c;
      const obj: any = { ...((c[objKey] as any) ?? {}) };
      obj[arrKey] = [...((obj[arrKey] as any[]) ?? []), item];
      return { ...c, [objKey]: obj };
    });
  const removeNestedItem = (objKey: keyof DurgaPujaPageContent, arrKey: string, index: number) =>
    setContent(c => {
      if (!c) return c;
      const obj: any = { ...((c[objKey] as any) ?? {}) };
      obj[arrKey] = ((obj[arrKey] as any[]) ?? []).filter((_, i) => i !== index);
      return { ...c, [objKey]: obj };
    });


  // FAQ + ticket link helpers (existing)
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
      const ticketLinks = (c.ticketLinks ?? []).map((t, i) => (i === index ? { ...t, ...patch } : t));
      return { ...c, ticketLinks };
    });
  const addTicketLink = () =>
    setContent(c => (c ? { ...c, ticketLinks: [...(c.ticketLinks ?? []), { label: '', url: '' }] } : c));
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
      if (!label && !url) continue;
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
  const sec = content.sections ?? {};
  const visible = (key: keyof DurgaPujaSectionToggles) => sec[key] !== false;
  const durgaPujaVisibleSubEvents = subEvents.filter(se => se.show_in_durga_puja_page === true);
  const publicOnSite = (key: keyof DurgaPujaSectionToggles) =>
    isDurgaPujaSectionPublic(key, { content, durgaPujaSubEvents: durgaPujaVisibleSubEvents });
  const ticketing = content.ticketing ?? {};
  const food = content.food ?? {};
  const puja = content.puja ?? {};
  const kids = content.kids ?? {};
  const sponsorship = content.sponsorship ?? {};
  const vendors = content.vendors ?? {};
  const volunteer = content.volunteer ?? {};
  const gallery = content.gallery ?? {};
  const social = content.social ?? {};

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
      <p className="text-gray-600 mb-2">
        Everything on the public <code>{durgaPujaPagePath(editYear)}</code> page is edited here. Dates
        and venue sync automatically from the linked &quot;Durga Puja&quot; event — you can override
        them below. Each section can be shown or hidden with its toggle.
      </p>
      {content.linkedEventId && (
        <p className="text-sm text-gray-500 mb-4">
          {isArchived && <span className="text-gray-600">Archived year — </span>}
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

      <div className="sticky top-0 z-10 bg-gray-50/90 backdrop-blur py-3 mb-4 flex items-center gap-3">
        <button
          type="button"
          onClick={handleSave}
          disabled={saving}
          className="bg-primary-600 text-white px-6 py-2.5 rounded-lg font-semibold hover:bg-primary-700 transition-colors disabled:opacity-50"
        >
          {saving ? 'Saving…' : 'Save Changes'}
        </button>
        {content.updated_at && (
          <span className="text-sm text-gray-500">
            Last updated {new Date(content.updated_at).toLocaleString()}
          </span>
        )}
      </div>

      <div className="space-y-4">
        {/* ---- Basics (always shown) ---- */}
        <div className="bg-white rounded-xl shadow p-6 space-y-4">
          <h2 className="font-semibold text-gray-900">Basics</h2>
          <div>
            <FieldLabel>Intro paragraph</FieldLabel>
            <textarea className={INPUT_CLS} rows={4} value={content.intro} onChange={e => set('intro', e.target.value)} />
          </div>
          <div>
            <FieldLabel>Dates (as shown to visitors)</FieldLabel>
            <input
              className={INPUT_CLS}
              value={content.datesText}
              onChange={e => set('datesText', e.target.value)}
              placeholder="October 9–11, 2026"
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <FieldLabel>Start date (for Google)</FieldLabel>
              <input type="date" className={INPUT_CLS} value={content.startDate} onChange={e => set('startDate', e.target.value)} />
            </div>
            <div>
              <FieldLabel>End date (for Google)</FieldLabel>
              <input type="date" className={INPUT_CLS} value={content.endDate} onChange={e => set('endDate', e.target.value)} />
            </div>
          </div>
          <div>
            <FieldLabel>Venue name</FieldLabel>
            <input
              className={INPUT_CLS}
              value={content.venueName}
              onChange={e => set('venueName', e.target.value)}
              placeholder="Orange Coast College, Costa Mesa"
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <FieldLabel>Venue city</FieldLabel>
              <input className={INPUT_CLS} value={content.venueCity} onChange={e => set('venueCity', e.target.value)} placeholder="Costa Mesa" />
            </div>
            <div>
              <FieldLabel>Venue note</FieldLabel>
              <input className={INPUT_CLS} value={content.venueNote} onChange={e => set('venueNote', e.target.value)} />
            </div>
          </div>
          <div>
            <FieldLabel>Hero / flyer image (background behind the title, and the OG share image)</FieldLabel>
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
            <p className="text-xs text-gray-500 mt-1">JPEG/PNG/WebP/GIF, max 20MB.</p>
          </div>
        </div>

        <p className="mb-4 text-sm text-gray-600 bg-green-50 border border-green-200 rounded-lg px-4 py-2.5">
          <span className="inline-block w-3 h-3 rounded-sm bg-green-100 border border-green-300 align-middle mr-2" />
          Light green sections are <strong className="font-medium text-green-800">live on the public page</strong> right now
          (toggle on + enough content). Amber label = enabled but not visible yet.
        </p>

        {/* ---- Section 1: Hero ---- */}
        <EditorSection title="1. Hero (title, tagline, countdown, buttons)" sectionKey="hero" visible={visible('hero')} publicVisible={publicOnSite('hero')} onToggle={toggleSection}>
          <div>
            <FieldLabel>Hero tagline (short message under the title)</FieldLabel>
            <textarea
              className={INPUT_CLS}
              rows={2}
              value={content.heroTagline ?? ''}
              onChange={e => set('heroTagline', e.target.value)}
              placeholder="Join Sanhoti for three unforgettable days of devotion, Bengali culture, music, food…"
            />
          </div>
          <div>
            <FieldLabel>Hero sub-headline</FieldLabel>
            <input
              className={INPUT_CLS}
              value={content.heroSubheadline ?? ''}
              onChange={e => set('heroSubheadline', e.target.value)}
              placeholder="Akriti Kakar & Subhadeep Das Live"
            />
          </div>
          <label className="flex items-center gap-2 text-sm text-gray-700">
            <input
              type="checkbox"
              className="h-4 w-4 accent-primary-600"
              checked={content.showCountdown !== false}
              onChange={e => set('showCountdown', e.target.checked)}
            />
            Show countdown to the start date
          </label>
          <div>
            <div className="flex items-center justify-between mb-2">
              <FieldLabel>Call-to-action buttons</FieldLabel>
              <button type="button" onClick={() => addItem('ctaButtons', { label: '', href: '', style: 'primary' })} className="inline-flex items-center gap-1 text-primary-600 text-sm font-medium">
                <Plus className="w-4 h-4" /> Add button
              </button>
            </div>
            <p className="text-xs text-gray-500 mb-2">
              Target can be an anchor (#tickets, #schedule, #menu, #sponsor, #volunteer), an internal path
              (/book-your-seat), or a full URL. Leave empty to use the default four buttons.
            </p>
            <div className="space-y-2">
              {arr('ctaButtons').map((b: any, i: number) => (
                <div key={i} className="flex flex-wrap gap-2 items-center">
                  <input className={`${INPUT_CLS} flex-1 min-w-[8rem]`} value={b.label ?? ''} placeholder="Label" onChange={e => updateItem('ctaButtons', i, { label: e.target.value })} />
                  <input className={`${INPUT_CLS} flex-1 min-w-[8rem]`} value={b.href ?? ''} placeholder="#tickets or https://…" onChange={e => updateItem('ctaButtons', i, { href: e.target.value })} />
                  <select className="border border-gray-300 rounded-lg px-2 py-2 text-sm" value={b.style ?? 'primary'} onChange={e => updateItem('ctaButtons', i, { style: e.target.value })}>
                    <option value="primary">Solid</option>
                    <option value="secondary">Outline</option>
                  </select>
                  <button type="button" onClick={() => removeItem('ctaButtons', i)} className="text-red-500 hover:text-red-700 p-1"><Trash2 className="w-4 h-4" /></button>
                </div>
              ))}
            </div>
          </div>
        </EditorSection>

        {/* ---- Section 2: Highlights ---- */}
        <EditorSection title="2. Event highlights" sectionKey="highlights" visible={visible('highlights')} publicVisible={publicOnSite('highlights')} onToggle={toggleSection}>
          <p className="text-xs text-gray-500">Leave empty to show a default set of highlights.</p>
          <div className="space-y-4">
            {arr('highlights').map((h: any, i: number) => (
              <div key={i} className="border border-gray-200 rounded-lg p-3 space-y-2">
                <div className="flex gap-2 items-center">
                  <select className="border border-gray-300 rounded-lg px-2 py-2 text-sm" value={h.icon ?? 'sparkles'} onChange={e => updateItem('highlights', i, { icon: e.target.value })}>
                    {HIGHLIGHT_ICON_OPTIONS.map(o => <option key={o} value={o}>{o}</option>)}
                  </select>
                  <input className={`${INPUT_CLS} flex-1`} value={h.title ?? ''} placeholder="Title" onChange={e => updateItem('highlights', i, { title: e.target.value })} />
                  <button type="button" onClick={() => removeItem('highlights', i)} className="text-red-500 hover:text-red-700 p-1"><Trash2 className="w-4 h-4" /></button>
                </div>
                <textarea className={INPUT_CLS} rows={2} value={h.text ?? ''} placeholder="Short description" onChange={e => updateItem('highlights', i, { text: e.target.value })} />
                <AssetImageField year={editYear} category="highlights" value={h.imageUrl} onChange={url => updateItem('highlights', i, { imageUrl: url })} label="Optional image (used instead of the icon)" />
              </div>
            ))}
          </div>
          <button type="button" onClick={() => addItem('highlights', { icon: 'sparkles', title: '', text: '' })} className="inline-flex items-center gap-1 text-primary-600 text-sm font-medium"><Plus className="w-4 h-4" /> Add highlight</button>
          <div>
            <FieldLabel>Expected attendance</FieldLabel>
            <input className={INPUT_CLS} value={content.expectedAttendance ?? ''} placeholder="Approximately 1,000 attendees" onChange={e => set('expectedAttendance', e.target.value)} />
          </div>
        </EditorSection>

        {/* ---- Section 3: Schedule ---- */}
        <EditorSection title="3. Three-day schedule" sectionKey="schedule" visible={visible('schedule')} publicVisible={publicOnSite('schedule')} onToggle={toggleSection}>
          <p className="text-xs text-gray-500 mb-2">
            Each day (e.g. “Friday | Oct-09”) becomes a card on the public page. Add groups like
            “Morning”, “Evening”, or “Cultural Program”, pick a color, and list the activities under each.
          </p>
          <div className="space-y-3">
            {arr('scheduleDays').map((day: any, di: number) => (
              <div key={di} className="border border-gray-200 rounded-lg p-3 space-y-2">
                <div className="flex flex-wrap gap-2 items-center">
                  <input className={`${INPUT_CLS} flex-1 min-w-[8rem]`} value={day.dayLabel ?? ''} placeholder="Friday | Oct-09" onChange={e => updateItem('scheduleDays', di, { dayLabel: e.target.value })} />
                  <input className="border border-gray-300 rounded-lg px-2 py-2 text-sm w-44" value={day.date ?? ''} placeholder="6:30 PM – 10:00 PM" onChange={e => updateItem('scheduleDays', di, { date: e.target.value })} />
                  <button type="button" onClick={() => removeItem('scheduleDays', di)} className="text-red-500 hover:text-red-700 p-1" aria-label="Remove day"><Trash2 className="w-4 h-4" /></button>
                </div>
                <CardBgColorField value={day.bgColor} onChange={v => updateItem('scheduleDays', di, { bgColor: v })} />
                {(() => {
                  const groups: { label: string; items: string[]; color?: string }[] = Array.isArray(day.groups) ? day.groups : [];
                  const setGroups = (next: { label: string; items: string[]; color?: string }[]) =>
                    updateItem('scheduleDays', di, { groups: next });
                  return (
                    <div className="space-y-2 pt-1">
                      {groups.map((g, gi) => (
                        <div key={gi} className="border border-gray-100 rounded-lg p-2 bg-gray-50 space-y-2">
                          <div className="flex gap-2 items-center">
                            <input
                              className={`${INPUT_CLS} flex-1 min-w-0`}
                              value={g.label ?? ''}
                              placeholder="Group — e.g. Morning, Evening, Cultural Program"
                              onChange={e =>
                                setGroups(groups.map((x, k) => (k === gi ? { ...x, label: e.target.value } : x)))
                              }
                            />
                            <span
                              className="w-5 h-5 rounded-full border border-gray-300 flex-shrink-0"
                              style={{ backgroundColor: g.color || '#9ca3af' }}
                              title="Group color"
                            />
                            <select
                              className="border border-gray-300 rounded-lg px-2 py-2 text-sm shrink-0"
                              value={g.color ?? ''}
                              onChange={e =>
                                setGroups(
                                  groups.map((x, k) => (k === gi ? { ...x, color: e.target.value || undefined } : x))
                                )
                              }
                            >
                              <option value="">Default</option>
                              {MENU_CATEGORY_COLORS.map(c => (
                                <option key={c.value} value={c.value}>
                                  {c.name}
                                </option>
                              ))}
                            </select>
                            <button
                              type="button"
                              onClick={() => setGroups(groups.filter((_, k) => k !== gi))}
                              className="text-red-500 hover:text-red-700 p-1"
                              aria-label="Remove group"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                          <StringListEditor
                            value={g.items}
                            placeholder="Activity — e.g. Pushpanjali"
                            onChange={items => setGroups(groups.map((x, k) => (k === gi ? { ...x, items } : x)))}
                          />
                        </div>
                      ))}
                      <button
                        type="button"
                        onClick={() => setGroups([...groups, { label: '', items: [] }])}
                        className="inline-flex items-center gap-1 text-primary-600 text-sm font-medium"
                      >
                        <Plus className="w-4 h-4" /> Add group
                      </button>
                    </div>
                  );
                })()}
              </div>
            ))}
          </div>
          <button type="button" onClick={() => addItem('scheduleDays', { dayLabel: '', groups: [] })} className="inline-flex items-center gap-1 text-primary-600 text-sm font-medium"><Plus className="w-4 h-4" /> Add day</button>
          <div>
            <FieldLabel>Schedule note</FieldLabel>
            <input className={INPUT_CLS} value={content.scheduleNote ?? ''} placeholder="Schedule may be updated. Please check this page before attending." onChange={e => set('scheduleNote', e.target.value)} />
          </div>
        </EditorSection>

        {/* ---- Section 4: Artists ---- */}
        <EditorSection title="4. Featured artists" sectionKey="artists" visible={visible('artists')} publicVisible={publicOnSite('artists')} onToggle={toggleSection}>
          <div className="space-y-4">
            {arr('artists').map((a: any, i: number) => (
              <div key={i} className="border border-gray-200 rounded-lg p-3 space-y-2">
                <div className="flex gap-2 items-center">
                  <input className={`${INPUT_CLS} flex-1`} value={a.name ?? ''} placeholder="Artist name" onChange={e => updateItem('artists', i, { name: e.target.value })} />
                  <button type="button" onClick={() => removeItem('artists', i)} className="text-red-500 hover:text-red-700 p-1"><Trash2 className="w-4 h-4" /></button>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <input className={INPUT_CLS} value={a.performanceType ?? ''} placeholder="Performance type (e.g. Live in Concert)" onChange={e => updateItem('artists', i, { performanceType: e.target.value })} />
                  <input className={INPUT_CLS} value={a.dateTime ?? ''} placeholder="Sat, Oct 10 · 8:00 PM" onChange={e => updateItem('artists', i, { dateTime: e.target.value })} />
                </div>
                <textarea className={INPUT_CLS} rows={2} value={a.bio ?? ''} placeholder="Short biography" onChange={e => updateItem('artists', i, { bio: e.target.value })} />
                <input className={INPUT_CLS} value={a.ticketInfo ?? ''} placeholder="Included with ticket / separate ticket required" onChange={e => updateItem('artists', i, { ticketInfo: e.target.value })} />
                <div>
                  <FieldLabel>Video links (optional)</FieldLabel>
                  {(() => {
                    const vids: string[] = Array.isArray(a.videoUrls)
                      ? a.videoUrls
                      : a.videoUrl
                        ? [a.videoUrl]
                        : [];
                    // Writing to videoUrls (and clearing the legacy single field)
                    // keeps the public page from rendering the same video twice.
                    const setVids = (next: string[]) =>
                      updateItem('artists', i, { videoUrls: next, videoUrl: undefined });
                    return (
                      <div className="space-y-2">
                        {vids.map((v, vi) => (
                          <div key={vi} className="flex gap-2 items-center">
                            <input
                              className={`${INPUT_CLS} flex-1`}
                              value={v}
                              placeholder="https://www.youtube.com/watch?v=… or youtu.be/…"
                              onChange={e => {
                                const next = [...vids];
                                next[vi] = e.target.value;
                                setVids(next);
                              }}
                            />
                            <button
                              type="button"
                              onClick={() => setVids(vids.filter((_, k) => k !== vi))}
                              className="text-red-500 hover:text-red-700 p-1"
                              aria-label="Remove video link"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        ))}
                        <button
                          type="button"
                          onClick={() => setVids([...vids, ''])}
                          className="inline-flex items-center gap-1 text-primary-600 text-sm font-medium"
                        >
                          <Plus className="w-4 h-4" /> Add video link
                        </button>
                        <p className="text-xs text-gray-500">
                          YouTube and Vimeo links embed on the public page; other URLs show a watch link.
                        </p>
                      </div>
                    );
                  })()}
                </div>
                <div>
                  <FieldLabel>Social / streaming links (optional)</FieldLabel>
                  {(() => {
                    const links = Array.isArray(a.socialLinks) ? a.socialLinks : [];
                    const setLinks = (next: { label?: string; url: string }[]) =>
                      updateItem('artists', i, { socialLinks: next });
                    return (
                      <div className="space-y-2">
                        {links.map((s: { label?: string; url: string }, si: number) => (
                          <div key={si} className="flex gap-2 items-center">
                            {/* flex-1 + min-w-0 so the URL box fills remaining space
                                and can shrink without overflowing. */}
                            <input
                              className={`${INPUT_CLS} flex-1 min-w-0`}
                              value={s.url ?? ''}
                              placeholder="URL — https://instagram.com/… , spotify.com/… , website"
                              onChange={e => {
                                const next = links.map(
                                  (x: { label?: string; url: string }, k: number) =>
                                    k === si ? { ...x, url: e.target.value } : x
                                );
                                setLinks(next);
                              }}
                            />
                            {/* Fixed-width wrapper avoids putting a second width class
                                (w-36) on top of INPUT_CLS's w-full, which conflicted and
                                resolved differently in dev vs the production build. */}
                            <div className="w-36 shrink-0">
                              <input
                                className={INPUT_CLS}
                                value={s.label ?? ''}
                                placeholder="Label (optional)"
                                onChange={e => {
                                  const next = links.map(
                                    (x: { label?: string; url: string }, k: number) =>
                                      k === si ? { ...x, label: e.target.value } : x
                                  );
                                  setLinks(next);
                                }}
                              />
                            </div>
                            <button
                              type="button"
                              onClick={() =>
                                setLinks(links.filter((_: unknown, k: number) => k !== si))
                              }
                              className="text-red-500 hover:text-red-700 p-1"
                              aria-label="Remove social link"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        ))}
                        <button
                          type="button"
                          onClick={() => setLinks([...links, { url: '' }])}
                          className="inline-flex items-center gap-1 text-primary-600 text-sm font-medium"
                        >
                          <Plus className="w-4 h-4" /> Add social link
                        </button>
                        <p className="text-xs text-gray-500">
                          Instagram, YouTube, Facebook, Spotify, X, or website. The icon is detected
                          automatically; label is optional.
                        </p>
                      </div>
                    );
                  })()}
                </div>
                <AssetImageField year={editYear} category="artists" value={a.imageUrl} onChange={url => updateItem('artists', i, { imageUrl: url })} label="Artist photo" />
                <div className="border-t border-gray-100 pt-2 space-y-2">
                  <label className="flex items-start gap-2 text-sm text-gray-700">
                    <input
                      type="checkbox"
                      className="mt-0.5 h-4 w-4 accent-primary-600"
                      checked={a.linkSubEventPage === true}
                      disabled={subEvents.length === 0}
                      onChange={e =>
                        updateItem('artists', i, {
                          linkSubEventPage: e.target.checked,
                          ...(e.target.checked && !a.subEventId && subEvents[0]
                            ? { subEventId: subEvents[0].sub_event_id }
                            : {}),
                          ...(!e.target.checked ? { subEventId: undefined } : {}),
                        })
                      }
                    />
                    <span>
                      <span className="font-medium">Link card to sub-event public page</span>
                      <span className="block text-xs text-gray-500 mt-0.5">
                        Visitors can open the SEO concert page (/sub-events/…) from this card on the Durga Puja page.
                      </span>
                    </span>
                  </label>
                  {a.linkSubEventPage && (
                    <div>
                      <FieldLabel>Sub-event page</FieldLabel>
                      {subEvents.length === 0 ? (
                        <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                          Link a Sanhoti event above (Section 1) with sub-events, or enable sub-events on the Events admin page.
                        </p>
                      ) : (
                        <select
                          className={INPUT_CLS}
                          value={a.subEventId ?? ''}
                          onChange={e =>
                            updateItem('artists', i, {
                              subEventId: e.target.value || undefined,
                            })
                          }
                        >
                          <option value="">Select sub-event…</option>
                          {subEvents.map(se => (
                            <option key={se.sub_event_id} value={se.sub_event_id}>
                              {se.sub_event_name}
                              {se.sub_event_start_dt
                                ? ` — ${formatDateWithTime(se.sub_event_start_dt)}`
                                : ''}
                              {se.seo_page_enabled ? ' (SEO page on)' : ''}
                            </option>
                          ))}
                        </select>
                      )}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
          <button type="button" onClick={() => addItem('artists', { name: '' })} className="inline-flex items-center gap-1 text-primary-600 text-sm font-medium"><Plus className="w-4 h-4" /> Add artist</button>
        </EditorSection>

        {/* ---- Section 5: Tickets ---- */}
        <EditorSection title="5. Tickets" sectionKey="tickets" visible={visible('tickets')} publicVisible={publicOnSite('tickets')} onToggle={toggleSection}>
          <div className="border border-gray-200 rounded-lg p-4 bg-gray-50 space-y-2.5">
            <p className="text-sm font-medium text-gray-700 flex items-center gap-1.5"><Ticket className="w-4 h-4 text-primary-600" /> Ticketing visibility</p>
            <label className="flex items-start gap-2 text-sm text-gray-700">
              <input type="checkbox" className="mt-0.5 h-4 w-4 accent-primary-600" checked={content.showInternalBooking !== false} disabled={content.ticketsOff === true} onChange={e => set('showInternalBooking', e.target.checked)} />
              <span><span className="font-medium">In-website booking</span> — show the “Book Your Seat” button (needs the seat system open).</span>
            </label>
            <label className="flex items-start gap-2 text-sm text-gray-700">
              <input type="checkbox" className="mt-0.5 h-4 w-4 accent-primary-600" checked={content.showExternalTickets !== false} disabled={content.ticketsOff === true} onChange={e => set('showExternalTickets', e.target.checked)} />
              <span><span className="font-medium">External ticket link(s)</span> — show the buttons configured below.</span>
            </label>
            <label className="flex items-start gap-2 text-sm text-gray-700">
              <input
                type="checkbox"
                className="mt-0.5 h-4 w-4 accent-primary-600"
                checked={content.showDonateButtonInTickets === true}
                disabled={content.ticketsOff === true}
                onChange={e => set('showDonateButtonInTickets', e.target.checked)}
              />
              <span>
                <span className="font-medium">Donate button</span> — links to{' '}
                <code className="text-xs bg-gray-200 px-1 rounded">/donate</code>, shown to the right of
                external ticket buttons (e.g. Yapsody) on the public page.
              </span>
            </label>
            <label className="flex items-start gap-2 text-sm text-gray-700">
              <input type="checkbox" className="mt-0.5 h-4 w-4 accent-primary-600" checked={content.ticketsOff === true} onChange={e => set('ticketsOff', e.target.checked)} />
              <span><span className="font-medium">Off</span> — hide all ticketing and show “Tickets coming soon”.</span>
            </label>
            <label className="flex items-start gap-2 text-sm text-gray-700">
              <input type="checkbox" className="mt-0.5 h-4 w-4 accent-primary-600" checked={content.showSavedTickets === true} onChange={e => set('showSavedTickets', e.target.checked)} />
              <span>
                <span className="font-medium">Show saved tickets</span> — display the ticket pricing
                configured on the{' '}
                <a href="/admin/book-your-seat" target="_blank" rel="noopener noreferrer" className="text-primary-600 hover:text-primary-700 underline">
                  Book Your Seat
                </a>{' '}
                page: entire-event category prices, child age range, daily lunch &amp; dinner pricing
                (meals priced 0 are hidden), and sub-event ticketing. Unchecked = hidden from the public.
              </span>
            </label>
          </div>

          <div className="border border-gray-200 rounded-lg p-4 bg-gray-50 space-y-3">
            <p className="text-sm font-medium text-gray-700">Yapsody event list widget</p>
            <label className="flex items-start gap-2 text-sm text-gray-700">
              <input
                type="checkbox"
                className="mt-0.5 h-4 w-4 accent-primary-600"
                checked={content.showYapsodyWidget === true}
                disabled={content.ticketsOff === true}
                onChange={e => set('showYapsodyWidget', e.target.checked)}
              />
              <span>
                <span className="font-medium">Show embedded Yapsody ticket list</span> — renders the
                Yapsody event-list widget at the top of the public Tickets section.
              </span>
            </label>
            {content.showYapsodyWidget && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pl-0 sm:pl-6">
                <div>
                  <FieldLabel>Event ID</FieldLabel>
                  <input
                    className={INPUT_CLS}
                    value={content.yapsodyEventId ?? ''}
                    onChange={e => set('yapsodyEventId', e.target.value)}
                    placeholder="212239"
                  />
                  <p className="text-xs text-gray-500 mt-1">Creates the widget div id: yapwid-event-…</p>
                </div>
                <div>
                  <FieldLabel>Venue code</FieldLabel>
                  <input
                    className={INPUT_CLS}
                    value={content.yapsodyVenueCode ?? ''}
                    onChange={e => set('yapsodyVenueCode', e.target.value)}
                    placeholder="sanhoti"
                  />
                  <p className="text-xs text-gray-500 mt-1">The data-venue-code attribute from Yapsody.</p>
                </div>
              </div>
            )}
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <FieldLabel>External ticket booking links</FieldLabel>
              <button type="button" onClick={addTicketLink} className="inline-flex items-center gap-1 text-primary-600 text-sm font-medium"><Plus className="w-4 h-4" /> Add Link</button>
            </div>
            <div className="space-y-3">
              {(content.ticketLinks ?? []).map((link, i) => (
                <div key={i} className="flex items-start gap-2">
                  <div className="flex-1 grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <input className={INPUT_CLS} value={link.label} onChange={e => setTicketLink(i, { label: e.target.value })} placeholder="Label (e.g. Full Event Pass)" />
                    <input className={INPUT_CLS} type="url" value={link.url} onChange={e => setTicketLink(i, { url: e.target.value })} placeholder="https://sanhoti.yapsody.com/" />
                  </div>
                  <button type="button" onClick={() => removeTicketLink(i)} className="text-red-500 hover:text-red-700 p-1" aria-label={`Remove ticket link ${i + 1}`}><Trash2 className="w-5 h-5" /></button>
                </div>
              ))}
            </div>
            <input className={`${INPUT_CLS} mt-2`} value={content.ticketsNote ?? ''} onChange={e => set('ticketsNote', e.target.value)} placeholder="Optional note, e.g. Early-bird pricing until Sep 1" />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {([
              ['adultPrice', 'Adult ticket price'],
              ['childPrice', 'Child ticket price'],
              ['weekendPackage', 'Weekend package'],
              ['familyPackage', 'Family package'],
              ['concertOnly', 'Concert-only ticket'],
              ['freeEntryAge', "Children's free-entry age"],
              ['foodInclusion', 'Food inclusion / exclusion'],
              ['maxCapacity', 'Maximum venue capacity'],
              ['refundPolicy', 'Refund policy'],
              ['transferPolicy', 'Ticket-transfer policy'],
              ['buttonUrl', 'Primary ticket button URL'],
              ['buttonLabel', 'Primary ticket button label'],
            ] as [string, string][]).map(([key, label]) => (
              <div key={key}>
                <FieldLabel>{label}</FieldLabel>
                <input className={INPUT_CLS} value={(ticketing as any)[key] ?? ''} onChange={e => patchObj('ticketing', { [key]: e.target.value })} />
              </div>
            ))}
          </div>
          <AssetImageField year={editYear} category="qr" value={ticketing.qrImageUrl} onChange={url => patchObj('ticketing', { qrImageUrl: url })} label="Ticket QR code image" />
        </EditorSection>

        {/* ---- Section 6: Venue & parking ---- */}
        <EditorSection title="6. Venue & parking" sectionKey="venue" visible={visible('venue')} publicVisible={publicOnSite('venue')} onToggle={toggleSection}>
          <div className="bg-gray-50 border border-gray-200 rounded-lg p-3 text-sm space-y-2">
            <p className="text-gray-700">
              <span className="font-medium">Main venue (from the event):</span>{' '}
              {content.venueName || '— not set on the linked event yet'}
            </p>
            {subEvents.filter(se => se.location).length > 0 && (
              <div>
                <p className="font-medium text-gray-700">Sub-event venues (from each sub-event):</p>
                <ul className="mt-1 space-y-0.5 text-gray-600 list-disc list-inside">
                  {subEvents
                    .filter(se => se.location)
                    .map(se => (
                      <li key={se.sub_event_id}>
                        {se.sub_event_name}: {se.location}
                      </li>
                    ))}
                </ul>
              </div>
            )}
            <p className="text-xs text-gray-500">
              These pre-fill the public Venue section automatically from the event and its sub-events —
              you don&apos;t need to retype them. Edit the main venue on the linked event (or the Basics
              &quot;Venue name&quot; field above); edit a sub-event&apos;s venue from the Events admin.
              The fields below are optional extras (parking, entrance, transit, map) and override the
              building name only if you fill them in.
            </p>
          </div>
          <label className="flex items-start gap-2 text-sm text-gray-700">
            <input
              type="checkbox"
              className="mt-0.5 h-4 w-4 accent-primary-600"
              checked={content.showVenueDefaults !== false}
              onChange={e => set('showVenueDefaults', e.target.checked)}
            />
            <span>
              <span className="font-medium">Show the event &amp; sub-event addresses</span> — display
              the main venue pulled from the event and the sub-event venue list on the public page.
              Uncheck to show only the venues you add below (the Venue section stays visible; use the
              section toggle above to hide the whole section).
            </span>
          </label>
          <div className="border-t border-gray-100 pt-4">
            <div className="flex items-center justify-between mb-1">
              <FieldLabel>Additional venues</FieldLabel>
              <button
                type="button"
                onClick={() => addItem('venues', { name: '' })}
                className="inline-flex items-center gap-1 text-primary-600 text-sm font-medium"
              >
                <Plus className="w-4 h-4" /> Add venue
              </button>
            </div>
            <p className="text-xs text-gray-500 mb-3">
              Add a separate venue for an event or sub-event held at a different location (e.g. a
              concert). Each appears as its own venue card on the public page.
            </p>
            <div className="space-y-4">
              {arr('venues').map((v: any, i: number) => (
                <div key={i} className="border border-gray-200 rounded-lg p-3 space-y-2">
                  <div className="flex gap-2 items-center">
                    <input
                      className={`${INPUT_CLS} flex-1 font-medium`}
                      value={v.name ?? ''}
                      placeholder="Event name (e.g. Subhadeep Concert)"
                      onChange={e => updateItem('venues', i, { name: e.target.value })}
                    />
                    <button
                      type="button"
                      onClick={() => removeItem('venues', i)}
                      className="text-red-500 hover:text-red-700 p-1"
                      aria-label={`Remove venue ${i + 1}`}
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                  <CardBgColorField value={v.bgColor} onChange={val => updateItem('venues', i, { bgColor: val })} />
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {([
                      ['buildingName', 'Building / gym name'],
                      ['streetAddress', 'Full street address'],
                      ['mapsUrl', 'Google Maps URL'],
                      ['parkingLot', 'Parking lot number'],
                      ['parkingCost', 'Parking cost / free-parking info'],
                      ['accessibleParking', 'Accessible parking details'],
                      ['recommendedEntrance', 'Recommended entrance'],
                      ['publicTransit', 'Public transportation info'],
                    ] as [string, string][]).map(([key, label]) => (
                      <input
                        key={key}
                        className={INPUT_CLS}
                        value={v[key] ?? ''}
                        placeholder={label}
                        onChange={e => updateItem('venues', i, { [key]: e.target.value })}
                      />
                    ))}
                  </div>
                  <input
                    className={INPUT_CLS}
                    value={v.layoutNote ?? ''}
                    placeholder="Layout note (optional)"
                    onChange={e => updateItem('venues', i, { layoutNote: e.target.value })}
                  />
                  <AssetImageField
                    year={editYear}
                    category="venue"
                    value={v.venueMapImageUrl}
                    onChange={url => updateItem('venues', i, { venueMapImageUrl: url })}
                    label="Venue map image (optional)"
                  />
                </div>
              ))}
            </div>
          </div>
        </EditorSection>

        {/* ---- Section 7: Food ---- */}
        <EditorSection title="7. Food (Menu section)" sectionKey="food" visible={visible('food')} publicVisible={publicOnSite('food')} onToggle={toggleSection}>
          <label className="flex items-center gap-2 text-sm text-gray-700">
            <input
              type="checkbox"
              className="h-4 w-4 accent-primary-600"
              checked={visible('menuButton')}
              onChange={e => toggleSection('menuButton', e.target.checked)}
            />
            Show the &ldquo;Menu&rdquo; button in the page hero (scrolls to the Menu section)
          </label>
          <p className="text-xs text-gray-500 -mt-2">
            The hero button is hidden when this Menu section is off or has no content yet.{' '}
            <span
              className={
                publicOnSite('menuButton') ? 'text-green-700 font-medium' : 'text-amber-600'
              }
            >
              {publicOnSite('menuButton') ? 'Menu button is live on site.' : 'Menu button not on site yet.'}
            </span>
          </p>
          <div>
            <FieldLabel>Intro</FieldLabel>
            <textarea className={INPUT_CLS} rows={2} value={food.intro ?? ''} onChange={e => patchObj('food', { intro: e.target.value })} />
          </div>
          <div>
            <div className="flex items-center justify-between mb-2">
              <FieldLabel>Meals</FieldLabel>
              <button type="button" onClick={() => addNestedItem('food', 'meals', { name: '', hours: '', description: '' })} className="inline-flex items-center gap-1 text-primary-600 text-sm font-medium"><Plus className="w-4 h-4" /> Add meal</button>
            </div>
            <p className="text-xs text-gray-500 mb-2">
              Each meal (e.g. “Friday Dinner”) becomes a card on the public page. Add menu
              categories like “Non-Veg Item”, “Veg Item”, or “Kids Meal”, and list the dishes
              under each. Leave categories empty to just show the optional detail text.
            </p>
            <div className="space-y-3">
              {nestedArr('food', 'meals').map((m: any, i: number) => (
                <div key={i} className="border border-gray-200 rounded-lg p-3 space-y-2">
                  <div className="flex flex-wrap gap-2 items-center">
                    <input className={`${INPUT_CLS} flex-1 min-w-[8rem]`} value={m.name ?? ''} placeholder="Friday Dinner" onChange={e => updateNestedItem('food', 'meals', i, { name: e.target.value })} />
                    <input className="border border-gray-300 rounded-lg px-2 py-2 text-sm w-40" value={m.hours ?? ''} placeholder="7:00–9:00 PM" onChange={e => updateNestedItem('food', 'meals', i, { hours: e.target.value })} />
                    <button type="button" onClick={() => removeNestedItem('food', 'meals', i)} className="text-red-500 hover:text-red-700 p-1" aria-label="Remove meal"><Trash2 className="w-4 h-4" /></button>
                  </div>
                  <CardBgColorField value={m.bgColor} onChange={v => updateNestedItem('food', 'meals', i, { bgColor: v })} />
                  <input className={INPUT_CLS} value={m.description ?? ''} placeholder="Optional detail shown under the meal title" onChange={e => updateNestedItem('food', 'meals', i, { description: e.target.value })} />
                  {(() => {
                    const cats: { label: string; items: string[]; color?: string }[] = Array.isArray(m.categories) ? m.categories : [];
                    const setCats = (next: { label: string; items: string[]; color?: string }[]) =>
                      updateNestedItem('food', 'meals', i, { categories: next });
                    return (
                      <div className="space-y-2 pt-1">
                        {cats.map((cat, ci) => (
                          <div key={ci} className="border border-gray-100 rounded-lg p-2 bg-gray-50 space-y-2">
                            <div className="flex gap-2 items-center">
                              <input
                                className={`${INPUT_CLS} flex-1 min-w-0`}
                                value={cat.label ?? ''}
                                placeholder="Category — e.g. Non-Veg Item, Veg Item, Kids Meal, Snacks"
                                onChange={e =>
                                  setCats(cats.map((x, k) => (k === ci ? { ...x, label: e.target.value } : x)))
                                }
                              />
                              <span
                                className="w-5 h-5 rounded-full border border-gray-300 flex-shrink-0"
                                style={{ backgroundColor: cat.color || '#9ca3af' }}
                                title="Category color"
                              />
                              <select
                                className="border border-gray-300 rounded-lg px-2 py-2 text-sm shrink-0"
                                value={cat.color ?? ''}
                                onChange={e =>
                                  setCats(
                                    cats.map((x, k) =>
                                      k === ci ? { ...x, color: e.target.value || undefined } : x
                                    )
                                  )
                                }
                              >
                                <option value="">Default</option>
                                {MENU_CATEGORY_COLORS.map(c => (
                                  <option key={c.value} value={c.value}>
                                    {c.name}
                                  </option>
                                ))}
                              </select>
                              <button
                                type="button"
                                onClick={() => setCats(cats.filter((_, k) => k !== ci))}
                                className="text-red-500 hover:text-red-700 p-1"
                                aria-label="Remove category"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                            <StringListEditor
                              value={cat.items}
                              placeholder="Dish — e.g. Goat Biriyani"
                              onChange={items => setCats(cats.map((x, k) => (k === ci ? { ...x, items } : x)))}
                            />
                          </div>
                        ))}
                        <button
                          type="button"
                          onClick={() => setCats([...cats, { label: '', items: [] }])}
                          className="inline-flex items-center gap-1 text-primary-600 text-sm font-medium"
                        >
                          <Plus className="w-4 h-4" /> Add menu category
                        </button>
                      </div>
                    );
                  })()}
                </div>
              ))}
            </div>
          </div>
          <div>
            <FieldLabel>Food photos</FieldLabel>
            <AssetImageList year={editYear} category="food" value={food.photos} onChange={urls => patchObj('food', { photos: urls })} />
          </div>
        </EditorSection>

        {/* ---- Section 8: Puja & religious ---- */}
        <EditorSection title="8. Puja & religious information" sectionKey="puja" visible={visible('puja')} publicVisible={publicOnSite('puja')} onToggle={toggleSection}>
          <div>
            <FieldLabel>Intro</FieldLabel>
            <textarea className={INPUT_CLS} rows={2} value={puja.intro ?? ''} onChange={e => patchObj('puja', { intro: e.target.value })} />
          </div>
          <div>
            <div className="flex items-center justify-between mb-2">
              <FieldLabel>Timings (Pushpanjali, Sandhi Puja, Kumari Puja, Dhunuchi, Bhog, Sindoor Khela…)</FieldLabel>
              <button type="button" onClick={() => addNestedItem('puja', 'timings', { label: '', time: '' })} className="inline-flex items-center gap-1 text-primary-600 text-sm font-medium"><Plus className="w-4 h-4" /> Add timing</button>
            </div>
            <div className="space-y-2">
              {nestedArr('puja', 'timings').map((t: any, i: number) => (
                <div key={i} className="flex gap-2 items-center">
                  <input className={`${INPUT_CLS} flex-1`} value={t.label ?? ''} placeholder="Pushpanjali" onChange={e => updateNestedItem('puja', 'timings', i, { label: e.target.value })} />
                  <input className="border border-gray-300 rounded-lg px-2 py-2 text-sm w-40" value={t.time ?? ''} placeholder="10:30 AM" onChange={e => updateNestedItem('puja', 'timings', i, { time: e.target.value })} />
                  <button type="button" onClick={() => removeNestedItem('puja', 'timings', i)} className="text-red-500 hover:text-red-700 p-1"><Trash2 className="w-4 h-4" /></button>
                </div>
              ))}
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {([
              ['priestInfo', 'Priest information'],
              ['itemsToBring', 'Items devotees should bring'],
              ['attireGuidance', 'Saree / traditional-attire guidance'],
              ['rules', 'Rules (flowers, offerings, footwear)'],
            ] as [string, string][]).map(([key, label]) => (
              <div key={key}>
                <FieldLabel>{label}</FieldLabel>
                <input className={INPUT_CLS} value={(puja as any)[key] ?? ''} onChange={e => patchObj('puja', { [key]: e.target.value })} />
              </div>
            ))}
          </div>
        </EditorSection>

        {/* ---- Section 9: Children & family ---- */}
        <EditorSection title="9. Children & family activities" sectionKey="kids" visible={visible('kids')} publicVisible={publicOnSite('kids')} onToggle={toggleSection}>
          <div>
            <FieldLabel>Intro</FieldLabel>
            <textarea className={INPUT_CLS} rows={2} value={kids.intro ?? ''} onChange={e => patchObj('kids', { intro: e.target.value })} />
          </div>
          <div>
            <div className="flex items-center justify-between mb-2">
              <FieldLabel>Activities</FieldLabel>
              <button type="button" onClick={() => addNestedItem('kids', 'activities', { title: '', description: '' })} className="inline-flex items-center gap-1 text-primary-600 text-sm font-medium"><Plus className="w-4 h-4" /> Add activity</button>
            </div>
            <div className="space-y-2">
              {nestedArr('kids', 'activities').map((a: any, i: number) => (
                <div key={i} className="flex gap-2 items-center">
                  <input className={`${INPUT_CLS} flex-1`} value={a.title ?? ''} placeholder="Art competition" onChange={e => updateNestedItem('kids', 'activities', i, { title: e.target.value })} />
                  <input className={`${INPUT_CLS} flex-1`} value={a.description ?? ''} placeholder="Optional detail" onChange={e => updateNestedItem('kids', 'activities', i, { description: e.target.value })} />
                  <button type="button" onClick={() => removeNestedItem('kids', 'activities', i)} className="text-red-500 hover:text-red-700 p-1"><Trash2 className="w-4 h-4" /></button>
                </div>
              ))}
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <FieldLabel>Age requirements</FieldLabel>
              <input className={INPUT_CLS} value={kids.ageRequirements ?? ''} onChange={e => patchObj('kids', { ageRequirements: e.target.value })} />
            </div>
            <div>
              <FieldLabel>Parent-supervision policy</FieldLabel>
              <input className={INPUT_CLS} value={kids.supervisionPolicy ?? ''} onChange={e => patchObj('kids', { supervisionPolicy: e.target.value })} />
            </div>
          </div>
        </EditorSection>

        {/* ---- Section 10: Sponsorship ---- */}
        <EditorSection title="10. Sponsorship" sectionKey="sponsorship" visible={visible('sponsorship')} publicVisible={publicOnSite('sponsorship')} onToggle={toggleSection} toggleLabel="Show the “Become a Sponsor” button on the public page">
          <p className="text-xs text-gray-500">
            There is no separate Sponsorship section on the public page. The “Become a Sponsor” button
            lives in the page hero (check the box above to show it). By default it opens a prospectus
            page that displays the PDF below plus a “Contact Us to Sponsor” button.
          </p>

          <div>
            <FieldLabel>Sponsorship prospectus (PDF)</FieldLabel>
            {hasSponsorshipPdf ? (
              <div className="flex items-center gap-2 text-sm text-green-700 mb-2">
                <FileText className="w-4 h-4" /> Prospectus uploaded
                <a
                  href={durgaPujaPageAPI.sponsorshipPdfUrl(editYear)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary-600 hover:text-primary-700 underline"
                >
                  View
                </a>
              </div>
            ) : (
              <div className="flex items-center gap-2 text-gray-400 text-sm mb-2">
                <FileText className="w-4 h-4" /> No prospectus uploaded yet
              </div>
            )}
            <input
              ref={pdfInputRef}
              type="file"
              accept="application/pdf,.pdf"
              className="hidden"
              onChange={e => handlePdfSelected(e.target.files?.[0])}
            />
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => pdfInputRef.current?.click()}
                disabled={uploadingPdf}
                className="inline-flex items-center gap-2 bg-white border-2 border-primary-600 text-primary-600 px-4 py-2 rounded-lg font-medium hover:bg-primary-50 transition-colors disabled:opacity-50"
              >
                <Upload className="w-4 h-4" />
                {uploadingPdf ? 'Uploading…' : hasSponsorshipPdf ? 'Replace PDF' : 'Upload PDF'}
              </button>
              {hasSponsorshipPdf && (
                <button
                  type="button"
                  onClick={handlePdfDelete}
                  className="inline-flex items-center gap-2 text-red-600 hover:text-red-700 px-3 py-2 font-medium"
                >
                  <Trash2 className="w-4 h-4" /> Remove
                </button>
              )}
            </div>
            <p className="text-xs text-gray-500 mt-1">PDF up to 25MB. Uploading replaces the current one.</p>
          </div>

          <div>
            <FieldLabel>Optional: send the button straight to a link instead</FieldLabel>
            <input
              className={INPUT_CLS}
              value={sponsorship.buttonUrl ?? ''}
              onChange={e => patchObj('sponsorship', { buttonUrl: e.target.value })}
              placeholder="https://docs.google.com/forms/…  or  /contact"
            />
            <p className="text-xs text-gray-500 mt-1">
              Leave empty to use the prospectus page above. If you set a URL here (e.g. a Google Form) or
              a path like <span className="font-medium">/contact</span>, the button goes there directly and
              skips the prospectus page. Specific to the {content.year} page.
            </p>
          </div>
        </EditorSection>

        {/* ---- Sponsor showcase (logos/flyers) ---- */}
        <EditorSection title="Sponsors (logos & flyers)" sectionKey="sponsorShowcase" visible={visible('sponsorShowcase')} publicVisible={publicOnSite('sponsorShowcase')} onToggle={toggleSection} toggleLabel="Show the sponsor logos/flyers at the bottom of the public page">
          <p className="text-xs text-gray-500">
            Separate from the site-wide Sponsors page. Add each sponsor with a title, a tier, and one or
            more logo/flyer images. They appear grouped by tier (Presenting → Platinum → Gold → Silver)
            at the bottom of the {content.year} page.
          </p>
          <div className="space-y-4">
            {arr('sponsorShowcase').map((s: any, i: number) => (
              <div key={i} className="border border-gray-200 rounded-lg p-3 space-y-2">
                <div className="flex gap-2 items-center">
                  <input
                    className={`${INPUT_CLS} flex-1`}
                    value={s.title ?? ''}
                    placeholder="Sponsor title / name"
                    onChange={e => updateItem('sponsorShowcase', i, { title: e.target.value })}
                  />
                  <select
                    className="border border-gray-300 rounded-lg px-2 py-2 text-sm"
                    value={s.tier ?? 'GOLD'}
                    onChange={e => updateItem('sponsorShowcase', i, { tier: e.target.value })}
                  >
                    <option value="PRESENTING">Presenting</option>
                    <option value="PLATINUM">Platinum</option>
                    <option value="GOLD">Gold</option>
                    <option value="SILVER">Silver</option>
                  </select>
                  <button
                    type="button"
                    onClick={() => removeItem('sponsorShowcase', i)}
                    className="text-red-500 hover:text-red-700 p-1"
                    aria-label={`Remove sponsor ${i + 1}`}
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
                <div>
                  <FieldLabel>Logo / flyer images</FieldLabel>
                  <AssetImageList
                    year={editYear}
                    category="sponsors"
                    value={s.images}
                    onChange={urls => updateItem('sponsorShowcase', i, { images: urls })}
                  />
                </div>
              </div>
            ))}
          </div>
          <button
            type="button"
            onClick={() => addItem('sponsorShowcase', { title: '', tier: 'GOLD', images: [] })}
            className="inline-flex items-center gap-1 text-primary-600 text-sm font-medium"
          >
            <Plus className="w-4 h-4" /> Add sponsor
          </button>
        </EditorSection>

        {/* ---- Section 11: Vendors ---- */}
        <EditorSection title="11. Vendor & stall registration" sectionKey="vendors" visible={visible('vendors')} publicVisible={publicOnSite('vendors')} onToggle={toggleSection}>
          <div>
            <FieldLabel>Intro</FieldLabel>
            <textarea className={INPUT_CLS} rows={2} value={vendors.intro ?? ''} onChange={e => patchObj('vendors', { intro: e.target.value })} />
          </div>
          <div>
            <FieldLabel>Vendor types</FieldLabel>
            <StringListEditor value={vendors.types} onChange={v => patchObj('vendors', { types: v })} placeholder="Food vendors, Clothing & jewelry, Nonprofits…" />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {([
              ['stallFees', 'Stall fees'],
              ['provisions', 'Table & chair provisions'],
              ['electricity', 'Electricity availability'],
              ['setupTimes', 'Setup & closing times'],
              ['insurance', 'Insurance requirements'],
              ['deadline', 'Application deadline'],
              ['formUrl', 'Registration form URL'],
              ['contactEmail', 'Vendor contact email'],
            ] as [string, string][]).map(([key, label]) => (
              <div key={key}>
                <FieldLabel>{label}</FieldLabel>
                <input className={INPUT_CLS} value={(vendors as any)[key] ?? ''} onChange={e => patchObj('vendors', { [key]: e.target.value })} />
              </div>
            ))}
          </div>
        </EditorSection>

        {/* ---- Section 12: Volunteer ---- */}
        <EditorSection title="12. Volunteer" sectionKey="volunteer" visible={visible('volunteer')} publicVisible={publicOnSite('volunteer')} onToggle={toggleSection} toggleLabel="Show the “Volunteer” button on the public page (opens your Google Form)">
          <p className="text-xs text-gray-500">
            There is no separate Volunteer section on the public page. The Volunteer button lives in the
            page hero: check the box above and set the Google Form URL below, and the button opens that
            form directly. Unchecked (or no form URL) = the button is hidden.
          </p>
          <div>
            <FieldLabel>Google Form URL</FieldLabel>
            <input className={INPUT_CLS} value={volunteer.formUrl ?? ''} onChange={e => patchObj('volunteer', { formUrl: e.target.value })} placeholder="https://docs.google.com/forms/…" />
            <p className="text-xs text-gray-500 mt-1">
              Build a Google Form with a Checkboxes question for the categories plus Name and Email (or
              turn on “Collect email addresses”), then paste its share link here. Submissions appear in
              the form’s Responses tab / linked Google Sheet — enable “Get email notifications for new
              responses” to be emailed on each signup. This form is specific to the {content.year} page.
            </p>
          </div>
          <div>
            <div className="flex items-center justify-between mb-1">
              <FieldLabel>Volunteer categories (reference for your form)</FieldLabel>
              <button
                type="button"
                onClick={() => patchObj('volunteer', { categories: DEFAULT_VOLUNTEER_CATEGORIES })}
                className="text-primary-600 text-xs font-medium hover:text-primary-700"
              >
                Fill recommended
              </button>
            </div>
            <StringListEditor value={volunteer.categories} onChange={v => patchObj('volunteer', { categories: v })} placeholder="Puja, Food service, Parking, Photography…" />
            <p className="text-xs text-gray-500 mt-1">
              Not shown on the public page — use this as your checklist when adding the <span className="font-medium">Checkboxes</span> question in the Google Form.
            </p>
          </div>
        </EditorSection>

        {/* ---- Section 13: About ---- */}
        <EditorSection title="13. About Sanhoti" sectionKey="about" visible={visible('about')} publicVisible={publicOnSite('about')} onToggle={toggleSection}>
          <textarea className={INPUT_CLS} rows={4} value={content.about ?? ''} onChange={e => set('about', e.target.value)} placeholder="Sanhoti is a nonprofit Bengali cultural association serving Orange County and Southern California…" />
        </EditorSection>

        {/* ---- Section 14: Gallery ---- */}
        <EditorSection title="14. Previous-year gallery" sectionKey="gallery" visible={visible('gallery')} publicVisible={publicOnSite('gallery')} onToggle={toggleSection}>
          <div>
            <FieldLabel>Intro</FieldLabel>
            <textarea className={INPUT_CLS} rows={2} value={gallery.intro ?? ''} onChange={e => patchObj('gallery', { intro: e.target.value })} />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <FieldLabel>Link to full gallery (internal path)</FieldLabel>
              <input className={INPUT_CLS} value={gallery.galleryLink ?? ''} onChange={e => patchObj('gallery', { galleryLink: e.target.value })} placeholder="/galleries" />
            </div>
            <div>
              <FieldLabel>Highlight video embed URL</FieldLabel>
              <input className={INPUT_CLS} value={gallery.videoUrl ?? ''} onChange={e => patchObj('gallery', { videoUrl: e.target.value })} placeholder="https://www.youtube.com/embed/…" />
            </div>
          </div>
          <div>
            <FieldLabel>Gallery images</FieldLabel>
            <AssetImageList year={editYear} category="gallery" value={gallery.images} onChange={urls => patchObj('gallery', { images: urls })} />
          </div>
        </EditorSection>

        {/* ---- Section 15: FAQ ---- */}
        <EditorSection title="15. Frequently asked questions" sectionKey="faqs" visible={visible('faqs')} publicVisible={publicOnSite('faqs')} onToggle={toggleSection}>
          <div className="flex justify-end">
            <button type="button" onClick={addFaq} className="inline-flex items-center gap-1 text-primary-600 text-sm font-medium"><Plus className="w-4 h-4" /> Add FAQ</button>
          </div>
          <div className="space-y-4">
            {content.faqs.map((faq, i) => (
              <div key={i} className="border border-gray-200 rounded-lg p-3 flex items-start gap-2">
                <div className="flex-1 space-y-2">
                  <input className={INPUT_CLS} value={faq.question} onChange={e => setFaq(i, { question: e.target.value })} placeholder="Question" />
                  <textarea className={INPUT_CLS} rows={2} value={faq.answer} onChange={e => setFaq(i, { answer: e.target.value })} placeholder="Answer" />
                </div>
                <button type="button" onClick={() => removeFaq(i)} className="text-red-500 hover:text-red-700 p-1" aria-label={`Remove FAQ ${i + 1}`}><Trash2 className="w-5 h-5" /></button>
              </div>
            ))}
          </div>
        </EditorSection>

        {/* ---- Section 16: Contact ---- */}
        <EditorSection title="16. Contact" sectionKey="contact" visible={visible('contact')} publicVisible={publicOnSite('contact')} onToggle={toggleSection}>
          <div>
            <div className="flex items-center justify-between mb-2">
              <FieldLabel>Contacts</FieldLabel>
              <button type="button" onClick={() => addItem('contacts', { role: '', name: '', email: '', phone: '' })} className="inline-flex items-center gap-1 text-primary-600 text-sm font-medium"><Plus className="w-4 h-4" /> Add contact</button>
            </div>
            <div className="space-y-2">
              {arr('contacts').map((c: any, i: number) => (
                <div key={i} className="flex flex-wrap gap-2 items-center">
                  <input className={`${INPUT_CLS} flex-1 min-w-[7rem]`} value={c.role ?? ''} placeholder="General / Tickets / Sponsorship…" onChange={e => updateItem('contacts', i, { role: e.target.value })} />
                  <input className={`${INPUT_CLS} flex-1 min-w-[7rem]`} value={c.name ?? ''} placeholder="Name (optional)" onChange={e => updateItem('contacts', i, { name: e.target.value })} />
                  <input className={`${INPUT_CLS} flex-1 min-w-[7rem]`} value={c.email ?? ''} placeholder="Email" onChange={e => updateItem('contacts', i, { email: e.target.value })} />
                  <input className={`${INPUT_CLS} flex-1 min-w-[7rem]`} value={c.phone ?? ''} placeholder="Phone" onChange={e => updateItem('contacts', i, { phone: e.target.value })} />
                  <button type="button" onClick={() => removeItem('contacts', i)} className="text-red-500 hover:text-red-700 p-1"><Trash2 className="w-4 h-4" /></button>
                </div>
              ))}
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {([
              ['facebook', 'Facebook URL'],
              ['instagram', 'Instagram URL'],
              ['youtube', 'YouTube URL'],
              ['whatsapp', 'WhatsApp URL'],
            ] as [string, string][]).map(([key, label]) => (
              <div key={key}>
                <FieldLabel>{label}</FieldLabel>
                <input className={INPUT_CLS} value={(social as any)[key] ?? ''} onChange={e => patchObj('social', { [key]: e.target.value })} placeholder="https://…" />
              </div>
            ))}
          </div>
        </EditorSection>

        {/* ---- Sub-events (from linked event) ---- */}
        <div
          className={`rounded-xl shadow p-6 border ${
            publicOnSite('subEvents') ? 'bg-green-50 border-green-200' : 'bg-white border-gray-100'
          }`}
        >
          <div className="flex items-start justify-between gap-3 mb-1">
            <h2 className="text-lg font-semibold text-gray-900">Sub-events on the Durga Puja page</h2>
            <span
              className={`text-xs font-medium shrink-0 ${
                publicOnSite('subEvents') ? 'text-green-700' : 'text-gray-400'
              }`}
            >
              {publicOnSite('subEvents') ? 'Live on site' : 'Not on site yet'}
            </span>
          </div>
          <p className="text-gray-600 text-sm mb-4">
            Turn a sub-event on to show it (with its banner) on the public page, in the “Programs &amp;
            Events” strip. Sub-events come from the linked Durga Puja event.
          </p>
          {!content.linkedEventId ? (
            <p className="text-sm text-gray-500">
              No Durga Puja event is linked yet. Create or update a &quot;Durga Puja&quot; event with
              sub-events, and they will appear here.
            </p>
          ) : subEvents.length === 0 ? (
            <p className="text-sm text-gray-500">
              The linked event{' '}
              <a href={`/events/${content.linkedEventId}`} target="_blank" rel="noopener noreferrer" className="text-primary-600 hover:text-primary-700 underline">
                {content.linkedEventId}
              </a>{' '}
              has no active sub-events yet.
            </p>
          ) : (
            <div className="space-y-3">
              {subEvents.map(se => {
                const banner = subEventImages[se.sub_event_id];
                const on = se.show_in_durga_puja_page === true;
                return (
                  <div key={se.sub_event_id} className="flex items-center gap-4 border border-gray-200 rounded-lg p-3">
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
                    </div>
                    <button
                      type="button"
                      role="switch"
                      aria-checked={on}
                      disabled={togglingId === se.sub_event_id}
                      onClick={() => toggleSubEventVisibility(se)}
                      className={`relative inline-flex h-6 w-11 flex-shrink-0 items-center rounded-full transition-colors disabled:opacity-50 ${on ? 'bg-primary-600' : 'bg-gray-300'}`}
                      title={on ? 'Shown on Durga Puja page' : 'Hidden'}
                    >
                      <span className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform ${on ? 'translate-x-5' : 'translate-x-0.5'}`} />
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div className="pt-2 pb-10">
          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className="bg-primary-600 text-white px-6 py-2.5 rounded-lg font-semibold hover:bg-primary-700 transition-colors disabled:opacity-50"
          >
            {saving ? 'Saving…' : 'Save Changes'}
          </button>
        </div>
      </div>
    </div>
  );
}
