import {
  Controller,
  Delete,
  HttpCode,
  HttpStatus,
  Post,
  Req,
  Res,
  UploadedFile,
  UploadedFiles,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { FileInterceptor, FilesInterceptor } from '@nestjs/platform-express';
import type { Response } from 'express';
import { Usuario } from '../auth/decoradores.js';
import {
  NeonAuthGuard,
  type RequestSolvia,
  type UsuarioActual,
} from '../auth/guards/neon-auth/neon-auth.guard.js';
import {
  COOKIE_FACIAL,
  firmarPruebaFacial,
  opcionesCookieFacial,
  pruebaFacialVigente,
  VIGENCIA_FACIAL_SEGUNDOS,
} from '../auth/prueba-facial.js';
import { ApiError } from '../common/api-error.js';
import { type Captura, FacialService } from './facial.service.js';

const MAX_CAPTURAS = 5;
const LIMITES = { fileSize: 5 * 1024 * 1024 };
const TIPOS = new Set(['image/jpeg', 'image/png', 'image/webp']);

// Estas rutas solo exigen Neon Auth: son el paso previo a la prueba facial
// que piden las rutas de negocio (@Protegido).
@Controller('facial')
@UseGuards(NeonAuthGuard)
export class FacialController {
  private readonly secreto: string;
  private readonly cookieSegura: boolean;

  constructor(
    private readonly facialService: FacialService,
    config: ConfigService,
  ) {
    this.secreto = config.getOrThrow<string>('FACE_JWT_SECRET');
    this.cookieSegura = config.get<string>('FACE_COOKIE_SECURE') === 'true';
  }

  // Primer registro sin prueba facial (excepción de primer acceso); para
  // reemplazar un rostro ya registrado hay que haberlo verificado antes.
  @Post('inscripciones')
  @UseInterceptors(
    FilesInterceptor('captura', MAX_CAPTURAS, { limits: LIMITES }),
  )
  async inscribir(
    @Usuario() usuario: UsuarioActual,
    @Req() request: RequestSolvia,
    @Res({ passthrough: true }) response: Response,
    @UploadedFiles() capturas: Captura[] = [],
  ) {
    validarCapturas(capturas);
    if (
      (await this.facialService.estaInscrito(usuario.id)) &&
      !(await pruebaFacialVigente(request, usuario.id, this.secreto))
    ) {
      throw new ApiError(
        HttpStatus.FORBIDDEN,
        'FACE_REENROLL_FORBIDDEN',
        'Verifica tu rostro actual antes de registrar uno nuevo.',
      );
    }
    const resultado = await this.facialService.inscribir(usuario, capturas);
    // Quien acaba de registrar su rostro ya lo presentó: queda verificado.
    await this.emitirPrueba(usuario.id, response);
    return resultado;
  }

  @Post('verificaciones')
  @UseInterceptors(FileInterceptor('captura', { limits: LIMITES }))
  async verificar(
    @Usuario() usuario: UsuarioActual,
    @Res({ passthrough: true }) response: Response,
    @UploadedFile() captura?: Captura,
  ) {
    validarCapturas(captura ? [captura] : []);
    await this.facialService.verificar(usuario, captura!);
    return this.emitirPrueba(usuario.id, response);
  }

  // Cierra la prueba facial (al cerrar sesión en el frontend).
  @Delete('verificacion')
  @HttpCode(HttpStatus.NO_CONTENT)
  cerrar(@Res({ passthrough: true }) response: Response) {
    const { maxAge: _maxAge, ...opciones } = opcionesCookieFacial(
      this.cookieSegura,
    );
    response.clearCookie(COOKIE_FACIAL, opciones);
  }

  private async emitirPrueba(usuarioId: string, response: Response) {
    response.cookie(
      COOKIE_FACIAL,
      await firmarPruebaFacial(usuarioId, this.secreto),
      opcionesCookieFacial(this.cookieSegura),
    );
    return {
      verificado: true,
      expiraEn: new Date(
        Date.now() + VIGENCIA_FACIAL_SEGUNDOS * 1000,
      ).toISOString(),
    };
  }
}

function validarCapturas(capturas: Captura[]) {
  if (capturas.length === 0) {
    throw ApiError.entradaInvalida(
      'Envía al menos una captura en el campo captura',
    );
  }
  if (capturas.some((c) => !TIPOS.has(c.mimetype))) {
    throw ApiError.entradaInvalida('La captura debe ser JPEG, PNG o WebP');
  }
}
