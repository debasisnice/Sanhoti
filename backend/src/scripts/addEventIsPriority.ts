import { EventDataHelper } from '../data/EventDataHelper.js';

async function addEventIsPriority() {
  const eventDataHelper = new EventDataHelper();
  
  try {
    const events = await eventDataHelper.findAll();
    console.log(`Found ${events.length} events to update`);
    
    let updated = 0;
    for (const event of events) {
      if (event.is_priority === undefined) {
        // Update event to add is_priority: false
        await eventDataHelper.update(event.event_id, { is_priority: false });
        updated++;
        console.log(`Updated event: ${event.event_name} (${event.event_id}) - added is_priority: false`);
      }
    }
    
    console.log(`\nMigration completed: ${updated} events updated with is_priority field`);
  } catch (error) {
    console.error('Error adding is_priority field to events:', error);
    process.exit(1);
  }
}

addEventIsPriority()
  .then(() => {
    console.log('Migration script completed successfully');
    process.exit(0);
  })
  .catch((error) => {
    console.error('Migration script failed:', error);
    process.exit(1);
  });


