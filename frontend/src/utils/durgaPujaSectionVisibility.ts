import type { DurgaPujaPageContent, DurgaPujaSectionToggles } from '../services/api';
import type { SubEvent } from '../types';

export type DurgaPujaVisibilityContext = {
  content: DurgaPujaPageContent;
  /** Sub-events with show_in_durga_puja_page (Programs & Events strip). */
  durgaPujaSubEvents?: SubEvent[];
  seatBookingOpen?: boolean;
  hasSavedTicketData?: boolean;
};

function sectionEnabled(content: DurgaPujaPageContent, key: keyof DurgaPujaSectionToggles): boolean {
  return content.sections?.[key] !== false;
}

function celebrationEnded(content: DurgaPujaPageContent): boolean {
  const eventYear = content.year ?? new Date().getFullYear();
  if (
    content.endDate &&
    !Number.isNaN(new Date(`${content.endDate}T23:59:59`).getTime()) &&
    new Date(`${content.endDate}T23:59:59`).getTime() < Date.now()
  ) {
    return true;
  }
  return eventYear < new Date().getFullYear();
}

/** Mirrors DurgaPuja.tsx — true when the section actually renders on the public page. */
export function isDurgaPujaSectionPublic(
  key: keyof DurgaPujaSectionToggles,
  ctx: DurgaPujaVisibilityContext
): boolean {
  const { content, durgaPujaSubEvents = [], seatBookingOpen = false, hasSavedTicketData = false } =
    ctx;
  if (!sectionEnabled(content, key)) return false;

  const venue = content.venue ?? {};
  const food = content.food;
  const puja = content.puja;
  const kids = content.kids;
  const sponsorship = content.sponsorship;
  const vendors = content.vendors;
  const volunteer = content.volunteer;
  const gallery = content.gallery;
  const social = content.social;
  const contacts = content.contacts ?? [];
  const artists = content.artists ?? [];
  const scheduleDays = content.scheduleDays ?? [];
  const additionalVenues = (content.venues ?? []).filter(
    v => v && (v.name || v.buildingName || v.streetAddress || v.mapsUrl)
  );
  const venueDefaultsOn = content.showVenueDefaults !== false;
  const mainVenueName = venue.buildingName || (venueDefaultsOn ? content.venueName : '');
  const mainVenueHasDetails = Boolean(
    mainVenueName ||
      venue.streetAddress ||
      venue.mapsUrl ||
      venue.parkingLot ||
      venue.parkingCost ||
      venue.accessibleParking ||
      venue.recommendedEntrance ||
      venue.publicTransit ||
      venue.layoutNote ||
      venue.venueMapImageUrl
  );
  const showSubEventVenues = venueDefaultsOn && durgaPujaSubEvents.some(se => se.location);
  const ticketSalesOpen = !celebrationEnded(content);

  switch (key) {
    case 'hero':
    case 'highlights':
      return true;
    case 'schedule':
      return scheduleDays.length > 0;
    case 'artists':
      return artists.length > 0;
    case 'tickets':
      return ticketSalesOpen;
    case 'subEvents':
      return durgaPujaSubEvents.length > 0;
    case 'venue':
      return mainVenueHasDetails || additionalVenues.length > 0 || showSubEventVenues;
    case 'food':
      return Boolean(food && (food.intro || (food.meals && food.meals.length) || food.vegetarian));
    case 'puja':
      return Boolean(puja && (puja.intro || (puja.timings && puja.timings.length) || puja.priestInfo));
    case 'kids':
      return Boolean(kids && (kids.intro || (kids.activities && kids.activities.length)));
    case 'sponsorship':
      return Boolean(
        sponsorship && (sponsorship.intro || (sponsorship.packages && sponsorship.packages.length))
      );
    case 'vendors':
      return Boolean(vendors && (vendors.intro || (vendors.types && vendors.types.length)));
    case 'volunteer':
      return Boolean(
        volunteer && (volunteer.intro || (volunteer.categories && volunteer.categories.length))
      );
    case 'about':
      return Boolean(content.about);
    case 'gallery':
      return Boolean(
        gallery &&
          (gallery.intro ||
            gallery.galleryLink ||
            (gallery.images && gallery.images.length) ||
            gallery.videoUrl)
      );
    case 'faqs':
      return (content.faqs?.length ?? 0) > 0;
    case 'contact':
      return contacts.length > 0 || Boolean(social);
    default:
      return false;
  }
}
