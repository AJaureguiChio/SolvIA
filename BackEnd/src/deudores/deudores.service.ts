import { Injectable } from '@nestjs/common';
import type { UsuarioActual } from '../auth/guards/neon-auth/neon-auth.guard.js';
import { filtroGestor } from '../common/alcance.js';
import { ApiError } from '../common/api-error.js';
import { importe, sqlEstadoCuentas } from '../common/cartera.sql.js';
import { desplazamiento, pagina } from '../common/validacion.js';
import { DatabaseService } from '../database/database.service.js';
import type {
  ActualizarDeudorDto,
  CrearDeudorDto,
  ListarDeudoresDto,
} from './deudores.dto.js';

const COLUMNAS_DEUDOR = `
  d.id::text AS id, d.nombre, d.curp, d.rfc, d.telefono, d.ciudad,
  d.segmento, d.score_buro AS "scoreBuro"`;

// Campos del DTO -> columnas que el esquema permite modificar.
const COLUMNAS_EDITABLES: Record<keyof CrearDeudorDto, string> = {
  nombre: 'nombre',
  curp: 'curp',
  rfc: 'rfc',
  telefono: 'telefono',
  ciudad: 'ciudad',
  segmento: 'segmento',
  scoreBuro: 'score_buro',
};

@Injectable()
export class DeudoresService {
  constructor(private readonly database: DatabaseService) {}

  async listar(usuario: UsuarioActual, filtros: ListarDeudoresDto) {
    const { rows } = await this.database.query(
      `SELECT ${COLUMNAS_DEUDOR},
              (SELECT count(*)::int FROM public.cuentas c
                WHERE c.deudor_id = d.id
                  AND ($1::uuid IS NULL OR c.responsable_id = $1::uuid))
                  AS "numeroCuentas",
              count(*) OVER ()::int AS total
         FROM public.deudores d
        WHERE ($1::uuid IS NULL OR EXISTS (
                  SELECT 1 FROM public.cuentas c
                   WHERE c.deudor_id = d.id AND c.responsable_id = $1::uuid))
          AND ($2::text IS NULL
               OR d.nombre ILIKE '%' || $2 || '%'
               OR d.curp ILIKE $2 || '%'
               OR d.rfc ILIKE $2 || '%')
        ORDER BY d.nombre, d.id
        LIMIT $3 OFFSET $4`,
      [
        filtroGestor(usuario),
        filtros.q?.trim().replace(/[%_\\]/g, '\\$&') || null,
        filtros.pageSize,
        desplazamiento(filtros),
      ],
    );
    return pagina(rows, filtros);
  }

  async obtener(usuario: UsuarioActual, id: string) {
    const gestor = filtroGestor(usuario);
    const { rows } = await this.database.query(
      `SELECT ${COLUMNAS_DEUDOR}
         FROM public.deudores d
        WHERE d.id = $1::bigint
          AND ($2::uuid IS NULL OR EXISTS (
                  SELECT 1 FROM public.cuentas c
                   WHERE c.deudor_id = d.id AND c.responsable_id = $2::uuid))`,
      [id, gestor],
    );
    if (!rows[0]) throw ApiError.noEncontrado('Deudor');

    const cuentas = await this.database.query(
      `SELECT c.id::text AS id, c.referencia_externa AS "referenciaExterna",
              c.producto, ${importe('c.monto_inicial')} AS "montoInicial",
              c.moneda, ${importe('e.saldo')} AS saldo,
              e.estado_plan AS "estadoPlan",
              e.cuenta_liquidada AS "cuentaLiquidada",
              e.dias_mora AS "diasMora"
         FROM public.cuentas c
         JOIN (${sqlEstadoCuentas('CURRENT_DATE')}) e ON e.cuenta_id = c.id
        WHERE c.deudor_id = $1::bigint
          AND ($2::uuid IS NULL OR c.responsable_id = $2::uuid)
        ORDER BY c.id`,
      [id, gestor],
    );
    return { ...rows[0], cuentas: cuentas.rows };
  }

  async crear(dto: CrearDeudorDto) {
    if (!dto.curp && !dto.rfc) {
      throw ApiError.entradaInvalida('Se requiere CURP o RFC', {
        curp: ['curp o rfc es obligatorio'],
      });
    }
    const { rows } = await this.database.query(
      `INSERT INTO public.deudores AS d
           (nombre, curp, rfc, telefono, ciudad, segmento, score_buro)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING ${COLUMNAS_DEUDOR}`,
      [
        dto.nombre.trim(),
        dto.curp || null,
        dto.rfc || null,
        dto.telefono ?? null,
        dto.ciudad ?? null,
        dto.segmento ?? null,
        dto.scoreBuro,
      ],
    );
    return rows[0];
  }

  async actualizar(id: string, dto: ActualizarDeudorDto) {
    const cambios = (
      Object.keys(COLUMNAS_EDITABLES) as (keyof CrearDeudorDto)[]
    )
      .filter((campo) => dto[campo] !== undefined)
      .map((campo) => {
        const valor = dto[campo];
        return [
          COLUMNAS_EDITABLES[campo],
          typeof valor === 'string' && valor.trim() === '' ? null : valor,
        ] as const;
      });
    if (!cambios.length) {
      throw ApiError.entradaInvalida('No hay campos que actualizar');
    }

    const { rows } = await this.database.query(
      `UPDATE public.deudores AS d
          SET ${cambios.map(([columna], i) => `${columna} = $${i + 2}`).join(', ')}
        WHERE d.id = $1::bigint
       RETURNING ${COLUMNAS_DEUDOR}`,
      [id, ...cambios.map(([, valor]) => valor)],
    );
    if (!rows[0]) throw ApiError.noEncontrado('Deudor');
    return rows[0];
  }
}
