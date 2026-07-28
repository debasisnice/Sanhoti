import { join, resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

/** The real data directory, used whenever no override is set. */
const DEFAULT_DATA_DIR = join(__dirname, '../../data');

/**
 * Root directory for stored data.
 *
 * `SANHOTI_DATA_DIR` redirects it, which is how the test suite avoids writing to
 * the real `backend/data`. Unset in normal operation, so production is
 * unaffected. Keep in step with `DatabaseHelper`, which applies the same rule to
 * the JSON records.
 */
export function dataRoot(): string {
  return process.env.SANHOTI_DATA_DIR
    ? resolve(process.env.SANHOTI_DATA_DIR)
    : DEFAULT_DATA_DIR;
}

/**
 * Directory for an uploaded-asset category, e.g. `assetDir('Events_Flyers')`.
 *
 * These folders are created and, on delete, removed recursively. Without the
 * override a test that creates and deletes an event would be doing that inside
 * the real uploads tree.
 */
export function assetDir(category: string): string {
  return join(dataRoot(), category);
}
