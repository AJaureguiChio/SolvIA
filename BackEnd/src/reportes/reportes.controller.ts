import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  StreamableFile,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { Protegido, Roles, Usuario } from '../auth/decoradores.js';
import type { UsuarioActual } from '../auth/guards/neon-auth/neon-auth.guard.js';
import { IdPipe, PaginacionDto } from '../common/validacion.js';
import {
  CrearReporteDto,
  EntregarReporteDto,
  PrevisualizarReporteDto,
} from './reportes.dto.js';
import {
  type ArchivoPdf,
  MAX_PDF,
  ReportesService,
} from './reportes.service.js';

@Controller('reportes')
@Protegido()
export class ReportesController {
  constructor(private readonly reportesService: ReportesService) {}

  @Post('previsualizaciones')
  @Roles('administrador')
  previsualizar(
    @Usuario() admin: UsuarioActual,
    @Body() dto: PrevisualizarReporteDto,
  ) {
    return this.reportesService.previsualizar(admin, dto);
  }

  // Multer corta un poco por encima del límite para responder 413 propio.
  @Post()
  @Roles('administrador')
  @UseInterceptors(
    FileInterceptor('pdf', { limits: { fileSize: MAX_PDF + 1024 } }),
  )
  crear(
    @Usuario() admin: UsuarioActual,
    @Body() dto: CrearReporteDto,
    @UploadedFile() pdf?: ArchivoPdf,
  ) {
    return this.reportesService.crear(admin, dto, pdf);
  }

  @Get()
  listar(@Usuario() usuario: UsuarioActual, @Query() filtros: PaginacionDto) {
    return this.reportesService.listar(usuario, filtros);
  }

  @Get(':id')
  obtener(@Usuario() usuario: UsuarioActual, @Param('id', IdPipe) id: string) {
    return this.reportesService.obtener(usuario, id);
  }

  @Get(':id/pdf')
  async pdf(
    @Usuario() usuario: UsuarioActual,
    @Param('id', IdPipe) id: string,
  ) {
    const { titulo, archivo } = await this.reportesService.pdf(usuario, id);
    const nombre = `${titulo.replace(/[^\w\-áéíóúñÁÉÍÓÚÑ ]+/g, '').trim() || 'reporte'}.pdf`;
    return new StreamableFile(archivo, {
      type: 'application/pdf',
      disposition: `attachment; filename="reporte-${id}.pdf"; filename*=UTF-8''${encodeURIComponent(nombre)}`,
      length: archivo.length,
    });
  }

  @Post(':id/entregas')
  @Roles('administrador')
  entregar(
    @Usuario() admin: UsuarioActual,
    @Param('id', IdPipe) id: string,
    @Body() dto: EntregarReporteDto,
  ) {
    return this.reportesService.entregar(admin, id, dto);
  }
}
