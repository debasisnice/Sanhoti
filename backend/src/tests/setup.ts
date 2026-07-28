import { mkdtempSync, mkdirSync, copyFileSync, readdirSync, existsSync, rmSync } from 'fs';
import { join, dirname } from 'path';
import { tmpdir } from 'os';
import { fileURLToPath } from 'url';
import { afterAll } from 'vitest';

const __dirname = dirname(fileURLToPath(import.meta.url));
const realDataDir = join(__dirname, '../../data');

/**
 * Point every test at a throwaway copy of the data directory.
 *
 * `DatabaseHelper` writes JSON straight to `backend/data`, and several suites
 * call `createEvent`, `register`, `saveMapTemplate` and `deleteBooking`. Before
 * this, running `npm test` silently mutated the real event and user records —
 * and because `backend/data/*.json` is gitignored, git would never show it.
 *
 * Only the JSON is copied (2.5 MB); the uploaded images alongside it are 343 MB
 * and no test reads them.
 */
const testDataDir = mkdtempSync(join(tmpdir(), 'sanhoti-test-data-'));

if (existsSync(realDataDir)) {
  for (const file of readdirSync(realDataDir)) {
    if (file.endsWith('.json')) {
      copyFileSync(join(realDataDir, file), join(testDataDir, file));
    }
  }
}

// Directories some helpers create on construction; making them up front avoids
// each helper racing to mkdir the same path.
for (const sub of ['Artists', 'Blogs', 'Events_Flyers', 'Notice_Flyers', 'Galleries']) {
  mkdirSync(join(testDataDir, sub), { recursive: true });
}

process.env.SANHOTI_DATA_DIR = testDataDir;

afterAll(() => {
  try {
    rmSync(testDataDir, { recursive: true, force: true });
  } catch {
    /* best-effort cleanup — the OS clears tmp anyway */
  }
});
