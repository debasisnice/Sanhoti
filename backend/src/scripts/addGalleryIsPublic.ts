import { EventDataHelper } from '../data/EventDataHelper.js';

/**
 * Script to add gallery_is_public field to all existing events
 * Defaults to false (unpublished)
 */
async function addGalleryIsPublic() {
  try {
    console.log('Adding gallery_is_public to existing events...');
    const eventDataHelper = new EventDataHelper();
    const events = await eventDataHelper.findAll();
    
    let updated = 0;
    for (const event of events) {
      // Only update if gallery_is_public is not already set
      if (event.gallery_is_public === undefined) {
        await eventDataHelper.update(event.event_id, {
          gallery_is_public: false, // Default to unpublished
        });
        console.log(`Updated event ${event.event_id}: ${event.event_name} -> gallery_is_public: false`);
        updated++;
      }
    }
    
    console.log(`✅ Successfully added gallery_is_public to ${updated} events`);
  } catch (error) {
    console.error('❌ Error adding gallery_is_public:', error);
    process.exit(1);
  }
}

addGalleryIsPublic();


