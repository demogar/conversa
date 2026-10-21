import { Module } from '@nestjs/common';
import { TurnstileService } from '../../common/security/turnstile.service.js';
import { AccountController } from '../account/account.controller.js';
import { AccountService } from '../account/account.service.js';
import { WorkspacesModule } from '../workspaces/workspaces.module.js';
import { AuthController } from './auth.controller.js';
import { AuthService } from './auth.service.js';
import { MfaService } from './mfa.service.js';
import { PasswordService } from './password.service.js';
import { SessionService } from './session.service.js';

@Module({
  imports: [WorkspacesModule],
  controllers: [AuthController, AccountController],
  providers: [
    AuthService,
    AccountService,
    PasswordService,
    SessionService,
    MfaService,
    TurnstileService,
  ],
  exports: [SessionService],
})
export class AuthModule {}
