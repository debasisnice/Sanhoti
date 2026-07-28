import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // Runs before each test file, redirecting DatabaseHelper at a temp copy of
    // backend/data so the suite cannot write to real records. See setup.ts.
    setupFiles: ['./src/tests/setup.ts'],
    // Each file gets its own process and therefore its own temp data dir, so
    // two suites writing the same JSON file cannot clobber each other.
    pool: 'forks',
  },
});
