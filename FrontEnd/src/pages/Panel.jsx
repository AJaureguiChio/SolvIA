import { lazy, Suspense } from 'react';
import { Link } from 'react-router';
import { Cargando, ErrorCarga, MedidorPrioridad, PillPlan, Stat, Titulo, Vacio } from '../components/comunes.jsx';
import { api } from '../lib/api.js';
import { fecha, importe, nombreUsuario } from '../lib/formato.js';
import { useCarga } from '../lib/useCarga.js';
import { useSesion } from '../sesion/SesionContext.jsx';

// Recharts se descarga aparte y solo cuando el panel dibuja las gráficas,
// para no cargarlo en el resto de la aplicación (y mantener el bundle bajo 500 kB).
const graficas = () => import('../components/Graficas.jsx');
const GraficaPagos = lazy(() => graficas().then((m) => ({ default: m.GraficaPagos })));
const GraficaCartera = lazy(() => graficas().then((m) => ({ default: m.GraficaCartera })));
const GraficaMorosidad = lazy(() => graficas().then((m) => ({ default: m.GraficaMorosidad })));

// Reserva la altura de la gráfica mientras llega para que la página no salte.
function EsperaGrafica({ alto, children }) {
  return <Suspense fallback={<div className="skeleton" style={{ height: alto, margin: 0 }} />}>{children}</Suspense>;
}

