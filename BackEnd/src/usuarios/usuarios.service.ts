import { HttpStatus, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { UsuarioActual } from '../auth/guards/neon-auth/neon-auth.guard.js';
import { ApiError } from '../common/api-error.js';
import { DatabaseService } from '../database/database.service.js';
import type {
  ActualizarUsuarioDto,
  CrearUsuarioDto,
  ListarUsuariosDto,
} from './usuarios.dto.js';

const SELECT_USUARIO = `
  SELECT p.id::text AS id, u.name AS nombre, u.email, p.rol, p.activo,
         (SELECT count(*)::int FROM public.cuentas c
           WHERE c.responsable_id = p.id) AS "cuentasAsignadas",
         EXISTS (SELECT 1 FROM public.facial_plantillas f
                  WHERE f.usuario_id = p.id) AS "facialInscrito"
    FROM public.perfiles_usuario p
    JOIN neon_auth."user" u ON u.id = p.id`;

@Injectable()
export class UsuariosService {
  private readonly logger = new Logger(UsuariosService.name);
  private readonly urlNeonAuth: string;
  // Neon Auth rechaza peticiones sin Origin de un dominio de confianza.
  private readonly origen: string;

  constructor(
    config: ConfigService,
    private readonly database: DatabaseService,
  ) {
    this.urlNeonAuth = config.getOrThrow<string>('NEON_AUTH_BASE_URL');
    this.origen = (
      config.get<string>('FRONTEND_ORIGIN') ?? 'http://localhost:5173'
    ).split(',')[0];
  }

  // Si falla el alta del perfil despues de crear la identidad, reintentar con
  // el mismo correo reutiliza la identidad: no se duplica.
  async crear(dto: CrearUsuarioDto) {
    const email = dto.email.trim().toLowerCase();
    let id = await this.identidadPorCorreo(email);
    const identidadNueva = !id;
    if (!id) id = await this.registrarIdentidad(dto, email);

    try {
      await this.database.query(
        `INSERT INTO public.perfiles_usuario (id, rol, activo)
         VALUES ($1::uuid, $2, true)`,
        [id, dto.rol],
      );
    } catch (error) {
      if ((error as { code?: string }).code === '23505') {
        throw new ApiError(
          HttpStatus.CONFLICT,
          'DUPLICATE_IDENTIFIER',
          'Ya existe un usuario con ese correo',
        );
      }
      throw error;
    }
    return { ...(await this.obtener(id)), identidadNueva };
  }

  private async identidadPorCorreo(email: string) {
    const { rows } = await this.database.query(
      `SELECT id::text AS id FROM neon_auth."user" WHERE lower(email) = $1`,
      [email],
    );
    return (rows[0] as { id: string } | undefined)?.id;
  }

  // Mismo registro de correo y contrasena que usa Neon Auth (Better Auth).
  // La sesion que devuelve para el nuevo usuario se descarta.
  private async registrarIdentidad(dto: CrearUsuarioDto, email: string) {
    let respuesta: Response;
    try {
      respuesta = await fetch(`${this.urlNeonAuth}/sign-up/email`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Origin: this.origen },
        body: JSON.stringify({
          name: dto.nombre.trim(),
          email,
          password: dto.password,
        }),
        signal: AbortSignal.timeout(15000),
      });
    } catch {
      throw this.authNoDisponible();
    }

    const cuerpo = (await respuesta.json().catch(() => null)) as {
      user?: { id?: string };
      code?: string;
      message?: string;
    } | null;
    if (respuesta.ok && cuerpo?.user?.id) return cuerpo.user.id;

    // Carrera: otra peticion creo la identidad entre la consulta y el registro.
    if (cuerpo?.code === 'USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL') {
      const id = await this.identidadPorCorreo(email);
      if (id) return id;
    }
    if (respuesta.status === 400 || respuesta.status === 422) {
      throw ApiError.entradaInvalida(
        cuerpo?.message ?? 'Neon Auth rechazó los datos del usuario',
        { neonAuth: [cuerpo?.code ?? `HTTP ${respuesta.status}`] },
      );
    }
    this.logger.error(
      `sign-up de Neon Auth respondio ${respuesta.status} ${cuerpo?.code ?? ''}`,
    );
    throw this.authNoDisponible();
  }

  private authNoDisponible() {
    return new ApiError(
      HttpStatus.SERVICE_UNAVAILABLE,
      'AUTH_SERVICE_UNAVAILABLE',
      'No fue posible crear la cuenta en Neon Auth. Inténtalo de nuevo.',
    );
  }

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
