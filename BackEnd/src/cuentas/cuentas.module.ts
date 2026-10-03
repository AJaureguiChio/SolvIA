import { Module } from '@nestjs/common';
import { CuentasService } from './cuentas.service.js';
import { CuentasController } from './cuentas.controller.js';
import { DatabaseModule } from '../database/database.module.js';

@Module({
  imports: [DatabaseModule],
  controllers: [CuentasController],
  providers: [CuentasService],
})
export class CuentasModule {}
