// Migraciones y datos de demostracion de SolvIA.
//   node scripts/db.mjs migrate         aplica db/migrations/*.sql pendientes
//   node scripts/db.mjs seed [--reset]  carga db/seed/demo.sql
// Solo corre contra la rama Neon "desarrollo" (NEON_BRANCH en ../.env).
import { readFile, readdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import pg from 'pg';

const raiz = fileURLToPath(new URL('../../', import.meta.url));
const RAMA_PERMITIDA = 'desarrollo';

const TABLAS_DE_NEGOCIO = [
  'reporte_destinatarios',
  'reportes',
  'movimientos_saldo',
  'pagos',
  'cuotas',
  'planes_pago',
  'historial_asignaciones',
  'cuentas',
  'deudores',
];

function abortar(mensaje) {
  console.error(`✖ ${mensaje}`);
  process.exit(1);
}

async function migrar(client) {
  await client.query(`
    CREATE TABLE IF NOT EXISTS public.schema_migraciones (
      nombre text PRIMARY KEY,
      aplicada_en timestamptz NOT NULL DEFAULT now()
    )`);
  const { rows } = await client.query(
    'SELECT nombre FROM public.schema_migraciones',
  );
  const aplicadas = new Set(rows.map((r) => r.nombre));
  const archivos = (await readdir(`${raiz}db/migrations`))
    .filter((f) => f.endsWith('.sql'))
    .sort();

  for (const archivo of archivos) {
    if (aplicadas.has(archivo)) continue;
    const sql = await readFile(`${raiz}db/migrations/${archivo}`, 'utf8');
    await client.query('BEGIN');
    try {
      await client.query(sql);
      await client.query(
        'INSERT INTO public.schema_migraciones (nombre) VALUES ($1)',
        [archivo],
      );
      await client.query('COMMIT');
      console.log(`✔ ${archivo}`);
    } catch (error) {
      await client.query('ROLLBACK');
      abortar(`${archivo}: ${error.message}`);
    }
  }
  console.log('Migraciones al día.');
}

async function sembrar(client, reiniciar) {
  const { rows } = await client.query(
    'SELECT count(*)::int AS n FROM public.deudores',
  );
  if (rows[0].n > 0 && !reiniciar) {
    abortar('Ya hay deudores; usa "seed --reset" para recargar la demo.');
  }

  const sql = await readFile(`${raiz}db/seed/demo.sql`, 'utf8');
  await client.query('BEGIN');
  try {
    if (reiniciar) {
      // TRUNCATE no dispara los triggers de inmutabilidad por fila.
      await client.query(
        `TRUNCATE ${TABLAS_DE_NEGOCIO.map((t) => `public.${t}`).join(', ')}
         RESTART IDENTITY`,
      );
    }
    await client.query(sql);
    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    abortar(`seed: ${error.message}`);
  }

  const resumen = await client.query(`
    SELECT estado_plan, cuenta_liquidada, count(*)::int AS cuentas
      FROM public.resumen_planes()
     GROUP BY 1, 2 ORDER BY 1, 2`);
  console.log('✔ Seed cargado. Estado de la cartera:');
  console.table(resumen.rows);
}

const [comando, ...opciones] = process.argv.slice(2);
if (!['migrate', 'seed'].includes(comando)) {
  abortar('Uso: node scripts/db.mjs <migrate|seed> [--reset]');
}

process.loadEnvFile(`${raiz}.env`);
if (process.env.NEON_BRANCH !== RAMA_PERMITIDA) {
  abortar(`NEON_BRANCH debe ser "${RAMA_PERMITIDA}"; no se toca otra rama.`);
}
const url = process.env.DATABASE_URL_UNPOOLED;
if (!url) abortar('Falta DATABASE_URL_UNPOOLED en .env');

const client = new pg.Client({ connectionString: url });
await client.connect();
try {
  if (comando === 'migrate') await migrar(client);
  else await sembrar(client, opciones.includes('--reset'));
} finally {
  await client.end();
}
