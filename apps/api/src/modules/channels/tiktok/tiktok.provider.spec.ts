import { createHmac } from 'node:crypto';
import { AppConfig } from '../../../config/app-config.js';
import type { Env } from '../../../config/env.js';
import type { InstanceSettingsService } from '../../instance/instance-settings.service.js';
import { ProviderError } from '../provider/channel-provider.js';
import { TikTokApiClient } from './tiktok-api.client.js';
import {
  classifyTikTokCredentialsProbe,
  TikTokProvider,
  toTikTokMessages,
} from './tiktok.provider.js';

const APP = {
  appId: '7300000000000000001',
  appSecret: 'abcdef0123456789abcdef0123456789',
  authorizationUrl:
    'https://www.tiktok.com/v2/auth/authorize?client_key=7300000000000000001&scope=user.info.basic%2Cmessage.list.send&response_type=code&redirect_uri=https%3A%2F%2Fconversa.example.com%2Fapi%2Fv1%2Fchannels%2Foauth%2Ftiktok%2Fcallback%2F',
};
const SESSION = { channelId: 'ch1', externalId: 'open-1', accessToken: 'tok', username: 'shop' };

/** Stands in for Valkey: just enough for the provider's memory of sent parts. */
function memoryRedis() {
  const values = new Map<string, string>();
  return {
    get: async (key: string) => values.get(key) ?? null,
    set: async (key: string, value: string) => {
      values.set(key, value);
      return 'OK' as const;
    },
  };
}

function provider(app: typeof APP | null = APP, redis = memoryRedis()) {
  return new TikTokProvider(
    new TikTokApiClient(),
    { tiktok: app } as unknown as InstanceSettingsService,
    new AppConfig({ APP_URL: 'https://conversa.example.com' } as Env),
    redis as never,
  );
}

/** TikTok's API, answering each call with the next body in turn. */
function tiktokAnswers(...bodies: unknown[]) {
  const calls: Array<{ url: string; body: Record<string, unknown> | null }> = [];
  global.fetch = (async (url: URL | string, init?: RequestInit) => {
    calls.push({
      url: String(url),
      body:
        typeof init?.body === 'string' ? (JSON.parse(init.body) as Record<string, unknown>) : null,
    });
    const body = bodies[Math.min(calls.length - 1, bodies.length - 1)];
    return { ok: true, status: 200, text: async () => JSON.stringify(body) } as Response;
  }) as typeof fetch;
  return calls;
}

function signed(body: string, secret = APP.appSecret, t = Math.floor(Date.now() / 1000)) {
  const s = createHmac('sha256', secret).update(`${t}.${body}`).digest('hex');
  return { 'tiktok-signature': `t=${t},s=${s}` };
}

describe('TikTokProvider.verifySignature', () => {
  const body = '{"event":"im_receive_msg","content":"{}"}';

  it('accepts a body signed with the app secret', () => {
    expect(provider().verifySignature(Buffer.from(body), signed(body))).toBe(true);
  });

  it('refuses a wrong secret, a changed body, a stale timestamp or no header', () => {
    const p = provider();
    expect(p.verifySignature(Buffer.from(body), signed(body, 'other-secret'))).toBe(false);
    expect(p.verifySignature(Buffer.from(`${body} `), signed(body))).toBe(false);
    const stale = Math.floor(Date.now() / 1000) - 3600;
    expect(p.verifySignature(Buffer.from(body), signed(body, APP.appSecret, stale))).toBe(false);
    expect(p.verifySignature(Buffer.from(body), {})).toBe(false);
    expect(p.verifySignature(Buffer.from(body), { 'tiktok-signature': 'garbage' })).toBe(false);
  });

  it('refuses everything while the app is not configured', () => {
    expect(provider(null).verifySignature(Buffer.from(body), signed(body))).toBe(false);
  });
});

