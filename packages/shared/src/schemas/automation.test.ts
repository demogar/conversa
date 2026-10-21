import { createAutomationSchema } from './automation.js';

const base = {
  name: 'Send the guide',
  channelId: 'ch_1',
  triggerType: 'COMMENT',
  keywords: ['guide'],
  response: { message: { text: 'Here it is {username}' } },
};

describe('createAutomationSchema', () => {
  it('fills defaults for a minimal comment automation', () => {
    const parsed = createAutomationSchema.parse(base);
    expect(parsed.postScope).toBe('ANY');
    expect(parsed.status).toBe('DRAFT');
    expect(parsed.response.opening.enabled).toBe(false);
  });

  it('requires keywords in keyword mode', () => {
    const result = createAutomationSchema.safeParse({ ...base, keywords: [] });
    expect(result.success).toBe(false);
    expect(result.error?.issues[0]?.message).toBe('keywords_required');
  });

  it('requires posts when the scope is specific', () => {
    const result = createAutomationSchema.safeParse({ ...base, postScope: 'SPECIFIC' });
    expect(result.error?.issues.map((i) => i.path.join('.'))).toContain('mediaIds');
  });

  it('rejects public replies on message triggers', () => {
    const result = createAutomationSchema.safeParse({
      ...base,
      triggerType: 'MESSAGE',
      response: { ...base.response, publicReply: { enabled: true, variants: ['Sent!'] } },
    });
    expect(result.success).toBe(false);
  });

  it('rejects non-http button links', () => {
    const result = createAutomationSchema.safeParse({
      ...base,
      response: {
        message: { text: 'x', buttons: [{ label: 'Open', url: 'javascript:alert(1)' }] },
      },
    });
    expect(result.success).toBe(false);
  });

  it('requires the text and label of an enabled gate', () => {
    const result = createAutomationSchema.safeParse({
      ...base,
      response: { ...base.response, followGate: { enabled: true } },
    });
    expect(result.error?.issues.map((i) => i.path.join('.'))).toEqual(
      expect.arrayContaining(['response.followGate.text', 'response.followGate.buttonLabel']),
    );
  });
});
