import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { join } from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export class DatabaseHelper {
  private dataDir: string;

  constructor() {
    this.dataDir = join(__dirname, '../../data');
    this.ensureDataDir();
  }

  private ensureDataDir(): void {
    if (!existsSync(this.dataDir)) {
      mkdirSync(this.dataDir, { recursive: true });
    }
  }

  protected readFile<T>(filename: string): T[] {
    const filePath = join(this.dataDir, filename);
    if (!existsSync(filePath)) {
      return [];
    }
    try {
      const content = readFileSync(filePath, 'utf-8');
      return JSON.parse(content) as T[];
    } catch (error) {
      console.error(`Error reading ${filename}:`, error);
      return [];
    }
  }

  protected writeFile<T>(filename: string, data: T[]): void {
    const filePath = join(this.dataDir, filename);
    try {
      writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf-8');
    } catch (error) {
      console.error(`Error writing ${filename}:`, error);
      throw error;
    }
  }

  protected generateId(): string {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  protected generate12DigitAlphanumericId(): string {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let id = '';
    for (let i = 0; i < 12; i++) {
      id += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return id;
  }
}

