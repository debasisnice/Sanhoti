import { DatabaseHelper } from './DatabaseHelper.js';
import { Notice } from '../models/types.js';
import { existsSync, mkdirSync, rmSync } from 'fs';
import { join } from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export class NoticeDataHelper extends DatabaseHelper {
  private readonly filename = 'notices.json';
  private readonly noticeFlyersDir = join(__dirname, '../../data/Notice_Flyers');

  constructor() {
    super();
    // Ensure Notice_Flyers directory exists
    if (!existsSync(this.noticeFlyersDir)) {
      mkdirSync(this.noticeFlyersDir, { recursive: true });
    }
  }

  private sanitizeFolderName(name: string): string {
    return name
      .replace(/[^a-zA-Z0-9\s-]/g, '') // Remove special characters except spaces and hyphens
      .replace(/\s+/g, '-') // Replace spaces with hyphens
      .replace(/-+/g, '-') // Replace multiple hyphens with single hyphen
      .toLowerCase()
      .trim();
  }

  private createNoticeFolder(notice: Notice): string {
    const folderName = `${this.sanitizeFolderName(notice.notice_name)}-${notice.notice_id}`;
    const folderPath = join(this.noticeFlyersDir, folderName);
    
    if (!existsSync(folderPath)) {
      mkdirSync(folderPath, { recursive: true });
    }
    
    return folderName;
  }

  async findAll(): Promise<Notice[]> {
    return this.readFile<Notice>(this.filename);
  }

  async findById(noticeId: string): Promise<Notice | null> {
    const notices = await this.findAll();
    return notices.find(n => n.notice_id === noticeId || n.id === noticeId) || null;
  }

  async findPublished(): Promise<Notice[]> {
    const notices = await this.findAll();
    return notices
      .filter(n => {
        // Check new schema first
        if (n.is_published !== undefined && n.is_active !== undefined) {
          return n.is_published && n.is_active;
        }
        // Fallback to legacy schema
        if (n.isPublic !== undefined) {
          return n.isPublic;
        }
        return false;
      })
      .sort((a, b) => {
        const dateA = new Date(a.created_at || a.createdAt || '').getTime();
        const dateB = new Date(b.created_at || b.createdAt || '').getTime();
        return dateB - dateA; // Newest first
      });
  }

  async create(notice: Omit<Notice, 'notice_id' | 'created_at' | 'updated_at'>): Promise<Notice> {
    const notices = await this.findAll();
    const now = new Date().toISOString();
    
    // Generate unique 12-digit alphanumeric notice_id
    let notice_id: string;
    let exists = true;
    while (exists) {
      notice_id = this.generate12DigitAlphanumericId();
      const existing = notices.find(n => n.notice_id === notice_id);
      exists = existing !== undefined;
    }

    const newNotice: Notice = {
      ...notice,
      notice_id: notice_id!,
      is_active: notice.is_active !== undefined ? notice.is_active : true,
      is_published: notice.is_published !== undefined ? notice.is_published : false,
      created_at: now,
      updated_at: now,
    };
    
    // Create folder for the notice and set notice_image_path if not provided
    const folderName = this.createNoticeFolder(newNotice);
    if (!newNotice.notice_image_path) {
      newNotice.notice_image_path = folderName;
    }
    
    notices.push(newNotice);
    this.writeFile(this.filename, notices);
    return newNotice;
  }

  async update(noticeId: string, updates: Partial<Omit<Notice, 'notice_id' | 'created_at'>>): Promise<Notice | null> {
    const notices = await this.findAll();
    const index = notices.findIndex(n => n.notice_id === noticeId || n.id === noticeId);
    if (index === -1) return null;
    
    // If notice is being deactivated, automatically unpublish it
    if (updates.is_active === false) {
      updates.is_published = false;
    }
    
    notices[index] = {
      ...notices[index],
      ...updates,
      updated_at: new Date().toISOString(),
    };
    this.writeFile(this.filename, notices);
    return notices[index];
  }

  async delete(noticeId: string): Promise<boolean> {
    const notices = await this.findAll();
    const noticeToDelete = notices.find(n => n.notice_id === noticeId || n.id === noticeId);
    
    if (!noticeToDelete) return false;
    
    // Delete the notice folder if it exists
    if (noticeToDelete.notice_image_path) {
      const folderPath = join(this.noticeFlyersDir, noticeToDelete.notice_image_path);
      if (existsSync(folderPath)) {
        try {
          rmSync(folderPath, { recursive: true, force: true });
        } catch (error) {
          console.error(`Error deleting notice folder ${folderPath}:`, error);
          // Continue with notice deletion even if folder deletion fails
        }
      }
    }
    
    // Delete the notice record
    const filtered = notices.filter(n => n.notice_id !== noticeId && n.id !== noticeId);
    this.writeFile(this.filename, filtered);
    return true;
  }

  async publish(noticeId: string): Promise<Notice | null> {
    const notice = await this.findById(noticeId);
    if (!notice) return null;
    
    // Cannot publish an inactive notice
    if (notice.is_active === false) {
      throw new Error('Cannot publish an inactive notice. Please activate the notice first.');
    }
    
    return this.update(noticeId, { is_published: true });
  }

  async unpublish(noticeId: string): Promise<Notice | null> {
    return this.update(noticeId, { is_published: false });
  }
}

