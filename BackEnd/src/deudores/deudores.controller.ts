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
  ActualizarDeudorDto,
  CrearDeudorDto,
  ListarDeudoresDto,
} from './deudores.dto.js';
import { DeudoresService } from './deudores.service.js';

@Controller('deudores')
@Protegido()
export class DeudoresController {
  constructor(private readonly deudoresService: DeudoresService) {}

  @Get()
  listar(
    @Usuario() usuario: UsuarioActual,
    @Query() filtros: ListarDeudoresDto,
  ) {
    return this.deudoresService.listar(usuario, filtros);
  }

  @Post()
  @Roles('administrador')
  crear(@Body() dto: CrearDeudorDto) {
    return this.deudoresService.crear(dto);
  }

  @Get(':id')
  obtener(@Usuario() usuario: UsuarioActual, @Param('id', IdPipe) id: string) {
    return this.deudoresService.obtener(usuario, id);
  }

  @Patch(':id')
  @Roles('administrador')
  actualizar(
    @Param('id', IdPipe) id: string,
    @Body() dto: ActualizarDeudorDto,
  ) {
    return this.deudoresService.actualizar(id, dto);
  }
}
