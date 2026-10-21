import { matchKeywords, normalizeText } from './keywords.js';

describe('normalizeText', () => {
  it('folds case, Latin accents, emoji and punctuation', () => {
    expect(normalizeText('¡PRECIÓ!! 🙏 ya')).toBe('precio ya');
  });

  it('keeps marks that change the word outside the Latin script', () => {
    expect(normalizeText('किताब')).toBe('किताब');
  });
});

describe('matchKeywords', () => {
  it('matches a keyword regardless of case and accents', () => {
    expect(matchKeywords('Quiero el PRECIO por favor', ['precío'])).toEqual({
      matched: true,
      keyword: 'precío',
    });
  });

  it('requires a whole word by default', () => {
    expect(matchKeywords('information please', ['info']).matched).toBe(false);
    expect(matchKeywords('info please', ['info']).matched).toBe(true);
  });

  it('allows partial matches when whole-word matching is off', () => {
    expect(matchKeywords('information please', ['info'], false).matched).toBe(true);
  });

  it('matches multi-word keywords across punctuation', () => {
    expect(matchKeywords('More... info!', ['more info']).matched).toBe(true);
  });

  it('returns the first configured keyword that matches', () => {
    expect(matchKeywords('send link and price', ['price', 'link']).keyword).toBe('price');
  });

  it('never matches empty text or empty keywords', () => {
    expect(matchKeywords('🔥🔥', ['link']).matched).toBe(false);
    expect(matchKeywords('link', ['  ', '!!']).matched).toBe(false);
  });

  it('treats regex characters in keywords literally', () => {
    expect(matchKeywords('a+b', ['a+b'], false).matched).toBe(true);
    expect(matchKeywords('aab', ['a+b'], false).matched).toBe(false);
  });
});
