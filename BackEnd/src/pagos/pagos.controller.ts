import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { Protegido, Roles, Usuario } from '../auth/decoradores.js';
import type { UsuarioActual } from '../auth/guards/neon-auth/neon-auth.guard.js';
import { IdPipe, PaginacionDto } from '../common/validacion.js';
import { CrearPagoDto } from './pagos.dto.js';
import { PagosService } from './pagos.service.js';

@Controller('cuentas/:cuentaId/pagos')
@Protegido()
export class PagosController {
  constructor(private readonly pagosService: PagosService) {}

  @Get()
  listar(
    @Usuario() usuario: UsuarioActual,
    @Param('cuentaId', IdPipe) cuentaId: string,
    @Query() filtros: PaginacionDto,
  ) {
    return this.pagosService.listar(usuario, cuentaId, filtros);
  }

  @Post()
  @Roles('gestor')
  crear(
    @Usuario() gestor: UsuarioActual,
    @Param('cuentaId', IdPipe) cuentaId: string,
    @Body() dto: CrearPagoDto,
  ) {
    return this.pagosService.crear(gestor, cuentaId, dto);
  }
}
