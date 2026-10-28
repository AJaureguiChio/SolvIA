import { Module } from '@nestjs/common';
import { UsuariosService } from './usuarios.service.js';
import { UsuariosController } from './usuarios.controller.js';
import { DatabaseModule } from '../database/database.module.js';
import { FacialModule } from '../facial/facial.module.js';

@Module({
  imports: [DatabaseModule, FacialModule],
  controllers: [UsuariosController],
  providers: [UsuariosService],
})
export class UsuariosModule {}
