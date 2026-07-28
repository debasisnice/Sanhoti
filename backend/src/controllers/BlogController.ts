import express, { Response } from 'express';
import multer from 'multer';
import { existsSync, mkdirSync, renameSync, unlinkSync } from 'fs';
import { join, resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { AuthRequest } from '../middleware/auth.js';
import { BlogService } from '../services/BlogService.js';
import { safeServedFilename } from '../utils/safeFile.js';
import { renderMarkdown } from '../utils/markdown.js';
import type { Blog } from '../models/types.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const blogsDir = join(__dirname, '../../data/Blogs');
const tempDir = join(blogsDir, '.temp');

if (!existsSync(tempDir)) mkdirSync(tempDir, { recursive: true });

const upload = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, tempDir),
    filename: (_req, file, cb) =>
      cb(null, `${Date.now()}-${file.originalname.replace(/[^a-zA-Z0-9.-]/g, '_')}`),
  }),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const okExt = /\.(jpe?g|png|gif|webp)$/i.test(file.originalname);
    const okMime = /^image\/(jpeg|jpg|png|gif|webp)$/i.test(file.mimetype);
    if (okExt && okMime) cb(null, true);
    else cb(new Error('Only image files (jpg, png, gif, webp) are allowed'));
  },
});

function parseBool(raw: unknown): boolean | undefined {
  if (raw === undefined || raw === null || raw === '') return undefined;
  if (typeof raw === 'boolean') return raw;
  return String(raw).toLowerCase() === 'true';
}

/**
 * Admin → Blogs, and the public /blogs pages.
 *
 * The public endpoints return HTML already rendered by BlogService, so the
 * React page and the crawler prerender display the same markup by construction
 * rather than by two implementations agreeing.
 */
export class BlogController {
  private blogService: BlogService;

  constructor() {
    this.blogService = new BlogService();
  }

  uploadCover() {
    return upload.single('cover');
  }

  // ---------------------------------------------------------------- public

  /** Published posts for the public /blogs index. `?limit=` caps the list. */
  async getPublicBlogs(req: express.Request, res: Response): Promise<void> {
    try {
      const raw = Number(req.query.limit);
      const limit = Number.isFinite(raw) && raw > 0 ? raw : undefined;
      res.json(await this.blogService.getPublicBlogs(limit));
    } catch (error) {
      console.error('Error fetching blogs:', error);
      res.status(500).json({ error: 'Failed to fetch blogs' });
    }
  }

  /**
   * One published post by slug, with its rendered body and a few related
   * posts. Unpublished and unknown slugs both 404 — returning 200 for a draft
   * would let it into the index.
   */
  async getPublicBlogBySlug(req: express.Request, res: Response): Promise<void> {
    try {
      const blog = await this.blogService.getPublicBlogBySlug(req.params.slug);
      if (!blog) {
        res.status(404).json({ error: 'Blog post not found' });
        return;
      }
      const related = await this.blogService.getRelated(blog.blog_id, blog.tags);
      res.json({ blog, related });
    } catch (error) {
      console.error('Error fetching blog:', error);
      res.status(500).json({ error: 'Failed to fetch blog' });
    }
  }

  /** Stream a cover image. Public: it is referenced from indexable pages. */
  async serveCover(req: express.Request, res: Response): Promise<void> {
    try {
      const blog = await this.blogService.getBlogById(req.params.id);
      if (!blog?.cover_image_path) {
        res.status(404).json({ error: 'Cover image not found' });
        return;
      }
      const filePath = join(blogsDir, safeServedFilename(blog.cover_image_path));
      if (!existsSync(filePath)) {
        res.status(404).json({ error: 'Cover image not found' });
        return;
      }
      const ext = filePath.split('.').pop()?.toLowerCase();
      const contentType =
        ext === 'png' ? 'image/png'
        : ext === 'gif' ? 'image/gif'
        : ext === 'webp' ? 'image/webp'
        : 'image/jpeg';
      res.setHeader('Content-Type', contentType);
      res.setHeader('Cache-Control', 'public, max-age=31536000');
      res.sendFile(resolve(filePath));
    } catch (error) {
      console.error('Error serving blog cover:', error);
      res.status(500).json({ error: 'Failed to serve cover image' });
    }
  }

  // ----------------------------------------------------------------- admin

  async getAllBlogs(_req: AuthRequest, res: Response): Promise<void> {
    try {
      res.json(await this.blogService.getAllBlogs());
    } catch (error) {
      console.error('Error fetching blogs:', error);
      res.status(500).json({ error: 'Failed to fetch blogs' });
    }
  }

  async getBlogById(req: AuthRequest, res: Response): Promise<void> {
    try {
      const blog = await this.blogService.getBlogById(req.params.id);
      if (!blog) {
        res.status(404).json({ error: 'Blog post not found' });
        return;
      }
      res.json(blog);
    } catch (error) {
      console.error('Error fetching blog:', error);
      res.status(500).json({ error: 'Failed to fetch blog' });
    }
  }