describe('toTikTokMessages', () => {
  it('writes link buttons under the text, since TikTok has none', () => {
    expect(
      toTikTokMessages({
        text: 'Here you go',
        buttons: [{ type: 'url', label: 'Guide', url: 'https://conversa.example.com/l/abc' }],
      }),
    ).toEqual([
      {
        message_type: 'TEXT',
        text: { body: 'Here you go\n\nGuide: https://conversa.example.com/l/abc' },
      },
    ]);
  });

  it('sends a short text with a tap button as one Q&A card', () => {
    expect(
      toTikTokMessages({
        text: 'Want the guide?',
        buttons: [{ type: 'postback', label: 'Send it', payload: 'c1.id.sig' }],
      }),
    ).toEqual([
      {
        message_type: 'TEMPLATE',
        template: {
          type: 'QA_BUTTON_CARD',
          title: 'Want the guide?',
          buttons: [{ type: 'REPLY', title: 'Send it', id: 'c1.id.sig' }],
        },
      },
    ]);
  });

  it('sends a longer text first, then the card titled with its button', () => {
    const messages = toTikTokMessages({
      text: 'Follow us first, then tap the button below and the guide is yours.',
      buttons: [{ type: 'postback', label: 'I follow you', payload: 'p' }],
    });
    expect(messages).toHaveLength(2);
    expect(messages[0]).toMatchObject({ message_type: 'TEXT' });
    expect(messages[1]).toMatchObject({
      message_type: 'TEMPLATE',
      template: { title: 'I follow you', buttons: [{ id: 'p', title: 'I follow you' }] },
    });
  });
});

describe('classifyTikTokCredentialsProbe', () => {
  it('reads complaints about the code as valid credentials and about the app as invalid', () => {
    expect(classifyTikTokCredentialsProbe('Auth code is invalid.')).toBe('valid');
    expect(classifyTikTokCredentialsProbe('Authorization code is expired.')).toBe('valid');
    expect(classifyTikTokCredentialsProbe('App ID or secret is incorrect')).toBe('invalid');
    expect(classifyTikTokCredentialsProbe('Invalid client_secret')).toBe('invalid');
    expect(classifyTikTokCredentialsProbe('Something else')).toBe('unknown');
  });
});

