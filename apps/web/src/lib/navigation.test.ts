import { safeNextPath } from './navigation';

describe('safeNextPath', () => {
  it('keeps same-site paths with their query and hash', () => {
    expect(safeNextPath('/w/abc/automations?tab=active#top')).toBe(
      '/w/abc/automations?tab=active#top',
    );
  });

  it.each([
    null,
    '',
    'https://evil.example/',
    'evil.example',
    'javascript:alert(1)',
    '//evil.example',
    '/\\evil.example',
    '/\t/evil.example',
    '/\n/evil.example',
    '/\t\\evil.example',
  ])('falls back for %j', (value) => {
    expect(safeNextPath(value)).toBe('/');
    expect(safeNextPath(value, '/account')).toBe('/account');
  });
});
