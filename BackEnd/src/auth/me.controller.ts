import { Controller, Get, Req, UseGuards, Headers } from '@nestjs/common';
import {
    NeonAuthGuard,
    type RequestSolvia,
} from './guards/neon-auth/neon-auth.guard.js';
import { NeonSessionService } from './neon-session.service.js';

@Controller('me')
export class MeController {
    constructor(private readonly neonSession: NeonSessionService) { }

    @Get()
    async obtenerMiIdentidad(@Headers('cookie') cookie?: string) {
        const id = await this.neonSession.obtenerUsuarioId(cookie);
        return { id };
    }
    // @Get()
    // @UseGuards(NeonAuthGuard)
    // obtenerPerfil(@Req() request: RequestSolvia) {
    //     return request.usuarioActual;
    // }
}