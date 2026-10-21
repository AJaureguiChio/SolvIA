import { HttpStatus, Injectable } from '@nestjs/common';
import type { UsuarioActual } from '../auth/guards/neon-auth/neon-auth.guard.js';
import { ApiError } from '../common/api-error.js';
import { DatabaseService } from '../database/database.service.js';
import type {
  ActualizarUsuarioDto,
  ListarUsuariosDto,
} from './usuarios.dto.js';

const SELECT_USUARIO = `
  SELECT p.id::text AS id, u.name AS nombre, u.email, p.rol, p.activo,
         (SELECT count(*)::int FROM public.cuentas c
           WHERE c.responsable_id = p.id) AS "cuentasAsignadas"
    FROM public.perfiles_usuario p
    JOIN neon_auth."user" u ON u.id = p.id`;

@Injectable()
export class UsuariosService {
  constructor(private readonly database: DatabaseService) {}

  async listar(filtros: ListarUsuariosDto) {
    const { rows } = await this.database.query(
      `${SELECT_USUARIO}
        WHERE ($1::text IS NULL OR p.rol = $1::text)
          AND ($2::boolean IS NULL OR p.activo = $2::boolean)
        ORDER BY p.rol, u.name, u.email`,
      [filtros.rol ?? null, filtros.activo ?? null],
    );
    return { items: rows };
  }

  async obtener(id: string) {
    const { rows } = await this.database.query(
      `${SELECT_USUARIO} WHERE p.id = $1::uuid`,
      [id],
    );
    if (!rows[0]) throw ApiError.noEncontrado('Usuario');
    return rows[0];
  }

  // El trigger impide desactivar o cambiar de rol a un gestor con cuentas
  // (409 USER_HAS_ACCOUNTS). Aqui se evita quedarse sin administradores.
  async actualizar(
    admin: UsuarioActual,
    id: string,
    dto: ActualizarUsuarioDto,
  ) {
    if (dto.rol === undefined && dto.activo === undefined) {
      throw ApiError.entradaInvalida('Indica rol y/o activo');
    }
    if (id === admin.id) {
      throw new ApiError(
        HttpStatus.CONFLICT,
        'SELF_MODIFICATION',
        'No puedes cambiar tu propio rol ni desactivarte',
      );
    }

    await this.database.transaction(async (client) => {
      const admins = await client.query(
        `SELECT id FROM public.perfiles_usuario
          WHERE rol = 'administrador' AND activo
          FOR UPDATE`,
      );
      const actual = await client.query(
        `SELECT rol, activo FROM public.perfiles_usuario
          WHERE id = $1::uuid FOR UPDATE`,
        [id],
      );
      const perfil = actual.rows[0] as
        { rol: string; activo: boolean } | undefined;
      if (!perfil) throw ApiError.noEncontrado('Usuario');

      const dejaDeSerAdmin =
        perfil.rol === 'administrador' &&
        perfil.activo &&
        (dto.rol === 'gestor' || dto.activo === false);
      if (dejaDeSerAdmin && admins.rows.length <= 1) {
        throw new ApiError(
          HttpStatus.CONFLICT,
          'LAST_ADMIN',
          'Debe quedar al menos un administrador activo',
        );
      }

      await client.query(
        `UPDATE public.perfiles_usuario
            SET rol = COALESCE($2::text, rol),
                activo = COALESCE($3::boolean, activo)
          WHERE id = $1::uuid`,
        [id, dto.rol ?? null, dto.activo ?? null],
      );
    });
    return this.obtener(id);
  }
}
