import { Module } from '@nestjs/common';
import { AuthService } from './auth.service.js';
import { AuthController } from './auth.controller.js';
import { MeController } from './me.controller.js';
import { NeonAuthGuard } from './guards/neon-auth/neon-auth.guard.js';
import { DatabaseModule } from '../database/database.module.js';
import { NeonSessionService } from './neon-session.service.js';

@Module({
  imports: [DatabaseModule],
  controllers: [AuthController, MeController],
  providers: [AuthService, NeonAuthGuard, NeonSessionService],
  exports: [NeonAuthGuard],
})
export class AuthModule {}