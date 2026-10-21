import { Injectable } from '@nestjs/common';
import type { UsuarioActual } from '../auth/guards/neon-auth/neon-auth.guard.js';
import { filtroGestor } from '../common/alcance.js';
import { ApiError } from '../common/api-error.js';
import {
  importe,
  sqlCuotasCubiertas,
  sqlEstadoCuentas,
  usuarioJson,
} from '../common/cartera.sql.js';
import { DatabaseService } from '../database/database.service.js';
import type { PrioridadesDto, ResumenPanelDto } from './panel.dto.js';

// $1 = fecha de corte (null = hoy), $2 = gestor (null = toda la cartera).
const CORTE = 'COALESCE($1::date, CURRENT_DATE)';
const CUENTAS_VISIBLES = `
  FROM public.cuentas c
  JOIN (${sqlEstadoCuentas(CORTE)}) e ON e.cuenta_id = c.id
 WHERE ($2::uuid IS NULL OR c.responsable_id = $2::uuid)`;

// Rangos de dias de mora para la grafica de morosidad.
const RANGOS_MORA = `
  (VALUES (1, 'sin_mora', 0, 0), (2, '1-30', 1, 30), (3, '31-60', 31, 60),
          (4, '61-90', 61, 90), (5, '90+', 91, 2147483647))
  AS r(orden, rango, minimo, maximo)`;

type Totales = {
  cuentas: number;
  alCorriente: number;
  atrasadas: number;
  cubiertas: number;
  liquidadas: number;
  sinAsignar?: number;
  saldoTotal: string;
  montoExigible: string;
  montoVencido: string;
  indiceMorosidad: number;
};

@Injectable()
export class PanelService {
  constructor(private readonly database: DatabaseService) {}

  async resumen(usuario: UsuarioActual, filtros: ResumenPanelDto) {
    if (filtros.desde && filtros.hasta && filtros.desde > filtros.hasta) {
      throw ApiError.entradaInvalida('desde no puede ser posterior a hasta');
    }
    const base = [filtros.fechaCorte ?? null, filtroGestor(usuario)];
    const periodo = [...base, filtros.desde ?? null, filtros.hasta ?? null];
    const DESDE = `COALESCE($3::date,
        (date_trunc('month', ${CORTE}) - interval '5 months')::date)`;
    const HASTA = `COALESCE($4::date, ${CORTE})`;

    const [totales, morosidad, pagos, vencimientos] = await Promise.all([
      this.database.query(
        `SELECT ${CORTE} AS "fechaCorte", ${DESDE} AS desde, ${HASTA} AS hasta,
                count(*)::int AS cuentas,
                count(*) FILTER (WHERE e.estado_plan = 'al_corriente')::int
                    AS "alCorriente",
                count(*) FILTER (WHERE e.estado_plan = 'atrasado')::int
                    AS atrasadas,
                count(*) FILTER (WHERE e.estado_plan = 'cubierto')::int
                    AS cubiertas,
                count(*) FILTER (WHERE e.cuenta_liquidada)::int AS liquidadas,
                count(*) FILTER (WHERE c.responsable_id IS NULL)::int
                    AS "sinAsignar",
                ${importe('COALESCE(sum(e.saldo), 0)')} AS "saldoTotal",
                ${importe('COALESCE(sum(e.monto_exigible), 0)')}
                    AS "montoExigible",
                ${importe('COALESCE(sum(e.monto_vencido), 0)')}
                    AS "montoVencido",
                COALESCE(round(100.0
                    * count(*) FILTER (WHERE e.estado_plan = 'atrasado')
                    / NULLIF(count(*), 0), 1), 0)::float8 AS "indiceMorosidad"
           ${CUENTAS_VISIBLES}`,
        periodo,
      ),
      this.database.query(
        `SELECT r.rango, count(x.cuenta_id)::int AS cuentas,
                ${importe('COALESCE(sum(x.monto_vencido), 0)')} AS "montoVencido"
           FROM ${RANGOS_MORA}
           LEFT JOIN (SELECT e.cuenta_id, e.dias_mora, e.monto_vencido
                        ${CUENTAS_VISIBLES}
                         AND NOT e.cuenta_liquidada) x
                  ON x.dias_mora BETWEEN r.minimo AND r.maximo
          GROUP BY r.orden, r.rango
          ORDER BY r.orden`,
        base,
      ),
      // Pagos cobrados frente a cuotas que vencian en cada mes del periodo.
      this.database.query(
        `SELECT to_char(m.mes, 'YYYY-MM') AS periodo,
                ${importe(`(SELECT COALESCE(sum(p.monto), 0)
                              FROM public.pagos p
                              JOIN public.cuentas c ON c.id = p.cuenta_id
                             WHERE ($2::uuid IS NULL OR c.responsable_id = $2::uuid)
                               AND date_trunc('month', p.fecha_pago) = m.mes
                               AND p.fecha_pago BETWEEN ${DESDE} AND ${HASTA})`)}
                    AS monto,
                (SELECT count(*)::int
                   FROM public.pagos p
                   JOIN public.cuentas c ON c.id = p.cuenta_id
                  WHERE ($2::uuid IS NULL OR c.responsable_id = $2::uuid)
                    AND date_trunc('month', p.fecha_pago) = m.mes
                    AND p.fecha_pago BETWEEN ${DESDE} AND ${HASTA})
                    AS pagos,
                ${importe(`(SELECT COALESCE(sum(q.monto), 0)
                              FROM public.cuotas q
                              JOIN public.cuentas c ON c.id = q.cuenta_id
                             WHERE ($2::uuid IS NULL OR c.responsable_id = $2::uuid)
                               AND date_trunc('month', q.fecha_vencimiento) = m.mes)`)}
                    AS esperado
           FROM generate_series(date_trunc('month', ${DESDE}),
                                date_trunc('month', ${HASTA}),
                                interval '1 month') AS m(mes)
          ORDER BY m.mes`,
        periodo,
      ),
      // Cuotas de los proximos 30 dias que aun no estan cubiertas.
      this.database.query(
        `SELECT c.id::text AS "cuentaId",
                c.referencia_externa AS "referenciaExterna",
                d.nombre AS deudor,
                q.numero,
                q.fecha_vencimiento AS "fechaVencimiento",
                ${importe('q.monto - q.cubierto')} AS "montoPendiente"
           FROM (${sqlCuotasCubiertas(CORTE)}) q
           JOIN public.cuentas c ON c.id = q.cuenta_id
           JOIN public.deudores d ON d.id = c.deudor_id
          WHERE ($2::uuid IS NULL OR c.responsable_id = $2::uuid)
            AND q.cubierto < q.monto
            AND q.fecha_vencimiento BETWEEN ${CORTE} AND ${CORTE} + 30
          ORDER BY q.fecha_vencimiento, c.id
          LIMIT 10`,
        base,
      ),
    ]);

    const { fechaCorte, desde, hasta, ...t } = totales.rows[0] as Totales & {
      fechaCorte: string;
      desde: string;
      hasta: string;
    };
    if (usuario.rol === 'gestor') delete t.sinAsignar;

    return {
      fechaCorte,
      desde,
      hasta,
      totales: t,
      distribucionPlan: [
        { estadoPlan: 'al_corriente', cuentas: t.alCorriente },
        { estadoPlan: 'atrasado', cuentas: t.atrasadas },
        { estadoPlan: 'cubierto', cuentas: t.cubiertas },
      ],
      morosidad: morosidad.rows,
      pagosPorPeriodo: pagos.rows,
      proximosVencimientos: vencimientos.rows,
    };
  }

