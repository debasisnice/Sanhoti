import { FormEvent, useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { BookOpen, ExternalLink, Eye, EyeOff, Pencil, Plus, Star, Trash2, X } from 'lucide-react';
import { blogsAPI } from '../../services/api';
import type { Blog } from '../../types';

const INPUT =
  'w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500';
const LABEL = 'block text-sm font-medium text-gray-700 mb-1';
const HINT = 'text-xs text-gray-500 mt-1';

interface FormState {
  title: string;
  slug: string;
  body: string;
  excerpt: string;
  author_name: string;
  author_contact: string;
  cover_image_alt: string;
  tags: string;
  meta_title: string;
  meta_description: string;
  is_published: boolean;
  is_active: boolean;
  is_featured: boolean;
}

const EMPTY: FormState = {
  title: '',
  slug: '',
  body: '',
  excerpt: '',
  author_name: '',
  author_contact: '',
  cover_image_alt: '',
  tags: '',
  meta_title: '',
  meta_description: '',
  is_published: false,
  is_active: true,
  is_featured: false,
};

function slugify(title: string): string {
  return title
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9\s-]/g, ' ')
    .trim()
    .replace(/[\s-]+/g, '-')
    .toLowerCase()
    .slice(0, 80)
    .replace(/^-+|-+$/g, '');
}

function toForm(b: Blog): FormState {
  return {
    title: b.title ?? '',
    slug: b.slug ?? '',
    body: b.body ?? '',
    excerpt: b.excerpt ?? '',
    author_name: b.author_name ?? '',
    author_contact: b.author_contact ?? '',
    cover_image_alt: b.cover_image_alt ?? '',
    tags: b.tags ?? '',
    meta_title: b.meta_title ?? '',
    meta_description: b.meta_description ?? '',
    is_published: b.is_published === true,
    is_active: b.is_active !== false,
    is_featured: b.is_featured === true,
  };
}

