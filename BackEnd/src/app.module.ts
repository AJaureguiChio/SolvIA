import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AuthModule } from './auth/auth.module.js';
import { FacialModule } from './facial/facial.module.js';
import { UsuariosModule } from './usuarios/usuarios.module.js';
import { DeudoresModule } from './deudores/deudores.module.js';
import { CuentasModule } from './cuentas/cuentas.module.js';
import { PagosModule } from './pagos/pagos.module.js';
import { MovimientosModule } from './movimientos/movimientos.module.js';
import { PanelModule } from './panel/panel.module.js';
import { ReportesModule } from './reportes/reportes.module.js';
import { DatabaseModule } from './database/database.module.js';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '../.env',
    }),
    AuthModule,
    FacialModule,
    UsuariosModule,
    DeudoresModule,
    CuentasModule,
    PagosModule,
    MovimientosModule,
    PanelModule,
    ReportesModule,
    DatabaseModule
  ],
})
export class AppModule {}
