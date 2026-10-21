import en from '../../messages/en';
import es from '../../messages/es';

function keys(tree: unknown, prefix = ''): string[] {
  if (Array.isArray(tree)) return [prefix];
  if (tree && typeof tree === 'object') {
    return Object.entries(tree).flatMap(([key, value]) =>
      keys(value, prefix ? `${prefix}.${key}` : key),
    );
  }
  return [prefix];
}

describe('messages', () => {
  it('has the same keys in Spanish as in English', () => {
    expect(keys(es).sort()).toEqual(keys(en).sort());
  });

  it('keeps every placeholder of the English text', () => {
    const placeholders = (text: unknown) =>
      [...String(text).matchAll(/\{(\w+)\s*[,}]/g)].map((m) => m[1]).sort();
    const lookup = (tree: unknown, path: string) =>
      path
        .split('.')
        .reduce<unknown>((node, key) => (node as Record<string, unknown>)?.[key], tree);
    for (const path of keys(en)) {
      expect([path, placeholders(lookup(es, path))]).toEqual([
        path,
        placeholders(lookup(en, path)),
      ]);
    }
  });
});
