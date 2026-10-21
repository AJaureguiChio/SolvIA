import { HttpStatus, Injectable } from '@nestjs/common';
import type { UsuarioActual } from '../auth/guards/neon-auth/neon-auth.guard.js';
import { exigirCuentaVisible, filtroGestor } from '../common/alcance.js';
import { ApiError } from '../common/api-error.js';
import {
  importe,
  sqlCuotasCubiertas,
  sqlEstadoCuentas,
  usuarioJson,
} from '../common/cartera.sql.js';
import { desplazamiento, pagina } from '../common/validacion.js';
import { DatabaseService } from '../database/database.service.js';
import type {
  AsignacionDto,
  CrearCuentaDto,
  ListarCuentasDto,
} from './cuentas.dto.js';

// Consulta base de cuenta + deudor + responsable + estado a la fecha de corte
// del parametro $1 (o hoy si es null).
const CORTE = 'COALESCE($1::date, CURRENT_DATE)';
const DEUDOR_COMPLETO = `,
    'curp', d.curp, 'rfc', d.rfc, 'telefono', d.telefono,
    'ciudad', d.ciudad, 'scoreBuro', d.score_buro`;

const selectCuenta = ({ deudorCompleto = false, extra = '' } = {}) => `
  SELECT c.id::text AS id,
         c.referencia_externa AS "referenciaExterna",
         c.producto,
         ${importe('c.monto_inicial')} AS "montoInicial",
         c.moneda,
         c.fecha_originacion AS "fechaOriginacion",
         json_build_object('id', d.id::text, 'nombre', d.nombre
                           ${deudorCompleto ? DEUDOR_COMPLETO : ''}) AS deudor,
         ${usuarioJson('c.responsable_id', 'ru')} AS responsable,
         ${importe('e.saldo')} AS saldo,
         ${importe('e.monto_exigible')} AS "montoExigible",
         ${importe('e.monto_vencido')} AS "montoVencido",
         e.estado_plan AS "estadoPlan",
         e.cuenta_liquidada AS "cuentaLiquidada",
         e.dias_mora AS "diasMora",
         e.prioridad::float8 AS prioridad
         ${extra}
    FROM public.cuentas c
    JOIN public.deudores d ON d.id = c.deudor_id
    JOIN (${sqlEstadoCuentas(CORTE)}) e ON e.cuenta_id = c.id
    LEFT JOIN neon_auth."user" ru ON ru.id = c.responsable_id`;

const ORDENES = {
  id: 'c.id',
  prioridad: 'e.prioridad DESC, e.monto_vencido DESC, c.id',
  saldo: 'e.saldo DESC, c.id',
} as const;

// "1250.5" -> 125050 centavos, sin errores de punto flotante.
function centavos(valor: string): bigint {
  const [enteros, decimales = ''] = valor.split('.');
  return BigInt(enteros) * 100n + BigInt(decimales.padEnd(2, '0'));
}

@Injectable()
export class CuentasService {
  constructor(private readonly database: DatabaseService) {}

  async listar(usuario: UsuarioActual, filtros: ListarCuentasDto) {
    const esAdmin = usuario.rol === 'administrador';
    const { rows } = await this.database.query(
      `${selectCuenta({ extra: ', count(*) OVER ()::int AS total' })}
        WHERE ($2::uuid IS NULL OR c.responsable_id = $2::uuid)
          AND ($3::uuid IS NULL OR c.responsable_id = $3::uuid)
          AND ($4::boolean IS NOT TRUE OR c.responsable_id IS NULL)
          AND ($5::bigint IS NULL OR c.deudor_id = $5::bigint)
          AND ($6::text IS NULL OR e.estado_plan = $6::text)
          AND ($7::boolean IS NULL OR e.cuenta_liquidada = $7::boolean)
          AND ($8::text IS NULL
               OR c.referencia_externa ILIKE '%' || $8 || '%'
               OR d.nombre ILIKE '%' || $8 || '%')
        ORDER BY ${ORDENES[filtros.orden ?? 'id']}
        LIMIT $9 OFFSET $10`,
      [
        filtros.fechaCorte ?? null,
        filtroGestor(usuario),
        esAdmin ? (filtros.responsableId ?? null) : null,
        esAdmin ? (filtros.sinAsignar ?? null) : null,
        filtros.deudorId ?? null,
        filtros.estadoPlan ?? null,
        filtros.liquidada ?? null,
        filtros.q?.trim().replace(/[%_\\]/g, '\\$&') || null,
        filtros.pageSize,
        desplazamiento(filtros),
      ],
    );
    return pagina(rows, filtros);
  }

