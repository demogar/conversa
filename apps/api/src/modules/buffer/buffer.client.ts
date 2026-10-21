import { Injectable, Logger } from '@nestjs/common';

const ENDPOINT = 'https://api.buffer.com';
const TIMEOUT_MS = 15_000;

export type BufferErrorKind = 'unauthorized' | 'rate_limited' | 'not_found' | 'unavailable';

export class BufferError extends Error {
  constructor(
    readonly kind: BufferErrorKind,
    message: string,
  ) {
    super(message);
    this.name = 'BufferError';
  }
}

export interface BufferOrganization {
  id: string;
  name: string;
}

export interface BufferChannel {
  id: string;
  name: string;
  displayName: string | null;
  service: string;
  avatar: string | null;
  isDisconnected: boolean;
}

export interface BufferPost {
  id: string;
  channelId: string;
  text: string;
  status: string;
  dueAt: string | null;
  sentAt: string | null;
  externalLink: string | null;
  assets: Array<{ thumbnail: string | null }>;
}

const POST_FIELDS = `id channelId text status dueAt sentAt externalLink assets { thumbnail }`;

/**
 * Read-only client for Buffer's GraphQL API, authenticated with a personal
 * API key. GraphQL answers 200 even on failure, so errors are read from the
 * body's `errors` array.
 */
@Injectable()
export class BufferClient {
  private readonly logger = new Logger(BufferClient.name);

  async organizations(apiKey: string): Promise<BufferOrganization[]> {
    const data = await this.query<{ account: { organizations: BufferOrganization[] } }>(
      apiKey,
      `query { account { organizations { id name } } }`,
    );
    return data.account.organizations;
  }

  async channels(apiKey: string, organizationId: string): Promise<BufferChannel[]> {
    const data = await this.query<{ channels: BufferChannel[] }>(
      apiKey,
      `query Channels($organizationId: OrganizationId!) {
        channels(input: { organizationId: $organizationId }) { id name displayName service avatar isDisconnected }
      }`,
      { organizationId },
    );
    return data.channels;
  }

  async posts(
    apiKey: string,
    organizationId: string,
    filter: { status: string[]; channelIds: string[] },
    first = 50,
  ): Promise<BufferPost[]> {
    if (filter.channelIds.length === 0) return [];
    const scheduled = filter.status.includes('scheduled');
    const data = await this.query<{ posts: { edges: Array<{ node: BufferPost }> | null } }>(
      apiKey,
      `query Posts($input: PostsInput!, $first: Int) {
        posts(input: $input, first: $first) { edges { node { ${POST_FIELDS} } } }
      }`,
      {
        first,
        input: {
          organizationId,
          filter: { status: filter.status, channelIds: filter.channelIds },
          sort: [
            { field: scheduled ? 'dueAt' : 'createdAt', direction: scheduled ? 'asc' : 'desc' },
          ],
        },
      },
    );
    return (data.posts.edges ?? []).map((edge) => edge.node);
  }

  async post(apiKey: string, id: string): Promise<BufferPost | null> {
    try {
      const data = await this.query<{ post: BufferPost }>(
        apiKey,
        `query Post($id: PostId!) { post(input: { id: $id }) { ${POST_FIELDS} } }`,
        { id },
      );
      return data.post;
    } catch (error) {
      if (error instanceof BufferError && error.kind === 'not_found') return null;
      throw error;
    }
  }

  private async query<T>(
    apiKey: string,
    query: string,
    variables?: Record<string, unknown>,
  ): Promise<T> {
    let response: Response;
    try {
      response = await fetch(ENDPOINT, {
        method: 'POST',
        headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ query, variables }),
        signal: AbortSignal.timeout(TIMEOUT_MS),
      });
    } catch (error) {
      throw new BufferError('unavailable', `Buffer request failed: ${(error as Error).message}`);
    }
    if (response.status === 401)
      throw new BufferError('unauthorized', 'Buffer rejected the API key');
    if (response.status === 429) throw new BufferError('rate_limited', 'Buffer rate limit reached');
    if (!response.ok)
      throw new BufferError('unavailable', `Buffer answered HTTP ${response.status}`);

    const body = (await response.json().catch(() => ({}))) as {
      data?: T;
      errors?: Array<{ message?: string; extensions?: { code?: string } }>;
    };
    const [error] = body.errors ?? [];
    if (error) {
      const code = error.extensions?.code;
      const kind: BufferErrorKind =
        code === 'UNAUTHORIZED' || code === 'FORBIDDEN'
          ? 'unauthorized'
          : code === 'RATE_LIMIT_EXCEEDED'
            ? 'rate_limited'
            : code === 'NOT_FOUND'
              ? 'not_found'
              : 'unavailable';
      if (kind === 'unavailable')
        this.logger.warn({ code, message: error.message }, 'Buffer query failed');
      throw new BufferError(kind, error.message ?? 'Buffer query failed');
    }
    if (!body.data) throw new BufferError('unavailable', 'Buffer returned no data');
    return body.data;
  }
}
