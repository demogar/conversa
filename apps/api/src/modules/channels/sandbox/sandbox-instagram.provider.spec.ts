import { Logger } from '@nestjs/common';
import type { ChannelSession } from '../provider/channel-provider.js';
import { SandboxInstagramProvider, sandboxMedia } from './sandbox-instagram.provider.js';
import { SandboxOutbox, type SandboxRedis } from './sandbox-outbox.js';

/** Just enough of Redis for the outbox: lists and plain keys, in memory. */
function fakeRedis(): SandboxRedis {
  const lists = new Map<string, string[]>();
  const keys = new Map<string, string>();
  const fake = {
    lpush: async (key: string, value: string) => {
      const list = lists.get(key) ?? [];
      list.unshift(value);
      lists.set(key, list);
      return list.length;
    },
    ltrim: async (key: string, start: number, stop: number) => {
      lists.set(key, (lists.get(key) ?? []).slice(start, stop + 1));
      return 'OK';
    },
    lrange: async (key: string, start: number, stop: number) =>
      (lists.get(key) ?? []).slice(start, stop + 1),
    set: async (key: string, value: string) => {
      keys.set(key, value);
      return 'OK';
    },
    get: async (key: string) => keys.get(key) ?? null,
  };
  return fake as unknown as SandboxRedis;
}

const session: ChannelSession = {
  channelId: 'ch1',
  externalId: 'sandbox-0a1b2c3d',
  accessToken: 'token',
};

describe('SandboxInstagramProvider', () => {
  let outbox: SandboxOutbox;
  let provider: SandboxInstagramProvider;

  beforeAll(() => Logger.overrideLogger(false));

  beforeEach(() => {
    outbox = new SandboxOutbox(fakeRedis());
    provider = new SandboxInstagramProvider(outbox);
  });

  it('lists the same six posts for a channel, one a day going back', async () => {
    const now = new Date('2026-05-10T08:00:00Z');
    const media = sandboxMedia('ch1', now);
    expect(media.map((m) => m.id)).toEqual([
      'ch1-post-1',
      'ch1-post-2',
      'ch1-post-3',
      'ch1-post-4',
      'ch1-post-5',
      'ch1-post-6',
    ]);
    expect(sandboxMedia('ch1', now)).toEqual(media);
    expect(media[0]?.publishedAt).toBe('2026-05-10T12:00:00.000Z');
    expect(media[1]?.publishedAt).toBe('2026-05-09T12:00:00.000Z');
    expect(media[0]?.thumbnailUrl).toMatch(/^data:image\/svg\+xml,/);
    expect(media[0]?.permalink).toBe('https://www.instagram.com/p/SANDBOX1/');
    expect(await provider.listMedia(session, 3)).toHaveLength(3);
  });

  it('finds its own posts and still resolves unknown ids', async () => {
    expect((await provider.getMedia(session, 'ch1-post-2'))?.caption).toBe(
      sandboxMedia('ch1')[1]?.caption,
    );
    expect((await provider.getMedia(session, 'elsewhere'))?.id).toBe('elsewhere');
  });

  it('records every send in the outbox, newest first', async () => {
    await outbox.rememberCommentAuthor('c1', 'sandbox-user-ana');
    await provider.sendPrivateReply(session, 'c1', { text: 'Here is your link' });
    await provider.replyToComment(session, 'c1', 'Check your DMs');
    const sent = await provider.sendMessage(session, 'sandbox-user-bob', {
      text: 'Tap below',
      buttons: [{ type: 'postback', label: 'Send it', payload: 'cv1.d1.sig' }],
    });

    const entries = await outbox.list('ch1');
    expect(entries.map((e) => [e.kind, e.recipient, e.commentId])).toEqual([
      ['message', 'sandbox-user-bob', null],
      ['public_reply', 'sandbox-user-ana', 'c1'],
      ['private_reply', 'sandbox-user-ana', 'c1'],
    ]);
    expect(entries[0]?.id).toBe(sent.messageId);
    expect(entries[0]?.message.buttons?.[0]).toEqual({
      type: 'postback',
      label: 'Send it',
      payload: 'cv1.d1.sig',
    });
    expect(await outbox.list('other')).toEqual([]);
  });

  it('keeps only the last hundred sends', async () => {
    for (let i = 0; i < 105; i++)
      await provider.sendMessage(session, 'sandbox-user-ana', { text: `m${i}` });
    const entries = await outbox.list('ch1');
    expect(entries).toHaveLength(100);
    expect(entries[0]?.message.text).toBe('m104');
  });

  it('builds conversations from both sides, latest first', async () => {
    await outbox.recordReceived('ch1', {
      id: 'in1',
      sender: 'sandbox-user-ana',
      text: 'hola',
      timestamp: new Date(Date.now() - 1000).toISOString(),
    });
    await provider.sendMessage(session, 'sandbox-user-ana', { text: 'first' });
    await provider.sendMessage(session, 'sandbox-user-bob', { text: 'hello bob' });
    await provider.sendMessage(session, 'sandbox-user-ana', { text: 'second' });

    const conversations = await provider.listConversations(session);
    expect(conversations.map((c) => [c.participant.username, c.lastMessage])).toEqual([
      ['ana', 'second'],
      ['bob', 'hello bob'],
    ]);
    const messages = await provider.listMessages(session, 'sandbox-user-ana');
    expect(messages.map((m) => [m.text, m.fromSelf])).toEqual([
      ['hola', false],
      ['first', true],
      ['second', true],
    ]);
  });

  it('treats everyone as a follower except "nofollow" usernames', async () => {
    expect((await provider.getContactProfile(session, 'sandbox-user-ana')).follows).toBe(true);
    expect((await provider.getContactProfile(session, 'sandbox-user-ana_nofollow')).follows).toBe(
      false,
    );
  });

  it('connects a different fake account each time', async () => {
    const first = await provider.completeAuthorization();
    const second = await provider.completeAuthorization();
    expect(first.externalId).toMatch(/^sandbox-[0-9a-f]{8}$/);
    expect(first.username).toMatch(/^sandbox_[0-9a-f]{4}$/);
    expect(first.externalId).not.toBe(second.externalId);
    expect(provider.authorizationUrl('a b', 'https://example.test/cb')).toBe(
      'https://example.test/cb?code=sandbox&state=a%20b',
    );
  });
});
