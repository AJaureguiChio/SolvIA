import { Module } from '@nestjs/common';
import { FacialService } from './facial.service.js';
import { FacialController } from './facial.controller.js';
import { DatabaseModule } from '../database/database.module.js';

@Module({
  imports: [DatabaseModule],
  controllers: [FacialController],
  providers: [FacialService],
})
export class FacialModule {}
