import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, BookOpen, Calendar, Clock, Phone, User } from 'lucide-react';
import Seo from '../components/Seo';
import { blogsAPI } from '../services/api';
import { getSiteOrigin } from '../utils/eventShareUrl';
import type { PublicBlog } from '../types';

function fmtDate(iso?: string): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '';
  return d.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    timeZone: 'America/Los_Angeles',
  });
}

export default function BlogDetail() {
  const { slug } = useParams<{ slug: string }>();
  const [blog, setBlog] = useState<PublicBlog | null>(null);
  const [related, setRelated] = useState<PublicBlog[]>([]);
  const [status, setStatus] = useState<'loading' | 'ready' | 'missing'>('loading');

  useEffect(() => {
    let cancelled = false;
    if (!slug) {
      setStatus('missing');
      return;
    }
    setStatus('loading');
    blogsAPI
      .getPublicBySlug(slug)
      .then(data => {
        if (cancelled) return;
        setBlog(data.blog);
        setRelated(data.related ?? []);
        setStatus('ready');
      })
      .catch(() => {
        if (cancelled) return;
        setStatus('missing');
      });
    return () => {
      cancelled = true;
    };
  }, [slug]);

  const jsonLd = useMemo(() => {
    if (!blog) return undefined;
    const origin = getSiteOrigin();
    const url = `${origin}${blog.path}`;
    return {
      '@context': 'https://schema.org',
      '@type': 'BlogPosting',
      headline: blog.title,
      description: blog.meta_description || blog.excerpt,
      datePublished: blog.published_at,
      dateModified: blog.updated_at,
      url,
      mainEntityOfPage: url,
      ...(blog.cover_image_url
        ? { image: blogsAPI.getCoverUrl(blog.blog_id) }
        : {}),
      author: blog.author_name
        ? { '@type': 'Person', name: blog.author_name }
        : { '@type': 'Organization', name: 'Sanhoti Bengali Association of Orange County' },
      publisher: {
        '@type': 'Organization',
        name: 'Sanhoti Bengali Association of Orange County',
        logo: { '@type': 'ImageObject', url: `${origin}/images/logo.png` },
      },
      ...(blog.tags.length ? { keywords: blog.tags.join(', ') } : {}),
    };
  }, [blog]);

  if (status === 'loading') {
    return (
      <div className="min-h-[50vh] flex items-center justify-center">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary-600" />
      </div>
    );
  }

  if (status === 'missing' || !blog) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-20 text-center">
        <Seo
          title="Blog post not found | Sanhoti"
          description="This blog post could not be found."
          path={`/blogs/${slug ?? ''}`}
          noindex
        />
        <BookOpen className="w-12 h-12 text-gray-400 mx-auto mb-4" />
        <h1 className="text-2xl font-bold text-gray-900 mb-2">Post not found</h1>
        <p className="text-gray-600 mb-6">This article may have been removed or is not yet published.</p>
        <Link to="/blogs" className="text-primary-600 hover:underline inline-flex items-center gap-1">
          <ArrowLeft className="w-4 h-4" /> Back to all posts
        </Link>
      </div>
    );
  }

  const pageTitle =
    blog.meta_title ||
    `${blog.title} | Sanhoti Blog — Orange County Bengali Community`;

  return (
    <article className="pb-24">
      <Seo
        title={pageTitle}
        description={blog.meta_description || blog.excerpt}
        path={blog.path}
        jsonLd={jsonLd}
        ogImage={blog.cover_image_url ? blogsAPI.getCoverUrl(blog.blog_id) : undefined}
      />

      {blog.cover_image_url && (
        <div className="w-full max-h-[420px] overflow-hidden bg-gray-100">
          <img
            src={blogsAPI.getCoverUrl(blog.blog_id)}
            alt={blog.cover_image_alt}
            className="w-full h-full object-cover max-h-[420px]"
          />
        </div>
      )}

      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
        <Link
          to="/blogs"
          className="inline-flex items-center gap-1 text-primary-600 hover:text-primary-800 text-sm font-medium mb-6"
        >
          <ArrowLeft className="w-4 h-4" /> All posts
        </Link>

        <header className="mb-8 border-b border-gray-200 pb-6">
          <div className="flex flex-wrap items-center gap-3 text-sm text-gray-500 mb-3">
            <span className="inline-flex items-center gap-1">
              <Calendar className="w-4 h-4" />
              {fmtDate(blog.published_at)}
            </span>
            <span className="inline-flex items-center gap-1">
              <Clock className="w-4 h-4" />
              {blog.reading_minutes} min read
            </span>
          </div>
          <h1 className="text-3xl sm:text-4xl font-bold text-gray-900 leading-tight mb-4">
            {blog.title}
          </h1>
          {(blog.author_name || blog.author_contact) && (
            <div className="flex flex-wrap gap-4 text-sm text-gray-600">
              {blog.author_name && (
                <span className="inline-flex items-center gap-1.5">
                  <User className="w-4 h-4 text-gray-400" />
                  {blog.author_name}
                </span>
              )}
              {blog.author_contact && (
                <span className="inline-flex items-center gap-1.5">
                  <Phone className="w-4 h-4 text-gray-400" />
                  {blog.author_contact}
                </span>
              )}
            </div>
          )}
          {blog.tags.length > 0 && (
            <div className="flex flex-wrap gap-2 mt-4">
              {blog.tags.map(tag => (
                <span
                  key={tag}
                  className="px-2.5 py-0.5 rounded-full bg-primary-50 text-primary-700 text-xs font-medium"
                >
                  {tag}
                </span>
              ))}
            </div>
          )}
        </header>

        {blog.body_html && (
          <div
            className="prose prose-lg max-w-none prose-headings:text-gray-900 prose-a:text-primary-600"
            dangerouslySetInnerHTML={{ __html: blog.body_html }}
          />
        )}

        {related.length > 0 && (
          <section className="mt-16 pt-8 border-t border-gray-200">
            <h2 className="text-xl font-bold text-gray-900 mb-6">Related reading</h2>
            <ul className="space-y-4">
              {related.map(r => (
                <li key={r.blog_id}>
                  <Link to={r.path} className="group block">
                    <span className="font-semibold text-gray-900 group-hover:text-primary-700">
                      {r.title}
                    </span>
                    <p className="text-sm text-gray-600 mt-0.5 line-clamp-2">{r.excerpt}</p>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        )}
      </div>
    </article>
  );
}
