import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { UtensilsCrossed, Leaf, Fish, Candy, Info } from 'lucide-react';
import Seo from '../components/Seo';
import PageHero from '../components/PageHero';
import { getSiteOrigin } from '../utils/eventShareUrl';
import { menusAPI } from '../services/api';
import type { PublicMenu } from '../services/api';
import MenuDisplay, { buildMenuJsonLd } from '../components/MenuDisplay';

const SECTIONS = [
  {
    icon: Leaf,
    title: 'Bhog — the traditional offering',
    items: ['Khichuri', 'Labra', 'Beguni', 'Tomato chatni', 'Payesh'],
    text: 'The vegetarian meal offered during puja and then served to everyone. Cooked without onion or garlic, in keeping with tradition.',
  },
  {
    icon: Fish,
    title: 'Fish & meat classics',
    items: ['Maacher jhol', 'Fish fry', 'Kosha mangsho', 'Chicken curry'],
    text: 'Bengali non-vegetarian favourites served on non-bhog days and at evening meals. Always labelled separately.',
  },
  {
    icon: UtensilsCrossed,
    title: 'Street-food favourites',
    items: ['Egg roll', 'Ghugni', 'Phuchka', 'Chops & cutlets'],
    text: 'The snacks that define an evening at a Kolkata puja pandal, recreated in Orange County.',
  },
  {
    icon: Candy,
    title: 'Sweets',
    items: ['Rosogolla', 'Mishti doi', 'Sandesh', 'Payesh'],
    text: 'No Bengali celebration ends without mishti. Made fresh or sourced from trusted local makers.',
  },
];

const FAQ = [
  {
    q: 'Where can I find Bengali food in Orange County?',
    a: 'Sanhoti serves authentic home-style Bengali food at its cultural events across Orange County, California — including bhog at Durga Puja in Costa Mesa, and full Bengali menus at Poila Boishakh and Saraswati Puja. Events are open to everyone.',
  },
  {
    q: 'What is bhog?',
    a: 'Bhog is the traditional vegetarian meal offered to the deity during puja and then served to attendees. A Bengali bhog typically includes khichuri, labra, beguni, chatni, and payesh, cooked without onion or garlic.',
  },
  {
    q: 'Is the food at Sanhoti events vegetarian?',
    a: 'Bhog is fully vegetarian and prepared without onion or garlic. Non-vegetarian Bengali dishes such as fish curry and kosha mangsho are served separately at some events and are clearly labelled.',
  },
  {
    q: 'Is food included with a Durga Puja ticket?',
    a: 'Bhog is included with most Sanhoti Durga Puja passes. Check the Durga Puja page for the current year’s ticket tiers and exactly which meals each pass includes.',
  },
];

/**
 * `/bengali-food` — the food offering is a real differentiator with its own
 * search demand ("Bengali food Orange County", "bhog near me") and previously
 * had no page of its own. Emits Menu schema so the dishes are machine-readable.
 */
