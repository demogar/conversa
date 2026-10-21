import { Controller, Delete, Get, HttpCode, Param, Patch, Post } from '@nestjs/common';
import {
  type CreateInvitationInput,
  createInvitationSchema,
  type CreateWorkspaceInput,
  createWorkspaceSchema,
  paginationQuery,
  type PaginationQuery,
  type UpdateMemberInput,
  updateMemberSchema,
  type UpdateWorkspaceInput,
  updateWorkspaceSchema,
} from '@conversa/shared';
import {
  CurrentAuth,
  CurrentMembership,
  RequireRole,
} from '../../common/http/decorators.js';
import type { AuthContext, MembershipContext } from '../../common/http/request.js';
import { ZodBody, ZodQuery } from '../../common/validation/zod.pipe.js';
import { AuditService } from '../audit/audit.service.js';
import { InvitationsService } from './invitations.service.js';
import { WorkspacesService } from './workspaces.service.js';

@Controller('workspaces')
export class WorkspacesController {
  constructor(
    private readonly workspaces: WorkspacesService,
    private readonly invitations: InvitationsService,
    private readonly audit: AuditService,
  ) {}

  @Get()
  list(@CurrentAuth() auth: AuthContext) {
    return this.workspaces.listForUser(auth.userId);
  }

  @Post()
  create(@CurrentAuth() auth: AuthContext, @ZodBody(createWorkspaceSchema) body: CreateWorkspaceInput) {
    return this.workspaces.create(auth.userId, body.name);
  }

  @Patch(':workspaceId')
  @RequireRole('ADMIN')
  rename(
    @CurrentAuth() auth: AuthContext,
    @CurrentMembership() membership: MembershipContext,
    @ZodBody(updateWorkspaceSchema) body: UpdateWorkspaceInput,
  ) {
    return this.workspaces.rename(membership, auth.userId, body.name);
  }

  @Delete(':workspaceId')
  @RequireRole('OWNER')
  @HttpCode(204)
  async remove(@CurrentMembership() membership: MembershipContext): Promise<void> {
    await this.workspaces.remove(membership.workspaceId);
  }

  @Get(':workspaceId/members')
  members(@CurrentMembership() membership: MembershipContext) {
    return this.workspaces.listMembers(membership.workspaceId);
  }

  @Patch(':workspaceId/members/:userId')
  @RequireRole('ADMIN')
  @HttpCode(204)
  async changeRole(
    @CurrentAuth() auth: AuthContext,
    @CurrentMembership() membership: MembershipContext,
    @Param('userId') userId: string,
    @ZodBody(updateMemberSchema) body: UpdateMemberInput,
  ): Promise<void> {
    await this.workspaces.changeRole(membership, auth.userId, userId, body.role);
  }

  @Delete(':workspaceId/members/:userId')
  @HttpCode(204)
  async removeMember(
    @CurrentAuth() auth: AuthContext,
    @CurrentMembership() membership: MembershipContext,
    @Param('userId') userId: string,
  ): Promise<void> {
    await this.workspaces.removeMember(membership, auth.userId, userId);
  }

  @Get(':workspaceId/invitations')
  @RequireRole('ADMIN')
  listInvitations(@CurrentMembership() membership: MembershipContext) {
    return this.invitations.list(membership.workspaceId);
  }

  @Post(':workspaceId/invitations')
  @RequireRole('ADMIN')
  invite(
    @CurrentAuth() auth: AuthContext,
    @CurrentMembership() membership: MembershipContext,
    @ZodBody(createInvitationSchema) body: CreateInvitationInput,
  ) {
    return this.invitations.create(membership.workspaceId, auth.userId, body);
  }

  @Delete(':workspaceId/invitations/:invitationId')
  @RequireRole('ADMIN')
  @HttpCode(204)
  async revokeInvitation(
    @CurrentAuth() auth: AuthContext,
    @CurrentMembership() membership: MembershipContext,
    @Param('invitationId') invitationId: string,
  ): Promise<void> {
    await this.invitations.revoke(membership.workspaceId, auth.userId, invitationId);
  }

  @Get(':workspaceId/audit')
  @RequireRole('ADMIN')
  auditLog(
    @CurrentMembership() membership: MembershipContext,
    @ZodQuery(paginationQuery) query: PaginationQuery,
  ) {
    return this.audit.list(membership.workspaceId, query.cursor, query.limit);
  }
}
