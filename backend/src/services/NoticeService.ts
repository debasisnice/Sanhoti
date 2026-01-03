import { NoticeDataHelper } from '../data/NoticeDataHelper.js';
import { Notice } from '../models/types.js';

export class NoticeService {
  private noticeDataHelper: NoticeDataHelper;

  constructor() {
    this.noticeDataHelper = new NoticeDataHelper();
  }

  async getPublishedNotices(): Promise<Notice[]> {
    return this.noticeDataHelper.findPublished();
  }

  async getAllNotices(): Promise<Notice[]> {
    return this.noticeDataHelper.findAll();
  }

  async getNoticeById(noticeId: string): Promise<Notice | null> {
    return this.noticeDataHelper.findById(noticeId);
  }

  async createNotice(data: {
    notice_name: string;
    notice_body: string;
    event_id?: string;
    notice_image_path?: string;
    is_active?: boolean;
    is_published?: boolean;
  }): Promise<Notice> {
    return this.noticeDataHelper.create({
      ...data,
      is_active: data.is_active ?? true,
      is_published: data.is_published ?? false,
    });
  }

  async updateNotice(noticeId: string, updates: Partial<Omit<Notice, 'notice_id' | 'created_at'>>): Promise<Notice | null> {
    return this.noticeDataHelper.update(noticeId, updates);
  }

  async deleteNotice(noticeId: string): Promise<boolean> {
    return this.noticeDataHelper.delete(noticeId);
  }

  async publishNotice(noticeId: string): Promise<Notice | null> {
    const notice = await this.noticeDataHelper.findById(noticeId);
    if (!notice) return null;
    
    // Cannot publish an inactive notice
    if (notice.is_active === false) {
      throw new Error('Cannot publish an inactive notice. Please activate the notice first.');
    }
    
    return this.noticeDataHelper.publish(noticeId);
  }

  async unpublishNotice(noticeId: string): Promise<Notice | null> {
    return this.noticeDataHelper.unpublish(noticeId);
  }
}

