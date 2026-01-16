import { NewsDataHelper } from '../data/NewsDataHelper.js';
import { News } from '../models/types.js';

export class NewsService {
  private newsDataHelper: NewsDataHelper;

  constructor() {
    this.newsDataHelper = new NewsDataHelper();
  }

  async getAllNews(): Promise<News[]> {
    return this.newsDataHelper.findAll();
  }

  async getNewsById(id: string): Promise<News | null> {
    return this.newsDataHelper.findById(id);
  }

  async getPublishedNews(): Promise<News[]> {
    return this.newsDataHelper.findPublished();
  }

  async getArchivedNews(): Promise<News[]> {
    return this.newsDataHelper.findArchived();
  }

  async createNews(data: Omit<News, 'news_id' | 'created_at' | 'updated_at'>): Promise<News> {
    return this.newsDataHelper.create(data);
  }

  async updateNews(id: string, updates: Partial<Omit<News, 'news_id' | 'created_at'>>): Promise<News | null> {
    return this.newsDataHelper.update(id, updates);
  }

  async deleteNews(id: string): Promise<boolean> {
    return this.newsDataHelper.delete(id);
  }

  async archiveNews(id: string): Promise<News | null> {
    return this.newsDataHelper.update(id, { is_archived: true });
  }

  async unarchiveNews(id: string): Promise<News | null> {
    return this.newsDataHelper.update(id, { is_archived: false });
  }

  getNewsMediaDir(): string {
    return this.newsDataHelper.getNewsMediaDir();
  }
}