  // Cuentas ordenadas por el puntaje de atencion P, con sus componentes para
  // explicar el orden. P no es una probabilidad de impago.
  async prioridades(usuario: UsuarioActual, filtros: PrioridadesDto) {
    const { rows } = await this.database.query(
      `SELECT c.id::text AS id,
              c.referencia_externa AS "referenciaExterna",
              json_build_object('id', d.id::text, 'nombre', d.nombre) AS deudor,
              ${usuarioJson('c.responsable_id', 'ru')} AS responsable,
              e.estado_plan AS "estadoPlan",
              ${importe('e.monto_exigible')} AS "montoExigible",
              ${importe('e.monto_vencido')} AS "montoVencido",
              ${importe('e.saldo')} AS saldo,
              e.dias_mora AS "diasMora",
              e.prioridad::float8 AS prioridad,
              json_build_object(
                  'proporcionVencida',
                  round(LEAST(e.monto_vencido / e.monto_exigible, 1), 4)::float8,
                  'factorMora',
                  round(LEAST(e.dias_mora / 30.0, 1), 4)::float8
              ) AS componentes
         FROM public.cuentas c
         JOIN (${sqlEstadoCuentas(CORTE)}) e ON e.cuenta_id = c.id
         JOIN public.deudores d ON d.id = c.deudor_id
         LEFT JOIN neon_auth."user" ru ON ru.id = c.responsable_id
        WHERE ($2::uuid IS NULL OR c.responsable_id = $2::uuid)
          AND e.prioridad > 0
        ORDER BY e.prioridad DESC, e.monto_vencido DESC, c.id
        LIMIT $3`,
      [filtros.fechaCorte ?? null, filtroGestor(usuario), filtros.limit],
    );
    return { items: rows };
  }
}
