// Fragmentos SQL compartidos para calcular el estado de las cuentas a una
// fecha de corte. `corte` es la expresion del parametro, p. ej. '$1::date'.
// Todo se deriva de cuotas, pagos y movimientos mediante resumen_planes();
// no hay columnas persistidas de saldo ni mora.

// Cobertura de cada cuota: el credito del plan se aplica por orden de
// vencimiento (FIFO), igual que en resumen_planes().
export const sqlCuotasCubiertas = (corte: string) => `
  SELECT q.cuenta_id, q.numero, q.fecha_vencimiento, q.monto,
         LEAST(GREATEST(r.credito_plan
             - (sum(q.monto) OVER w - q.monto), 0), q.monto) AS cubierto
    FROM public.cuotas q
    JOIN public.resumen_planes(${corte}) r ON r.cuenta_id = q.cuenta_id
  WINDOW w AS (PARTITION BY q.cuenta_id ORDER BY q.numero)`;

// Estado por cuenta. Dias de mora: desde la cuota vencida mas antigua que
// sigue sin cubrirse (entra en mora el dia siguiente a su vencimiento).
// Prioridad P = 60*min(vencido/exigible, 1) + 40*min(dias_mora/30, 1);
// P = 0 si no hay monto exigible. Es una heuristica de ordenamiento.
export const sqlEstadoCuentas = (corte: string) => `
  SELECT r.cuenta_id, r.saldo, r.monto_exigible, r.credito_plan,
         r.estado_plan, r.cuenta_liquidada,
         GREATEST(r.monto_exigible - r.credito_plan, 0) AS monto_vencido,
         COALESCE(m.dias_mora, 0) AS dias_mora,
         CASE WHEN r.monto_exigible = 0 THEN 0::numeric
              ELSE round(
                  60 * LEAST(GREATEST(r.monto_exigible - r.credito_plan, 0)
                             / r.monto_exigible, 1)
                + 40 * LEAST(COALESCE(m.dias_mora, 0) / 30.0, 1), 1)
         END AS prioridad
    FROM public.resumen_planes(${corte}) r
    LEFT JOIN (
        SELECT cc.cuenta_id, ${corte} - min(cc.fecha_vencimiento) AS dias_mora
          FROM (${sqlCuotasCubiertas(corte)}) cc
         WHERE cc.fecha_vencimiento < ${corte} AND cc.cubierto < cc.monto
         GROUP BY cc.cuenta_id
    ) m ON m.cuenta_id = r.cuenta_id`;

// Objeto { id, nombre, email } de un usuario de Neon Auth, o null.
export const usuarioJson = (columna: string, alias: string) => `
  CASE WHEN ${columna} IS NULL THEN NULL
       ELSE json_build_object('id', ${columna}, 'nombre', ${alias}.name,
                              'email', ${alias}.email) END`;

// Importe numeric -> cadena con dos decimales, como pide el contrato.
export const importe = (expr: string) => `(${expr})::numeric(16, 2)::text`;
