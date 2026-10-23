/** Integers with more digits than this may not survive a JavaScript number. */
const SAFE_DIGITS = 15;

/**
 * JSON.parse that keeps long integers exact by reading them as strings.
 * TikTok sends some ids (comment and video ids in webhooks) as bare numbers
 * above 2^53, which JSON.parse would round. Text inside strings is never
 * touched.
 */
export function parseJsonKeepingIds(text: string): unknown {
  let out = '';
  let inString = false;
  let index = 0;
  while (index < text.length) {
    const char = text[index]!;
    if (inString) {
      out += char;
      if (char === '\\') {
        out += text[index + 1] ?? '';
        index += 2;
        continue;
      }
      if (char === '"') inString = false;
      index += 1;
      continue;
    }
    if (char === '"') {
      inString = true;
      out += char;
      index += 1;
      continue;
    }
    if (char === '-' || (char >= '0' && char <= '9')) {
      const match = /^-?\d+(\.\d+)?([eE][+-]?\d+)?/.exec(text.slice(index));
      const number = match?.[0] ?? char;
      const digits = number.replace(/^-/, '');
      out += /^\d+$/.test(digits) && digits.length > SAFE_DIGITS ? `"${number}"` : number;
      index += number.length;
      continue;
    }
    out += char;
    index += 1;
  }
  return JSON.parse(out);
}
