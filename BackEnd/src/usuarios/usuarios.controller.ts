import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Query,
} from '@nestjs/common';
import { Protegido, Roles, Usuario } from '../auth/decoradores.js';
import type { UsuarioActual } from '../auth/guards/neon-auth/neon-auth.guard.js';
import { ActualizarUsuarioDto, ListarUsuariosDto } from './usuarios.dto.js';
import { UsuariosService } from './usuarios.service.js';

// El alta de identidades (POST /usuarios) queda pendiente: depende del
// mecanismo de invitaciones de Neon Auth.
@Controller('usuarios')
@Protegido()
@Roles('administrador')
export class UsuariosController {
  constructor(private readonly usuariosService: UsuariosService) {}

  @Get()
  listar(@Query() filtros: ListarUsuariosDto) {
    return this.usuariosService.listar(filtros);
  }

  @Get(':id')
  obtener(@Param('id', ParseUUIDPipe) id: string) {
    return this.usuariosService.obtener(id);
  }

  @Patch(':id')
  actualizar(
    @Usuario() admin: UsuarioActual,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ActualizarUsuarioDto,
  ) {
    return this.usuariosService.actualizar(admin, id, dto);
  }
}
