import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { Protegido, Roles, Usuario } from '../auth/decoradores.js';
import type { UsuarioActual } from '../auth/guards/neon-auth/neon-auth.guard.js';
import { IdPipe } from '../common/validacion.js';
import {
  AsignacionDto,
  CrearCuentaDto,
  DetalleCuentaDto,
  ListarCuentasDto,
} from './cuentas.dto.js';
import { CuentasService } from './cuentas.service.js';

@Controller('cuentas')
@Protegido()
export class CuentasController {
  constructor(private readonly cuentasService: CuentasService) {}

  @Get()
  listar(
    @Usuario() usuario: UsuarioActual,
    @Query() filtros: ListarCuentasDto,
  ) {
    return this.cuentasService.listar(usuario, filtros);
  }

  @Post()
  @Roles('administrador')
  crear(@Usuario() admin: UsuarioActual, @Body() dto: CrearCuentaDto) {
    return this.cuentasService.crear(admin, dto);
  }

  @Get(':id')
  obtener(
    @Usuario() usuario: UsuarioActual,
    @Param('id', IdPipe) id: string,
    @Query() query: DetalleCuentaDto,
  ) {
    return this.cuentasService.obtener(usuario, id, query.fechaCorte);
  }

  @Patch(':id/asignacion')
  @Roles('administrador')
  asignar(
    @Usuario() admin: UsuarioActual,
    @Param('id', IdPipe) id: string,
    @Body() dto: AsignacionDto,
  ) {
    return this.cuentasService.asignar(admin, id, dto);
  }

  @Get(':id/asignaciones')
  historial(
    @Usuario() usuario: UsuarioActual,
    @Param('id', IdPipe) id: string,
  ) {
    return this.cuentasService.historialAsignaciones(usuario, id);
  }
}
