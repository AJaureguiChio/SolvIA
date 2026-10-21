import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { Protegido, Roles, Usuario } from '../auth/decoradores.js';
import type { UsuarioActual } from '../auth/guards/neon-auth/neon-auth.guard.js';
import { IdPipe, PaginacionDto } from '../common/validacion.js';
import { CrearMovimientoDto } from './movimientos.dto.js';
import { MovimientosService } from './movimientos.service.js';

@Controller('cuentas/:cuentaId/movimientos')
@Protegido()
export class MovimientosController {
  constructor(private readonly movimientosService: MovimientosService) {}

  @Get()
  listar(
    @Usuario() usuario: UsuarioActual,
    @Param('cuentaId', IdPipe) cuentaId: string,
    @Query() filtros: PaginacionDto,
  ) {
    return this.movimientosService.listar(usuario, cuentaId, filtros);
  }

  @Post()
  @Roles('administrador')
  crear(
    @Usuario() admin: UsuarioActual,
    @Param('cuentaId', IdPipe) cuentaId: string,
    @Body() dto: CrearMovimientoDto,
  ) {
    return this.movimientosService.crear(admin, cuentaId, dto);
  }
}
