import { parseTikTokWebhook } from './tiktok-webhook.parser.js';

const ACCOUNT = '-000Abc1DeFgHiJ2kLmNoP3qRsTuVwXyZ';
const CONVERSATION = 'a1AbcBdeCfghDijkEF2b3+lmGn==';

/** TikTok's envelope: the event's details are a JSON document inside a string. */
function webhook(content: Record<string, unknown> | string, event = 'im_receive_msg') {
  return {
    client_key: 'aw1234',
    event,
    create_time: 1701090880,
    user_openid: ACCOUNT,
    content: typeof content === 'string' ? content : JSON.stringify(content),
  };
}

function received(overrides: Record<string, unknown> = {}) {
  return {
    from: 'ana.lopez',
    to: 'shop',
    unique_identifier: '+ABc1D2/E0fGhijklMNOrD34vDW',
    from_user: { id: '+ABc1D2/E0fGhijklMNOrD34vDW', role: 'personal_account' },
    to_user: { id: ACCOUNT, role: 'business_account' },
    conversation_id: CONVERSATION,
    message_id: 'm1AbcdefBCghDE2iFGjk3HIJ4l==',
    timestamp: 1701090879815,
    type: 'text',
    text: { body: '  PRICE please ' },
    scene_type: 0,
    is_follower: true,
    message_tag: { source: 'APP' },
    ...overrides,
  };
}

describe('parseTikTokWebhook', () => {
  it('parses a direct message, keyed by its conversation', () => {
    expect(parseTikTokWebhook(webhook(received()))).toEqual([
      {
        kind: 'message',
        accountExternalId: ACCOUNT,
        messageId: 'm1AbcdefBCghDE2iFGjk3HIJ4l==',
        text: 'PRICE please',
        sender: { externalId: CONVERSATION, username: 'ana.lopez', follows: true },
        isStoryReply: false,
      },
    ]);
  });

  it('reads a tap on a Q&A card button as a postback with the button id', () => {
    const events = parseTikTokWebhook(
      webhook(
        received({
          text: { body: 'Send it' },
          is_follower: false,
          reply_source_payload: { reply_source_msg_id: 'm2', reply_source_unique_id: 'c1.abc.sig' },
        }),
      ),
    );
    expect(events).toEqual([
      {
        kind: 'postback',
        accountExternalId: ACCOUNT,
        sender: { externalId: CONVERSATION, username: 'ana.lopez', follows: false },
        payload: 'c1.abc.sig',
      },
    ]);
  });

  it("drops the account's own messages, sent from TikTok or through the API", () => {
    expect(
      parseTikTokWebhook(
        webhook(received({ from_user: { id: ACCOUNT, role: 'business_account' } })),
      ),
    ).toEqual([]);
    expect(parseTikTokWebhook(webhook(received({ message_tag: { source: 'API' } })))).toEqual([]);
    expect(parseTikTokWebhook(webhook(received(), 'im_send_msg'))).toEqual([]);
  });

  it('ignores other events and messages without text', () => {
    expect(parseTikTokWebhook(webhook(received(), 'im_mark_read_msg'))).toEqual([]);
    expect(parseTikTokWebhook(webhook(received(), 'comment.update'))).toEqual([]);
    expect(
      parseTikTokWebhook(
        webhook(received({ type: 'image', text: undefined, image: { media_id: 'x' } })),
      ),
    ).toEqual([]);
    expect(parseTikTokWebhook(webhook(received({ text: { body: '   ' } })))).toEqual([]);
  });

  it('falls back to the receiving account in the content when the envelope has no open id', () => {
    const payload = { ...webhook(received()), user_openid: undefined };
    expect(parseTikTokWebhook(payload)[0]?.accountExternalId).toBe(ACCOUNT);
  });

  it('bounds what it keeps', () => {
    const [event] = parseTikTokWebhook(webhook(received({ text: { body: 'x'.repeat(10_000) } })));
    expect(event?.kind === 'message' && event.text.length).toBe(2_200);
    expect(parseTikTokWebhook(webhook(received({ conversation_id: 'c'.repeat(300) })))).toEqual([]);
    const [long] = parseTikTokWebhook(webhook(received({ from: 'u'.repeat(200) })));
    expect(long?.kind === 'message' && long.sender.username?.length).toBe(64);
  });

  it('never throws on malformed input', () => {
    for (const input of [
      null,
      undefined,
      42,
      'im_receive_msg',
      [],
      {},
      { event: 'im_receive_msg' },
      { event: 'im_receive_msg', user_openid: ACCOUNT, content: '{not json' },
      { event: 'im_receive_msg', user_openid: ACCOUNT, content: '"a string"' },
      { event: 'im_receive_msg', user_openid: ACCOUNT, content: { conversation_id: 5 } },
      webhook(received({ conversation_id: null, message_id: 7 })),
    ]) {
      expect(parseTikTokWebhook(input)).toEqual([]);
    }
  });
});
