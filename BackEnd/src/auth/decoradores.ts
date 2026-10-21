import {
  applyDecorators,
  createParamDecorator,
  ExecutionContext,
  SetMetadata,
  UseGuards,
} from '@nestjs/common';
import { FaceVerifiedGuard } from './guards/face-verified/face-verified.guard.js';
import {
  NeonAuthGuard,
  type RequestSolvia,
  type UsuarioActual,
} from './guards/neon-auth/neon-auth.guard.js';
import { ROLES_KEY, RolesGuard, type Rol } from './guards/roles/roles.guard.js';

// Restringe un controlador o ruta a ciertos roles; sin @Roles basta con
// estar autenticado y verificado.
export const Roles = (...roles: Rol[]) => SetMetadata(ROLES_KEY, roles);

// Cadena de acceso de las rutas de negocio.
export const Protegido = () =>
  applyDecorators(UseGuards(NeonAuthGuard, FaceVerifiedGuard, RolesGuard));

export const Usuario = createParamDecorator(
  (_data: unknown, context: ExecutionContext): UsuarioActual =>
    context.switchToHttp().getRequest<RequestSolvia>().usuarioActual!,
);
