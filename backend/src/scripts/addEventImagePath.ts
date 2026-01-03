import { EventDataHelper } from '../data/EventDataHelper.js';
import { existsSync, mkdirSync } from 'fs';
import { join } from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const eventsFlyersDir = join(__dirname, '../../data/Events_Flyers');

// Ensure Events_Flyers directory exists
if (!existsSync(eventsFlyersDir)) {
  mkdirSync(eventsFlyersDir, { recursive: true });
}

function sanitizeFolderName(name: string): string {
  return name
    .replace(/[^a-zA-Z0-9\s-]/g, '') // Remove special characters except spaces and hyphens
    .replace(/\s+/g, '-') // Replace spaces with hyphens
    .replace(/-+/g, '-') // Replace multiple hyphens with single hyphen
    .toLowerCase()
    .trim();
}

async function addEventImagePath() {
  const eventDataHelper = new EventDataHelper();
  
  try {
    const events = await eventDataHelper.findAll();
    console.log(`Found ${events.length} events to update`);
    
    let updated = 0;
    for (const event of events) {
      if (!event.event_image_path) {
        // Create folder for the event and set event_image_path
        const folderName = `${sanitizeFolderName(event.event_name)}-${event.event_id}`;
        const folderPath = join(eventsFlyersDir, folderName);
        
        // Create the folder if it doesn't exist
        if (!existsSync(folderPath)) {
          mkdirSync(folderPath, { recursive: true });
          console.log(`Created folder: ${folderPath}`);
        }
        
        // Update event to add event_image_path
        await eventDataHelper.update(event.event_id, { event_image_path: folderName });
        updated++;
        console.log(`Updated event: ${event.event_name} (${event.event_id}) - added event_image_path: ${folderName}`);
      }
    }
    
    console.log(`\nMigration completed: ${updated} events updated with event_image_path field`);
  } catch (error) {
    console.error('Error adding event_image_path field to events:', error);
    process.exit(1);
  }
}

addEventImagePath()
  .then(() => {
    console.log('Migration script completed successfully');
    process.exit(0);
  })
  .catch((error) => {
    console.error('Migration script failed:', error);
    process.exit(1);
  });

