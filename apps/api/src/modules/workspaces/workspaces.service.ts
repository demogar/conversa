import { Injectable } from '@nestjs/common';
import {
  ErrorCode,
  hasRole,
  type MemberDto,
  type WorkspaceDto,
  WorkspaceRole,
} from '@conversa/shared';
import { AppException } from '../../common/errors/app.exception.js';
import { PrismaService } from '../../infra/prisma/prisma.service.js';
import type { MembershipContext } from '../../common/http/request.js';
import { AuditService } from '../audit/audit.service.js';

@Injectable()
export class WorkspacesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async listForUser(userId: string): Promise<WorkspaceDto[]> {
    const memberships = await this.prisma.membership.findMany({
      where: { userId },
      include: { workspace: true },
      orderBy: { createdAt: 'asc' },
    });
    return memberships.map((m) => ({
      id: m.workspace.id,
      name: m.workspace.name,
      role: m.role,
      createdAt: m.workspace.createdAt.toISOString(),
    }));
  }

  async create(userId: string, name: string): Promise<WorkspaceDto> {
    const workspace = await this.prisma.workspace.create({
      data: { name, memberships: { create: { userId, role: WorkspaceRole.OWNER } } },
    });
    await this.audit.record({ action: 'workspace.created', actorId: userId, workspaceId: workspace.id });
    return { id: workspace.id, name: workspace.name, role: 'OWNER', createdAt: workspace.createdAt.toISOString() };
  }

  async rename(membership: MembershipContext, actorId: string, name: string): Promise<WorkspaceDto> {
    const workspace = await this.prisma.workspace.update({
      where: { id: membership.workspaceId },
      data: { name },
    });
    await this.audit.record({ action: 'workspace.renamed', actorId, workspaceId: workspace.id });
    return {
      id: workspace.id,
      name: workspace.name,
      role: membership.role,
      createdAt: workspace.createdAt.toISOString(),
    };
  }

  async remove(workspaceId: string): Promise<void> {
    await this.prisma.workspace.delete({ where: { id: workspaceId } });
  }

  async listMembers(workspaceId: string): Promise<MemberDto[]> {
    const members = await this.prisma.membership.findMany({
      where: { workspaceId },
      include: { user: { select: { id: true, name: true, email: true } } },
      orderBy: { createdAt: 'asc' },
    });
    return members.map((m) => ({
      userId: m.user.id,
      name: m.user.name,
      email: m.user.email,
      role: m.role,
      joinedAt: m.createdAt.toISOString(),
    }));
  }

  /**
   * Admins manage members and admins; only owners touch ownership. A
   * workspace always keeps at least one owner.
   */
  async changeRole(actor: MembershipContext, actorId: string, userId: string, role: WorkspaceRole): Promise<void> {
    const target = await this.findMember(actor.workspaceId, userId);
    const touchesOwnership = target.role === WorkspaceRole.OWNER || role === WorkspaceRole.OWNER;
    if (touchesOwnership && actor.role !== WorkspaceRole.OWNER) throw AppException.forbidden();
    if (!hasRole(actor.role, WorkspaceRole.ADMIN)) throw AppException.forbidden();
    if (target.role === role) return;

    await this.prisma.$transaction(async (tx) => {
      if (target.role === WorkspaceRole.OWNER) await this.assertNotLastOwner(tx, actor.workspaceId);
      await tx.membership.update({ where: { id: target.id }, data: { role } });
    });
    await this.audit.record({
      action: 'member.role_changed',
      actorId,
      workspaceId: actor.workspaceId,
      targetType: 'user',
      targetId: userId,
      metadata: { from: target.role, to: role },
    });
  }

  async removeMember(actor: MembershipContext, actorId: string, userId: string): Promise<void> {
    const target = await this.findMember(actor.workspaceId, userId);
    const leaving = actorId === userId;
    if (!leaving) {
      if (!hasRole(actor.role, WorkspaceRole.ADMIN)) throw AppException.forbidden();
      if (target.role === WorkspaceRole.OWNER && actor.role !== WorkspaceRole.OWNER) throw AppException.forbidden();
    }
    await this.prisma.$transaction(async (tx) => {
      if (target.role === WorkspaceRole.OWNER) await this.assertNotLastOwner(tx, actor.workspaceId);
      await tx.membership.delete({ where: { id: target.id } });
    });
    await this.audit.record({
      action: 'member.removed',
      actorId,
      workspaceId: actor.workspaceId,
      targetType: 'user',
      targetId: userId,
    });
  }

  private async findMember(workspaceId: string, userId: string) {
    const member = await this.prisma.membership.findUnique({
      where: { workspaceId_userId: { workspaceId, userId } },
    });
    if (!member) throw AppException.notFound();
    return member;
  }

  private async assertNotLastOwner(
    tx: Pick<PrismaService, 'membership' | '$queryRaw'>,
    workspaceId: string,
  ): Promise<void> {
    // Lock the owner rows so two concurrent demotions cannot both pass.
    const owners = await tx.$queryRaw<Array<{ id: string }>>`
      SELECT id FROM "Membership" WHERE "workspaceId" = ${workspaceId} AND role = 'OWNER' FOR UPDATE`;
    if (owners.length <= 1) throw new AppException(ErrorCode.LAST_OWNER);
  }
}
