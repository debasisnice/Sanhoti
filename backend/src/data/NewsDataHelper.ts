import { DatabaseHelper } from './DatabaseHelper.js';
import { News } from '../models/types.js';
import { existsSync, mkdirSync } from 'fs';
import { join } from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export class NewsDataHelper extends DatabaseHelper {
  private readonly filename = 'news.json';
  private readonly newsMediaDir = join(__dirname, '../../data/News_Media');

  constructor() {
    super();
    // Ensure News_Media directory exists
    if (!existsSync(this.newsMediaDir)) {
      mkdirSync(this.newsMediaDir, { recursive: true });
    }
  }

  async findAll(): Promise<News[]> {
    return this.readFile<News>(this.filename);
  }

  async findById(newsId: string): Promise<News | null> {
    const news = await this.findAll();
    return news.find(n => n.news_id === newsId) || null;
  }

  async findPublished(): Promise<News[]> {
    const news = await this.findAll();
    return news
      .filter(n => n.is_published && n.is_active && !n.is_archived)
      .sort((a, b) => {
        const dateA = new Date(a.created_at).getTime();
        const dateB = new Date(b.created_at).getTime();
        return dateB - dateA; // Newest first
      });
  }

  async findArchived(): Promise<News[]> {
    const news = await this.findAll();
    return news
      .filter(n => n.is_archived === true)
      .sort((a, b) => {
        const dateA = new Date(a.created_at).getTime();
        const dateB = new Date(b.created_at).getTime();
        return dateB - dateA; // Newest first
      });
  }

  async create(newsData: Omit<News, 'news_id' | 'created_at' | 'updated_at'>): Promise<News> {
    const news = await this.findAll();
    const now = new Date().toISOString();
    
    // Generate unique 12-digit alphanumeric news_id
    let news_id: string = '';
    let exists = true;
    while (exists) {
      news_id = this.generate12DigitAlphanumericId();
      exists = news.some(n => n.news_id === news_id);
    }
    
    const newNews: News = {
      ...newsData,
      news_id,
      created_at: now,
      updated_at: now,
    };
    
    news.push(newNews);
    await this.writeFile(this.filename, news);
    
    return newNews;
  }

  async update(newsId: string, updates: Partial<Omit<News, 'news_id' | 'created_at'>>): Promise<News | null> {
    const news = await this.findAll();
    const index = news.findIndex(n => n.news_id === newsId);
    
    if (index === -1) {
      return null;
    }
    
    news[index] = {
      ...news[index],
      ...updates,
      updated_at: new Date().toISOString(),
    };
    
    await this.writeFile(this.filename, news);
    return news[index];
  }

  async delete(newsId: string): Promise<boolean> {
    const news = await this.findAll();
    const index = news.findIndex(n => n.news_id === newsId);
    
    if (index === -1) {
      return false;
    }
    
    // Optionally delete associated media files
    const newsItem = news[index];
    if (newsItem.media_file_path) {
      // Media file deletion can be handled by controller if needed
    }
    
    news.splice(index, 1);
    await this.writeFile(this.filename, news);
    
    return true;
  }

  getNewsMediaDir(): string {
    return this.newsMediaDir;
  }
}

