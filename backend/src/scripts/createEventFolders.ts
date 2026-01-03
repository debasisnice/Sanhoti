import { EventDataHelper } from '../data/EventDataHelper.js';

/**
 * Script to create gallery folders for all existing events
 * Run this script to create folders for events that were created before folder creation was implemented
 */
async function createFoldersForExistingEvents() {
  try {
    console.log('Creating gallery folders for existing events...');
    const eventDataHelper = new EventDataHelper();
    await eventDataHelper.createGalleryFoldersForAllEvents();
    console.log('✅ Successfully created gallery folders for all events');
  } catch (error) {
    console.error('❌ Error creating gallery folders:', error);
    process.exit(1);
  }
}

createFoldersForExistingEvents();

