import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import type { UsuarioActual } from '../../auth/guards/neon-auth/neon-auth.guard.js';
import { importe, sqlEstadoCuentas } from '../../common/cartera.sql.js';
import type { DatabaseService } from '../../database/database.service.js';
import type { PanelService } from '../../panel/panel.service.js';

const FECHA = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .describe('Fecha YYYY-MM-DD');

function json(datos: unknown) {
  return { content: [{ type: 'text' as const, text: JSON.stringify(datos) }] };
}

// Servidor MCP de SolvIA: expone las metricas de la cartera como
// herramientas de solo lectura para que el LLM las consulte al redactar.
// Vive en el mismo proceso y se conecta por un transporte en memoria.
// No entrega nombres de deudores: el LLM solo ve referencias de cuenta.
export function crearServidorSolvia(
  admin: UsuarioActual,
  panel: PanelService,
  database: DatabaseService,
) {
  const servidor = new McpServer({ name: 'solvia', version: '1.0.0' });

  servidor.registerTool(
    'resumen_cartera',
    {
      description:
        'Indicadores de la cartera de cobranza: totales (cuentas, al corriente, atrasadas, cubiertas, liquidadas, sin asignar, saldo, exigible, vencido, indice de morosidad en %), cuentas por rango de dias de mora, pagos cobrados frente a lo esperado por mes en el periodo y proximos vencimientos (30 dias). Importes en MXN como texto decimal.',
      inputSchema: { desde: FECHA, hasta: FECHA },
    },
    async ({ desde, hasta }) => {
      const r = await panel.resumen(admin, { desde, hasta });
      return json({
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
      inputSchema: { limite: z.number().int().min(1).max(20).default(10) },
    },
    async ({ limite }) => {
      const { items } = await panel.prioridades(admin, { limit: limite });
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
      inputSchema: {},
    },
    async () => {
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
          GROUP BY u.name, u.email
          ORDER BY vencido DESC`,
      );
      return json(rows);
    },
  );

  return servidor;
}
