import { Controller, Delete, Get, HttpCode, Param, Post, Put } from '@nestjs/common';
import {
  type CreateAutomationInput,
  createAutomationSchema,
  type SetAutomationStatusInput,
  setAutomationStatusSchema,
  type UpdateAutomationInput,
  updateAutomationSchema,
} from '@conversa/shared';
import { CurrentAuth, CurrentMembership } from '../../common/http/decorators.js';
import type { AuthContext, MembershipContext } from '../../common/http/request.js';
import { ZodBody } from '../../common/validation/zod.pipe.js';
import { AutomationsService } from './automations.service.js';

/** Every member can build automations; connecting accounts is for admins. */
@Controller('workspaces/:workspaceId/automations')
export class AutomationsController {
  constructor(private readonly automations: AutomationsService) {}

  @Get()
  list(@CurrentMembership() membership: MembershipContext) {
    return this.automations.list(membership.workspaceId);
  }

  @Post()
  create(
    @CurrentAuth() auth: AuthContext,
    @CurrentMembership() membership: MembershipContext,
    @ZodBody(createAutomationSchema) body: CreateAutomationInput,
  ) {
    return this.automations.create(membership.workspaceId, auth.userId, body);
  }

  @Get(':automationId')
  get(@CurrentMembership() membership: MembershipContext, @Param('automationId') id: string) {
    return this.automations.get(membership.workspaceId, id);
  }

  @Put(':automationId')
  update(
    @CurrentAuth() auth: AuthContext,
    @CurrentMembership() membership: MembershipContext,
    @Param('automationId') id: string,
    @ZodBody(updateAutomationSchema) body: UpdateAutomationInput,
  ) {
    return this.automations.update(membership.workspaceId, auth.userId, id, body);
  }

  @Post(':automationId/status')
  @HttpCode(200)
  setStatus(
    @CurrentAuth() auth: AuthContext,
    @CurrentMembership() membership: MembershipContext,
    @Param('automationId') id: string,
    @ZodBody(setAutomationStatusSchema) body: SetAutomationStatusInput,
  ) {
    return this.automations.setStatus(membership.workspaceId, auth.userId, id, body.status);
  }

  @Post(':automationId/duplicate')
  duplicate(
    @CurrentAuth() auth: AuthContext,
    @CurrentMembership() membership: MembershipContext,
    @Param('automationId') id: string,
  ) {
    return this.automations.duplicate(membership.workspaceId, auth.userId, id);
  }

  @Delete(':automationId')
  @HttpCode(204)
  async remove(
    @CurrentAuth() auth: AuthContext,
    @CurrentMembership() membership: MembershipContext,
    @Param('automationId') id: string,
  ): Promise<void> {
    await this.automations.remove(membership.workspaceId, auth.userId, id);
  }
}
