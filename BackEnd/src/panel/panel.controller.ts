import { Controller, Get, Query } from '@nestjs/common';
import { Protegido, Usuario } from '../auth/decoradores.js';
import type { UsuarioActual } from '../auth/guards/neon-auth/neon-auth.guard.js';
import { PrioridadesDto, ResumenPanelDto } from './panel.dto.js';
import { PanelService } from './panel.service.js';

@Controller('panel')
@Protegido()
export class PanelController {
  constructor(private readonly panelService: PanelService) {}

  @Get('resumen')
  resumen(
    @Usuario() usuario: UsuarioActual,
    @Query() filtros: ResumenPanelDto,
  ) {
    return this.panelService.resumen(usuario, filtros);
  }

  @Get('prioridades')
  prioridades(
    @Usuario() usuario: UsuarioActual,
    @Query() filtros: PrioridadesDto,
  ) {
    return this.panelService.prioridades(usuario, filtros);
  }
}