  /** Map request body -> Blog fields, omitting anything the admin left out. */
  private buildPayload(body: Record<string, unknown>): Partial<Blog> {
    const payload: Partial<Blog> = {};
    const text: Array<keyof Blog> = [
      'slug', 'title', 'body', 'excerpt', 'author_name', 'author_contact',
      'cover_image_alt', 'tags', 'published_at', 'meta_title', 'meta_description',
    ];
    for (const key of text) {
      const raw = body[key as string];
      if (raw !== undefined) {
        // Body keeps its newlines; everything else is a single-line field.
        (payload as Record<string, unknown>)[key] =
          key === 'body' ? String(raw ?? '') : String(raw ?? '').trim();
      }
    }
    for (const flag of ['is_published', 'is_active', 'is_featured'] as const) {
      const v = parseBool(body[flag]);
      if (v !== undefined) payload[flag] = v;
    }
    return payload;
  }

  /** Move an uploaded cover out of .temp into data/Blogs, replacing any old one. */
  private commitCover(file: Express.Multer.File | undefined, previous?: string): string | undefined {
    if (!file) return undefined;
    const filename = `${Date.now()}-${file.originalname.replace(/[^a-zA-Z0-9.-]/g, '_')}`;
    renameSync(file.path, join(blogsDir, filename));
    if (previous) {
      const old = join(blogsDir, safeServedFilename(previous));
      // A failed cleanup must not fail the save — the new cover is already in place.
      try {
        if (existsSync(old)) unlinkSync(old);
      } catch (error) {
        console.error('Could not remove replaced blog cover:', error);
      }
    }
    return filename;
  }

  async createBlog(req: AuthRequest, res: Response): Promise<void> {
    try {
      const payload = this.buildPayload(req.body ?? {});
      if (!payload.title || !payload.body) {
        res.status(400).json({ error: 'Title and body are required' });
        return;
      }
      const cover = this.commitCover(req.file);
      const blog = await this.blogService.createBlog({
        ...payload,
        title: payload.title,
        body: payload.body,
        ...(cover ? { cover_image_path: cover } : {}),
      });
      res.status(201).json(blog);
    } catch (error) {
      console.error('Error creating blog:', error);
      res.status(400).json({
        error: error instanceof Error ? error.message : 'Failed to create blog post',
      });
    }
  }

  async updateBlog(req: AuthRequest, res: Response): Promise<void> {
    try {
      const existing = await this.blogService.getBlogById(req.params.id);
      if (!existing) {
        res.status(404).json({ error: 'Blog post not found' });
        return;
      }
      const payload = this.buildPayload(req.body ?? {});
      const cover = this.commitCover(req.file, existing.cover_image_path);
      const blog = await this.blogService.updateBlog(req.params.id, {
        ...payload,
        ...(cover ? { cover_image_path: cover } : {}),
      });
      res.json(blog);
    } catch (error) {
      console.error('Error updating blog:', error);
      res.status(400).json({
        error: error instanceof Error ? error.message : 'Failed to update blog post',
      });
    }
  }

  async deleteBlog(req: AuthRequest, res: Response): Promise<void> {
    try {
      const blog = await this.blogService.getBlogById(req.params.id);
      const deleted = await this.blogService.deleteBlog(req.params.id);
      if (!deleted) {
        res.status(404).json({ error: 'Blog post not found' });
        return;
      }
      if (blog?.cover_image_path) {
        try {
          const file = join(blogsDir, safeServedFilename(blog.cover_image_path));
          if (existsSync(file)) unlinkSync(file);
        } catch (error) {
          console.error('Could not remove blog cover on delete:', error);
        }
      }
      res.json({ message: 'Blog post deleted' });
    } catch (error) {
      console.error('Error deleting blog:', error);
      res.status(500).json({ error: 'Failed to delete blog post' });
    }
  }

  async publishBlog(req: AuthRequest, res: Response): Promise<void> {
    try {
      const blog = await this.blogService.publishBlog(req.params.id);
      if (!blog) {
        res.status(404).json({ error: 'Blog post not found' });
        return;
      }
      res.json(blog);
    } catch (error) {
      console.error('Error publishing blog:', error);
      res.status(400).json({
        error: error instanceof Error ? error.message : 'Failed to publish blog post',
      });
    }
  }

  async unpublishBlog(req: AuthRequest, res: Response): Promise<void> {
    try {
      const blog = await this.blogService.unpublishBlog(req.params.id);
      if (!blog) {
        res.status(404).json({ error: 'Blog post not found' });
        return;
      }
      res.json(blog);
    } catch (error) {
      console.error('Error unpublishing blog:', error);
      res.status(500).json({ error: 'Failed to unpublish blog post' });
    }
  }

  /** Admin live preview — same renderer the public page uses. */
  async previewBody(req: AuthRequest, res: Response): Promise<void> {
    try {
      const markdown = typeof req.body?.markdown === 'string' ? req.body.markdown : '';
      res.json({ html: renderMarkdown(markdown) });
    } catch (error) {
      console.error('Error previewing blog body:', error);
      res.status(500).json({ error: 'Failed to preview blog body' });
    }
  }
}
