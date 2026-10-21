import { parseInstagramWebhook } from './instagram-webhook.parser.js';

const ACCOUNT = '17841400000000001';

function comment(value: Record<string, unknown>) {
  return { object: 'instagram', entry: [{ id: ACCOUNT, changes: [{ field: 'comments', value }] }] };
}

function messaging(item: Record<string, unknown>) {
  return { object: 'instagram', entry: [{ id: ACCOUNT, messaging: [item] }] };
}

describe('parseInstagramWebhook', () => {
  it('parses a comment with the media and the ad source media', () => {
    const events = parseInstagramWebhook(
      comment({
        id: 'c1',
        text: 'LINK please',
        from: { id: 'u1', username: 'ana' },
        media: { id: 'ad-media', original_media_id: 'post-media' },
      }),
    );
    expect(events).toEqual([
      {
        kind: 'comment',
        accountExternalId: ACCOUNT,
        commentId: 'c1',
        text: 'LINK please',
        author: { externalId: 'u1', username: 'ana' },
        mediaIds: ['ad-media', 'post-media'],
      },
    ]);
  });

  it("ignores the account's own comments", () => {
    expect(parseInstagramWebhook(comment({ id: 'c1', from: { id: ACCOUNT }, media: { id: 'm' } }))).toEqual([]);
  });

  it('parses direct messages and flags story replies', () => {
    const [event] = parseInstagramWebhook(
      messaging({ sender: { id: 'u1' }, message: { mid: 'm1', text: ' info ', reply_to: { story: { id: 's' } } } }),
    );
    expect(event).toMatchObject({ kind: 'message', messageId: 'm1', text: 'info', isStoryReply: true });
  });

  it('drops echoes, deletions and attachment-only messages', () => {
    expect(parseInstagramWebhook(messaging({ sender: { id: 'u1' }, message: { mid: 'm', text: 'x', is_echo: true } }))).toEqual([]);
    expect(parseInstagramWebhook(messaging({ sender: { id: 'u1' }, message: { mid: 'm', is_deleted: true } }))).toEqual([]);
    expect(parseInstagramWebhook(messaging({ sender: { id: 'u1' }, message: { mid: 'm' } }))).toEqual([]);
  });

  it('parses button postbacks and quick replies as postbacks', () => {
    expect(parseInstagramWebhook(messaging({ sender: { id: 'u1' }, postback: { payload: 'p1' } }))[0]).toMatchObject({
      kind: 'postback',
      payload: 'p1',
    });
    expect(
      parseInstagramWebhook(messaging({ sender: { id: 'u1' }, message: { mid: 'm', quick_reply: { payload: 'p2' } } }))[0],
    ).toMatchObject({ kind: 'postback', payload: 'p2' });
  });

  it('returns nothing for payloads of other objects or malformed input', () => {
    expect(parseInstagramWebhook({ object: 'page', entry: [] })).toEqual([]);
    expect(parseInstagramWebhook(null)).toEqual([]);
    expect(parseInstagramWebhook({ object: 'instagram', entry: [{ changes: 'x' }] })).toEqual([]);
  });
});