export default function AdminBlogs() {
  const [blogs, setBlogs] = useState<Blog[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Blog | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY);
  const [coverFile, setCoverFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);
  const [previewHtml, setPreviewHtml] = useState('');
  const [previewLoading, setPreviewLoading] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      setBlogs(await blogsAPI.getAll());
    } catch {
      toast.error('Failed to load blog posts');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  useEffect(() => {
    if (!showForm) {
      setPreviewHtml('');
      return;
    }
    const handle = window.setTimeout(async () => {
      if (!form.body.trim()) {
        setPreviewHtml('');
        return;
      }
      setPreviewLoading(true);
      try {
        const html = await blogsAPI.previewBody(form.body);
        setPreviewHtml(html);
      } catch {
        setPreviewHtml('<p class="text-red-600 text-sm">Preview unavailable.</p>');
      } finally {
        setPreviewLoading(false);
      }
    }, 350);
    return () => window.clearTimeout(handle);
  }, [form.body, showForm]);

  const openCreate = () => {
    setEditing(null);
    setForm(EMPTY);
    setCoverFile(null);
    setShowForm(true);
  };

  const openEdit = (blog: Blog) => {
    setEditing(blog);
    setForm(toForm(blog));
    setCoverFile(null);
    setShowForm(true);
  };

  const patchForm = (patch: Partial<FormState>) => setForm(prev => ({ ...prev, ...patch }));

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!form.title.trim()) {
      toast.error('Title is required');
      return;
    }
    if (!form.body.trim()) {
      toast.error('Body is required');
      return;
    }
    setSaving(true);
    try {
      const payload: Partial<Blog> = {
        ...form,
        slug: form.slug.trim() || undefined,
        author_name: form.author_name.trim() || undefined,
        author_contact: form.author_contact.trim() || undefined,
        excerpt: form.excerpt.trim() || undefined,
        cover_image_alt: form.cover_image_alt.trim() || undefined,
        tags: form.tags.trim() || undefined,
        meta_title: form.meta_title.trim() || undefined,
        meta_description: form.meta_description.trim() || undefined,
      };
      if (editing) {
        await blogsAPI.update(editing.blog_id, payload, coverFile);
        toast.success('Blog post updated');
      } else {
        await blogsAPI.create(payload, coverFile);
        toast.success('Blog post created');
      }
      setShowForm(false);
      await load();
    } catch (error) {
      const message =
        (error as { response?: { data?: { error?: string } } })?.response?.data?.error ??
        'Failed to save blog post';
      toast.error(message);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (blog: Blog) => {
    if (
      !window.confirm(
        `Delete "${blog.title}"? Its /blogs/${blog.slug} page will return 404.`
      )
    ) {
      return;
    }
    try {
      await blogsAPI.delete(blog.blog_id);
      toast.success('Blog post deleted');
      await load();
    } catch {
      toast.error('Failed to delete blog post');
    }
  };

  const togglePublish = async (blog: Blog) => {
    try {
      if (blog.is_published) {
        await blogsAPI.unpublish(blog.blog_id);
        toast.success('Unpublished');
      } else {
        await blogsAPI.publish(blog.blog_id);
        toast.success('Published');
      }
      await load();
    } catch (error) {
      const message =
        (error as { response?: { data?: { error?: string } } })?.response?.data?.error ??
        'Failed to update publish status';
      toast.error(message);
    }
  };

  const slugPreview = form.slug.trim() || slugify(form.title) || 'your-post-slug';

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Blog posts</h1>
          <p className="text-gray-600 mt-1">
            Publish articles at <code>/blogs/&lt;slug&gt;</code>. Use Markdown for the body.
          </p>
        </div>
        <button
          type="button"
          onClick={openCreate}
          className="inline-flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700"
        >
          <Plus className="w-4 h-4" /> New post
        </button>
      </div>

      {loading ? (
        <p className="text-gray-500">Loading blog posts…</p>
      ) : blogs.length === 0 ? (
        <div className="text-center py-16 bg-gray-50 rounded-lg border border-dashed border-gray-300">
          <BookOpen className="w-10 h-10 text-gray-400 mx-auto mb-3" />
          <h2 className="font-semibold text-gray-900 mb-1">No blog posts yet</h2>
          <p className="text-gray-600 text-sm mb-4">Create your first community story or event recap.</p>
          <button type="button" onClick={openCreate} className="text-primary-600 font-medium hover:underline">
            Write a post
          </button>
        </div>
      ) : (
        <div className="overflow-x-auto border border-gray-200 rounded-lg">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Title</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Status</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Published</th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-gray-600 uppercase">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 bg-white">
              {blogs.map(b => (
                <tr key={b.blog_id} className="hover:bg-gray-50">
                  <td className="px-4 py-3">
                    <div className="font-medium text-gray-900 flex items-center gap-1.5">
                      {b.is_featured && <Star className="w-4 h-4 text-amber-500 fill-amber-500" />}
                      {b.title}
                    </div>
                    <a
                      href={`/blogs/${b.slug}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs text-primary-600 hover:underline inline-flex items-center gap-0.5 mt-0.5"
                    >
                      /blogs/{b.slug} <ExternalLink className="w-3 h-3" />
                    </a>
                  </td>
                  <td className="px-4 py-3">
                    {b.is_active === false ? (
                      <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-600">Archived</span>
                    ) : b.is_published ? (
                      <span className="text-xs px-2 py-0.5 rounded-full bg-green-100 text-green-800">Published</span>
                    ) : (
                      <span className="text-xs px-2 py-0.5 rounded-full bg-amber-100 text-amber-800">Draft</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-600">
                    {b.published_at
                      ? new Date(b.published_at).toLocaleDateString('en-US', { timeZone: 'America/Los_Angeles' })
                      : '—'}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="inline-flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => togglePublish(b)}
                        className="p-2 text-gray-500 hover:text-primary-600 rounded"
                        title={b.is_published ? 'Unpublish' : 'Publish'}
                      >
                        {b.is_published ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                      <button
                        type="button"
                        onClick={() => openEdit(b)}
                        className="p-2 text-gray-500 hover:text-primary-600 rounded"
                        title="Edit"
                      >
                        <Pencil className="w-4 h-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDelete(b)}
                        className="p-2 text-gray-500 hover:text-red-600 rounded"
                        title="Delete"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {showForm && (
        <div className="fixed inset-0 z-50 flex items-start justify-center p-4 bg-black/40 overflow-y-auto">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-5xl my-8">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
              <h2 className="text-lg font-semibold text-gray-900">
                {editing ? 'Edit blog post' : 'New blog post'}
              </h2>
              <button type="button" onClick={() => setShowForm(false)} className="text-gray-400 hover:text-gray-600">
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleSubmit} className="p-6 space-y-4 max-h-[75vh] overflow-y-auto">
              <div>
                <label className={LABEL}>Title *</label>
                <input className={INPUT} value={form.title} onChange={e => patchForm({ title: e.target.value })} required />
              </div>
              <div>
                <label className={LABEL}>URL slug</label>
                <input className={INPUT} value={form.slug} onChange={e => patchForm({ slug: e.target.value })} placeholder={slugPreview} />
                <p className={HINT}>Public URL: /blogs/{slugPreview}</p>
              </div>
              <div>
                <label className={LABEL}>Body (Markdown) *</label>
                <p className={HINT + ' mb-2'}>
                  Use ## and ### for section headings, **bold**, lists, [links](/path), and &gt; blockquotes.
                  Preview matches the public page exactly.
                </p>
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 min-h-[320px]">
                  <textarea
                    className={`${INPUT} font-mono text-sm min-h-[320px] resize-y`}
                    value={form.body}
                    onChange={e => patchForm({ body: e.target.value })}
                    required
                    placeholder={'## Section heading\n\nYour opening paragraph.\n\n### Subsection\n\n- Bullet one\n- Bullet two'}
                  />
                  <div className="border border-gray-200 rounded-lg bg-gray-50 overflow-hidden flex flex-col min-h-[320px]">
                    <div className="px-3 py-2 border-b border-gray-200 bg-white text-xs font-medium text-gray-600">
                      Live preview {previewLoading ? '…' : ''}
                    </div>
                    <div className="flex-1 overflow-y-auto p-4">
                      {form.body.trim() ? (
                        <div
                          className="prose prose-sm max-w-none prose-headings:text-gray-900 prose-a:text-primary-600"
                          dangerouslySetInnerHTML={{ __html: previewHtml || '<p class="text-gray-400 text-sm">Rendering…</p>' }}
                        />
                      ) : (
                        <p className="text-gray-400 text-sm">Start typing to see a preview.</p>
                      )}
                    </div>
                  </div>
                </div>
              </div>
              <div>
                <label className={LABEL}>Excerpt</label>
                <textarea className={INPUT} rows={2} value={form.excerpt} onChange={e => patchForm({ excerpt: e.target.value })} />
                <p className={HINT}>Optional. Shown on the blog index; auto-generated from body if empty.</p>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className={LABEL}>Author name</label>
                  <input className={INPUT} value={form.author_name} onChange={e => patchForm({ author_name: e.target.value })} />
                </div>
                <div>
                  <label className={LABEL}>Author contact</label>
                  <input className={INPUT} value={form.author_contact} onChange={e => patchForm({ author_contact: e.target.value })} placeholder="Optional phone number" />
                </div>
              </div>
              <div>
                <label className={LABEL}>Cover image</label>
                <input type="file" accept="image/*" onChange={e => setCoverFile(e.target.files?.[0] ?? null)} />
                {editing?.cover_image_path && !coverFile && (
                  <img
                    src={blogsAPI.getCoverUrl(editing.blog_id)}
                    alt=""
                    className="mt-2 h-24 rounded border object-cover"
                  />
                )}
              </div>
              <div>
                <label className={LABEL}>Cover image alt text</label>
                <input className={INPUT} value={form.cover_image_alt} onChange={e => patchForm({ cover_image_alt: e.target.value })} />
              </div>
              <div>
                <label className={LABEL}>Tags</label>
                <input className={INPUT} value={form.tags} onChange={e => patchForm({ tags: e.target.value })} placeholder="durga puja, community, charity" />
                <p className={HINT}>Comma-separated.</p>
              </div>
              <div>
                <label className={LABEL}>SEO title</label>
                <input className={INPUT} value={form.meta_title} onChange={e => patchForm({ meta_title: e.target.value })} />
              </div>
              <div>
                <label className={LABEL}>SEO description</label>
                <textarea className={INPUT} rows={2} value={form.meta_description} onChange={e => patchForm({ meta_description: e.target.value })} />
              </div>
              <div className="flex flex-wrap gap-4">
                <label className="inline-flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" checked={form.is_published} onChange={e => patchForm({ is_published: e.target.checked })} />
                  <span className="text-sm text-gray-700">Published (visible to public)</span>
                </label>
                <label className="inline-flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" checked={form.is_active} onChange={e => patchForm({ is_active: e.target.checked })} />
                  <span className="text-sm text-gray-700">Active (not archived)</span>
                </label>
                <label className="inline-flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" checked={form.is_featured} onChange={e => patchForm({ is_featured: e.target.checked })} />
                  <span className="text-sm text-gray-700">Featured on blog index</span>
                </label>
              </div>
              <div className="flex justify-end gap-3 pt-4 border-t border-gray-200">
                <button type="button" onClick={() => setShowForm(false)} className="px-4 py-2 text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50">
                  Cancel
                </button>
                <button type="submit" disabled={saving} className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50">
                  {saving ? 'Saving…' : editing ? 'Save changes' : 'Create post'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
