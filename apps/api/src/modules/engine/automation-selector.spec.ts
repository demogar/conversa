import { type CandidateAutomation, selectAutomation } from './automation-selector.js';

function automation(overrides: Partial<CandidateAutomation> & { id: string }): CandidateAutomation {
  return {
    postScope: 'ANY',
    mediaIds: [],
    scopeResolvedAt: null,
    matchMode: 'KEYWORDS',
    keywords: ['link'],
    wholeWord: true,
    createdAt: new Date('2026-01-01'),
    ...overrides,
  };
}

describe('selectAutomation', () => {
  it('returns null when nothing matches', () => {
    expect(selectAutomation([automation({ id: 'a' })], { text: 'hello', mediaIds: ['m1'] })).toBeNull();
  });

  it('prefers an automation bound to the post over one for every post', () => {
    const any = automation({ id: 'any', createdAt: new Date('2026-06-01') });
    const specific = automation({ id: 'specific', postScope: 'SPECIFIC', mediaIds: ['m1'] });
    expect(selectAutomation([any, specific], { text: 'LINK', mediaIds: ['m1'] })?.automation.id).toBe('specific');
  });

  it('skips automations bound to other posts', () => {
    const other = automation({ id: 'other', postScope: 'SPECIFIC', mediaIds: ['m2'] });
    expect(selectAutomation([other], { text: 'link', mediaIds: ['m1'] })).toBeNull();
  });

  it('matches an ad comment through the original post id', () => {
    const specific = automation({ id: 's', postScope: 'SPECIFIC', mediaIds: ['organic'] });
    expect(selectAutomation([specific], { text: 'link', mediaIds: ['ad', 'organic'] })?.automation.id).toBe('s');
  });

  it('prefers a keyword match over a catch-all at the same scope', () => {
    const catchAll = automation({ id: 'all', matchMode: 'ANYTHING', createdAt: new Date('2026-06-01') });
    const keyword = automation({ id: 'kw' });
    const selection = selectAutomation([catchAll, keyword], { text: 'send the link', mediaIds: ['m1'] });
    expect(selection).toEqual({ automation: keyword, matchedKeyword: 'link' });
  });

  it('breaks ties with the newest automation', () => {
    const older = automation({ id: 'old' });
    const newer = automation({ id: 'new', createdAt: new Date('2026-03-01') });
    expect(selectAutomation([older, newer], { text: 'link' })?.automation.id).toBe('new');
  });

  it('ignores post scope for direct messages', () => {
    const specific = automation({ id: 's', postScope: 'SPECIFIC', mediaIds: ['m1'] });
    expect(selectAutomation([specific], { text: 'link' })?.automation.id).toBe('s');
  });
});
