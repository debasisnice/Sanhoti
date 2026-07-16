import { readFileSync, writeFileSync, existsSync, mkdirSync, renameSync, unlinkSync } from 'fs';
import { join } from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import { randomInt } from 'crypto';

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
    const content = readFileSync(filePath, 'utf-8');
    // An empty/whitespace-only file is treated as "no records yet".
    if (content.trim() === '') {
      return [];
    }
    try {
      return JSON.parse(content) as T[];
    } catch (error) {
      // Never silently return [] on a corrupt file: the caller would then write
      // that empty array back and permanently destroy the data. Preserve the bad
      // file for recovery and fail loudly instead.
      try {
        writeFileSync(`${filePath}.corrupt-${Date.now()}`, content, 'utf-8');
      } catch {
        /* best-effort backup only */
      }
      console.error(`Corrupt JSON in ${filename}:`, error);
      throw new Error(`Data file ${filename} is corrupt and was not overwritten`);
    }
  }

  protected dataFileExists(filename: string): boolean {
    return existsSync(join(this.dataDir, filename));
  }

  protected writeFile<T>(filename: string, data: T[]): void {
    const filePath = join(this.dataDir, filename);
    // Write to a temp file then atomically rename, so a crash mid-write can never
    // leave a truncated/corrupt data file (rename is atomic on the same volume).
    const tmpPath = `${filePath}.tmp-${process.pid}-${Date.now()}`;
    try {
      writeFileSync(tmpPath, JSON.stringify(data, null, 2), 'utf-8');
      renameSync(tmpPath, filePath);
    } catch (error) {
      try {
        if (existsSync(tmpPath)) unlinkSync(tmpPath);
      } catch {
        /* ignore cleanup failure */
      }
      console.error(`Error writing ${filename}:`, error);
      throw error;
    }
  }

  protected generateId(): string {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  protected generate12DigitAlphanumericId(): string {
    // crypto.randomInt gives unbiased, unpredictable values — important because
    // this also mints admission-QR tokens used as an entry credential.
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let id = '';
    for (let i = 0; i < 12; i++) {
      id += chars.charAt(randomInt(chars.length));
    }
    return id;
  }
}
