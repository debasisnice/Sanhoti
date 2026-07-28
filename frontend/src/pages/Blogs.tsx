import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { BookOpen, Calendar, Clock, ArrowRight } from 'lucide-react';
import Seo from '../components/Seo';
import PageHero from '../components/PageHero';
import PageContent from '../components/PageContent';
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

/**
 * `/blogs` — community stories, recaps, and cultural articles in Sanhoti theme.
 */
export default function Blogs() {
  const [posts, setPosts] = useState<PublicBlog[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let cancelled = false;
    blogsAPI
      .getPublic()
      .then(list => {
        if (cancelled) return;
        setPosts(list);
        setLoaded(true);
      })
      .catch(() => {
        if (cancelled) return;
        setPosts([]);
        setLoaded(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const jsonLd = useMemo(() => {
    if (posts.length === 0) return undefined;
    const origin = getSiteOrigin();
    return {
      '@context': 'https://schema.org',
      '@type': 'ItemList',
      name: 'Sanhoti community blog',
      numberOfItems: posts.length,
      itemListElement: posts.map((p, i) => ({
        '@type': 'ListItem',
        position: i + 1,
        url: `${origin}${p.path}`,
        item: {
          '@type': 'BlogPosting',
          headline: p.title,
          url: `${origin}${p.path}`,
          datePublished: p.published_at,
          dateModified: p.updated_at,
        },
      })),
    };
  }, [posts]);

  return (
    <div className="pb-32">
      <Seo
        title="Blog | Sanhoti Bengali Association of Orange County, CA"
        description="Stories, event recaps, and cultural articles from Sanhoti — the Bengali community association serving Orange County and Southern California."
        path="/blogs"
        jsonLd={jsonLd}
      />

      <PageHero
        icon={BookOpen}
        title="Sanhoti Blog — Orange County, California"
        subtitle="Event recaps, cultural reflections, charity highlights, and news from Sanhoti Bengali Association across Orange County and Southern California."
      />

      <PageContent as="section">
        {loaded && posts.length === 0 && (
          <p className="text-center text-gray-600">No blog posts published yet. Check back soon.</p>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {posts.map(post => (
            <article
              key={post.blog_id}
              className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden hover:shadow-md transition-shadow flex flex-col"
            >
              {post.cover_image_url ? (
                <Link to={post.path} className="block aspect-[16/10] overflow-hidden bg-gray-100">
                  <img
                    src={blogsAPI.getCoverUrl(post.blog_id)}
                    alt={post.cover_image_alt}
                    className="w-full h-full object-cover hover:scale-105 transition-transform duration-300"
                    loading="lazy"
                    onError={(e) => {
                      e.currentTarget.style.display = 'none';
                    }}
                  />
                </Link>
              ) : (
                <Link
                  to={post.path}
                  className="block aspect-[16/10] bg-gradient-to-br from-primary-100 to-amber-50 flex items-center justify-center"
                >
                  <BookOpen className="w-12 h-12 text-primary-400" />
                </Link>
              )}
              <div className="p-5 flex flex-col flex-1">
                <div className="flex flex-wrap items-center gap-3 text-xs text-gray-500 mb-2">
                  <span className="inline-flex items-center gap-1">
                    <Calendar className="w-3.5 h-3.5" />
                    {fmtDate(post.published_at)}
                  </span>
                  <span className="inline-flex items-center gap-1">
                    <Clock className="w-3.5 h-3.5" />
                    {post.reading_minutes} min read
                  </span>
                  {post.is_featured && (
                    <span className="px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 font-medium">
                      Featured
                    </span>
                  )}
                </div>
                <h2 className="text-xl font-bold text-gray-900 mb-2 leading-snug">
                  <Link to={post.path} className="hover:text-primary-700 transition-colors">
                    {post.title}
                  </Link>
                </h2>
                <p className="text-gray-600 text-sm leading-relaxed flex-1 mb-4">{post.excerpt}</p>
                {post.author_name && (
                  <p className="text-xs text-gray-500 mb-3">By {post.author_name}</p>
                )}
                <Link
                  to={post.path}
                  className="inline-flex items-center gap-1 text-primary-600 font-medium text-sm hover:text-primary-800"
                >
                  Read more <ArrowRight className="w-4 h-4" />
                </Link>
              </div>
            </article>
          ))}
        </div>
      </PageContent>
    </div>
  );
}
