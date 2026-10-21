import { parseInstagramWebhook } from '../instagram/instagram-webhook.parser.js';
import {
  buildCommentPayload,
  buildMessagePayload,
  buildPostbackPayload,
  sandboxUserId,
  sandboxUsername,
} from './sandbox-events.js';

const ACCOUNT = 'sandbox-0a1b2c3d';

describe('sandbox events', () => {
  it('maps the same username to the same contact', () => {
    expect(sandboxUserId('Ana.Lopez')).toBe(sandboxUserId('ana.lopez'));
    expect(sandboxUsername(sandboxUserId('ana'))).toBe('ana');
    expect(sandboxUsername('17841400000000001')).toBeNull();
  });

  it('builds a comment the Instagram parser understands', () => {
    const payload = buildCommentPayload({
      accountId: ACCOUNT,
      commentId: 'c1',
      username: 'ana',
      text: 'LINK please',
      mediaId: 'post-1',
    });
    expect(parseInstagramWebhook(payload)).toEqual([
      {
        kind: 'comment',
        accountExternalId: ACCOUNT,
        commentId: 'c1',
        text: 'LINK please',
        author: { externalId: sandboxUserId('ana'), username: 'ana' },
        mediaIds: ['post-1'],
      },
    ]);
  });

  it('builds a direct message the Instagram parser understands', () => {
    const payload = buildMessagePayload({ accountId: ACCOUNT, messageId: 'm1', username: 'ana', text: 'hi' });
    expect(parseInstagramWebhook(payload)).toEqual([
      {
        kind: 'message',
        accountExternalId: ACCOUNT,
        messageId: 'm1',
        text: 'hi',
        sender: { externalId: sandboxUserId('ana') },
        isStoryReply: false,
      },
    ]);
  });

  it('builds a button tap the Instagram parser understands', () => {
    const payload = buildPostbackPayload({ accountId: ACCOUNT, senderId: 'sandbox-user-ana', payload: 'cv1.d1.sig' });
    expect(parseInstagramWebhook(payload)).toEqual([
      { kind: 'postback', accountExternalId: ACCOUNT, sender: { externalId: 'sandbox-user-ana' }, payload: 'cv1.d1.sig' },
    ]);
  });
});
