import { Controller, Delete, Get, HttpCode, Post, Put } from '@nestjs/common';
import { z } from 'zod';
import {
  type ConnectBufferInput,
  connectBufferSchema,
  type SelectBufferOrganizationInput,
  selectBufferOrganizationSchema,
} from '@conversa/shared';
import { CurrentAuth, CurrentMembership, RequireRole } from '../../common/http/decorators.js';
import type { AuthContext, MembershipContext } from '../../common/http/request.js';
import { ZodBody, ZodQuery } from '../../common/validation/zod.pipe.js';
import { BufferService } from './buffer.service.js';

const postsQuery = z.object({ view: z.enum(['scheduled', 'sent']).default('scheduled') });

@Controller('workspaces/:workspaceId/integrations/buffer')
export class BufferController {
  constructor(private readonly buffer: BufferService) {}

  @Get()
  status(@CurrentMembership() membership: MembershipContext) {
    return this.buffer.status(membership.workspaceId);
  }

  @Put()
  @RequireRole('ADMIN')
  connect(
    @CurrentAuth() auth: AuthContext,
    @CurrentMembership() membership: MembershipContext,
    @ZodBody(connectBufferSchema) body: ConnectBufferInput,
  ) {
    return this.buffer.connect(membership.workspaceId, auth.userId, body.apiKey);
  }

  @Delete()
  @RequireRole('ADMIN')
  @HttpCode(204)
  async disconnect(@CurrentAuth() auth: AuthContext, @CurrentMembership() membership: MembershipContext): Promise<void> {
    await this.buffer.disconnect(membership.workspaceId, auth.userId);
  }

  @Get('organizations')
  organizations(@CurrentMembership() membership: MembershipContext) {
    return this.buffer.organizations(membership.workspaceId);
  }

  @Post('organization')
  @RequireRole('ADMIN')
  @HttpCode(200)
  selectOrganization(
    @CurrentMembership() membership: MembershipContext,
    @ZodBody(selectBufferOrganizationSchema) body: SelectBufferOrganizationInput,
  ) {
    return this.buffer.selectOrganization(membership.workspaceId, body.organizationId);
  }

  @Get('channels')
  channels(@CurrentMembership() membership: MembershipContext) {
    return this.buffer.listChannels(membership.workspaceId);
  }

  @Get('posts')
  posts(@CurrentMembership() membership: MembershipContext, @ZodQuery(postsQuery) query: z.infer<typeof postsQuery>) {
    return this.buffer.listPosts(membership.workspaceId, query.view);
  }
}
