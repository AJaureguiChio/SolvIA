import {
  CanActivate,
  ExecutionContext,
  HttpStatus,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ApiError } from '../../../common/api-error.js';
import type {
  RequestSolvia,
  UsuarioActual,
} from '../neon-auth/neon-auth.guard.js';

export const ROLES_KEY = 'roles';

export type Rol = UsuarioActual['rol'];

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const roles = this.reflector.getAllAndOverride<Rol[] | undefined>(
      ROLES_KEY,
      [context.getHandler(), context.getClass()],
    );
    if (!roles?.length) return true;

    const usuario = context
      .switchToHttp()
      .getRequest<RequestSolvia>().usuarioActual;
    if (usuario && roles.includes(usuario.rol)) return true;

    throw new ApiError(
      HttpStatus.FORBIDDEN,
      'FORBIDDEN',
      'Tu rol no permite esta operación',
    );
  }
}
