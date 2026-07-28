import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Heart, Gift, Users, Mail, Phone, Building2 } from 'lucide-react';
import Seo from '../components/Seo';
import PageHero from '../components/PageHero';
import { settingsAPI } from '../services/api';
import { getSiteOrigin } from '../utils/eventShareUrl';
import { fetchCommitteeMembers, type CommitteeMemberDisplay } from '../utils/fetchCommitteeMembers';
import type { CorporatePartnershipsContent } from '../types';

/** Default content — admin overrides via /admin/settings → Corporate Partnerships. */
export const DEFAULT_CORPORATE_PARTNERSHIPS: Required<CorporatePartnershipsContent> = {
  heroTitle: 'Corporate Partnerships & CSR',
  heroSubtitle: 'Invest in Bengali culture, diversity, and community across Orange County & SoCal',
  whyPartnerTitle: 'Why Partner With Sanhoti',
  whyPartner: [
    { title: 'Advance Diversity & Inclusion', text: 'Sanhoti builds bridges across Bengali, broader Indian, and non-Indian communities, creating shared cultural experiences open to all backgrounds, races, and religions.' },
    { title: 'Invest in the Next Generation', text: 'Our year-round programming gives children and young adults hands-on exposure to Bengali language, literature, and music — supporting cultural literacy and identity.' },
    { title: 'Support Arts & Heritage', text: 'From Durga Puja and Saraswati Puja to Poila Boishakh, Sanhoti sustains centuries-old traditions and makes them accessible to wider Southern California.' },
    { title: 'Strengthen Local Community Ties', text: 'Sanhoti brings together families across Rancho Santa Margarita, Irvine, Tustin, Mission Viejo, and greater Orange County/SoCal, fostering regional civic connection.' },
  ],
  impactTitle: 'Community & Charitable Impact',
  impactIntro: 'Beyond cultural programming, Sanhoti members show up for causes across Orange County — giving companies a concrete way to co-sponsor volunteer days or fundraising drives alongside us, not just cultural festivals.',
  impact: [
    { tag: 'Hunger Relief', name: 'Walk with Second Harvest 2026', meta: 'Second Harvest Food Bank of Orange County · Tanaka Farms, Irvine', text: "Sanhoti fields a team for Second Harvest's annual community fundraising walk, supporting food-insecurity relief for Orange County families." },
    { tag: 'Domestic Violence Support', name: "Sanhoti Charity Event at Laura's House (2025)", meta: "Laura's House · Orange County", text: "A Sanhoti-organized charity event supporting Laura's House, an Orange County nonprofit providing shelter, therapy, legal advocacy, and prevention education for survivors of domestic violence." },
    { tag: 'Domestic Violence Support', name: "Sanhoti Charity Event at Laura's House (2026)", meta: "Laura's House · Orange County", text: "A continuation of Sanhoti's partnership with Laura's House, extending support to survivors of domestic violence in the local community." },
  ],
  waysTitle: 'Ways to Give or Partner',
  waysToGive: [
    'Corporate sponsorship of flagship events (Durga Puja, Saraswati Puja, Poila Boishakh, cultural concerts)',
    'Matching gift programs for employee donations',
    'In-kind support (venue space, catering, printing, A/V equipment, volunteer time)',
    'Employee volunteer days at Sanhoti events and community programs',
    'Multi-year partnership commitments for long-term cultural and educational programming',
  ],
  csrNote: 'Sanhoti is a registered 501(c)(3) nonprofit (EIN 39-2903777). Every corporate contribution is tax-deductible, and many employers match employee gifts dollar-for-dollar — check with your HR or CSR team.',
  leadershipTitle: 'Leadership',
  ctaTitle: 'Get Involved',
  ctaText: "To discuss a sponsorship, matching gift, or corporate partnership, reach out — we're happy to provide our EIN, tax-exemption letter, and program details for your company's CSR review process.",
  contactEmail: 'sanhoti.ec@gmail.com',
  contactPhone: '+1 949-378-6425',
};

const WHY_ICONS = [Heart, Users, Gift, Building2];

