import { DatabaseHelper } from './DatabaseHelper.js';
import { Blog } from '../models/types.js';
import { existsSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/**
 * Storage for Blog records (data/blogs.json) and their cover images
 * (data/Blogs/). Blogs are addressed publicly by slug, so lookup by slug —
 * including previously used slugs — is a first-class operation, mirroring
 * ArtistDataHelper.
 */
export class BlogDataHelper extends DatabaseHelper {
  private readonly filename = 'blogs.json';
  private readonly blogsDir = join(__dirname, '../../data/Blogs');

  constructor() {
    super();
    if (!existsSync(this.blogsDir)) {
      mkdirSync(this.blogsDir, { recursive: true });
    }
  }

  getBlogsDir(): string {
    return this.blogsDir;
  }

  async findAll(): Promise<Blog[]> {
    return this.readFile<Blog>(this.filename);
  }

  async findById(blogId: string): Promise<Blog | null> {
    const blogs = await this.findAll();
    return blogs.find(b => b.blog_id === blogId) ?? null;
  }

  /**
   * Publicly visible posts, featured first then newest-first. Sorting on
   * published_at (falling back to created_at) means correcting a typo on an old
   * post does not jump it back to the top of the index.
   */
  async findPublished(): Promise<Blog[]> {
    const blogs = await this.findAll();
    return blogs
      .filter(b => b.is_published === true && b.is_active !== false)
      .sort((a, b) => {
        if (!!b.is_featured !== !!a.is_featured) return b.is_featured ? 1 : -1;
        const at = new Date(a.published_at || a.created_at || 0).getTime();
        const bt = new Date(b.published_at || b.created_at || 0).getTime();
        return bt - at;
      });
  }

  /**
   * Resolve a public URL segment to a post: current slug, then any previous
   * slug (so a renamed post keeps its indexed URL working instead of 404-ing),
   * then the raw id as a last resort.
   */
  async findBySlug(slug: string): Promise<Blog | null> {
    const wanted = String(slug ?? '').trim().toLowerCase();
    if (!wanted) return null;
    const blogs = await this.findAll();
    return (
      blogs.find(b => (b.slug || '').toLowerCase() === wanted) ??
      blogs.find(b => (b.previous_slugs ?? []).some(s => s.toLowerCase() === wanted)) ??
      blogs.find(b => b.blog_id === slug) ??
      null
    );
  }

  async create(data: Omit<Blog, 'blog_id' | 'created_at' | 'updated_at'>): Promise<Blog> {
    const blogs = await this.findAll();
    const now = new Date().toISOString();

    let blog_id = '';
    let exists = true;
    while (exists) {
      blog_id = this.generate12DigitAlphanumericId();
      exists = blogs.some(b => b.blog_id === blog_id);
    }

    const blog: Blog = { ...data, blog_id, created_at: now, updated_at: now };
    blogs.push(blog);
    await this.writeFile(this.filename, blogs);
    return blog;
  }

  async update(
    blogId: string,
    updates: Partial<Omit<Blog, 'blog_id' | 'created_at'>>
  ): Promise<Blog | null> {
    const blogs = await this.findAll();
    const index = blogs.findIndex(b => b.blog_id === blogId);
    if (index === -1) return null;

    const previous = blogs[index];

    // A slug change would orphan the already-indexed URL, so retain the old one
    // as an alias that still resolves.
    const previous_slugs =
      updates.slug && updates.slug !== previous.slug
        ? Array.from(new Set([...(previous.previous_slugs ?? []), previous.slug].filter(Boolean)))
        : previous.previous_slugs;

    // Deactivating implies withdrawing from public view; leaving is_published
    // true on an inactive post would be a contradiction the UI could not show.
    const next: Blog = {
      ...previous,
      ...updates,
      ...(previous_slugs ? { previous_slugs } : {}),
      updated_at: new Date().toISOString(),
    };
    if (next.is_active === false) next.is_published = false;

    blogs[index] = next;
    await this.writeFile(this.filename, blogs);
    return blogs[index];
  }

  async delete(blogId: string): Promise<boolean> {
    const blogs = await this.findAll();
    const index = blogs.findIndex(b => b.blog_id === blogId);
    if (index === -1) return false;
    blogs.splice(index, 1);
    await this.writeFile(this.filename, blogs);
    return true;
  }

  /** True when any other post already owns this slug (uniqueness check). */
  async slugTaken(slug: string, exceptBlogId?: string): Promise<boolean> {
    const wanted = String(slug ?? '').trim().toLowerCase();
    if (!wanted) return false;
    const blogs = await this.findAll();
    return blogs.some(
      b =>
        b.blog_id !== exceptBlogId &&
        ((b.slug || '').toLowerCase() === wanted ||
          (b.previous_slugs ?? []).some(s => s.toLowerCase() === wanted))
    );
  }
}
