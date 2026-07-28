import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { Heart, HeartHandshake, Building2, Users, Receipt } from 'lucide-react';
import Seo from '../components/Seo';
import PageHero from '../components/PageHero';
import PageContent from '../components/PageContent';
import { getSiteOrigin } from '../utils/eventShareUrl';

const CAUSES = [
  {
    tag: 'Hunger Relief',
    name: 'Walk with Second Harvest',
    meta: 'Second Harvest Food Bank of Orange County · Tanaka Farms, Irvine',
    text: "Sanhoti fields a team for Second Harvest's annual community fundraising walk, supporting food-insecurity relief for Orange County families.",
  },
  {
    tag: 'Domestic Violence Support',
    name: "Charity events for Laura's House",
    meta: "Laura's House · Orange County",
    text: "Sanhoti-organized charity events supporting Laura's House, an Orange County non-profit providing shelter, therapy, legal advocacy, and prevention education for survivors of domestic violence.",
  },
  {
    tag: 'Community & Culture',
    name: 'Free and subsidised cultural programming',
    meta: 'Orange County & Southern California',
    text: 'Keeping festivals, youth language classes, and community gatherings affordable so cost is never a barrier to participation.',
  },
];

const WAYS = [
  {
    icon: Heart,
    title: 'Make a tax-deductible donation',
    text: 'One-time or recurring. Every dollar funds cultural programming and charitable giving in Orange County.',
    to: '/donate',
    cta: 'Donate',
  },
  {
    icon: Building2,
    title: 'Sponsor an event',
    text: 'Put your business in front of Bengali and Indian families across Southern California while supporting the community.',
    to: '/become-our-sponsor',
    cta: 'Sponsorship options',
  },
  {
    icon: Receipt,
    title: 'Corporate partnership & CSR',
    text: 'Multi-year partnerships, employer matching gifts, in-kind support, and employee volunteer days.',
    to: '/corporate-partnerships',
    cta: 'Corporate partnerships',
  },
  {
    icon: Users,
    title: 'Volunteer with us',
    text: 'Join a charity drive or help run an event. No experience needed — just time and enthusiasm.',
    to: '/contact',
    cta: 'Get in touch',
  },
];

const FAQ = [
  {
    q: 'Is Sanhoti a registered charitable organization in Orange County?',
    a: 'Yes. Sanhoti Bengali Association of Orange County is a registered 501(c)(3) non-profit charitable organization, EIN 39-2903777, based in Rancho Santa Margarita, California. Donations are tax-deductible to the extent allowed by law.',
  },
  {
    q: 'What causes does Sanhoti support?',
    a: 'Sanhoti supports hunger relief through Second Harvest Food Bank of Orange County, domestic violence survivor services through Laura’s House, and community welfare and cultural education programs for families across Orange County and Southern California.',
  },
  {
    q: 'Are donations to Sanhoti tax-deductible?',
    a: 'Yes. Sanhoti is a 501(c)(3) non-profit (EIN 39-2903777), so donations are tax-deductible to the extent allowed by law. Many employers also match employee donations — check with your HR or CSR team.',
  },
  {
    q: 'How can my company partner with Sanhoti on charitable work?',
    a: 'Companies can co-sponsor charity drives and volunteer days, run matching gift programs, or become an event sponsor. See our corporate partnerships page or contact us at info@sanhoti.org for our EIN and tax-exemption letter.',
  },
];

/**
 * `/charity` — targets "charitable organization in Orange County", a stated
 * priority query the site previously had no dedicated page for. Carries the
 * 501(c)(3)/EIN details Google and donors both look for.
 */
