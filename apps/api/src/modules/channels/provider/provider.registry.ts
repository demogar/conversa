import { Inject, Injectable } from '@nestjs/common';
import { type ChannelType, ErrorCode } from '@conversa/shared';
import { AppException } from '../../../common/errors/app.exception.js';
import type { ChannelProvider } from './channel-provider.js';

export const CHANNEL_PROVIDERS = Symbol('CHANNEL_PROVIDERS');

@Injectable()
export class ProviderRegistry {
  private readonly byType: Map<string, ChannelProvider>;

  constructor(@Inject(CHANNEL_PROVIDERS) providers: ChannelProvider[]) {
    this.byType = new Map(providers.map((provider) => [provider.type, provider]));
  }

  /** The provider for a channel type, or null for an unknown type. */
  find(type: string): ChannelProvider | null {
    return this.byType.get(type.toUpperCase()) ?? null;
  }

  get(type: ChannelType): ChannelProvider {
    const provider = this.byType.get(type);
    if (!provider) throw new Error(`No provider registered for ${type}`);
    return provider;
  }

  /** Like get(), but fails with CHANNEL_NOT_CONFIGURED when the app keys are missing. */
  getConfigured(type: ChannelType): ChannelProvider {
    const provider = this.get(type);
    if (!provider.isConfigured()) throw new AppException(ErrorCode.CHANNEL_NOT_CONFIGURED);
    return provider;
  }
}
