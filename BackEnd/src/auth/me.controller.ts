import { Controller, Get, UseGuards } from '@nestjs/common';
import { DatabaseService } from '../database/database.service.js';
import { Usuario } from './decoradores.js';
import {
  NeonAuthGuard,
  type UsuarioActual,
} from './guards/neon-auth/neon-auth.guard.js';

// /me solo exige la identidad de Neon Auth: es el punto de partida del
// flujo facial, asi que no puede requerir la verificacion facial.
@Controller('me')
@UseGuards(NeonAuthGuard)
export class MeController {
  constructor(private readonly database: DatabaseService) {}

  @Get()
  async obtenerPerfil(@Usuario() usuario: UsuarioActual) {
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
        // TODO(bloque D): leer la prueba facial de la cookie solvia_face.
        // Mientras FaceVerifiedGuard no la exige, el acceso no se bloquea.
        verificado: true,
      },
    };
  }
}
