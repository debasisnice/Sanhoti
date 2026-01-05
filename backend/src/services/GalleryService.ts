import { GalleryDataHelper } from '../data/GalleryDataHelper.js';
import { EventDataHelper } from '../data/EventDataHelper.js';
import { PhotoGallery, Photo, Event } from '../models/types.js';
import { readdirSync, statSync, unlinkSync, existsSync } from 'fs';
import { join } from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const galleriesDir = join(__dirname, '../../data/Galleries');

export class GalleryService {
  private galleryDataHelper: GalleryDataHelper;
  private eventDataHelper: EventDataHelper;

  constructor() {
    this.galleryDataHelper = new GalleryDataHelper();
    this.eventDataHelper = new EventDataHelper();
  }

  async getPublicGalleries(): Promise<PhotoGallery[]> {
    try {
      // Get all events with public galleries
      const events = await this.eventDataHelper.findAll();
      const publicEvents = events.filter(e => e.gallery_is_public === true && e.photo_gallery_link);
      
      
      // Convert events to PhotoGallery format
      const galleries: PhotoGallery[] = [];
      
      for (const event of publicEvents) {
        const folderName = event.photo_gallery_link;
        if (!folderName) continue;
        const folderPath = join(galleriesDir, folderName);
        
        // Get photos from the folder
        let photos: Photo[] = [];
        try {
          if (statSync(folderPath).isDirectory()) {
            const files = readdirSync(folderPath);
            photos = files
              .filter(file => /\.(jpg|jpeg|png|gif|webp)$/i.test(file))
              .map((file, index) => {
                // URL encode the filename to handle special characters
                const encodedFile = encodeURIComponent(file);
                return {
                  id: `photo-${event.event_id}-${index}`,
                  url: `/api/galleries/${event.event_id}/photos/${encodedFile}`,
                  thumbnailUrl: `/api/galleries/${event.event_id}/photos/${encodedFile}`,
                  caption: file.replace(/\.[^/.]+$/, ''), // Use filename as caption
                  uploadedAt: new Date().toISOString(), // Could get from file stats if needed
                  filename: file, // Store original filename for reference
                };
              });
          }
        } catch (error: any) {
          // Folder doesn't exist or can't be read - that's okay, return gallery with empty photos
          console.warn(`Could not read gallery folder for event ${event.event_id}:`, error.message);
        }
        
        galleries.push({
          id: event.event_id, // Use event_id as gallery ID
          eventId: event.event_id,
          title: `${event.event_name} Gallery`,
          description: event.event_description,
          isPublic: true,
          photos: photos,
          createdAt: event.created_at,
          updatedAt: event.updated_at,
          createdBy: '', // Could add to event if needed
          event_start_dt: event.event_start_dt, // Include event start date for sorting
        });
      }
      
      return galleries;
    } catch (error: any) {
      console.error('Error in getPublicGalleries:', error);
      throw error;
    }
  }

  async getAllGalleries(): Promise<PhotoGallery[]> {
    return this.galleryDataHelper.findAll();
  }

  async getGalleryById(id: string): Promise<PhotoGallery | null> {
    // First try to find in galleries.json (for backward compatibility)
    const galleryFromJson = await this.galleryDataHelper.findById(id);
    if (galleryFromJson) {
      return galleryFromJson;
    }
    
    // If not found, try to get from events (event_id as gallery id)
    const event = await this.eventDataHelper.findById(id);
    if (event && event.photo_gallery_link) {
      const folderName = event.photo_gallery_link;
      const folderPath = join(galleriesDir, folderName);
      
      // Get photos from the folder
      let photos: Photo[] = [];
      try {
        if (statSync(folderPath).isDirectory()) {
          const files = readdirSync(folderPath);
          photos = files
            .filter(file => /\.(jpg|jpeg|png|gif|webp)$/i.test(file))
            .map((file, index) => {
              // URL encode the filename to handle special characters
              const encodedFile = encodeURIComponent(file);
              return {
                id: `photo-${event.event_id}-${index}`,
                url: `/api/galleries/${event.event_id}/photos/${encodedFile}`,
                thumbnailUrl: `/api/galleries/${event.event_id}/photos/${encodedFile}`,
                caption: file.replace(/\.[^/.]+$/, ''),
                uploadedAt: new Date().toISOString(),
                filename: file, // Store original filename for reference
              };
            });
        }
      } catch (error) {
        console.warn(`Could not read gallery folder for event ${event.event_id}:`, error);
      }
      
      return {
        id: event.event_id,
        eventId: event.event_id,
        title: `${event.event_name} Gallery`,
        description: event.event_description,
        isPublic: event.gallery_is_public ?? false,
        photos: photos,
        createdAt: event.created_at,
        updatedAt: event.updated_at,
        createdBy: '',
        event_start_dt: event.event_start_dt, // Include event start date for sorting
      };
    }
    
    return null;
  }

