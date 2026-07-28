import { BlogDataHelper } from '../data/BlogDataHelper.js';
import { Blog } from '../models/types.js';
import { readingTimeMinutes, renderMarkdown, stripMarkdown } from '../utils/markdown.js';

/** URL-safe slug from a title: "Durga Puja 2026 Recap" -> "durga-puja-2026-recap". */
export function slugifyBlogTitle(title: string | undefined | null): string {
  if (!title) return '';
  return String(title)
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9\s-]/g, ' ')
    .trim()
    .replace(/[\s-]+/g, '-')
    .toLowerCase()
    .slice(0, 80)
    .replace(/^-+|-+$/g, '');
}

/** Length at which an auto-generated excerpt is cut. Fits a search snippet. */
const EXCERPT_CHARS = 180;

/**
 * A blog as the public API returns it.
 *
 * `body_html` is rendered here rather than in the client so the React page and
 * the crawler prerender consume one identical string — the same single-source
 * rule that MenuService follows for the food page.
 */
export interface PublicBlog {
  blog_id: string;
  slug: string;
  title: string;
  /** Rendered HTML. Absent on list responses, which only need the excerpt. */
  body_html?: string;
  excerpt: string;
  author_name?: string;
  author_contact?: string;
  cover_image_url?: string;
  cover_image_alt: string;
  tags: string[];
  published_at: string;
  updated_at: string;
  reading_minutes: number;
  meta_title?: string;
  meta_description?: string;
  is_featured: boolean;
  /** Canonical site-relative path, so callers never rebuild the URL by hand. */
  path: string;
}

export class BlogService {
  private blogDataHelper: BlogDataHelper;

  constructor() {
    this.blogDataHelper = new BlogDataHelper();
  }

  // ------------------------------------------------------------------ admin

  async getAllBlogs(): Promise<Blog[]> {
    const blogs = await this.blogDataHelper.findAll();
    return blogs.sort((a, b) => {
      const at = new Date(a.published_at || a.created_at || 0).getTime();
      const bt = new Date(b.published_at || b.created_at || 0).getTime();
      return bt - at;
    });
  }

  async getBlogById(blogId: string): Promise<Blog | null> {
    return this.blogDataHelper.findById(blogId);
  }

  /**
   * Resolve the slug the admin asked for, or derive one from the title, and
   * make it unique by appending -2, -3, … A slug is a permanent public URL, so
   * silently overwriting another post's is never acceptable.
   */
  private async resolveSlug(
    requested: string | undefined,
    title: string,
    exceptBlogId?: string
  ): Promise<string> {
    const base = slugifyBlogTitle(requested || title) || 'post';
    let candidate = base;
    let n = 2;
    while (await this.blogDataHelper.slugTaken(candidate, exceptBlogId)) {
      candidate = `${base}-${n}`;
      n += 1;
    }
    return candidate;
  }

  async createBlog(
    data: Partial<Blog> & { title: string; body: string }
  ): Promise<Blog> {
    const title = String(data.title ?? '').trim();
    if (!title) throw new Error('Blog title is required');
    if (!String(data.body ?? '').trim()) throw new Error('Blog body is required');

    const slug = await this.resolveSlug(data.slug, title);
    const isPublished = data.is_published === true;

    return this.blogDataHelper.create({
      slug,
      title,
      body: String(data.body),
      excerpt: data.excerpt?.trim() || undefined,
      author_name: data.author_name?.trim() || undefined,
      author_contact: data.author_contact?.trim() || undefined,
      cover_image_path: data.cover_image_path,
      cover_image_alt: data.cover_image_alt?.trim() || undefined,
      tags: data.tags?.trim() || undefined,
      // Stamp the publication date only when it actually goes public, so a
      // draft written weeks earlier does not publish with a stale date.
      published_at: data.published_at || (isPublished ? new Date().toISOString() : undefined),
      meta_title: data.meta_title?.trim() || undefined,
      meta_description: data.meta_description?.trim() || undefined,
      is_published: isPublished,
      is_active: data.is_active !== false,
      is_featured: data.is_featured === true,
    });
  }

  async updateBlog(blogId: string, updates: Partial<Blog>): Promise<Blog | null> {
    const existing = await this.blogDataHelper.findById(blogId);
    if (!existing) return null;

    if (updates.title !== undefined && !String(updates.title).trim()) {
      throw new Error('Blog title cannot be empty');
    }
    if (updates.body !== undefined && !String(updates.body).trim()) {
      throw new Error('Blog body cannot be empty');
    }

    const patch: Partial<Blog> = { ...updates };

    if (updates.slug !== undefined) {
      const wanted = slugifyBlogTitle(updates.slug);
      patch.slug =
        wanted && wanted !== existing.slug
          ? await this.resolveSlug(wanted, updates.title ?? existing.title, blogId)
          : existing.slug;
    }

    // First transition to published sets the date; later edits keep it.
    if (updates.is_published === true && !existing.published_at && !updates.published_at) {
      patch.published_at = new Date().toISOString();
    }

    return this.blogDataHelper.update(blogId, patch);
  }

