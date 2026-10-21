import { Controller, Get, Param, Post } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { type AcceptInvitationInput, acceptInvitationSchema } from '@conversa/shared';
import { CurrentAuth, Public } from '../../common/http/decorators.js';
import type { AuthContext } from '../../common/http/request.js';
import { ZodBody } from '../../common/validation/zod.pipe.js';
import { PrismaService } from '../../infra/prisma/prisma.service.js';
import { InvitationsService } from './invitations.service.js';

@Controller('invitations')
export class InvitationsController {
  constructor(
    private readonly invitations: InvitationsService,
    private readonly prisma: PrismaService,
  ) {}

  @Public()
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  @Get(':token')
  preview(@Param('token') token: string) {
    return this.invitations.preview(token);
  }

  @Post('accept')
  async accept(
    @CurrentAuth() auth: AuthContext,
    @ZodBody(acceptInvitationSchema) body: AcceptInvitationInput,
  ): Promise<{ workspaceId: string }> {
    const user = await this.prisma.user.findUniqueOrThrow({
      where: { id: auth.userId },
      select: { id: true, email: true },
    });
    const workspaceId = await this.prisma.$transaction((tx) =>
      this.invitations.accept(tx, body.token, user),
    );
    return { workspaceId };
  }
}
