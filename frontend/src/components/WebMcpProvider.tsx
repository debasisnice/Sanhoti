import { useEffect } from 'react';
import { eventsAPI, subEventsAPI, durgaPujaPageAPI } from '../services/api';
import { getEventDetailPath } from '../utils/eventSlug';
import { getSiteOrigin } from '../utils/eventShareUrl';

/**
 * WebMCP (navigator.modelContext) provider — exposes Sanhoti's public read
 * actions as tools to in-browser AI agents. Fully feature-detected: on browsers
 * without the experimental API this renders nothing and does no work. Tools only
 * call public, read-only endpoints. Spec: https://webmachinelearning.github.io/webmcp/
 */

type McpTool = {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
  execute: (args: Record<string, unknown>) => Promise<{ content: { type: 'text'; text: string }[] }>;
};

type ModelContext = {
  provideContext?: (ctx: { tools: McpTool[] }) => void;
};

function text(s: string) {
  return { content: [{ type: 'text' as const, text: s }] };
}

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

export default function WebMcpProvider() {
  useEffect(() => {
    const mc = (navigator as Navigator & { modelContext?: ModelContext }).modelContext;
    if (!mc?.provideContext) return; // Unsupported browser — no-op.

    const origin = getSiteOrigin();

    const tools: McpTool[] = [
      {
        name: 'sanhoti_get_upcoming_events',
        description:
          'List upcoming Bengali cultural events hosted by Sanhoti in Orange County, CA (name, date, location, link).',
        inputSchema: { type: 'object', properties: {}, additionalProperties: false },
        execute: async () => {
          const events = await eventsAPI.getUpcoming();
          if (!events.length) return text('No upcoming events are currently listed.');
          return text(
            events
              .map(
                e =>
                  `- ${e.event_name} — ${fmtDate(e.event_start_dt)}${e.location ? ` — ${e.location}` : ''} — ${origin}${getEventDetailPath(e, e.event_id)}`
              )
              .join('\n')
          );
        },
      },
      {
        name: 'sanhoti_search_events',
        description:
          "Search Sanhoti's events by keyword (e.g. 'Durga Puja', 'Saraswati', 'picnic'). Returns matching events with dates and links.",
        inputSchema: {
          type: 'object',
          properties: { query: { type: 'string', description: 'Search keyword' } },
          required: ['query'],
          additionalProperties: false,
        },
        execute: async args => {
          const q = String(args.query || '').toLowerCase().trim();
          const events = await eventsAPI.getActive();
          const hits = events.filter(e =>
            `${e.event_name} ${e.event_description} ${e.location || ''}`.toLowerCase().includes(q)
          );
          if (!hits.length) return text(`No events matched "${args.query}".`);
          return text(
            hits
              .map(
                e =>
                  `- ${e.event_name} — ${fmtDate(e.event_start_dt)}${e.location ? ` — ${e.location}` : ''} — ${origin}${getEventDetailPath(e, e.event_id)}`
              )
              .join('\n')
          );
        },
      },
      {
        name: 'sanhoti_list_concerts',
        description:
          'List Sanhoti Bengali concerts in Orange County / Southern California with performer, date, venue, and ticket link.',
        inputSchema: { type: 'object', properties: {}, additionalProperties: false },
        execute: async () => {
          const concerts = await subEventsAPI.getPublicConcerts();
          if (!concerts.length) return text('No concerts are currently listed.');
          return text(
            concerts
              .map(se => {
                const where = [se.venue_name, se.venue_city].filter(Boolean).join(', ');
                return `- ${se.sub_event_name}${se.performers ? ` (${se.performers})` : ''} — ${fmtDate(se.sub_event_start_dt)}${where ? ` — ${where}` : ''} — ${origin}/sub-events/${se.sub_event_id}${se.ticket_url ? ` — tickets: ${se.ticket_url}` : ''}`;
              })
              .join('\n')
          );
        },
      },
      {
        name: 'sanhoti_get_durga_puja_info',
        description:
          "Get Sanhoti's current Durga Puja details in Orange County: year, dates, venue, and page link.",
        inputSchema: { type: 'object', properties: {}, additionalProperties: false },
        execute: async () => {
          const { year, content } = await durgaPujaPageAPI.getActive();
          const parts = [
            `Sanhoti Durga Puja ${year} in Orange County, CA.`,
            content?.datesText ? `Dates: ${content.datesText}.` : '',
            content?.venueName ? `Venue: ${content.venueName}${content.venueCity ? `, ${content.venueCity}` : ''}.` : '',
            `Details: ${origin}/durga-puja`,
          ].filter(Boolean);
          return text(parts.join(' '));
        },
      },
    ];

    try {
      mc.provideContext({ tools });
    } catch {
      /* provideContext may throw on unsupported/older shapes — ignore. */
    }
  }, []);

  return null;
}
