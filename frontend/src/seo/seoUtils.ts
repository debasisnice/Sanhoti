/** Strip HTML and collapse whitespace for meta descriptions. */
export function seoPlainText(htmlOrText: string | undefined | null, maxLen = 165): string {
  if (!htmlOrText) return '';
  const t = htmlOrText
    .replace(/<[^>]*>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  if (t.length <= maxLen) return t;
  return `${t.slice(0, maxLen - 1).trimEnd()}…`;
}
