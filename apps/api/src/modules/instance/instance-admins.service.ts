import { Injectable } from '@nestjs/common';
import { ErrorCode, type InstanceUserDto } from '@conversa/shared';
import { AppException } from '../../common/errors/app.exception.js';
import { PrismaService } from '../../infra/prisma/prisma.service.js';
import { AuditService } from '../audit/audit.service.js';

// Serialises admin changes so two revocations cannot leave the instance without one.
const ADMINS_LOCK_KEY = 4_242_002;
const MAX_USERS = 1000;

/** Who may manage the installation. */
@Injectable()
export class InstanceAdminsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  /** Everyone with an account, admins first. Self-hosted instances stay small. */
  async list(): Promise<InstanceUserDto[]> {
    const users = await this.prisma.user.findMany({
      select: { id: true, name: true, email: true, isInstanceAdmin: true, createdAt: true },
      orderBy: [{ isInstanceAdmin: 'desc' }, { createdAt: 'asc' }],
      take: MAX_USERS,
    });
    return users.map((user) => ({ ...user, createdAt: user.createdAt.toISOString() }));
  }

  async setAdmin(
    userId: string,
    isInstanceAdmin: boolean,
    actorId: string,
    ip: string,
  ): Promise<InstanceUserDto> {
    const user = await this.prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(${ADMINS_LOCK_KEY})`;
      const target = await tx.user.findUnique({ where: { id: userId } });
      if (!target) throw AppException.notFound();
      if (target.isInstanceAdmin && !isInstanceAdmin) {
        const admins = await tx.user.count({ where: { isInstanceAdmin: true } });
        if (admins <= 1) throw new AppException(ErrorCode.LAST_INSTANCE_ADMIN);
      }
      return tx.user.update({ where: { id: userId }, data: { isInstanceAdmin } });
    });
    await this.audit.record({
      action: isInstanceAdmin ? 'instance.admin_granted' : 'instance.admin_revoked',
      actorId,
      targetType: 'user',
      targetId: userId,
      ip,
    });
    return {
      id: user.id,
      name: user.name,
      email: user.email,
      isInstanceAdmin: user.isInstanceAdmin,
      createdAt: user.createdAt.toISOString(),
    };
  }
}
