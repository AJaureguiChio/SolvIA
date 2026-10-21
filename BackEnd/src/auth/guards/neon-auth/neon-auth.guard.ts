import {
  CanActivate,
  ExecutionContext,
  HttpStatus,
  Injectable,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Request } from 'express';
import { createRemoteJWKSet, jwtVerify } from 'jose';
import { ApiError } from '../../../common/api-error.js';
import { DatabaseService } from '../../../database/database.service.js';

export type UsuarioActual = {
  id: string;
  rol: 'administrador' | 'gestor';
  activo: boolean;
};

export type RequestSolvia = Request & {
  usuarioActual?: UsuarioActual;
};

@Injectable()
export class NeonAuthGuard implements CanActivate {
  private readonly jwks: ReturnType<typeof createRemoteJWKSet>;
  private readonly issuer: string;

  constructor(
    config: ConfigService,
    private readonly database: DatabaseService,
  ) {
    this.jwks = createRemoteJWKSet(
      new URL(config.getOrThrow<string>('NEON_AUTH_JWKS_URL')),
    );

    this.issuer = new URL(
      config.getOrThrow<string>('NEON_AUTH_BASE_URL'),
    ).origin;
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<RequestSolvia>();
    const token = /^Bearer\s+(.+)$/i.exec(
      request.headers.authorization ?? '',
    )?.[1];

    if (!token) {
      throw new ApiError(
        HttpStatus.UNAUTHORIZED,
        'UNAUTHENTICATED',
        'Falta el token de Neon Auth',
      );
    }

    let usuarioId: string;

    try {
      const { payload } = await jwtVerify(token, this.jwks, {
        issuer: this.issuer,
        requiredClaims: ['sub', 'exp'],
      });

      if (
        typeof payload.sub !== 'string' ||
        !/^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(payload.sub)
      ) {
        throw new Error('Identificador de usuario inválido');
      }

      usuarioId = payload.sub;
    } catch {
      throw new ApiError(
        HttpStatus.UNAUTHORIZED,
        'UNAUTHENTICATED',
        'Token inválido o vencido',
      );
    }

    const resultado = await this.database.query(
      `SELECT id::text AS id, rol, activo
       FROM public.perfiles_usuario
       WHERE id = $1::uuid`,
      [usuarioId],
    );

    const perfil = resultado.rows[0] as UsuarioActual | undefined;

    if (!perfil) {
      throw new ApiError(
        HttpStatus.FORBIDDEN,
        'PROFILE_REQUIRED',
        'El usuario no tiene perfil en SolvIA',
      );
    }

    if (!perfil.activo) {
      throw new ApiError(
        HttpStatus.FORBIDDEN,
        'PROFILE_INACTIVE',
        'El usuario está desactivado',
      );
    }

    request.usuarioActual = perfil;
    return true;
  }
}