export default function Charity() {
  const jsonLd = useMemo(() => {
    const origin = getSiteOrigin();
    return [
      {
        '@context': 'https://schema.org',
        '@type': 'FAQPage',
        mainEntity: FAQ.map(f => ({
          '@type': 'Question',
          name: f.q,
          acceptedAnswer: { '@type': 'Answer', text: f.a },
        })),
      },
      {
        '@context': 'https://schema.org',
        '@type': 'NonprofitOrganization',
        '@id': `${origin}/#organization`,
        name: 'Sanhoti Bengali Association of Orange County',
        legalName: 'Sanhoti Inc',
        url: origin,
        taxID: '39-2903777',
        nonprofitStatus: 'Nonprofit501c3',
        areaServed: ['Orange County, California', 'Southern California'],
        potentialAction: {
          '@type': 'DonateAction',
          name: 'Donate to Sanhoti',
          target: {
            '@type': 'EntryPoint',
            urlTemplate: `${origin}/donate`,
            actionPlatform: 'https://schema.org/DesktopWebPlatform',
          },
          recipient: { '@id': `${origin}/#organization` },
        },
      },
    ];
  }, []);

  return (
    <div className="pb-32">
      <Seo
        title="Charity & Community Service | Sanhoti — 501(c)(3) Non-Profit in Orange County, CA"
        description="Sanhoti is a 501(c)(3) charitable organization in Orange County, CA (EIN 39-2903777) supporting hunger relief, domestic violence services, and community programs. Donations are tax-deductible."
        path="/charity"
        jsonLd={jsonLd}
      />

      <PageHero
        icon={HeartHandshake}
        title="Charity & Community Service — Sanhoti, Orange County"
        subtitle="Sanhoti is a 501(c)(3) non-profit in Rancho Santa Margarita supporting hunger relief, domestic violence services, and community welfare across Orange County, California."
      />

      <PageContent>
        <section className="mb-14">
          <h2 className="text-2xl font-bold text-gray-900 mb-6">Our charitable work</h2>
          <div className="grid gap-6 md:grid-cols-3">
            {CAUSES.map(c => (
              <article key={c.name} className="bg-white rounded-2xl shadow-lg p-6">
                <span className="inline-block text-xs font-semibold uppercase tracking-wide text-primary-700 bg-primary-50 px-3 py-1 rounded-full mb-3">
                  {c.tag}
                </span>
                <h3 className="font-bold text-gray-900 mb-1">{c.name}</h3>
                <p className="text-sm text-gray-500 mb-3">{c.meta}</p>
                <p className="text-gray-600 text-sm">{c.text}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="mb-14 bg-white rounded-2xl shadow-lg p-8">
          <h2 className="text-2xl font-bold text-gray-900 mb-4">How your donation is used</h2>
          <p className="text-gray-600 mb-3">
            Contributions to Sanhoti fund charity drives and partner non-profits in Orange County,
            free and low-cost community cultural programming, youth and language education for
            Bengali-American children, and scholarships and relief efforts.
          </p>
          <p className="text-gray-600">
            Sanhoti is entirely volunteer-run, so administrative overhead stays low and the large
            majority of every contribution reaches programming and charitable giving.
          </p>
        </section>

        <section className="mb-14">
          <h2 className="text-2xl font-bold text-gray-900 mb-6">Ways to support</h2>
          <div className="grid gap-6 sm:grid-cols-2">
            {WAYS.map(w => {
              const Icon = w.icon;
              return (
                <div key={w.title} className="bg-white rounded-2xl shadow-lg p-6 flex flex-col">
                  <Icon className="w-8 h-8 text-primary-600 mb-3" />
                  <h3 className="font-bold text-gray-900 mb-2">{w.title}</h3>
                  <p className="text-gray-600 text-sm mb-4 flex-1">{w.text}</p>
                  <Link
                    to={w.to}
                    className="inline-flex items-center font-medium text-primary-700 hover:underline mt-auto"
                  >
                    {w.cta} →
                  </Link>
                </div>
              );
            })}
          </div>
        </section>

        <section className="mb-14 bg-primary-50 rounded-2xl p-8">
          <h2 className="text-2xl font-bold text-gray-900 mb-4">Charity registration details</h2>
          <ul className="text-gray-700 space-y-1">
            <li>
              <strong>Legal name:</strong> Sanhoti Inc
            </li>
            <li>
              <strong>Status:</strong> Registered 501(c)(3) non-profit
            </li>
            <li>
              <strong>EIN:</strong> 39-2903777
            </li>
            <li>
              <strong>Address:</strong> 23 Calle Alamitos, Rancho Santa Margarita, CA 92688
            </li>
            <li>
              <strong>Contact:</strong> info@sanhoti.org · +1 949-378-6425
            </li>
          </ul>
          <p className="text-gray-600 mt-4 text-sm">
            We are happy to provide our IRS determination letter for corporate CSR and matching-gift
            review.
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
            <Link to="/about" className="hover:underline">
              About Sanhoti
            </Link>
            <Link to="/donate" className="hover:underline">
              Donate
            </Link>
            <Link to="/events" className="hover:underline">
              Our Events
            </Link>
            <Link to="/contact" className="hover:underline">
              Contact Us
            </Link>
          </div>
        </div>
      </PageContent>
    </div>
  );
}
