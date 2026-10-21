import { instagramShortcode } from './permalink.js';

describe('instagramShortcode', () => {
  it.each([
    ['https://www.instagram.com/p/C0deX_1-a/', 'C0deX_1-a'],
    ['https://instagram.com/reel/Abc123/?igsh=xyz', 'Abc123'],
    ['https://www.instagram.com/someone/p/Zz9/', 'Zz9'],
    ['https://www.instagram.com/tv/Tv1', 'Tv1'],
  ])('reads %s', (url, code) => {
    expect(instagramShortcode(url)).toBe(code);
  });

  it('returns null for other URLs', () => {
    expect(instagramShortcode('https://example.com/p/abc')).toBeNull();
    expect(instagramShortcode('https://www.instagram.com/someone/')).toBeNull();
    expect(instagramShortcode(null)).toBeNull();
  });
});
