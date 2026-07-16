import type { TicketSetup } from '../../services/api';
import type { Event } from '../../types';

const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;

/** Event ids that have at least one saved ticket setup (Event Tickets tab). */
export function savedTicketSetupEventIds(setups: TicketSetup[]): Set<string> {
  return new Set(setups.map(setup => setup.event_id));
}

/** Events with a saved ticket setup, optionally limited to recent (for check-in). */
export function eventsWithSavedTicketSetups(
  events: Event[],
  setups: TicketSetup[],
  options?: { recentOnly?: boolean }
): Event[] {
  const setupEventIds = savedTicketSetupEventIds(setups);
  const recentOnly = options?.recentOnly ?? false;
  const cutoff = Date.now() - SEVEN_DAYS_MS;

  return events
    .filter(event => {
      if (!setupEventIds.has(event.event_id)) return false;
      if (!recentOnly) return true;
      const end = Date.parse(event.event_end_dt);
      return Number.isFinite(end) && end >= cutoff;
    })
    .sort((a, b) => Date.parse(a.event_start_dt) - Date.parse(b.event_start_dt));
}

export const NO_SAVED_TICKET_SETUPS_LABEL = 'No saved ticket setups';

export const TICKET_SETUP_DRAFT_EVENT_KEY = 'sanhoti-ticket-setup-draft-event';

export function clearDraftEventId(): void {
  localStorage.removeItem(TICKET_SETUP_DRAFT_EVENT_KEY);
}
