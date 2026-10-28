import {
  CanActivate,
  ExecutionContext,
  HttpStatus,
  Injectable,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ApiError } from '../../../common/api-error.js';
import { pruebaFacialVigente } from '../../prueba-facial.js';
import type { RequestSolvia } from '../neon-auth/neon-auth.guard.js';

// Exige una prueba facial vigente del mismo usuario que identificó
// NeonAuthGuard (que va antes en @Protegido). Sin ella, 401.
@Injectable()
export class FaceVerifiedGuard implements CanActivate {
  private readonly secreto: string;

  constructor(config: ConfigService) {
    this.secreto = config.getOrThrow<string>('FACE_JWT_SECRET');
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<RequestSolvia>();
    const usuario = request.usuarioActual;

    if (
      !usuario ||
      !(await pruebaFacialVigente(request, usuario.id, this.secreto))
    ) {
      throw new ApiError(
        HttpStatus.UNAUTHORIZED,
        'FACE_VERIFICATION_REQUIRED',
        'Verifica tu rostro para continuar',
      );
    }
    return true;
  }
}
