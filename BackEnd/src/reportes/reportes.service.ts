import { HttpStatus, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { GoogleGenAI, mcpToTool } from '@google/genai';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import type { UsuarioActual } from '../auth/guards/neon-auth/neon-auth.guard.js';
import { ApiError } from '../common/api-error.js';
import { usuarioJson } from '../common/cartera.sql.js';
import {
  desplazamiento,
  pagina,
  type PaginacionDto,
} from '../common/validacion.js';
import { DatabaseService } from '../database/database.service.js';
import { PanelService } from '../panel/panel.service.js';
import {
  alcanceConsultado,
  type BitacoraMcp,
  crearServidorSolvia,
  vistaDe,
} from './mcp/servidor-solvia.js';
import type {
  CrearReporteDto,
  EntregarReporteDto,
  PrevisualizarReporteDto,
} from './reportes.dto.js';

export const MAX_PDF = 10 * 1024 * 1024;
export type ArchivoPdf = { buffer: Buffer; mimetype: string; size: number };

const SECCIONES = [
  'Resumen ejecutivo',
  'Tendencias',
  'Riesgos',
  'Recomendaciones',
];

const INSTRUCCIONES = `Eres analista financiero de cobranza en SolvIA, un sistema de seguimiento de planes de pago (los datos son ficticios, de demostración).
Redactas la explicación en lenguaje natural de un reporte ejecutivo para la dirección.
Reglas:
- Antes de escribir, consulta las herramientas: resumen_cartera, cuentas_prioritarias y cumplimiento_por_gestor.
- Si las indicaciones piden centrarse en un gestor, usa listar_gestores para obtener su gestorId y pásalo en resumen_cartera, cuentas_prioritarias y cumplimiento_por_gestor. En ese caso habla solo de ese gestor y de sus cuentas: no menciones ni compares a otros gestores.
- Las gráficas y la tabla del reporte se arman con el mismo alcance que consultes en resumen_cartera y cuentas_prioritarias.
- Usa solo cifras que devuelvan las herramientas; no inventes datos ni porcentajes. Si un dato no existe, dilo.
- Escribe en español de México, en tono profesional y directo, con un máximo de 350 palabras.
- Estructura obligatoria: exactamente estas cuatro secciones, cada una con su encabezado en una línea propia:
${SECCIONES.map((s) => `## ${s}`).join('\n')}
- Dentro de cada sección usa párrafos breves o viñetas que empiecen con "- ". No uses negritas, tablas ni otro formato Markdown.
- Escribe los importes como MXN 1,234.56 y menciona las cuentas por su referencia (por ejemplo SOL-003).`;

const COLUMNAS_REPORTE = `
  r.id::text AS id, r.titulo,
  r.periodo_desde AS "periodoDesde", r.periodo_hasta AS "periodoHasta",
  r.generado_en AS "generadoEn",
  ${usuarioJson('r.generado_por', 'ga')} AS "generadoPor",
  octet_length(r.archivo_pdf)::int AS "tamanoBytes"`;

@Injectable()
export class ReportesService {
  private readonly logger = new Logger(ReportesService.name);
  private readonly ai: GoogleGenAI | null;
  private readonly modelo: string;
  private readonly modeloRespaldo: string;

  constructor(
    config: ConfigService,
    private readonly database: DatabaseService,
    private readonly panel: PanelService,
  ) {
    const clave = config.get<string>('GEMINI_API_KEY');
    this.ai = clave ? new GoogleGenAI({ apiKey: clave }) : null;
    this.modelo = config.get<string>('GEMINI_MODEL') ?? 'gemini-3.5-flash';
    this.modeloRespaldo =
      config.get<string>('GEMINI_MODEL_RESPALDO') ?? 'gemini-2.5-flash';
  }

  // Borrador para revisión: texto del LLM, que consulta las métricas por MCP,
  // y gráficas y tabla calculadas con el mismo alcance que el LLM consultó
  // (o el que fijó el administrador). No escribe en `reportes`.
  async previsualizar(admin: UsuarioActual, dto: PrevisualizarReporteDto) {
    if (dto.desde > dto.hasta) {
      throw ApiError.entradaInvalida('desde no puede ser posterior a hasta');
    }
    const gestorFijo = dto.gestorId ?? null;
    const fijo = gestorFijo ? await this.exigirGestorActivo(gestorFijo) : null;
    const nombreFijo = fijo ? (fijo.nombre ?? fijo.email) : null;

    const { texto, bitacora, modelo } = await this.redactar(
      admin,
      dto,
      nombreFijo,
    );
    const gestorId = alcanceConsultado(bitacora, gestorFijo);
    const vista = vistaDe(admin, gestorId);
    const [resumen, prioridades, gestor] = await Promise.all([
      this.panel.resumen(vista, { desde: dto.desde, hasta: dto.hasta }),
      this.panel.prioridades(vista, { limit: 10 }),
      gestorId ? this.exigirGestorActivo(gestorId) : null,
    ]);
    return {
      periodoDesde: dto.desde,
      periodoHasta: dto.hasta,
      modelo,
      herramientasConsultadas: [...new Set(bitacora.map((b) => b.herramienta))],
      alcance: {
        gestor,
        origen: gestorFijo ? 'seleccion' : gestorId ? 'indicaciones' : 'cartera',
      },
      texto,
      resumen,
      prioridades: prioridades.items,
    };
  }

  private async exigirGestorActivo(id: string) {
    const { rows } = await this.database.query(
      `SELECT p.id::text AS id, u.name AS nombre, u.email
         FROM public.perfiles_usuario p
         JOIN neon_auth."user" u ON u.id = p.id
        WHERE p.id = $1::uuid AND p.rol = 'gestor' AND p.activo`,
      [id],
    );
    if (!rows[0]) {
      throw new ApiError(
        HttpStatus.UNPROCESSABLE_ENTITY,
        'INVALID_SCOPE',
        'El alcance debe ser un gestor activo',
      );
    }
    return rows[0] as { id: string; nombre: string | null; email: string };
  }

  // Gemini responde 503/429 cuando hay mucha demanda: se reintenta una vez
  // y después se usa el modelo de respaldo.
  private async redactar(
    admin: UsuarioActual,
    dto: PrevisualizarReporteDto,
    nombreFijo: string | null,
  ) {
    if (!this.ai) {
      throw new ApiError(
        HttpStatus.SERVICE_UNAVAILABLE,
        'LLM_UNAVAILABLE',
        'Falta GEMINI_API_KEY: no se puede redactar el reporte.',
      );
    }
    const ai = this.ai;
    const intentos = [this.modelo, this.modelo, this.modeloRespaldo];
    let ultimo: unknown;
    for (const [i, modelo] of intentos.entries()) {
      try {
        return {
          ...(await this.redactarCon(ai, modelo, admin, dto, nombreFijo)),
          modelo,
        };
      } catch (error) {
        ultimo = error;
        const status = (error as { status?: number }).status;
        if (status !== 503 && status !== 429) break;
        this.logger.warn(`Gemini (${modelo}) respondió ${status}; reintento ${i + 1}`);
        await new Promise((r) => setTimeout(r, 1500));
      }
    }
    this.logger.error(`Gemini falló: ${String(ultimo)}`);
    throw new ApiError(
      HttpStatus.SERVICE_UNAVAILABLE,
      'LLM_UNAVAILABLE',
      'El modelo de lenguaje no respondió. Inténtalo de nuevo en unos minutos.',
    );
  }

  private async redactarCon(
    ai: GoogleGenAI,
    modelo: string,
    admin: UsuarioActual,
    dto: PrevisualizarReporteDto,
    nombreFijo: string | null,
  ) {
    // Servidor y cliente MCP enlazados en memoria, uno por petición.
    const [transporteCliente, transporteServidor] =
      InMemoryTransport.createLinkedPair();
    const bitacora: BitacoraMcp = [];
    const gestorFijo = dto.gestorId ?? null;
    const servidor = crearServidorSolvia({
      admin,
      panel: this.panel,
      database: this.database,
      periodo: { desde: dto.desde, hasta: dto.hasta },
      gestorFijo,
      bitacora,
    });
    const cliente = new Client({ name: 'solvia-backend', version: '1.0.0' });
    await servidor.connect(transporteServidor);
    await cliente.connect(transporteCliente);

    try {
      const respuesta = await ai.models.generateContent({
        model: modelo,
        contents:
          `Redacta la explicación del reporte ejecutivo del periodo ${dto.desde} a ${dto.hasta}.` +
          (gestorFijo
            ? `\nEl reporte está limitado al gestor ${nombreFijo} (gestorId ${gestorFijo}): las herramientas solo devuelven sus cuentas. Refiérete a él como ${nombreFijo}. Si las indicaciones mencionan a otro gestor, no lo atiendas ni lo nombres: este reporte es solo de ${nombreFijo}.`
            : '') +
          (dto.indicaciones?.trim()
            ? `\nIndicaciones del administrador: ${dto.indicaciones.trim()}`
            : ''),
        config: {
          systemInstruction: INSTRUCCIONES,
          tools: [mcpToTool(cliente)],
          temperature: 0.4,
          automaticFunctionCalling: { maximumRemoteCalls: 8 },
          httpOptions: { timeout: 90000 },
        },
      });

      const texto = respuesta.text?.trim();
      if (!texto) throw new Error(`${modelo} devolvió una respuesta sin texto`);
      return { texto, bitacora };
    } finally {
      await cliente.close();
      await servidor.close();
    }
  }

  // El PDF lo arma el navegador (jsPDF); aquí se valida y se guarda una sola
  // vez junto con sus destinatarios, en una transacción.
  async crear(admin: UsuarioActual, dto: CrearReporteDto, pdf?: ArchivoPdf) {
    if (!pdf) throw ApiError.entradaInvalida('Falta el archivo PDF (campo pdf)');
    if (pdf.mimetype !== 'application/pdf') {
      throw new ApiError(
        HttpStatus.UNSUPPORTED_MEDIA_TYPE,
        'UNSUPPORTED_MEDIA_TYPE',
        'El archivo debe ser un PDF',
      );
    }
    if (pdf.size > MAX_PDF) {
      throw new ApiError(
        HttpStatus.PAYLOAD_TOO_LARGE,
        'PDF_TOO_LARGE',
        `El PDF supera ${MAX_PDF / 1024 / 1024} MB`,
      );
    }
    if (pdf.buffer.subarray(0, 5).toString('latin1') !== '%PDF-') {
      throw new ApiError(
        HttpStatus.UNSUPPORTED_MEDIA_TYPE,
        'UNSUPPORTED_MEDIA_TYPE',
        'El contenido no es un PDF válido',
      );
    }
    if (dto.periodoDesde > dto.periodoHasta) {
      throw ApiError.entradaInvalida(
        'periodoDesde no puede ser posterior a periodoHasta',
      );
    }

    const id = await this.database.transaction(async (client) => {
      const { rows } = await client.query(
        `INSERT INTO public.reportes (titulo, generado_por, periodo_desde,
                                      periodo_hasta, archivo_pdf)
         VALUES ($1, $2::uuid, $3::date, $4::date, $5)
         RETURNING id::text AS id`,
        [
          dto.titulo.trim(),
          admin.id,
          dto.periodoDesde,
          dto.periodoHasta,
          pdf.buffer,
        ],
      );
      const reporteId = (rows[0] as { id: string }).id;
      // El trigger exige que cada destinatario sea un gestor activo.
      if (dto.destinatarioIds.length > 0) {
        await client.query(
          `INSERT INTO public.reporte_destinatarios
                  (reporte_id, usuario_id, entregado_en)
           SELECT $1::bigint, u, CASE WHEN $3 THEN now() END
             FROM unnest($2::uuid[]) AS u`,
          [reporteId, dto.destinatarioIds, dto.entregar === true],
        );
      }
      return reporteId;
    });
    return this.obtener(admin, id);
  }

  // Administrador: todos. Gestor: solo los que se le entregaron.
  async listar(usuario: UsuarioActual, filtros: PaginacionDto) {
    const esAdmin = usuario.rol === 'administrador';
    const { rows } = await this.database.query(
      `SELECT ${COLUMNAS_REPORTE},
              (SELECT count(*)::int FROM public.reporte_destinatarios d
                WHERE d.reporte_id = r.id) AS destinatarios,
              (SELECT count(*)::int FROM public.reporte_destinatarios d
                WHERE d.reporte_id = r.id AND d.entregado_en IS NOT NULL)
                  AS entregados,
              count(*) OVER ()::int AS total
         FROM public.reportes r
         JOIN neon_auth."user" ga ON ga.id = r.generado_por
        WHERE $1::boolean OR EXISTS (
                SELECT 1 FROM public.reporte_destinatarios d
                 WHERE d.reporte_id = r.id AND d.usuario_id = $2::uuid
                   AND d.entregado_en IS NOT NULL)
        ORDER BY r.generado_en DESC, r.id DESC
        LIMIT $3 OFFSET $4`,
      [esAdmin, usuario.id, filtros.pageSize, desplazamiento(filtros)],
    );
    return pagina(rows, filtros);
  }

  async obtener(usuario: UsuarioActual, id: string) {
    await this.exigirVisible(usuario, id);
    const { rows } = await this.database.query(
      `SELECT ${COLUMNAS_REPORTE},
              COALESCE((
                SELECT json_agg(json_build_object(
                         'usuario', ${usuarioJson('d.usuario_id', 'du')},
                         'entregadoEn', d.entregado_en)
                       ORDER BY du.name, du.email)
                  FROM public.reporte_destinatarios d
                  JOIN neon_auth."user" du ON du.id = d.usuario_id
                 WHERE d.reporte_id = r.id
                   AND ($2::boolean OR d.usuario_id = $3::uuid)
              ), '[]'::json) AS destinatarios
         FROM public.reportes r
         JOIN neon_auth."user" ga ON ga.id = r.generado_por
        WHERE r.id = $1::bigint`,
      [id, usuario.rol === 'administrador', usuario.id],
    );
    return rows[0];
  }

  async pdf(usuario: UsuarioActual, id: string) {
    await this.exigirVisible(usuario, id);
    const { rows } = await this.database.query(
      `SELECT titulo, archivo_pdf AS archivo FROM public.reportes
        WHERE id = $1::bigint`,
      [id],
    );
    return rows[0] as { titulo: string; archivo: Buffer };
  }

  // Confirma una sola vez la entrega a destinatarios ya registrados.
  async entregar(admin: UsuarioActual, id: string, dto: EntregarReporteDto) {
    await this.exigirVisible(admin, id);
    await this.database.transaction(async (client) => {
      const { rows } = await client.query(
        `SELECT usuario_id::text AS "usuarioId", entregado_en AS "entregadoEn"
           FROM public.reporte_destinatarios
          WHERE reporte_id = $1::bigint AND usuario_id = ANY($2::uuid[])
          FOR UPDATE`,
        [id, dto.usuarioIds],
      );
      const filas = rows as { usuarioId: string; entregadoEn: string | null }[];
      const registrados = new Set(filas.map((f) => f.usuarioId));
      const ajenos = dto.usuarioIds.filter((u) => !registrados.has(u));
      if (ajenos.length > 0) {
        throw new ApiError(
          HttpStatus.UNPROCESSABLE_ENTITY,
          'INVALID_RECIPIENT',
          'Solo se puede entregar a destinatarios registrados en el reporte',
          { usuarioIds: ajenos },
        );
      }
      const entregados = filas.filter((f) => f.entregadoEn !== null);
      if (entregados.length > 0) {
        throw new ApiError(
          HttpStatus.CONFLICT,
          'DELIVERY_ALREADY_CONFIRMED',
          'La entrega ya estaba confirmada para algunos destinatarios',
          { usuarioIds: entregados.map((f) => f.usuarioId) },
        );
      }
      await client.query(
        `UPDATE public.reporte_destinatarios SET entregado_en = now()
          WHERE reporte_id = $1::bigint AND usuario_id = ANY($2::uuid[])`,
        [id, dto.usuarioIds],
      );
    });
    return this.obtener(admin, id);
  }

  // Un reporte no entregado al gestor se responde como inexistente (404).
  private async exigirVisible(usuario: UsuarioActual, id: string) {
    const { rows } = await this.database.query(
      `SELECT 1 FROM public.reportes r
        WHERE r.id = $1::bigint
          AND ($2::boolean OR EXISTS (
                SELECT 1 FROM public.reporte_destinatarios d
                 WHERE d.reporte_id = r.id AND d.usuario_id = $3::uuid
                   AND d.entregado_en IS NOT NULL))`,
      [id, usuario.rol === 'administrador', usuario.id],
    );
    if (rows.length === 0) throw ApiError.noEncontrado('Reporte');
  }
}
