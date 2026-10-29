import { useState } from 'react';
import { Link, useLocation, useParams } from 'react-router';
import { Cargando, ErrorCarga, ErrorFormulario, Paginacion, PillCuota, PillPlan, Stat, Titulo, Vacio } from '../components/comunes.jsx';
import { api } from '../lib/api.js';
import { fecha, fechaHora, importe, nombreUsuario, TIPO_MOVIMIENTO } from '../lib/formato.js';
import { useCarga } from '../lib/useCarga.js';
import { useSesion } from '../sesion/SesionContext.jsx';

const PESTANAS = [
  ['plan', 'Plan y cuotas'],
  ['pagos', 'Pagos'],
  ['movimientos', 'Movimientos'],
  ['asignaciones', 'Asignaciones'],
];

export default function Cuenta() {
  const { id } = useParams();
  const { usuario } = useSesion();
  const location = useLocation();
  const esAdmin = usuario.rol === 'administrador';
  const [pestana, setPestana] = useState(location.state?.pestana ?? 'plan');
  const { cargando, datos: cuenta, error, recargar } = useCarga(() => api(`/cuentas/${id}`), [id]);

  const volver = (
    <Link to="/cuentas" className="btn">
      Volver a cuentas
    </Link>
  );

  if (cargando && !cuenta) return <><Titulo titulo="Cuenta">{volver}</Titulo><Cargando /></>;
  if (error) return <><Titulo titulo="Cuenta">{volver}</Titulo><ErrorCarga error={error} onReintentar={recargar} /></>;

  const puedePagar = !esAdmin && cuenta.responsable?.id === usuario.id && Number(cuenta.saldo) > 0;

  return (
    <>
      <Titulo
        titulo={`Cuenta ${cuenta.referenciaExterna ?? `#${cuenta.id}`}`}
        subtitulo={`${cuenta.deudor.nombre} · ${cuenta.producto ?? 'Sin producto'} · ${cuenta.moneda}`}
      >
        {volver}
        {puedePagar && (
          <Link to={`/cuentas/${cuenta.id}/pago`} className="btn primary">
            Registrar pago
          </Link>
        )}
        {esAdmin && (
          <Link to={`/cuentas/${cuenta.id}/movimiento`} className="btn primary">
            Nuevo movimiento
          </Link>
        )}
      </Titulo>

      {location.state?.aviso && <div className="notice ok">{location.state.aviso}</div>}

      <div className="grid">
        <div className="col3">
          <Stat nombre="Saldo pendiente" valor={importe(cuenta.saldo, '')} detalle={cuenta.moneda} />
        </div>
        <div className="col3">
          <Stat nombre="Vencido" valor={importe(cuenta.montoVencido, '')} detalle={`${cuenta.diasMora} días de mora`} />
        </div>
        <div className="col3">
          <div className="card stat">
            <small>Plan</small>
            <strong style={{ fontSize: 18 }}>
              <PillPlan estado={cuenta.estadoPlan} liquidada={cuenta.cuentaLiquidada} />
            </strong>
            <em>Prioridad {cuenta.prioridad}</em>
          </div>
        </div>
        <div className="col3">
          <Stat nombre="Responsable" valor={<span style={{ fontSize: 16 }}>{nombreUsuario(cuenta.responsable)}</span>} />
        </div>
      </div>

      <div className="tabs" role="tablist">
        {PESTANAS.map(([clave, nombre]) => (
          <button key={clave} type="button" role="tab" aria-selected={pestana === clave} className={pestana === clave ? 'active' : ''} onClick={() => setPestana(clave)}>
            {nombre}
          </button>
        ))}
      </div>

      {pestana === 'plan' && <PlanYCuotas cuenta={cuenta} esAdmin={esAdmin} onReasignada={recargar} />}
      {pestana === 'pagos' && <Pagos cuentaId={cuenta.id} moneda={cuenta.moneda} />}
      {pestana === 'movimientos' && <Movimientos cuentaId={cuenta.id} moneda={cuenta.moneda} />}
      {pestana === 'asignaciones' && <Asignaciones cuentaId={cuenta.id} />}
    </>
  );
}

function PlanYCuotas({ cuenta, esAdmin, onReasignada }) {
  const plan = cuenta.plan;
  return (
    <div className="grid">
      <div className="card col7">
        <h3>Plan de pago fijo</h3>
        {!plan ? (
          <p className="muted">La cuenta no tiene plan registrado.</p>
        ) : (
          <>
            <p className="muted">
              Acuerdo: {fecha(plan.fechaAcuerdo)} · Monto original: {importe(cuenta.montoInicial, cuenta.moneda)}
            </p>
            <div className="tablewrap">
              <table>
                <thead>
                  <tr>
                    <th>Cuota</th>
                    <th>Vencimiento</th>
                    <th className="num">Importe</th>
                    <th className="num">Cubierto</th>
                    <th>Estado calculado</th>
                  </tr>
                </thead>
                <tbody>
                  {plan.cuotas.map((q) => (
                    <tr key={q.numero}>
                      <td>{q.numero}</td>
                      <td>{fecha(q.fechaVencimiento)}</td>
                      <td className="num">{importe(q.monto, cuenta.moneda)}</td>
                      <td className="num">{importe(q.montoCubierto, cuenta.moneda)}</td>
                      <td>
                        <PillCuota estado={q.estado} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>
      <div className="card col5">
        <h3>Resumen</h3>
        <p>
          Pagos registrados: <strong>{importe(cuenta.totalPagado, cuenta.moneda)}</strong>
        </p>
        <p>
          Exigible a hoy: <strong>{importe(cuenta.montoExigible, cuenta.moneda)}</strong>
        </p>
        <p>
          Deudor:{' '}
          <Link to={`/deudores/${cuenta.deudor.id}`} className="link">
            {cuenta.deudor.nombre}
          </Link>{' '}
          · score {cuenta.deudor.scoreBuro}
        </p>
        {esAdmin && <Reasignar cuenta={cuenta} onReasignada={onReasignada} />}
        <div className="note">El plan y los pagos históricos son inmutables. Las correcciones se registran como movimientos.</div>
      </div>
    </div>
  );
}

function Reasignar({ cuenta, onReasignada }) {
  const actual = cuenta.responsable?.id ?? '';
  const [elegido, setElegido] = useState(actual);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState(null);
  const gestores = useCarga(() => api('/usuarios', { params: { rol: 'gestor', activo: true } }), []);

  async function guardar() {
    setGuardando(true);
    setError(null);
    try {
      await api(`/cuentas/${cuenta.id}/asignacion`, { method: 'PATCH', body: { responsableId: elegido || null } });
      onReasignada();
    } catch (e) {
      setError(e);
    } finally {
      setGuardando(false);
    }
  }

  return (
    <>
      <h3 className="section">Gestor responsable</h3>
      <ErrorFormulario error={error} />
      <label className="field">
        Asignar a
        <select className="input" value={elegido} disabled={gestores.cargando || guardando} onChange={(e) => setElegido(e.target.value)}>
          <option value="">Sin asignar</option>
          {(gestores.datos?.items ?? []).map((g) => (
            <option key={g.id} value={g.id}>
              {nombreUsuario(g)}
            </option>
          ))}
        </select>
      </label>
      <button type="button" className="btn primary" disabled={guardando || elegido === actual} onClick={guardar}>
        {guardando ? 'Guardando…' : 'Confirmar reasignación'}
      </button>
    </>
  );
}

function useListaPaginada(ruta) {
  const [page, setPage] = useState(1);
  const carga = useCarga(() => api(ruta, { params: { page, pageSize: 20 } }), [ruta, page]);
  return { ...carga, setPage };
}

function Pagos({ cuentaId, moneda }) {
  const { cargando, datos, error, recargar, setPage } = useListaPaginada(`/cuentas/${cuentaId}/pagos`);
  if (cargando) return <Cargando />;
  if (error) return <ErrorCarga error={error} onReintentar={recargar} />;
  if (datos.items.length === 0) return <Vacio titulo="Sin pagos" texto="Aún no se registran pagos en esta cuenta." />;
  return (
    <>
      <div className="tablewrap">
        <table>
          <thead>
            <tr>
              <th>Fecha</th>
              <th className="num">Importe</th>
              <th className="num">Revertido</th>
              <th>Registró</th>
              <th>Registrado en</th>
            </tr>
          </thead>
          <tbody>
            {datos.items.map((p) => (
              <tr key={p.id}>
                <td>{fecha(p.fechaPago)}</td>
                <td className="num">{importe(p.monto, moneda)}</td>
                <td className="num">{Number(p.montoRevertido) > 0 ? importe(p.montoRevertido, moneda) : '—'}</td>
                <td>{nombreUsuario(p.registradoPor)}</td>
                <td>{fechaHora(p.registradoEn)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <Paginacion page={datos.page} pageSize={datos.pageSize} total={datos.total} onCambiar={setPage} />
    </>
  );
}

function Movimientos({ cuentaId, moneda }) {
  const { cargando, datos, error, recargar, setPage } = useListaPaginada(`/cuentas/${cuentaId}/movimientos`);
  if (cargando) return <Cargando />;
  if (error) return <ErrorCarga error={error} onReintentar={recargar} />;
  if (datos.items.length === 0) return <Vacio titulo="Sin movimientos" texto="No hay ajustes de saldo en esta cuenta." />;
  return (
    <>
      <div className="tablewrap">
        <table>
          <thead>
            <tr>
              <th>Fecha efectiva</th>
              <th>Tipo</th>
              <th className="num">Impacto en saldo</th>
              <th>Motivo</th>
              <th>Registró</th>
            </tr>
          </thead>
          <tbody>
            {datos.items.map((m) => (
              <tr key={m.id}>
                <td>{fecha(m.fechaEfectiva)}</td>
                <td>{TIPO_MOVIMIENTO[m.tipo] ?? m.tipo}</td>
                <td className="num">{importe(m.impactoSaldo, moneda)}</td>
                <td>{m.motivo}</td>
                <td>{nombreUsuario(m.registradoPor)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <Paginacion page={datos.page} pageSize={datos.pageSize} total={datos.total} onCambiar={setPage} />
    </>
  );
}

function Asignaciones({ cuentaId }) {
  const { cargando, datos, error, recargar } = useCarga(() => api(`/cuentas/${cuentaId}/asignaciones`), [cuentaId]);
  if (cargando) return <Cargando />;
  if (error) return <ErrorCarga error={error} onReintentar={recargar} />;
  if (datos.items.length === 0) return <Vacio titulo="Sin historial" texto="La cuenta no ha tenido asignaciones." />;
  return (
    <div className="tablewrap">
      <table>
        <thead>
          <tr>
            <th>Fecha</th>
            <th>Anterior</th>
            <th>Nuevo</th>
            <th>Autor</th>
          </tr>
        </thead>
        <tbody>
          {datos.items.map((a) => (
            <tr key={a.id}>
              <td>{fechaHora(a.realizadaEn)}</td>
              <td>{a.responsableAnterior ? nombreUsuario(a.responsableAnterior) : '—'}</td>
              <td>{nombreUsuario(a.responsableNuevo)}</td>
              <td>{nombreUsuario(a.realizadaPor)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