describe('TikTokProvider', () => {
  it('adds the state to the authorization URL TikTok generated, and asks for a code every time', () => {
    const url = new URL(provider().authorizationUrl('signed-state'));
    expect(url.origin + url.pathname).toBe('https://www.tiktok.com/v2/auth/authorize');
    expect(url.searchParams.get('client_key')).toBe(APP.appId);
    expect(url.searchParams.get('state')).toBe('signed-state');
    expect(url.searchParams.get('disable_auto_auth')).toBe('1');
  });

  it('exchanges the code and reads the profile', async () => {
    const calls = tiktokAnswers(
      {
        code: 0,
        data: {
          access_token: 'act',
          refresh_token: 'rft',
          open_id: 'open-1',
          expires_in: 86400,
          refresh_token_expires_in: 31536000,
        },
      },
      {
        code: 0,
        data: {
          username: 'shop',
          display_name: 'The Shop',
          profile_image: 'https://p16.example.com/a.jpg',
        },
      },
    );
    const account = await provider().completeAuthorization('the-code', 'https://r.example.com/');
    expect(calls[0]?.url).toContain('/tt_user/oauth2/token/');
    expect(calls[0]?.body).toMatchObject({
      client_id: APP.appId,
      client_secret: APP.appSecret,
      grant_type: 'authorization_code',
      auth_code: 'the-code',
      redirect_uri: 'https://r.example.com/',
    });
    expect(new URL(calls[1]!.url).searchParams.get('business_id')).toBe('open-1');
    expect(account).toMatchObject({
      externalId: 'open-1',
      username: 'shop',
      displayName: 'The Shop',
      accessToken: 'act',
      refreshToken: 'rft',
    });
    expect(account.tokenExpiresAt!.getTime()).toBeGreaterThan(Date.now());
  });

  it('refreshes with the refresh token, and needs one', async () => {
    const calls = tiktokAnswers({
      code: 0,
      data: { access_token: 'new', refresh_token: 'rft2', open_id: 'open-1', expires_in: 86400 },
    });
    await expect(
      provider().refreshCredentials({ accessToken: 'old', refreshToken: 'rft' }),
    ).resolves.toMatchObject({ accessToken: 'new', refreshToken: 'rft2' });
    expect(calls[0]?.body).toMatchObject({ grant_type: 'refresh_token', refresh_token: 'rft' });

    const error = await provider()
      .refreshCredentials({ accessToken: 'old' })
      .catch((e: unknown) => e);
    expect((error as ProviderError).kind).toBe('auth');
  });

  it('registers the app webhook for direct messages at this installation', async () => {
    const calls = tiktokAnswers({ code: 0, data: {} });
    await provider().subscribeWebhooks();
    expect(calls[0]?.body).toEqual({
      app_id: APP.appId,
      secret: APP.appSecret,
      event_type: 'DIRECT_MESSAGE',
      callback_url: 'https://conversa.example.com/api/v1/webhooks/tiktok',
    });
  });

  it('sends to the conversation and returns the last message id', async () => {
    const calls = tiktokAnswers({ code: 0, data: { message: { message_id: 'm9' } } });
    const result = await provider().sendMessage(SESSION, 'conv-1', { text: 'Hi' });
    expect(calls[0]?.body).toEqual({
      business_id: 'open-1',
      recipient_type: 'CONVERSATION',
      recipient: 'conv-1',
      message_type: 'TEXT',
      text: { body: 'Hi' },
    });
    expect(result).toEqual({ messageId: 'm9' });
  });

  it('does not send the text again when a retry follows a failed card', async () => {
    const p = provider();
    const gate = {
      text: 'Follow us first, then tap the button below and the list is yours.',
      buttons: [{ type: 'postback' as const, label: 'I follow', payload: 'c1.id.sig' }],
    };
    // The text goes out, then TikTok throttles the card.
    let calls = tiktokAnswers(
      { code: 0, data: { message: { message_id: 'text-1' } } },
      { code: 40100, message: 'Requests made too frequently' },
    );
    const error = await p
      .sendMessage(SESSION, 'conv-1', gate, { idempotencyKey: 'd1:start' })
      .catch((e: unknown) => e);
    expect((error as ProviderError).kind).toBe('rate_limit');
    expect(calls).toHaveLength(2);

    // The retry sends only the card.
    calls = tiktokAnswers({ code: 0, data: { message: { message_id: 'card-1' } } });
    await expect(
      p.sendMessage(SESSION, 'conv-1', gate, { idempotencyKey: 'd1:start' }),
    ).resolves.toEqual({ messageId: 'card-1' });
    expect(calls).toHaveLength(1);
    expect(calls[0]?.body).toMatchObject({ message_type: 'TEMPLATE' });

    // Another step (a new follow prompt) sends both again.
    calls = tiktokAnswers({ code: 0, data: { message: { message_id: 'm' } } });
    await p.sendMessage(SESSION, 'conv-1', gate, { idempotencyKey: 'd1:prompt:0' });
    expect(calls).toHaveLength(2);
  });

  it('turns a blocked message into window_closed', async () => {
    tiktokAnswers({ code: 40064, message: 'The message is blocked' });
    const error = await provider()
      .sendMessage(SESSION, 'conv-1', { text: 'Hi' })
      .catch((e: unknown) => e);
    expect((error as ProviderError).kind).toBe('window_closed');
  });

  it('refuses what TikTok cannot do', async () => {
    for (const call of [() => provider().sendPrivateReply(), () => provider().replyToComment()]) {
      const error = await call().catch((e: unknown) => e);
      expect(error).toBeInstanceOf(ProviderError);
      expect((error as ProviderError).kind).toBe('rejected');
    }
    await expect(provider().getContactProfile()).resolves.toEqual({
      username: null,
      follows: null,
    });
  });

  it('lists messages oldest first and knows its own', async () => {
    tiktokAnswers({
      code: 0,
      data: {
        messages: [
          {
            message_id: 'b',
            sender: 'shop',
            timestamp: 2000,
            message_type: 'TEXT',
            text: { body: 'Hello!' },
          },
          {
            message_id: 'a',
            sender: 'ana',
            timestamp: 1000,
            message_type: 'TEXT',
            text: { body: 'PRICE' },
          },
        ],
      },
    });
    await expect(provider().listMessages(SESSION, 'conv-1')).resolves.toEqual([
      { id: 'a', text: 'PRICE', fromSelf: false, createdAt: new Date(1000).toISOString() },
      { id: 'b', text: 'Hello!', fromSelf: true, createdAt: new Date(2000).toISOString() },
    ]);
  });

  it('maps videos to media', async () => {
    tiktokAnswers({
      code: 0,
      data: {
        videos: [
          {
            item_id: '7203946942097902849',
            caption: 'New drop',
            create_time: '1700000000',
            thumbnail_url: 'https://p16.example.com/t.jpg',
            share_url: 'https://www.tiktok.com/@shop/video/7203946942097902849',
          },
        ],
      },
    });
    await expect(provider().listMedia(SESSION, 50)).resolves.toEqual([
      {
        id: '7203946942097902849',
        caption: 'New drop',
        mediaType: 'VIDEO',
        thumbnailUrl: 'https://p16.example.com/t.jpg',
        permalink: 'https://www.tiktok.com/@shop/video/7203946942097902849',
        publishedAt: new Date(1_700_000_000_000).toISOString(),
        commentsCount: null,
      },
    ]);
  });
});
