import { basename } from 'path';

/**
 * Sanitize a user-supplied filename before joining it into a served directory.
 * Served folders are flat (one file per entity), so `basename` returns a
 * legitimate filename unchanged while stripping any directory/traversal
 * components — e.g. a request-encoded "..%2f..%2fetc%2fpasswd" decodes to
 * "../../etc/passwd" and is reduced to "passwd" (which won't exist → 404).
 */
export function safeServedFilename(name: string): string {
  return basename(String(name ?? ''));
}