  async obtener(usuario: UsuarioActual, id: string, fechaCorte?: string) {
    const { rows } = await this.database.query(
      `${selectCuenta({
        deudorCompleto: true,
        extra: `, ${importe(`(SELECT COALESCE(sum(p.monto), 0)
                                 FROM public.pagos p
                                WHERE p.cuenta_id = c.id)`)} AS "totalPagado"`,
      })}
        WHERE c.id = $2::bigint
          AND ($3::uuid IS NULL OR c.responsable_id = $3::uuid)`,
      [fechaCorte ?? null, id, filtroGestor(usuario)],
    );
    if (!rows[0]) throw ApiError.noEncontrado('Cuenta');

    const plan = await this.database.query(
      `SELECT p.fecha_acuerdo AS "fechaAcuerdo",
              json_agg(json_build_object(
                  'numero', q.numero,
                  'fechaVencimiento', q.fecha_vencimiento,
                  'monto', ${importe('q.monto')},
                  'montoCubierto', ${importe('q.cubierto')},
                  'estado', CASE
                      WHEN q.cubierto >= q.monto THEN 'pagada'
                      WHEN q.fecha_vencimiento < ${CORTE} THEN 'vencida'
                      WHEN q.cubierto > 0 THEN 'parcial'
                      ELSE 'pendiente' END
              ) ORDER BY q.numero) AS cuotas
         FROM public.planes_pago p
         JOIN (${sqlCuotasCubiertas(CORTE)}) q ON q.cuenta_id = p.cuenta_id
        WHERE p.cuenta_id = $2::bigint
        GROUP BY p.fecha_acuerdo`,
      [fechaCorte ?? null, id],
    );
    return { ...rows[0], plan: plan.rows[0] ?? null };
  }

  async crear(admin: UsuarioActual, dto: CrearCuentaDto) {
    const suma = dto.plan.cuotas.reduce((t, q) => t + centavos(q.monto), 0n);
    if (suma !== centavos(dto.montoInicial)) {
      throw new ApiError(
        HttpStatus.UNPROCESSABLE_ENTITY,
        'PLAN_INVALID',
        'Las cuotas deben sumar exactamente el monto inicial',
        {
          montoInicial: dto.montoInicial,
          sumaCuotas: (Number(suma) / 100).toFixed(2),
        },
      );
    }

    const id = await this.database.transaction(async (client) => {
      // Los triggers diferidos validan cuenta, plan y cuotas al COMMIT.
      const { rows } = await client.query(
        `INSERT INTO public.cuentas (
             deudor_id, referencia_externa, producto, monto_inicial, moneda,
             fecha_originacion, responsable_id, asignacion_modificada_por)
         VALUES ($1::bigint, $2, $3, $4::numeric, COALESCE($5, 'MXN'),
                 $6::date, $7::uuid,
                 CASE WHEN $7::uuid IS NULL THEN NULL ELSE $8::uuid END)
         RETURNING id::text AS id`,
        [
          dto.deudorId,
          dto.referenciaExterna?.trim() || null,
          dto.producto?.trim() || null,
          dto.montoInicial,
          dto.moneda ?? null,
          dto.fechaOriginacion ?? null,
          dto.responsableId ?? null,
          admin.id,
        ],
      );
      const cuentaId = (rows[0] as { id: string }).id;

      await client.query(
        `INSERT INTO public.planes_pago (cuenta_id, fecha_acuerdo)
         VALUES ($1::bigint, $2::date)`,
        [cuentaId, dto.plan.fechaAcuerdo],
      );
      await client.query(
        `INSERT INTO public.cuotas (cuenta_id, numero, fecha_vencimiento, monto)
         SELECT $1::bigint, q.numero, q.fecha, q.monto
           FROM unnest($2::int[], $3::date[], $4::numeric[])
                AS q(numero, fecha, monto)`,
        [
          cuentaId,
          dto.plan.cuotas.map((q) => q.numero),
          dto.plan.cuotas.map((q) => q.fechaVencimiento),
          dto.plan.cuotas.map((q) => q.monto),
        ],
      );
      return cuentaId;
    });

    return this.obtener(admin, id);
  }

  async asignar(admin: UsuarioActual, id: string, dto: AsignacionDto) {
    await this.database.transaction(async (client) => {
      const { rows } = await client.query(
        `SELECT responsable_id::text AS "responsableId"
           FROM public.cuentas WHERE id = $1::bigint FOR UPDATE`,
        [id],
      );
      const actual = rows[0] as { responsableId: string | null } | undefined;
      if (!actual) throw ApiError.noEncontrado('Cuenta');
      // Sin cambio real no se toca la fila: el trigger rechaza cambiar solo
      // el autor de la asignacion.
      if (actual.responsableId === dto.responsableId) return;

      // El trigger valida que el nuevo responsable sea un gestor activo y
      // escribe historial_asignaciones.
      await client.query(
        `UPDATE public.cuentas
            SET responsable_id = $2::uuid, asignacion_modificada_por = $3::uuid
          WHERE id = $1::bigint`,
        [id, dto.responsableId, admin.id],
      );
    });
    return this.obtener(admin, id);
  }

  async historialAsignaciones(usuario: UsuarioActual, id: string) {
    await exigirCuentaVisible(this.database, usuario, id);
    const { rows } = await this.database.query(
      `SELECT h.id::text AS id,
              h.realizada_en AS "realizadaEn",
              ${usuarioJson('h.responsable_anterior_id', 'ua')} AS "responsableAnterior",
              ${usuarioJson('h.responsable_nuevo_id', 'un')} AS "responsableNuevo",
              ${usuarioJson('h.realizada_por', 'up')} AS "realizadaPor"
         FROM public.historial_asignaciones h
         LEFT JOIN neon_auth."user" ua ON ua.id = h.responsable_anterior_id
         LEFT JOIN neon_auth."user" un ON un.id = h.responsable_nuevo_id
         LEFT JOIN neon_auth."user" up ON up.id = h.realizada_por
        WHERE h.cuenta_id = $1::bigint
        ORDER BY h.realizada_en DESC, h.id DESC`,
      [id],
    );
    return { items: rows };
  }
}
