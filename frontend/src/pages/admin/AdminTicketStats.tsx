import { useCallback, useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import { BarChart3, RefreshCw } from 'lucide-react';
import { eventsAPI, ticketSetupsAPI, ticketingAPI, type TicketSetup, type TicketStatCard, type TicketStatDetail, type TicketStatGuest } from '../../services/api';
import { Event } from '../../types';
import { eventsWithSavedTicketSetups, NO_SAVED_TICKET_SETUPS_LABEL } from './ticketSetupEvents';

const EVENT_STORAGE_KEY = 'sanhoti_ticket_stats_event';

type GuestStatusTab = keyof Pick<
  TicketStatDetail,
  'pending_payment' | 'confirmed' | 'expired' | 'cancelled' | 'entered'
>;

const STATUS_TABS: Array<{ key: GuestStatusTab; label: string }> = [
  { key: 'pending_payment', label: 'Pending Payment' },
  { key: 'confirmed', label: 'Confirmed' },
  { key: 'expired', label: 'Expired' },
  { key: 'cancelled', label: 'Cancelled' },
  { key: 'entered', label: 'Entered in Gate' },
];

function StatPill({ label, value }: { label: string; value: number }) {
  return (
    <div className="text-center">
      <div className="text-lg font-bold text-gray-900">{value}</div>
      <div className="text-[10px] uppercase tracking-wide text-gray-500 leading-tight">{label}</div>
    </div>
  );
}

function GuestTable({ guests }: { guests: TicketStatGuest[] }) {
  if (guests.length === 0) {
    return <p className="text-sm text-gray-500 italic py-2">No bookings</p>;
  }
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm min-w-[48rem]">
        <thead>
          <tr className="text-left text-xs uppercase tracking-wide text-gray-500 border-b border-gray-200">
            <th className="py-2 pr-3 font-medium">Booking ID</th>
            <th className="py-2 pr-3 font-medium">Name</th>
            <th className="py-2 pr-3 font-medium">Email</th>
            <th className="py-2 pr-3 font-medium">Phone</th>
            <th className="py-2 pr-3 font-medium text-right">Adults</th>
            <th className="py-2 font-medium text-right">Children</th>
          </tr>
        </thead>
        <tbody>
          {guests.map(guest => (
            <tr key={guest.booking_id} className="border-b border-gray-100 last:border-0">
              <td className="py-2 pr-3 font-mono text-xs text-gray-600">{guest.booking_id}</td>
              <td className="py-2 pr-3 font-medium text-gray-900">{guest.name}</td>
              <td className="py-2 pr-3 text-gray-600 break-all">{guest.email}</td>
              <td className="py-2 pr-3 text-gray-600 whitespace-nowrap">{guest.phone}</td>
              <td className="py-2 pr-3 text-right text-gray-700">{guest.adult_count}</td>
              <td className="py-2 text-right text-gray-700">{guest.child_count}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function StatCard({
  card,
  selected,
  onSelect,
}: {
  card: TicketStatCard;
  selected: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className={`w-full text-left rounded-xl border-2 p-5 transition-shadow hover:shadow-md ${
        selected
          ? 'border-primary-500 bg-primary-50/40 shadow-md ring-1 ring-primary-200'
          : 'border-gray-200 bg-white hover:border-primary-300'
      }`}
    >
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1 mb-4">
        <h3 className="text-lg font-semibold text-gray-900">{card.label}</h3>
        <span className="text-sm text-gray-600 shrink-0">
          <span className="font-semibold text-primary-700">
            {card.entered}/{card.confirmed}
          </span>
          <span className="ml-1.5 text-xs uppercase tracking-wide">Entered/Confirmed</span>
        </span>
      </div>
      <div className="grid grid-cols-3 gap-4 sm:grid-cols-6">
        <StatPill label="Total" value={card.total} />
        <StatPill label="Pending" value={card.pending_payment} />
        <StatPill label="Confirmed" value={card.confirmed} />
        <StatPill label="Expired" value={card.expired} />
        <StatPill label="Cancelled" value={card.cancelled} />
        <StatPill label="Entered" value={card.entered} />
      </div>
    </button>
  );
}

export default function AdminTicketStats() {
  const [events, setEvents] = useState<Event[]>([]);
  const [ticketSetups, setTicketSetups] = useState<TicketSetup[]>([]);
  const [eventId, setEventId] = useState(() => {
    try {
      return sessionStorage.getItem(EVENT_STORAGE_KEY) ?? '';
    } catch {
      return '';
    }
  });
  const [cards, setCards] = useState<TicketStatCard[]>([]);
  const [detail, setDetail] = useState<TicketStatDetail | null>(null);
  const [selectedScope, setSelectedScope] = useState('');
  const [guestStatusTab, setGuestStatusTab] = useState<GuestStatusTab>('pending_payment');
  const [loading, setLoading] = useState(false);

  const eventOptions = useMemo(
    () => eventsWithSavedTicketSetups(events, ticketSetups),
    [events, ticketSetups]
  );
  const hasSavedSetups = eventOptions.length > 0;
  const eventIdValid = Boolean(eventId && eventOptions.some(event => event.event_id === eventId));

  useEffect(() => {
    void Promise.all([
      eventsAPI.getAll().then(setEvents),
      ticketSetupsAPI.list().then(setTicketSetups),
    ]).catch(() => toast.error('Could not load events or ticket setups'));
  }, []);

  useEffect(() => {
    if (eventId && !eventOptions.some(event => event.event_id === eventId)) {
      setEventId('');
    }
  }, [eventId, eventOptions]);

  const loadStats = useCallback(
    async (scope?: string) => {
      if (!eventIdValid) {
        setCards([]);
        setDetail(null);
        return;
      }
      setLoading(true);
      try {
        const res = await ticketingAPI.getTicketStats(eventId, scope);
        setCards(res.cards);
        setDetail(res.detail ?? null);
      } catch {
        toast.error('Failed to load ticket stats');
      } finally {
        setLoading(false);
      }
    },
    [eventIdValid]
  );

  useEffect(() => {
    try {
      if (eventId) sessionStorage.setItem(EVENT_STORAGE_KEY, eventId);
    } catch {
      /* ignore */
    }
    setSelectedScope('');
    setGuestStatusTab('pending_payment');
    void loadStats();
  }, [eventId, loadStats]);

  const handleSelectCard = (scope: string) => {
    setSelectedScope(scope);
    setGuestStatusTab('pending_payment');
    void loadStats(scope);
  };

  const groupedCards = useMemo(() => {
    const meals = cards.filter(c => c.group === 'Meals');
    const subs = cards.filter(c => c.group === 'Sub-events');
    return { meals, subs };
  }, [cards]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-2">
            <BarChart3 className="h-7 w-7 text-primary-600" />
            Ticket Stats
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            Booking and gate check-in counts by meal and sub-event. Click a card to see guest lists.
          </p>
        </div>
        <button
          type="button"
          onClick={() => void loadStats(selectedScope || undefined)}
          disabled={loading || !eventIdValid}
          className="inline-flex items-center gap-1.5 rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
        >
          <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      <div className="max-w-md">
        <label className="block text-sm font-medium text-gray-700 mb-1">Event</label>
        <select
          className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
          value={eventId}
          onChange={e => setEventId(e.target.value)}
        >
          <option value="">
            {hasSavedSetups ? 'Select event…' : NO_SAVED_TICKET_SETUPS_LABEL}
          </option>
          {eventOptions.map(event => (
            <option key={event.event_id} value={event.event_id}>
              {event.event_name}
              {event.year ? ` (${event.year})` : ''}
            </option>
          ))}
        </select>
      </div>

      {!hasSavedSetups && (
        <div className="rounded-xl border border-dashed border-gray-300 bg-gray-50 p-8 text-center text-gray-500">
          Save a ticket setup under Ticket Settings → Event Tickets to view statistics here.
        </div>
      )}

      {hasSavedSetups && !eventIdValid && (
        <div className="rounded-xl border border-dashed border-gray-300 bg-gray-50 p-8 text-center text-gray-500">
          Select an event to view ticket statistics.
        </div>
      )}

      {eventIdValid && loading && cards.length === 0 && (
        <div className="text-sm text-gray-500">Loading stats…</div>
      )}

      {eventIdValid && cards.length === 0 && !loading && (
        <div className="rounded-xl border border-dashed border-gray-300 bg-gray-50 p-8 text-center text-gray-500">
          No meal or sub-event gates configured for this event.
        </div>
      )}

      {eventIdValid && groupedCards.meals.length > 0 && (
        <section>
          <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-500 mb-3">Meals</h2>
          <div className="grid gap-6 grid-cols-1 md:grid-cols-2">
            {groupedCards.meals.map(card => (
              <StatCard
                key={card.scope}
                card={card}
                selected={selectedScope === card.scope}
                onSelect={() => handleSelectCard(card.scope)}
              />
            ))}
          </div>
        </section>
      )}

      {eventIdValid && groupedCards.subs.length > 0 && (
        <section>
          <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-500 mb-3">Sub-events</h2>
          <div className="grid gap-6 grid-cols-1 md:grid-cols-2">
            {groupedCards.subs.map(card => (
              <StatCard
                key={card.scope}
                card={card}
                selected={selectedScope === card.scope}
                onSelect={() => handleSelectCard(card.scope)}
              />
            ))}
          </div>
        </section>
      )}

      {eventIdValid && detail && (
        <section className="border-t border-gray-200 pt-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">
            Guest list — {detail.label}
          </h2>
          <div className="rounded-xl border border-primary-200 overflow-hidden">
            <div
              role="tablist"
              aria-label="Guest list by booking status"
              className="flex flex-wrap items-end gap-1 bg-primary-100 px-3 pt-2 border-b border-primary-200"
            >
              {STATUS_TABS.map(tab => {
                const count = detail[tab.key].length;
                const selected = guestStatusTab === tab.key;
                return (
                  <button
                    key={tab.key}
                    type="button"
                    role="tab"
                    aria-selected={selected}
                    onClick={() => setGuestStatusTab(tab.key)}
                    className={`px-4 py-2.5 text-sm font-medium rounded-t-lg transition-colors ${
                      selected
                        ? 'bg-primary-50 text-primary-900 border border-primary-200 border-b-primary-50 -mb-px relative z-10'
                        : 'text-primary-800 hover:bg-primary-200/60 border border-transparent'
                    }`}
                  >
                    {tab.label}
                    <span className={`ml-1.5 ${selected ? 'text-primary-700' : 'text-primary-600/80'}`}>
                      ({count})
                    </span>
                  </button>
                );
              })}
            </div>
            <div role="tabpanel" className="bg-primary-50 p-5">
              <GuestTable guests={detail[guestStatusTab]} />
            </div>
          </div>
        </section>
      )}
    </div>
  );
}