  async getGalleriesByEvent(eventId: string): Promise<PhotoGallery[]> {
    return this.galleryDataHelper.findByEventId(eventId);
  }

  async getGalleryByAccessCode(code: string): Promise<PhotoGallery | null> {
    return this.galleryDataHelper.findByAccessCode(code);
  }

  async createGallery(data: {
    eventId?: string;
    title: string;
    description?: string;
    isPublic: boolean;
    specialAccessCode?: string;
    createdBy: string;
  }): Promise<PhotoGallery> {
    return this.galleryDataHelper.create({
      ...data,
      photos: [],
    });
  }

  async updateGallery(id: string, updates: Partial<Omit<PhotoGallery, 'id' | 'createdAt' | 'createdBy' | 'photos'>>): Promise<PhotoGallery | null> {
    return this.galleryDataHelper.update(id, updates);
  }

  async addPhotoToGallery(galleryId: string, photo: Omit<Photo, 'id' | 'uploadedAt'>): Promise<PhotoGallery | null> {
    const gallery = await this.galleryDataHelper.findById(galleryId);
    if (!gallery) return null;

    const newPhoto: Photo = {
      ...photo,
      id: `photo-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      uploadedAt: new Date().toISOString(),
    };

    gallery.photos.push(newPhoto);
    return this.galleryDataHelper.update(galleryId, { photos: gallery.photos });
  }

  async removePhotoFromGallery(galleryId: string, photoId: string): Promise<PhotoGallery | null> {
    const gallery = await this.galleryDataHelper.findById(galleryId);
    if (!gallery) return null;

    gallery.photos = gallery.photos.filter(p => p.id !== photoId);
    return this.galleryDataHelper.update(galleryId, { photos: gallery.photos });
  }

  async deleteGallery(id: string): Promise<boolean> {
    return this.galleryDataHelper.delete(id);
  }

  // Get photos in a gallery folder (by event_id)
  async getPhotosInFolder(eventId: string): Promise<Photo[]> {
    const event = await this.eventDataHelper.findById(eventId);
    if (!event || !event.photo_gallery_link) {
      return [];
    }

    const folderName = event.photo_gallery_link;
    const folderPath = join(galleriesDir, folderName);

    let photos: Photo[] = [];
    try {
      if (existsSync(folderPath) && statSync(folderPath).isDirectory()) {
        const files = readdirSync(folderPath);
        photos = files
          .filter(file => /\.(jpg|jpeg|png|gif|webp)$/i.test(file))
          .map((file, index) => {
            const filePath = join(folderPath, file);
            const stats = statSync(filePath);
            return {
              id: `photo-${eventId}-${index}-${file}`,
              url: `/api/galleries/${eventId}/photos/${encodeURIComponent(file)}`,
              thumbnailUrl: `/api/galleries/${eventId}/photos/${encodeURIComponent(file)}`,
              caption: file.replace(/\.[^/.]+$/, ''),
              uploadedAt: stats.birthtime.toISOString(),
              filename: file, // Store filename for deletion
            };
          });
      }
    } catch (error: any) {
      console.warn(`Could not read gallery folder for event ${eventId}:`, error.message);
    }

    return photos;
  }

  // Delete a photo file from a gallery folder
  async deletePhotoFromFolder(eventId: string, filename: string): Promise<boolean> {
    const event = await this.eventDataHelper.findById(eventId);
    if (!event || !event.photo_gallery_link) {
      return false;
    }

    const folderName = event.photo_gallery_link;
    const folderPath = join(galleriesDir, folderName);
    const filePath = join(folderPath, filename);

    try {
      if (existsSync(filePath)) {
        unlinkSync(filePath);
        return true;
      }
    } catch (error: any) {
      console.error(`Error deleting photo ${filename} from event ${eventId}:`, error);
      throw error;
    }

    return false;
  }
}

