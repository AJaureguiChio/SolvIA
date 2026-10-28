import { Controller, Get, Req, UseGuards } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DatabaseService } from '../database/database.service.js';
import { Usuario } from './decoradores.js';
import {
  NeonAuthGuard,
  type RequestSolvia,
  type UsuarioActual,
} from './guards/neon-auth/neon-auth.guard.js';
import { pruebaFacialVigente } from './prueba-facial.js';

// /me solo exige la identidad de Neon Auth: es el punto de partida del
// flujo facial, asi que no puede requerir la verificacion facial.
@Controller('me')
@UseGuards(NeonAuthGuard)
export class MeController {
  private readonly secretoFacial: string;

  constructor(
    private readonly database: DatabaseService,
    config: ConfigService,
  ) {
    this.secretoFacial = config.getOrThrow<string>('FACE_JWT_SECRET');
  }

  @Get()
  async obtenerPerfil(
    @Usuario() usuario: UsuarioActual,
    @Req() request: RequestSolvia,
  ) {
    const { rows } = await this.database.query(
      `SELECT u.name AS nombre, u.email,
              EXISTS (SELECT 1 FROM public.facial_plantillas f
                       WHERE f.usuario_id = u.id) AS inscrito
         FROM neon_auth."user" u
        WHERE u.id = $1::uuid`,
      [usuario.id],
    );
    const datos = rows[0] as
      { nombre: string | null; email: string; inscrito: boolean } | undefined;

    return {
      id: usuario.id,
      rol: usuario.rol,
      activo: usuario.activo,
      nombre: datos?.nombre ?? null,
      email: datos?.email ?? null,
      facial: {
        inscrito: datos?.inscrito ?? false,
        verificado: await pruebaFacialVigente(
          request,
          usuario.id,
          this.secretoFacial,
        ),
      },
    };
  }
}
