import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import type { UsuarioActual } from '../../auth/guards/neon-auth/neon-auth.guard.js';
import { importe, sqlEstadoCuentas } from '../../common/cartera.sql.js';
import type { DatabaseService } from '../../database/database.service.js';
import type { PanelService } from '../../panel/panel.service.js';

export type Periodo = { desde: string; hasta: string };

// Alcance de las consultas: null = toda la cartera. Las consultas del panel
// se acotan a un gestor con la misma vista que ese gestor tiene de su panel.
export function vistaDe(admin: UsuarioActual, gestorId: string | null) {
  return gestorId
    ? { id: gestorId, rol: 'gestor' as const, activo: true }
    : admin;
}

// Lo que el LLM consultó: con esto el reporte arma gráficas y tabla con el
// mismo alcance que usó para redactar.
export type BitacoraMcp = { herramienta: string; gestorId: string | null }[];

const GESTOR_ID = z
  .string()
  .uuid()
  .optional()
  .describe(
    'id de un gestor (de listar_gestores) para limitar la consulta a sus cuentas; omitir para toda la cartera',
  );

function json(datos: unknown) {
  return { content: [{ type: 'text' as const, text: JSON.stringify(datos) }] };
}

// Servidor MCP de SolvIA: expone las metricas de la cartera como
// herramientas de solo lectura para que el LLM las consulte al redactar.
// Vive en el mismo proceso y se conecta por un transporte en memoria.
// No entrega nombres de deudores: el LLM solo ve referencias de cuenta.
// Con `gestorFijo` el administrador acoto el reporte a un gestor y las
// herramientas ignoran cualquier otro alcance.
export function crearServidorSolvia(opciones: {
  admin: UsuarioActual;
  panel: PanelService;
  database: DatabaseService;
  periodo: Periodo;
  gestorFijo: string | null;
  bitacora: BitacoraMcp;
}) {
  const { admin, panel, database, periodo, gestorFijo, bitacora } = opciones;
  const servidor = new McpServer({ name: 'solvia', version: '1.1.0' });
  const alcance = (pedido?: string) => gestorFijo ?? pedido ?? null;

  servidor.registerTool(
    'listar_gestores',
    {
      description:
        'Gestores activos de la cartera con su id, nombre y numero de cuentas asignadas. Usalo para obtener el gestorId cuando el reporte deba centrarse en un gestor.',
      inputSchema: {},
    },
    async () => {
      bitacora.push({ herramienta: 'listar_gestores', gestorId: null });
      const { rows } = await database.query(
        `SELECT p.id::text AS "gestorId", COALESCE(u.name, u.email) AS nombre,
                (SELECT count(*)::int FROM public.cuentas c
                  WHERE c.responsable_id = p.id) AS cuentas
           FROM public.perfiles_usuario p
           JOIN neon_auth."user" u ON u.id = p.id
          WHERE p.rol = 'gestor' AND p.activo
            AND ($1::uuid IS NULL OR p.id = $1::uuid)
          ORDER BY nombre`,
        [gestorFijo],
      );
      return json(rows);
    },
  );

  servidor.registerTool(
    'resumen_cartera',
    {
      description: `Indicadores del periodo del reporte (${periodo.desde} a ${periodo.hasta}): totales (cuentas, al corriente, atrasadas, cubiertas, liquidadas, saldo, exigible, vencido, indice de morosidad en %), cuentas por rango de dias de mora, pagos cobrados frente a lo esperado por mes y proximos vencimientos (30 dias). Importes en MXN como texto decimal.`,
      inputSchema: { gestorId: GESTOR_ID },
    },
    async ({ gestorId }) => {
      const id = alcance(gestorId);
      bitacora.push({ herramienta: 'resumen_cartera', gestorId: id });
      const r = await panel.resumen(vistaDe(admin, id), periodo);
      return json({
        alcance: id ? { gestorId: id } : 'toda la cartera',
        ...r,
        proximosVencimientos: r.proximosVencimientos
          .slice(0, 10)
          .map(({ deudor: _deudor, ...v }: Record<string, unknown>) => v),
      });
    },
  );

  servidor.registerTool(
    'cuentas_prioritarias',
    {
      description:
        'Cuentas con monto vencido ordenadas por prioridad P (0-100): P = 60*min(vencido/exigible,1) + 40*min(dias de mora/30,1). Incluye estado del plan, vencido, saldo, dias de mora y gestor responsable.',
      inputSchema: {
        limite: z.number().int().min(1).max(20).default(10),
        gestorId: GESTOR_ID,
      },
    },
    async ({ limite, gestorId }) => {
      const id = alcance(gestorId);
      bitacora.push({ herramienta: 'cuentas_prioritarias', gestorId: id });
      const { items } = await panel.prioridades(vistaDe(admin, id), {
        limit: limite,
      });
      return json(
        items.map(({ deudor: _deudor, ...c }: Record<string, unknown>) => c),
      );
    },
  );

  servidor.registerTool(
    'cumplimiento_por_gestor',
    {
      description:
        'Por cada gestor activo y por las cuentas sin asignar: numero de cuentas vigentes, cuantas estan atrasadas, monto vencido, saldo y dias de mora maximos. Sirve para comparar el desempeno de la cobranza.',
      inputSchema: { gestorId: GESTOR_ID },
    },
    async ({ gestorId }) => {
      const id = alcance(gestorId);
      bitacora.push({ herramienta: 'cumplimiento_por_gestor', gestorId: id });
      const { rows } = await database.query(
        `SELECT COALESCE(u.name, u.email, 'Sin asignar') AS gestor,
                count(*)::int AS "cuentasVigentes",
                count(*) FILTER (WHERE e.estado_plan = 'atrasado')::int AS atrasadas,
                ${importe('COALESCE(sum(e.monto_vencido), 0)')} AS vencido,
                ${importe('COALESCE(sum(e.saldo), 0)')} AS saldo,
                COALESCE(max(e.dias_mora), 0)::int AS "diasMoraMaximos"
           FROM public.cuentas c
           JOIN (${sqlEstadoCuentas('CURRENT_DATE')}) e ON e.cuenta_id = c.id
           LEFT JOIN neon_auth."user" u ON u.id = c.responsable_id
          WHERE NOT e.cuenta_liquidada
            AND ($1::uuid IS NULL OR c.responsable_id = $1::uuid)
          GROUP BY u.name, u.email
          ORDER BY vencido DESC`,
        [id],
      );
      return json(rows);
    },
  );

  return servidor;
}

// Alcance con el que se arman gráficas y tabla: el fijado por el
// administrador o, si no, el gestor en el que se centró el LLM: el único
// gestor cuyos indicadores consultó (aunque también haya pedido la cartera
// completa como contexto). Si comparó varios gestores, toda la cartera.
export function alcanceConsultado(
  bitacora: BitacoraMcp,
  gestorFijo: string | null,
): string | null {
  if (gestorFijo) return gestorFijo;
  const gestores = new Set(
    bitacora
      .filter(
        (b) =>
          b.herramienta === 'resumen_cartera' ||
          b.herramienta === 'cuentas_prioritarias',
      )
      .map((b) => b.gestorId)
      .filter((id): id is string => id !== null),
  );
  return gestores.size === 1 ? [...gestores][0] : null;
}