  async deleteBlog(blogId: string): Promise<boolean> {
    return this.blogDataHelper.delete(blogId);
  }

  async publishBlog(blogId: string): Promise<Blog | null> {
    const blog = await this.blogDataHelper.findById(blogId);
    if (!blog) return null;
    if (blog.is_active === false) {
      throw new Error('Cannot publish an archived post. Restore it first.');
    }
    return this.updateBlog(blogId, { is_published: true });
  }

  async unpublishBlog(blogId: string): Promise<Blog | null> {
    return this.blogDataHelper.update(blogId, { is_published: false });
  }

  // ----------------------------------------------------------------- public

  /** Shape a stored record for public consumption. */
  toPublic(blog: Blog, includeBody: boolean): PublicBlog {
    return {
      blog_id: blog.blog_id,
      slug: blog.slug,
      title: blog.title,
      ...(includeBody ? { body_html: renderMarkdown(blog.body) } : {}),
      excerpt: blog.excerpt?.trim() || stripMarkdown(blog.body, EXCERPT_CHARS),
      author_name: blog.author_name || undefined,
      author_contact: blog.author_contact || undefined,
      cover_image_url: blog.cover_image_path
        ? `/api/blogs/${blog.blog_id}/cover`
        : undefined,
      // Falling back to the title keeps the image described rather than empty;
      // an unlabelled cover is invisible to image search and to screen readers.
      cover_image_alt: blog.cover_image_alt?.trim() || blog.title,
      tags: (blog.tags ?? '')
        .split(',')
        .map(t => t.trim())
        .filter(Boolean),
      published_at: blog.published_at || blog.created_at,
      updated_at: blog.updated_at,
      reading_minutes: readingTimeMinutes(blog.body),
      meta_title: blog.meta_title || undefined,
      meta_description: blog.meta_description || undefined,
      is_featured: blog.is_featured === true,
      path: `/blogs/${blog.slug}`,
    };
  }

  /**
   * Published posts for the public index. Bodies are omitted — the index shows
   * excerpts, and shipping every full article would bloat the payload for no
   * gain.
   */
  async getPublicBlogs(limit?: number): Promise<PublicBlog[]> {
    const blogs = await this.blogDataHelper.findPublished();
    const capped = typeof limit === 'number' && limit > 0 ? blogs.slice(0, limit) : blogs;
    return capped.map(b => this.toPublic(b, false));
  }

  /**
   * A single published post by slug, with its rendered body.
   *
   * Returns null for unknown *and* unpublished slugs so the caller emits a real
   * 404. Serving 200 for a draft would put it in the index.
   */
  async getPublicBlogBySlug(slug: string): Promise<PublicBlog | null> {
    const blog = await this.blogDataHelper.findBySlug(slug);
    if (!blog || blog.is_published !== true || blog.is_active === false) return null;
    return this.toPublic(blog, true);
  }

  /** The stored record behind a public slug — for redirect and canonical checks. */
  async getRawPublishedBySlug(slug: string): Promise<Blog | null> {
    const blog = await this.blogDataHelper.findBySlug(slug);
    if (!blog || blog.is_published !== true || blog.is_active === false) return null;
    return blog;
  }

  /** Posts that mention a tag, newest first — used for "related reading". */
  async getRelated(blogId: string, tags: string[], limit = 3): Promise<PublicBlog[]> {
    if (!tags.length) {
      const all = await this.blogDataHelper.findPublished();
      return all
        .filter(b => b.blog_id !== blogId)
        .slice(0, limit)
        .map(b => this.toPublic(b, false));
    }
    const wanted = new Set(tags.map(t => t.toLowerCase()));
    const all = await this.blogDataHelper.findPublished();
    const scored = all
      .filter(b => b.blog_id !== blogId)
      .map(b => {
        const own = (b.tags ?? '').split(',').map(t => t.trim().toLowerCase()).filter(Boolean);
        return { blog: b, score: own.filter(t => wanted.has(t)).length };
      })
      .sort((a, b) => b.score - a.score);
    return scored.slice(0, limit).map(s => this.toPublic(s.blog, false));
  }
}
