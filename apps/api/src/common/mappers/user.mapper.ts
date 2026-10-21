import { isLocale, type UserDto } from '@conversa/shared';
import type { User } from '../../generated/prisma/client.js';

export function toUserDto(user: User): UserDto {
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    locale: isLocale(user.locale) ? user.locale : 'en',
    mfaEnabled: user.mfaEnabledAt !== null,
    isInstanceAdmin: user.isInstanceAdmin,
    createdAt: user.createdAt.toISOString(),
  };
}
