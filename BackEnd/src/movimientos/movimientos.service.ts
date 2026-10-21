import { Injectable } from '@nestjs/common';
import type { UsuarioActual } from '../auth/guards/neon-auth/neon-auth.guard.js';
import { exigirCuentaVisible } from '../common/alcance.js';
import { ApiError } from '../common/api-error.js';
import { importe, usuarioJson } from '../common/cartera.sql.js';
import {
  desplazamiento,
  pagina,
  type PaginacionDto,
} from '../common/validacion.js';
import { DatabaseService } from '../database/database.service.js';
import {
  TIPOS_ABONO,
  TIPOS_CON_PAGO,
  type CrearMovimientoDto,
} from './movimientos.dto.js';

const COLUMNAS_MOVIMIENTO = `
  m.id::text AS id, m.cuenta_id::text AS "cuentaId", m.tipo,
  ${importe('m.impacto_saldo')} AS "impactoSaldo",
  m.fecha_efectiva AS "fechaEfectiva", m.motivo,
  m.pago_origen_id::text AS "pagoOrigenId",
  ${usuarioJson('m.registrado_por', 'u')} AS "registradoPor",
  m.registrado_en AS "registradoEn"`;

@Injectable()
export class MovimientosService {
  constructor(private readonly database: DatabaseService) {}

  async listar(
    usuario: UsuarioActual,
    cuentaId: string,
    filtros: PaginacionDto,
  ) {
    await exigirCuentaVisible(this.database, usuario, cuentaId);
    const { rows } = await this.database.query(
      `SELECT ${COLUMNAS_MOVIMIENTO}, count(*) OVER ()::int AS total
         FROM public.movimientos_saldo m
         JOIN neon_auth."user" u ON u.id = m.registrado_por
        WHERE m.cuenta_id = $1::bigint
        ORDER BY m.fecha_efectiva DESC, m.id DESC
        LIMIT $2 OFFSET $3`,
      [cuentaId, filtros.pageSize, desplazamiento(filtros)],
    );
    return pagina(rows, filtros);
  }

  async crear(admin: UsuarioActual, cuentaId: string, dto: CrearMovimientoDto) {
    await exigirCuentaVisible(this.database, admin, cuentaId);

    const requierePago = TIPOS_CON_PAGO.includes(dto.tipo);
    if (requierePago !== Boolean(dto.pagoOrigenId)) {
      throw ApiError.entradaInvalida(
        requierePago
          ? 'Reembolsos y reversiones requieren pagoOrigenId'
          : 'Solo reembolsos y reversiones llevan pagoOrigenId',
        { pagoOrigenId: [requierePago ? 'obligatorio' : 'no permitido'] },
      );
    }
    const signo = (TIPOS_ABONO as readonly string[]).includes(dto.tipo)
      ? '-'
      : '';

    const { rows } = await this.database.query(
      `INSERT INTO public.movimientos_saldo (
           cuenta_id, tipo, impacto_saldo, fecha_efectiva, motivo,
           pago_origen_id, registrado_por)
       VALUES ($1::bigint, $2, $3::numeric, $4::date, $5, $6::bigint, $7::uuid)
       RETURNING id::text AS id`,
      [
        cuentaId,
        dto.tipo,
        `${signo}${dto.monto}`,
        dto.fechaEfectiva,
        dto.motivo.trim(),
        dto.pagoOrigenId ?? null,
        admin.id,
      ],
    );

    // Consulta aparte: un CTE de escritura no veria el nuevo saldo.
    const movimiento = await this.database.query(
      `SELECT ${COLUMNAS_MOVIMIENTO},
              ${importe('public.saldo_cuenta(m.cuenta_id)')} AS "saldoCuenta"
         FROM public.movimientos_saldo m
         JOIN neon_auth."user" u ON u.id = m.registrado_por
        WHERE m.id = $1::bigint`,
      [(rows[0] as { id: string }).id],
    );
    return movimiento.rows[0];
  }
}