export default function CorporatePartnerships() {
  const [content, setContent] = useState<Required<CorporatePartnershipsContent>>(DEFAULT_CORPORATE_PARTNERSHIPS);
  const [committeeMembers, setCommitteeMembers] = useState<CommitteeMemberDisplay[]>([]);
  const [committeeYear, setCommitteeYear] = useState('');

  useEffect(() => {
    let cancelled = false;
    settingsAPI
      .getSettings()
      .then(s => {
        if (cancelled) return;
        const saved = s?.corporatePartnerships as CorporatePartnershipsContent | undefined;
        if (saved) {
          const nonEmpty = <T,>(v: T[] | undefined, fb: T[]) => (Array.isArray(v) && v.length ? v : fb);
          setContent({
            ...DEFAULT_CORPORATE_PARTNERSHIPS,
            ...saved,
            whyPartner: nonEmpty(saved.whyPartner, DEFAULT_CORPORATE_PARTNERSHIPS.whyPartner),
            impact: nonEmpty(saved.impact, DEFAULT_CORPORATE_PARTNERSHIPS.impact),
            waysToGive: nonEmpty(saved.waysToGive, DEFAULT_CORPORATE_PARTNERSHIPS.waysToGive),
          });
        }
        setCommitteeYear((s as { committeeYear?: string }).committeeYear || '');
      })
      .catch(() => {
        /* keep defaults */
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    fetchCommitteeMembers()
      .then(setCommitteeMembers)
      .catch(() => {
        /* optional section */
      });
  }, []);

  const c = content;

  const jsonLd = useMemo(
    () => [
      {
        '@context': 'https://schema.org',
        '@type': 'ItemList',
        name: c.waysTitle,
        itemListElement: c.waysToGive.map((w, i) => ({ '@type': 'ListItem', position: i + 1, name: w })),
      },
      {
        '@context': 'https://schema.org',
        '@type': 'BreadcrumbList',
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: 'Home', item: getSiteOrigin() + '/' },
          { '@type': 'ListItem', position: 2, name: 'Corporate Partnerships', item: getSiteOrigin() + '/corporate-partnerships' },
        ],
      },
    ],
    [c.waysTitle, c.waysToGive]
  );

  return (
    <div className="pb-32">
      <Seo
        title="Corporate Partnerships & CSR | Sanhoti Bengali Association, Orange County, CA"
        description="Partner with Sanhoti, a 501(c)(3) Bengali cultural association serving Orange County and Southern California, through corporate sponsorship, matching gifts, and CSR giving."
        path="/corporate-partnerships"
        jsonLd={jsonLd}
      />

      <PageHero
        icon={Building2}
        title="Corporate Partnerships & CSR — Sanhoti, Orange County"
        subtitle="Invest in Bengali culture, diversity, and community across Orange County and Southern California through sponsorship, matching gifts, and employee volunteer programmes."
      />

      <div className="bg-gray-50 border-b border-gray-200">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <nav
            aria-label="Page sections"
            className="inline-flex flex-wrap gap-1 bg-white rounded-full p-1 shadow-sm border border-gray-200"
          >
            {[
              ['#why-partner', 'Why Partner'],
              ['#impact', 'Community Impact'],
              ['#ways-to-give', 'Ways to Give'],
              ['#leadership', 'Leadership'],
              ['#get-involved', 'Get Involved'],
            ].map(([href, label]) => (
              <a
                key={href}
                href={href}
                className="px-4 py-2 rounded-full text-sm font-semibold text-gray-700 hover:bg-primary-50 hover:text-primary-800 transition-colors"
              >
                {label}
              </a>
            ))}
          </nav>
          <a
            href={`mailto:${c.contactEmail}`}
            className="inline-flex items-center justify-center gap-2 bg-primary-600 text-white px-6 py-2.5 rounded-lg font-semibold hover:bg-primary-700 transition-colors shrink-0"
          >
            <Mail className="w-5 h-5" /> Become a partner
          </a>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 pt-12 space-y-10">
        {/* Why partner */}
        <section id="why-partner" className="bg-white rounded-2xl shadow-lg p-8 scroll-mt-24">
          <h2 className="text-2xl font-bold text-gray-900 mb-6 flex items-center gap-3">
            <Heart className="w-7 h-7 text-primary-600" /> {c.whyPartnerTitle}
          </h2>
          <div className="grid gap-6 sm:grid-cols-2">
            {c.whyPartner.map((w, i) => {
              const Icon = WHY_ICONS[i % WHY_ICONS.length];
              return (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, y: 16 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  className="flex gap-3"
                >
                  <div className="w-11 h-11 rounded-xl bg-primary-50 flex items-center justify-center shrink-0">
                    <Icon className="w-5 h-5 text-primary-600" />
                  </div>
                  <div>
                    <h3 className="font-bold text-primary-800 mb-1">{w.title}</h3>
                    <p className="text-gray-600 text-sm">{w.text}</p>
                  </div>
                </motion.div>
              );
            })}
          </div>
        </section>

        {/* Community impact */}
        <section id="impact" className="bg-white rounded-2xl shadow-lg p-8 scroll-mt-24">
          <h2 className="text-2xl font-bold text-gray-900 mb-4">{c.impactTitle}</h2>
          <p className="text-gray-600 mb-6">{c.impactIntro}</p>
          <div className="grid gap-5 md:grid-cols-3">
            {c.impact.map((i, idx) => (
              <div key={idx} className="bg-primary-50/60 rounded-xl border-l-4 border-primary-500 p-5">
                {i.tag && (
                  <span className="inline-block text-[0.7rem] font-bold uppercase tracking-wide text-primary-700 bg-primary-100 rounded-full px-2.5 py-0.5 mb-2">
                    {i.tag}
                  </span>
                )}
                <p className="font-bold text-gray-900">{i.name}</p>
                {i.meta && <p className="text-xs font-semibold text-primary-700 mb-2">{i.meta}</p>}
                <p className="text-sm text-gray-600">{i.text}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Ways to give */}
        <section id="ways-to-give" className="bg-white rounded-2xl shadow-lg p-8 scroll-mt-24">
          <h2 className="text-2xl font-bold text-gray-900 mb-5 flex items-center gap-3">
            <Gift className="w-7 h-7 text-primary-600" /> {c.waysTitle}
          </h2>
          <ul className="space-y-3">
            {c.waysToGive.map((w, i) => (
              <li key={i} className="flex gap-3 text-gray-700">
                <span className="mt-2 w-2 h-2 rounded-full bg-primary-500 shrink-0" />
                <span>{w}</span>
              </li>
            ))}
          </ul>
          {c.csrNote && (
            <p className="mt-6 text-sm text-gray-600 bg-primary-50 border-l-4 border-primary-500 rounded-lg px-4 py-3">
              {c.csrNote}
            </p>
          )}
        </section>

        {/* Leadership — same source as /committee */}
        <section id="leadership" className="bg-white rounded-2xl shadow-lg p-8 scroll-mt-24">
          <h2 className="text-2xl font-bold text-gray-900 mb-1 flex items-center gap-3">
            <Users className="w-7 h-7 text-primary-600" /> {c.leadershipTitle}
          </h2>
          {committeeYear && (
            <p className="text-gray-500 mb-5">Executive Committee {committeeYear}</p>
          )}
          <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-4">
            {committeeMembers.map(l => (
              <div key={l.role} className="text-center bg-gray-50 rounded-xl overflow-hidden">
                <div className="aspect-[3/4] relative bg-gray-100">
                  {l.image ? (
                    <img
                      src={l.image}
                      alt={`${l.firstName} ${l.lastName}`.trim() || l.role}
                      className="w-full h-full object-cover object-center"
                      loading="lazy"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-amber-400 to-primary-600 text-white font-bold text-2xl">
                      {(l.firstName || l.role).charAt(0)}
                    </div>
                  )}
                </div>
                <div className="p-4">
                  {(l.firstName || l.lastName) && (
                    <p className="font-bold text-primary-800">{[l.firstName, l.lastName].filter(Boolean).join(' ')}</p>
                  )}
                  <p className="text-sm text-gray-600">{l.role}</p>
                </div>
              </div>
            ))}
          </div>
          <p className="mt-4 text-sm text-gray-500 text-center">
            <Link to="/committee" className="text-primary-600 font-medium hover:underline">
              View full committee page →
            </Link>
          </p>
        </section>

        {/* CTA */}
        <section id="get-involved" className="bg-primary-600 text-white rounded-2xl p-8 text-center scroll-mt-24">
          <h2 className="text-2xl font-bold mb-3">{c.ctaTitle}</h2>
          <p className="text-white/90 max-w-2xl mx-auto mb-5">{c.ctaText}</p>
          <div className="flex flex-wrap justify-center gap-x-6 gap-y-2 font-semibold">
            <a href={`mailto:${c.contactEmail}`} className="inline-flex items-center gap-2 hover:underline">
              <Mail className="w-5 h-5" /> {c.contactEmail}
            </a>
            <a href={`tel:${c.contactPhone.replace(/[^\d+]/g, '')}`} className="inline-flex items-center gap-2 hover:underline">
              <Phone className="w-5 h-5" /> {c.contactPhone}
            </a>
          </div>
        </section>
      </div>
    </div>
  );
}
