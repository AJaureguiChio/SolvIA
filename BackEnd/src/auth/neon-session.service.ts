import {
    BadGatewayException,
    Injectable,
    InternalServerErrorException,
    UnauthorizedException,
} from '@nestjs/common';

@Injectable()
export class NeonSessionService {
    async obtenerUsuarioId(cookie?: string): Promise<string> {
        if (!cookie) {
            throw new UnauthorizedException('Falta la sesión');
        }

        const baseUrl = process.env.NEON_AUTH_BASE_URL;
        if (!baseUrl) {
            throw new InternalServerErrorException('Falta NEON_AUTH_BASE_URL');
        }

        let respuesta: Response;

        try {
            respuesta = await fetch(
                `${baseUrl.replace(/\/$/, '')}/get-session`,
                {
                    headers: { cookie },
                    redirect: 'manual',
                },
            );
        } catch {
            throw new BadGatewayException('No se pudo consultar Neon Auth');
        }

        if (!respuesta.ok) {
            throw new UnauthorizedException('Sesión no válida');
        }

        const sesion = (await respuesta.json()) as {
            user?: { id?: string };
        } | null;

        if (!sesion?.user?.id) {
            throw new UnauthorizedException('Sesión no válida');
        }

        return sesion.user.id;
    }
}