export default function BengaliFood() {
  // Every menu across the site, from /api/menus/public. That endpoint and the
  // `/seo` prerender both read one MenuService, so this page and the crawler
  // version can never list different food.
  const [menus, setMenus] = useState<PublicMenu[]>([]);
  const [totalMenus, setTotalMenus] = useState(0);

  useEffect(() => {
    let cancelled = false;
    menusAPI
      .getPublic()
      .then(({ menus: list, total }) => {
        if (cancelled) return;
        setMenus(list);
        setTotalMenus(total);
      })
      .catch(() => {
        // The evergreen sections below stand on their own.
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const jsonLd = useMemo(() => {
    const origin = getSiteOrigin();
    const faqNode = {
      '@context': 'https://schema.org',
      '@type': 'FAQPage',
      mainEntity: FAQ.map(f => ({
        '@type': 'Question',
        name: f.q,
        acceptedAnswer: { '@type': 'Answer', text: f.a },
      })),
    };

    // One Menu node per event. When nothing is published yet, fall back to the
    // evergreen sections so the page still carries structured data.
    const menuNodes = menus.length
      ? menus
          .map(m => buildMenuJsonLd(m.menu, { name: m.title, url: `${origin}${m.href}` }))
          .filter((n): n is Record<string, unknown> => !!n)
      : [
          {
            '@context': 'https://schema.org',
            '@type': 'Menu',
            name: 'Bengali food served at Sanhoti events in Orange County, California',
            url: `${origin}/bengali-food`,
            inLanguage: 'en-US',
            hasMenuSection: SECTIONS.map(sec => ({
              '@type': 'MenuSection',
              name: sec.title,
              description: sec.text,
              hasMenuItem: sec.items.map(item => ({ '@type': 'MenuItem', name: item })),
            })),
          },
        ];

    return [faqNode, ...menuNodes];
  }, [menus]);

  return (
    <div className="pb-32">
      <Seo
        title="Bengali Food in Orange County, CA | Bhog & Festival Meals — Sanhoti"
        description="Authentic Bengali food in Orange County, California — Durga Puja bhog (khichuri, labra, payesh), fish and meat classics, street food, and sweets served at Sanhoti cultural events."
        path="/bengali-food"
        jsonLd={jsonLd}
      />

      <PageHero
        icon={UtensilsCrossed}
        title="Bengali Food in Orange County, California — Sanhoti"
        subtitle="Authentic home-style Bengali cooking at Sanhoti events — Durga Puja bhog, Poila Boishakh feasts, and festival meals prepared for the community across Southern California."
      />

      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 pt-12">
        {/* Real menus from every event, newest first with Durga Puja pinned on
            top. Shown above the evergreen sections because specific current
            dishes are what visitors and search engines actually want. */}
        {menus.length > 0 && (
          <div className="mb-14">
            <h2 className="text-2xl font-bold text-gray-900 mb-6">Menus from our events</h2>
            <div className="space-y-12">
              {menus.map(m => (
                <div key={m.id}>
                  <MenuDisplay
                    menu={m.menu}
                    heading={
                      m.source === 'durga-puja' ? `This year's menu — ${m.title}` : m.title
                    }
                  />
                  <Link
                    to={m.href}
                    className="inline-block mt-4 font-medium text-primary-700 hover:underline"
                  >
                    See {m.title} →
                  </Link>
                </div>
              ))}
            </div>
            {totalMenus > menus.length && (
              <p className="mt-8 text-gray-600">
                Menus from {totalMenus - menus.length} more past event
                {totalMenus - menus.length === 1 ? '' : 's'} are on their own pages —{' '}
                <Link to="/events" className="text-primary-700 font-medium hover:underline">
                  browse all Sanhoti events
                </Link>
                .
              </p>
            )}
          </div>
        )}

        <section className="mb-14">
          <h2 className="text-2xl font-bold text-gray-900 mb-6">
            {menus.length > 0 ? 'What we serve year-round' : 'What we serve'}
          </h2>
          <div className="grid gap-6 sm:grid-cols-2">
            {SECTIONS.map(s => {
              const Icon = s.icon;
              return (
                <article key={s.title} className="bg-white rounded-2xl shadow-lg p-6">
                  <Icon className="w-8 h-8 text-primary-600 mb-3" />
                  <h3 className="font-bold text-gray-900 mb-2">{s.title}</h3>
                  <p className="text-gray-600 text-sm mb-3">{s.text}</p>
                  <ul className="flex flex-wrap gap-2">
                    {s.items.map(item => (
                      <li
                        key={item}
                        className="text-xs font-medium text-primary-700 bg-primary-50 px-3 py-1 rounded-full"
                      >
                        {item}
                      </li>
                    ))}
                  </ul>
                </article>
              );
            })}
          </div>
        </section>

        <section className="mb-14 bg-white rounded-2xl shadow-lg p-8">
          <h2 className="text-2xl font-bold text-gray-900 mb-4">Bhog at Durga Puja</h2>
          <p className="text-gray-600 mb-3">
            During our three-day Durgotsav in Costa Mesa, bhog is served after the morning puja and
            pushpanjali on each day of the celebration. Bhog is included with most Durga Puja passes.
          </p>
          <Link to="/durga-puja" className="font-medium text-primary-700 hover:underline">
            See this year's Durga Puja schedule, menu, and tickets →
          </Link>
        </section>

        <section className="mb-14 bg-primary-50 rounded-2xl p-8">
          <div className="flex gap-4">
            <Info className="w-6 h-6 text-primary-700 shrink-0 mt-1" />
            <div>
              <h2 className="text-xl font-bold text-gray-900 mb-2">Dietary information</h2>
              <p className="text-gray-700 mb-2">
                Bhog is fully vegetarian and prepared without onion or garlic in keeping with
                tradition. Non-vegetarian dishes are served separately and clearly labelled.
              </p>
              <p className="text-gray-700">
                If you have an allergy or a specific dietary requirement, please{' '}
                <Link to="/contact" className="text-primary-700 font-medium hover:underline">
                  contact us
                </Link>{' '}
                ahead of the event and we will do our best to accommodate you.
              </p>
            </div>
          </div>
        </section>

        <section className="mb-14 bg-white rounded-2xl shadow-lg p-8">
          <h2 className="text-2xl font-bold text-gray-900 mb-4">Where to find us</h2>
          <p className="text-gray-600">
            Sanhoti food service happens at our events in Orange County — most often in Costa Mesa,
            minutes from Irvine, Tustin, Santa Ana, and Newport Beach. We are not a restaurant; meals
            are served at our festivals and cultural programs, which are open to everyone.
          </p>
        </section>

        <section className="mb-14">
          <h2 className="text-2xl font-bold text-gray-900 mb-6 text-center">
            Frequently asked questions
          </h2>
          <div className="space-y-4">
            {FAQ.map(item => (
              <div key={item.q} className="bg-white rounded-xl shadow p-6">
                <h3 className="font-semibold text-gray-900 mb-2">{item.q}</h3>
                <p className="text-gray-600">{item.a}</p>
              </div>
            ))}
          </div>
        </section>

        <div className="bg-white rounded-2xl shadow-lg p-8 text-center">
          <div className="flex flex-wrap justify-center gap-4 text-primary-700 font-medium">
            <Link to="/durga-puja" className="hover:underline">
              Durga Puja in Orange County
            </Link>
            <Link to="/festivals" className="hover:underline">
              Bengali Festivals
            </Link>
            <Link to="/events" className="hover:underline">
              Upcoming Events
            </Link>
            <Link to="/contact" className="hover:underline">
              Contact Us
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
