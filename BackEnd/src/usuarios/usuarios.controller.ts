import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { Protegido, Roles, Usuario } from '../auth/decoradores.js';
import type { UsuarioActual } from '../auth/guards/neon-auth/neon-auth.guard.js';
import { FacialService } from '../facial/facial.service.js';
import {
  ActualizarUsuarioDto,
  CrearUsuarioDto,
  ListarUsuariosDto,
} from './usuarios.dto.js';
import { UsuariosService } from './usuarios.service.js';

@Controller('usuarios')
@Protegido()
@Roles('administrador')
export class UsuariosController {
  constructor(
    private readonly usuariosService: UsuariosService,
    private readonly facialService: FacialService,
  ) {}

  @Get()
  listar(@Query() filtros: ListarUsuariosDto) {
    return this.usuariosService.listar(filtros);
  }

  // Crea la identidad en Neon Auth (o reutiliza una sin perfil) y su perfil.
  // El usuario registra su rostro en el primer acceso.
  @Post()
  crear(@Body() dto: CrearUsuarioDto) {
    return this.usuariosService.crear(dto);
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

  // Borra la plantilla facial; el usuario la registra de nuevo en su
  // siguiente acceso (excepción de primer acceso).
  @Post(':id/restablecimiento-facial')
  async restablecerFacial(@Param('id', ParseUUIDPipe) id: string) {
    await this.usuariosService.obtener(id);
    return this.facialService.restablecer(id);
  }
}
