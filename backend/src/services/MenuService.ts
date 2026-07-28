import { EventService } from './EventService.js';
import { SubEventService } from './SubEventService.js';
import { DurgaPujaPageService } from './DurgaPujaPageService.js';
import { getEventDetailPath } from '../utils/slug.js';
import { durgaPujaPagePath } from '../utils/durgaPuja.js';
import { isDurgaPujaEventName } from '../utils/durgaPuja.js';
import type { Event, EventMenu, SubEvent } from '../models/types.js';

/** One menu with enough context to render and link it. */
export interface PublicMenu {
  /** Where the menu is maintained — Durga Puja lives on its own page. */
  source: 'durga-puja' | 'event' | 'sub-event';
  /** Stable identifier, used as a React key and to build the schema @id. */
  id: string;
  /** Event/meal-owner title, e.g. "Annual Picnic 2026". */
  title: string;
  /** Public path of the owning page. */
  href: string;
  /** Event start time in ms, for ordering. 0 when unknown. */
  when: number;
  menu: EventMenu;
}

/**
 * Aggregates every publicly visible menu.
 *
 * This exists so the `/bengali-food` React page and its `/seo` prerender read
 * from one implementation. They previously aggregated separately, which drifted
 * immediately — bots saw every event's menu while browsers saw only Durga
 * Puja's. Any future surface that needs menus should call this too.
 */
export class MenuService {
  private eventService: EventService;
  private subEventService: SubEventService;
  private durgaPujaPageService: DurgaPujaPageService;

  constructor() {
    this.eventService = new EventService();
    this.subEventService = new SubEventService();
    this.durgaPujaPageService = new DurgaPujaPageService();
  }

  private static hasDishes(menu: EventMenu | undefined): boolean {
    return (menu?.meals ?? []).some(m => m?.name?.trim());
  }

  /**
   * How many menus the aggregated food page shows.
   *
   * Unbounded, this grows with every event forever: measured at 44 menus the
   * page reached 128 KB with 74 KB of that being JSON-LD, which hurts Core Web
   * Vitals and dilutes the page. Nothing is lost by capping — every event page
   * still carries its own full menu, and the food page links to them.
   */
  static readonly FOOD_PAGE_LIMIT = 8;

  /**
   * Durga Puja first (it is the flagship and its menu is the most complete),
   * then everything else newest-first.
   *
   * `limit` caps the result; omit it to get everything.
   */
  async getPublicMenus(limit?: number): Promise<PublicMenu[]> {
    const [events, subEvents] = await Promise.all([
      this.eventService.getActiveEvents().catch(() => [] as Event[]),
      this.subEventService.getAllSubEvents().catch(() => [] as SubEvent[]),
    ]);

    const durga: PublicMenu[] = [];
    try {
      const year = await this.durgaPujaPageService.getActiveYear();
      const content = await this.durgaPujaPageService.getContentByYear(year);
      const food = content?.food;
      if (MenuService.hasDishes(food as EventMenu | undefined)) {
        durga.push({
          source: 'durga-puja',
          id: `durga-puja-${year}`,
          title: `Sanhoti Durga Puja ${year}`,
          href: durgaPujaPagePath(year),
          when: Number.MAX_SAFE_INTEGER, // always first
          menu: food as EventMenu,
        });
      }
    } catch {
      /* the rest of the list is still worth returning */
    }

    const rest: PublicMenu[] = [];

    for (const e of events) {
      // Durga Puja's menu is owned by the Durga Puja page — including the event
      // copy too would list the same food twice.
      if (isDurgaPujaEventName(e.event_name)) continue;
      if (!MenuService.hasDishes(e.menu)) continue;
      rest.push({
        source: 'event',
        id: e.event_id,
        title: e.event_name,
        href: getEventDetailPath(e, e.event_id),
        when: new Date(e.event_start_dt || 0).getTime() || 0,
        menu: e.menu as EventMenu,
      });
    }

    for (const se of subEvents) {
      if (se.is_active === false) continue;
      if (!MenuService.hasDishes(se.menu)) continue;
      rest.push({
        source: 'sub-event',
        id: se.sub_event_id,
        title: se.sub_event_name,
        href: `/sub-events/${se.sub_event_id}`,
        when: new Date(se.sub_event_start_dt || 0).getTime() || 0,
        menu: se.menu as EventMenu,
      });
    }

    rest.sort((a, b) => b.when - a.when);
    const all = [...durga, ...rest];
    return typeof limit === 'number' && limit > 0 ? all.slice(0, limit) : all;
  }

  /** Total number of public menus, ignoring any display cap. */
  async countPublicMenus(): Promise<number> {
    return (await this.getPublicMenus()).length;
  }
}
