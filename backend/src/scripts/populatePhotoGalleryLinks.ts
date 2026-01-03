import { EventDataHelper } from '../data/EventDataHelper.js';

/**
 * Script to populate photo_gallery_link for all existing events
 * This links each event to its corresponding gallery folder
 */
async function populatePhotoGalleryLinks() {
  try {
    console.log('Populating photo_gallery_link for existing events...');
    const eventDataHelper = new EventDataHelper();
    const events = await eventDataHelper.findAll();
    
    let updated = 0;
    for (const event of events) {
      // Generate folder name based on event
      const folderName = `${event.event_name
        .replace(/[<>:"/\\|?*]/g, '-')
        .replace(/\s+/g, '-')
        .replace(/-+/g, '-')
        .replace(/^-|-$/g, '')
        .trim()}-${event.year}-${event.event_id}`;
      
      // Update if photo_gallery_link is empty or doesn't match
      if (!event.photo_gallery_link || event.photo_gallery_link !== folderName) {
        await eventDataHelper.update(event.event_id, {
          photo_gallery_link: folderName,
        });
        console.log(`Updated event ${event.event_id}: ${event.event_name} -> ${folderName}`);
        updated++;
      }
    }
    
    console.log(`✅ Successfully updated ${updated} events with photo_gallery_link`);
  } catch (error) {
    console.error('❌ Error populating photo_gallery_link:', error);
    process.exit(1);
  }
}

populatePhotoGalleryLinks();

