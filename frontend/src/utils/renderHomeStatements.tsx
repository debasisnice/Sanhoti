import type { ReactNode } from 'react';

/**
 * Split text on blank lines into blocks. A block where every line starts with "- "
 * renders as a bullet list; otherwise as a paragraph.
 */
export function renderHomeStatementBlocks(text: string, keyPrefix: string): ReactNode[] {
  const blocks = text.trim().split(/\n\n+/).filter(Boolean);
  return blocks.map((block, i) => {
    const lines = block
      .split('\n')
      .map((l) => l.trim())
      .filter(Boolean);
    const allBullets = lines.length > 0 && lines.every((l) => /^-\s+/.test(l));
    if (allBullets) {
      return (
        <ul
          key={`${keyPrefix}-ul-${i}`}
          className="list-disc pl-6 sm:pl-8 space-y-3 text-lg text-gray-700 leading-relaxed mb-6 last:mb-0"
        >
          {lines.map((line, j) => (
            <li key={j}>{line.replace(/^-\s+/, '')}</li>
          ))}
        </ul>
      );
    }
    return (
      <p
        key={`${keyPrefix}-p-${i}`}
        className="text-lg text-gray-700 leading-relaxed mb-4 last:mb-0"
      >
        {lines.join(' ')}
      </p>
    );
  });
}

export function mergeStatement(
  stored: string | undefined,
  fallback: string
): string {
  if (stored == null) return fallback;
  if (stored.trim() === '') return fallback;
  return stored;
}
