import { Controller, Get, HttpCode, Param, Post } from '@nestjs/common';
import { z } from 'zod';
import { type SimulateEventInput, simulateEventSchema } from '@conversa/shared';
import { CurrentMembership } from '../../../common/http/decorators.js';
import type { MembershipContext } from '../../../common/http/request.js';
import { ZodBody } from '../../../common/validation/zod.pipe.js';
import { SandboxService } from './sandbox.service.js';

const tapSchema = z.object({ deliveryId: z.string().trim().min(1).max(64) });

/** Sandbox only (INSTAGRAM_SANDBOX): every member can simulate events. */
@Controller('workspaces/:workspaceId/channels/:channelId/sandbox')
export class SandboxController {
  constructor(private readonly sandbox: SandboxService) {}

  @Post('events')
  @HttpCode(202)
  simulate(
    @CurrentMembership() membership: MembershipContext,
    @Param('channelId') channelId: string,
    @ZodBody(simulateEventSchema) body: SimulateEventInput,
  ) {
    return this.sandbox.simulate(membership.workspaceId, channelId, body);
  }

  @Post('taps')
  @HttpCode(202)
  tap(
    @CurrentMembership() membership: MembershipContext,
    @Param('channelId') channelId: string,
    @ZodBody(tapSchema) body: z.infer<typeof tapSchema>,
  ) {
    return this.sandbox.tap(membership.workspaceId, channelId, body.deliveryId);
  }

  @Get('outbox')
  outbox(
    @CurrentMembership() membership: MembershipContext,
    @Param('channelId') channelId: string,
  ) {
    return this.sandbox.outboxFor(membership.workspaceId, channelId);
  }
}
