import { HttpStatus, Injectable } from '@nestjs/common';
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
import type { CrearPagoDto } from './pagos.dto.js';

const COLUMNAS_PAGO = `
  p.id::text AS id, p.cuenta_id::text AS "cuentaId",
  p.fecha_pago AS "fechaPago", ${importe('p.monto')} AS monto,
  ${usuarioJson('p.registrado_por', 'u')} AS "registradoPor",
  p.registrado_en AS "registradoEn",
  ${importe(`(SELECT COALESCE(sum(m.impacto_saldo), 0)
                FROM public.movimientos_saldo m
               WHERE m.pago_origen_id = p.id)`)} AS "montoRevertido"`;

@Injectable()
export class PagosService {
  constructor(private readonly database: DatabaseService) {}

  async listar(
    usuario: UsuarioActual,
    cuentaId: string,
    filtros: PaginacionDto,
  ) {
    await exigirCuentaVisible(this.database, usuario, cuentaId);
    const { rows } = await this.database.query(
      `SELECT ${COLUMNAS_PAGO}, count(*) OVER ()::int AS total
         FROM public.pagos p
         JOIN neon_auth."user" u ON u.id = p.registrado_por
        WHERE p.cuenta_id = $1::bigint
        ORDER BY p.fecha_pago DESC, p.id DESC
        LIMIT $2 OFFSET $3`,
      [cuentaId, filtros.pageSize, desplazamiento(filtros)],
    );
    return pagina(rows, filtros);
  }

  // Solo el gestor asignado registra pagos; registrado_por sale de la sesion.
  // Los triggers validan saldo, rango de fechas y bloquean la cuenta.
  async crear(gestor: UsuarioActual, cuentaId: string, dto: CrearPagoDto) {
    const { responsableId } = await exigirCuentaVisible(
      this.database,
      gestor,
      cuentaId,
    );
    if (responsableId !== gestor.id) {
      throw new ApiError(
        HttpStatus.FORBIDDEN,
        'FORBIDDEN',
        'Solo el gestor asignado puede registrar pagos en esta cuenta',
      );
    }

    const { rows } = await this.database.query(
      `INSERT INTO public.pagos (cuenta_id, fecha_pago, monto, registrado_por)
       VALUES ($1::bigint, $2::date, $3::numeric, $4::uuid)
       RETURNING id::text AS id`,
      [cuentaId, dto.fechaPago, dto.monto, gestor.id],
    );
    const pagoId = (rows[0] as { id: string }).id;

    const pago = await this.database.query(
      `SELECT ${COLUMNAS_PAGO},
              ${importe('public.saldo_cuenta(p.cuenta_id)')} AS "saldoCuenta"
         FROM public.pagos p
         JOIN neon_auth."user" u ON u.id = p.registrado_por
        WHERE p.id = $1::bigint`,
      [pagoId],
    );
    return pago.rows[0];
  }
}
