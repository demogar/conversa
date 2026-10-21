import { type MiddlewareConsumer, Module, type NestModule, RequestMethod } from '@nestjs/common';
import { APP_FILTER, APP_GUARD } from '@nestjs/core';
import { ThrottlerModule } from '@nestjs/throttler';
import type { Redis } from 'ioredis';
import { HttpExceptionFilter } from './common/errors/http-exception.filter.js';
import { ClientIpMiddleware } from './common/http/client-ip.middleware.js';
import { AppThrottlerGuard } from './common/security/app-throttler.guard.js';
import { OriginGuard } from './common/security/origin.guard.js';
import { RedisThrottlerStorage } from './common/security/redis-throttler.storage.js';
import { InfraModule } from './infra/infra.module.js';
import { REDIS } from './infra/redis/redis.module.js';
import { ActivityModule } from './modules/activity/activity.controller.js';
import { AuthGuard } from './modules/auth/auth.guard.js';
import { AuthModule } from './modules/auth/auth.module.js';
import { AutomationsModule } from './modules/automations/automations.module.js';
import { BufferModule } from './modules/buffer/buffer.module.js';
import { ChannelsModule } from './modules/channels/channels.module.js';
import { SandboxModule } from './modules/channels/sandbox/sandbox.module.js';
import { ContactsModule } from './modules/contacts/contacts.controller.js';
import { DashboardModule } from './modules/dashboard/dashboard.controller.js';
import { InboxModule } from './modules/inbox/inbox.controller.js';
import { HealthController } from './modules/instance/health.controller.js';
import { InstanceAdminGuard } from './modules/instance/instance-admin.guard.js';
import { InstanceAdminsService } from './modules/instance/instance-admins.service.js';
import { InstanceSettingsController } from './modules/instance/instance-settings.controller.js';
import { InstanceController } from './modules/instance/instance.controller.js';
import { LinksModule } from './modules/links/links.module.js';
import { WebhooksModule } from './modules/webhooks/webhooks.module.js';
import { WorkerModule } from './worker.module.js';
import { WorkspaceGuard } from './modules/workspaces/workspace.guard.js';
import { WorkspacesModule } from './modules/workspaces/workspaces.module.js';

/** Small installs can run the worker inside the API process (WORKER_IN_API=true). */
const embeddedWorker = ['true', '1'].includes(process.env.WORKER_IN_API ?? '')
  ? [WorkerModule]
  : [];

@Module({
  imports: [
    InfraModule,
    ThrottlerModule.forRootAsync({
      inject: [REDIS],
      useFactory: (redis: Redis) => ({
        throttlers: [{ name: 'default', ttl: 60_000, limit: 300 }],
        storage: new RedisThrottlerStorage(redis),
      }),
    }),
    AuthModule,
    WorkspacesModule,
    ChannelsModule,
    WebhooksModule,
    AutomationsModule,
    LinksModule,
    ContactsModule,
    ActivityModule,
    InboxModule,
    DashboardModule,
    BufferModule,
    SandboxModule,
    ...embeddedWorker,
  ],
  controllers: [InstanceController, InstanceSettingsController, HealthController],
  providers: [
    InstanceAdminsService,
    // Guards run in this order: rate limit, origin check, session, workspace, instance admin.
    { provide: APP_GUARD, useClass: AppThrottlerGuard },
    { provide: APP_GUARD, useClass: OriginGuard },
    { provide: APP_GUARD, useClass: AuthGuard },
    { provide: APP_GUARD, useClass: WorkspaceGuard },
    { provide: APP_GUARD, useClass: InstanceAdminGuard },
    { provide: APP_FILTER, useClass: HttpExceptionFilter },
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    // A named wildcard, as path-to-regexp 8 requires. Nest mounts it under the
    // global prefix and on every route excluded from it, such as GET /l/:slug.
    consumer.apply(ClientIpMiddleware).forRoutes({ path: '{*splat}', method: RequestMethod.ALL });
  }
}
