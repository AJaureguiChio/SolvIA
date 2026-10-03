import { Module } from '@nestjs/common';
import { PagosService } from './pagos.service.js';
import { PagosController } from './pagos.controller.js';
import { DatabaseModule } from '../database/database.module.js';

@Module({
  imports: [DatabaseModule],
  controllers: [PagosController],
  providers: [PagosService],
})
export class PagosModule {}
