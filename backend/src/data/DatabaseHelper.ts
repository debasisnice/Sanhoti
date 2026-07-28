import { readFileSync, writeFileSync, existsSync, mkdirSync, renameSync, unlinkSync } from 'fs';
import { join, resolve } from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import { randomInt } from 'crypto';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export class DatabaseHelper {
  private dataDir: string;

  constructor() {
    // `SANHOTI_DATA_DIR` lets the test suite point storage at a throwaway copy.
    // Without it, running the tests writes to the real backend/data — creating
    // events, registering users and saving seat maps into live files. Unset in
    // normal operation, so production behaviour is unchanged.
    //
    // The guard below is not paranoia: a `vitest` watcher left running from
    // before this isolation existed re-ran the suite on file save and wrote 8
    // events and 8 user accounts into the live data. Because backend/data/*.json
    // is gitignored, nothing flagged it. Failing loudly beats corrupting records
    // silently, so under a test runner the override is mandatory.
    if (process.env.VITEST && !process.env.SANHOTI_DATA_DIR) {
      throw new Error(
        'Refusing to use the real data directory under a test runner. ' +
          'SANHOTI_DATA_DIR is unset — check that vitest.config.ts is loaded and ' +
          'src/tests/setup.ts ran. If a watcher is running, restart it so it picks ' +
          'up the config.'
      );
    }

    this.dataDir = process.env.SANHOTI_DATA_DIR
      ? resolve(process.env.SANHOTI_DATA_DIR)
      : join(__dirname, '../../data');
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
