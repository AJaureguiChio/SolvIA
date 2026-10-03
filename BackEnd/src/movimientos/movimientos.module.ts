import { Module } from '@nestjs/common';
import { MovimientosService } from './movimientos.service.js';
import { MovimientosController } from './movimientos.controller.js';
import { DatabaseModule } from '../database/database.module.js';

@Module({
  imports: [DatabaseModule],
  controllers: [MovimientosController],
  providers: [MovimientosService],
})
export class MovimientosModule {}