export default function Panel() {
  const { usuario } = useSesion();
  const esAdmin = usuario.rol === 'administrador';
  const { cargando, datos, error, recargar } = useCarga(
    () => Promise.all([api('/panel/resumen'), api('/panel/prioridades', { params: { limit: 8 } })]),
    [],
  );

  const titulo = (
    <Titulo
      titulo={esAdmin ? 'Panel del administrador' : 'Mi panel'}
      subtitulo={esAdmin ? 'Indicadores de todas las cuentas.' : 'Solo cuentas asignadas a ti.'}
    >
      <Link to="/cuentas" className="btn primary">
        {esAdmin ? 'Ver cartera' : 'Ver mis cuentas'}
      </Link>
    </Titulo>
  );

  if (cargando) return <>{titulo}<Cargando /></>;
  if (error) return <>{titulo}<ErrorCarga error={error} onReintentar={recargar} /></>;

  const [resumen, { items: prioridades }] = datos;
  const t = resumen.totales;
  const vigentes = t.cuentas - t.liquidadas;
  const porcentajeCorriente = vigentes ? Math.round((t.alCorriente / vigentes) * 100) : 0;

  return (
    <>
      {titulo}
      <div className="grid">
        <div className={esAdmin ? 'col3' : 'col4'}>
          <Stat nombre={esAdmin ? 'Cuentas' : 'Cuentas asignadas'} valor={t.cuentas} detalle={`${t.liquidadas} liquidadas`} />
        </div>
        <div className={esAdmin ? 'col3' : 'col4'}>
          <Stat nombre="Al corriente" valor={`${porcentajeCorriente} %`} detalle={`${t.alCorriente} de ${vigentes} vigentes`} />
        </div>
        <div className={esAdmin ? 'col3' : 'col4'}>
          <Stat nombre="Atrasadas" valor={t.atrasadas} detalle={`Morosidad ${t.indiceMorosidad} %`} />
        </div>
        {esAdmin && (
          <div className="col3">
            <Stat nombre="Por asignar" valor={t.sinAsignar ?? 0} detalle="Requieren un gestor" />
          </div>
        )}

        <div className="card col7">
          <h3>{esAdmin ? 'Tendencia de pagos' : 'Pagos de mis cuentas'}</h3>
          <p className="muted">Pagado por mes frente a las cuotas que vencían en ese mes.</p>
          <EsperaGrafica alto={240}>
            <GraficaPagos datos={resumen.pagosPorPeriodo} />
          </EsperaGrafica>
          <details className="tabla-datos">
            <summary>Ver tabla</summary>
            <div className="tablewrap">
            <table>
              <thead>
                <tr>
                  <th>Periodo</th>
                  <th className="num">Pagado</th>
                  <th className="num">Esperado</th>
                  <th className="num">Pagos</th>
                </tr>
              </thead>
              <tbody>
                {resumen.pagosPorPeriodo.map((p) => (
                  <tr key={p.periodo}>
                    <td>{p.periodo}</td>
                    <td className="num">{importe(p.monto)}</td>
                    <td className="num">{importe(p.esperado)}</td>
                    <td className="num">{p.pagos}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            </div>
          </details>
        </div>

        <div className="card col5">
          <h3>Estado de la cartera</h3>
          <EsperaGrafica alto={180}>
            <GraficaCartera totales={t} />
          </EsperaGrafica>
          <p>
            Saldo total: <strong>{importe(t.saldoTotal)}</strong>
          </p>
          <p>
            Exigible a la fecha: <strong>{importe(t.montoExigible)}</strong>
          </p>
          <p>
            Vencido: <strong>{importe(t.montoVencido)}</strong>
          </p>
        </div>

        <div className="card col7">
          <h3>Morosidad por días de atraso</h3>
          <p className="muted">Cuentas vigentes según sus días de mora.</p>
          <EsperaGrafica alto={200}>
            <GraficaMorosidad datos={resumen.morosidad} />
          </EsperaGrafica>
          <details className="tabla-datos">
            <summary>Ver tabla</summary>
            <div className="tablewrap">
              <table>
                <thead>
                  <tr>
                    <th>Días de mora</th>
                    <th className="num">Cuentas</th>
                    <th className="num">Vencido</th>
                  </tr>
                </thead>
                <tbody>
                  {resumen.morosidad.map((r) => (
                    <tr key={r.rango}>
                      <td>{r.rango === 'sin_mora' ? 'Sin mora' : r.rango}</td>
                      <td className="num">{r.cuentas}</td>
                      <td className="num">{importe(r.montoVencido)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </details>
        </div>

        <div className="card col5">
          <h3>Próximos vencimientos (30 días)</h3>
          {resumen.proximosVencimientos.length === 0 ? (
            <p className="muted">Sin vencimientos próximos.</p>
          ) : (
            <div className="tablewrap">
              <table style={{ minWidth: 0 }}>
                <thead>
                  <tr>
                    <th>Cuenta</th>
                    <th>Fecha</th>
                    <th className="num">Pendiente</th>
                  </tr>
                </thead>
                <tbody>
                  {resumen.proximosVencimientos.slice(0, 6).map((v) => (
                    <tr key={`${v.cuentaId}-${v.numero}`}>
                      <td>
                        <Link to={`/cuentas/${v.cuentaId}`} className="link">
                          {v.referenciaExterna ?? `#${v.cuentaId}`}
                        </Link>
                      </td>
                      <td>{fecha(v.fechaVencimiento)}</td>
                      <td className="num">{importe(v.montoPendiente)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div className="card col12">
          <div className="row between">
            <h3>Cuentas que necesitan atención</h3>
            <Link to="/cuentas?orden=prioridad" className="btn">
              Ver todas por prioridad
            </Link>
          </div>
          {prioridades.length === 0 ? (
            <Vacio titulo="Nada urgente" texto="No hay cuentas con montos vencidos." />
          ) : (
            <div className="tablewrap">
              <table>
                <thead>
                  <tr>
                    <th>Cuenta</th>
                    <th>Deudor</th>
                    <th>Situación</th>
                    <th className="num">Vencido</th>
                    <th className="num">Días de mora</th>
                    <th className="num">Prioridad</th>
                    {esAdmin && <th>Responsable</th>}
                    <th>Acción</th>
                  </tr>
                </thead>
                <tbody>
                  {prioridades.map((p) => (
                    <tr key={p.id}>
                      <td>{p.referenciaExterna ?? `#${p.id}`}</td>
                      <td>{p.deudor.nombre}</td>
                      <td>
                        <PillPlan estado={p.estadoPlan} />
                      </td>
                      <td className="num">{importe(p.montoVencido)}</td>
                      <td className="num">{p.diasMora}</td>
                      <td className="num">
                        <MedidorPrioridad valor={p.prioridad} />
                      </td>
                      {esAdmin && <td>{nombreUsuario(p.responsable)}</td>}
                      <td>
                        <Link to={`/cuentas/${p.id}`} className="btn">
                          Abrir
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
