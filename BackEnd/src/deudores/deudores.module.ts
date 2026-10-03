import { Module } from '@nestjs/common';
import { DeudoresService } from './deudores.service.js';
import { DeudoresController } from './deudores.controller.js';
import { DatabaseModule } from '../database/database.module.js';

@Module({
  imports: [DatabaseModule],
  controllers: [DeudoresController],
  providers: [DeudoresService],
})
export class DeudoresModule {}
