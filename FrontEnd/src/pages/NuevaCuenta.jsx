import { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router';
import { ErrorFormulario, Titulo } from '../components/comunes.jsx';
import { api } from '../lib/api.js';
import { fecha, hoy, importe, nombreUsuario } from '../lib/formato.js';
import { useCarga } from '../lib/useCarga.js';

const IMPORTE = /^\d{1,14}(\.\d{1,2})?$/;

// Importes en centavos para sumar sin errores de punto flotante.
const centavos = (texto) => Math.round(Number(texto) * 100);
const aTexto = (c) => (c / 100).toFixed(2);

// Suma meses a una fecha YYYY-MM-DD; el día se ajusta al último del mes si no existe (31 -> 30 o 28).
function sumarMeses(base, meses) {
  const [a, m, d] = base.split('-').map(Number);
  const ultimo = new Date(Date.UTC(a, m - 1 + meses + 1, 0)).getUTCDate();
  return new Date(Date.UTC(a, m - 1 + meses, Math.min(d, ultimo))).toISOString().slice(0, 10);
}

// Reparte el monto en cuotas mensuales iguales; la última absorbe los centavos sobrantes.
function generarCuotas(monto, numero, primera) {
  const total = centavos(monto);
  const base = Math.floor(total / numero);
  return Array.from({ length: numero }, (_, i) => ({
    fechaVencimiento: sumarMeses(primera, i),
    monto: aTexto(i === numero - 1 ? total - base * (numero - 1) : base),
  }));
}

// Mismas reglas que valida la base al confirmar (triggers de cuenta, plan y cuotas).
function revisar(cuenta, fechaAcuerdo, cuotas) {
  if (!cuenta.deudorId) return 'Elige el deudor.';
  if (!IMPORTE.test(cuenta.montoInicial) || centavos(cuenta.montoInicial) <= 0) return 'Captura un monto inicial positivo con hasta dos decimales.';
  if (!fechaAcuerdo) return 'Indica la fecha del acuerdo.';
  if (cuenta.fechaOriginacion && fechaAcuerdo < cuenta.fechaOriginacion) return 'El acuerdo no puede ser anterior a la originación.';
  if (cuotas.length === 0) return 'Agrega al menos una cuota.';
  for (const [i, q] of cuotas.entries()) {
    if (!q.fechaVencimiento) return `Indica el vencimiento de la cuota ${i + 1}.`;
    if (!IMPORTE.test(q.monto) || centavos(q.monto) <= 0) return `El monto de la cuota ${i + 1} debe ser positivo.`;
    if (q.fechaVencimiento < fechaAcuerdo) return `La cuota ${i + 1} vence antes del acuerdo.`;
    if (i > 0 && q.fechaVencimiento <= cuotas[i - 1].fechaVencimiento) return `La cuota ${i + 1} debe vencer después de la cuota ${i}.`;
  }
  const suma = cuotas.reduce((t, q) => t + centavos(q.monto), 0);
  if (suma !== centavos(cuenta.montoInicial)) {
    return `Las cuotas suman ${importe(aTexto(suma), cuenta.moneda)} y deben sumar ${importe(cuenta.montoInicial, cuenta.moneda)}.`;
  }
  return null;
}

export default function NuevaCuenta() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const [cuenta, setCuenta] = useState({
    deudorId: params.get('deudor') ?? '',
    referenciaExterna: '',
    producto: '',
    montoInicial: '',
    moneda: 'MXN',
    fechaOriginacion: hoy(),
    responsableId: '',
  });
  const [fechaAcuerdo, setFechaAcuerdo] = useState(hoy());
  const [cuotas, setCuotas] = useState([]);
  const [generador, setGenerador] = useState({ numero: '3', primera: sumarMeses(hoy(), 1) });
  const [revisando, setRevisando] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState(null);

  const [busqueda, setBusqueda] = useState('');
  const [q, setQ] = useState('');
  const deudores = useCarga(() => api('/deudores', { params: { q, pageSize: 100 } }), [q]);
  const elegido = useCarga(
    () => (cuenta.deudorId ? api(`/deudores/${cuenta.deudorId}`) : Promise.resolve(null)),
    [cuenta.deudorId],
  );
  const gestores = useCarga(() => api('/usuarios', { params: { rol: 'gestor', activo: true } }), []);

  const cambiar = (campo) => (ev) => setCuenta((c) => ({ ...c, [campo]: ev.target.value.trimStart() }));
  const cambiarCuota = (i, campo) => (ev) =>
    setCuotas((lista) => lista.map((q, j) => (j === i ? { ...q, [campo]: ev.target.value.trim() } : q)));

  const problema = revisar(cuenta, fechaAcuerdo, cuotas);
  const suma = cuotas.reduce((t, q) => t + (IMPORTE.test(q.monto) ? centavos(q.monto) : 0), 0);
  const numeroGenerar = Number(generador.numero);
  const puedeGenerar =
    IMPORTE.test(cuenta.montoInicial) && centavos(cuenta.montoInicial) > 0 && Number.isInteger(numeroGenerar) && numeroGenerar >= 1 && numeroGenerar <= 360 && !!generador.primera;

  // Opciones del selector: resultados de la búsqueda más el deudor elegido aunque no aparezca en ellos.
  const opciones = [...(deudores.datos?.items ?? [])];
  if (elegido.datos && !opciones.some((d) => d.id === elegido.datos.id)) opciones.unshift(elegido.datos);

  const nombreGestor = (gestores.datos?.items ?? []).find((g) => g.id === cuenta.responsableId);

  async function confirmar() {
    setGuardando(true);
    setError(null);
    try {
      const creada = await api('/cuentas', {
        method: 'POST',
        body: {
          deudorId: cuenta.deudorId,
          referenciaExterna: cuenta.referenciaExterna.trim() || undefined,
          producto: cuenta.producto.trim() || undefined,
          montoInicial: aTexto(centavos(cuenta.montoInicial)),
          moneda: cuenta.moneda,
          fechaOriginacion: cuenta.fechaOriginacion || undefined,
          responsableId: cuenta.responsableId || undefined,
          plan: {
            fechaAcuerdo,
            cuotas: cuotas.map((q, i) => ({ numero: i + 1, fechaVencimiento: q.fechaVencimiento, monto: aTexto(centavos(q.monto)) })),
          },
        },
      });
      navigate(`/cuentas/${creada.id}`, {
        replace: true,
        state: { aviso: `Cuenta ${creada.referenciaExterna ?? `#${creada.id}`} creada con ${cuotas.length} cuotas.` },
      });
    } catch (e) {
      setError(e);
      setRevisando(false);
      setGuardando(false);
    }
  }

  const paso = revisando ? 3 : cuotas.length > 0 ? 2 : 1;
  const bloqueado = revisando || guardando;

  return (
    <>
      <Titulo titulo="Nueva cuenta y plan" subtitulo="El plan se pacta una vez; revisa todos los importes antes de confirmar.">
        <Link to={cuenta.deudorId && params.get('deudor') ? `/deudores/${cuenta.deudorId}` : '/cuentas'} className="btn">
          Cancelar
        </Link>
      </Titulo>
      <div className="steps">
        <span className={paso >= 1 ? 'active' : ''}>1. Cuenta</span>
        <span className={paso >= 2 ? 'active' : ''}>2. Cuotas</span>
        <span className={paso >= 3 ? 'active' : ''}>3. Revisar y confirmar</span>
      </div>
      <ErrorFormulario error={error} />

      <div className="grid">
        <fieldset className="card col5" disabled={bloqueado} style={{ margin: 0, minWidth: 0 }}>
          <h3>Datos de la cuenta</h3>
          <form
            className="filters"
            style={{ gridTemplateColumns: '1fr auto' }}
            onSubmit={(ev) => {
              ev.preventDefault();
              setQ(busqueda.trim());
            }}
          >
            <label className="field">
              Buscar deudor
              <input className="input" type="search" maxLength={100} placeholder="Nombre, CURP o RFC" value={busqueda} onChange={(e) => setBusqueda(e.target.value)} />
            </label>
            <button type="submit" className="btn">
              Buscar
            </button>
          </form>
          <label className="field">
            Deudor
            <select className="input" required value={cuenta.deudorId} disabled={deudores.cargando} onChange={cambiar('deudorId')}>
              <option value="">{deudores.cargando ? 'Cargando…' : opciones.length ? 'Elige un deudor' : 'Sin resultados'}</option>
              {opciones.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.nombre} · {d.curp ?? d.rfc}
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            Referencia externa
            <input className="input" maxLength={60} placeholder="SOL-016" value={cuenta.referenciaExterna} onChange={cambiar('referenciaExterna')} />
          </label>
          <label className="field">
            Producto
            <input className="input" maxLength={100} placeholder="Préstamo personal" value={cuenta.producto} onChange={cambiar('producto')} />
          </label>
          <div className="form-grid">
            <label className="field">
              Monto inicial ({cuenta.moneda})
              <input className="input" inputMode="decimal" required placeholder="0.00" value={cuenta.montoInicial} onChange={cambiar('montoInicial')} />
            </label>
            <label className="field">
              Fecha de originación
              <input className="input" type="date" value={cuenta.fechaOriginacion} onChange={cambiar('fechaOriginacion')} />
            </label>
          </div>
          <label className="field">
            Gestor responsable
            <select className="input" value={cuenta.responsableId} disabled={gestores.cargando} onChange={cambiar('responsableId')}>
              <option value="">Sin asignar</option>
              {(gestores.datos?.items ?? []).map((g) => (
                <option key={g.id} value={g.id}>
                  {nombreUsuario(g)}
                </option>
              ))}
            </select>
          </label>
        </fieldset>

        <fieldset className="card col7" disabled={bloqueado} style={{ margin: 0, minWidth: 0 }}>
          <h3>Acuerdo y cuotas</h3>
          <label className="field">
            Fecha del acuerdo
            <input className="input" type="date" required min={cuenta.fechaOriginacion || undefined} value={fechaAcuerdo} onChange={(e) => setFechaAcuerdo(e.target.value)} />
          </label>
          <div className="filters" style={{ gridTemplateColumns: '1fr 1fr auto' }}>
            <label className="field">
              Número de cuotas
              <input
                className="input"
                type="number"
                min={1}
                max={360}
                value={generador.numero}
                onChange={(e) => setGenerador((g) => ({ ...g, numero: e.target.value }))}
              />
            </label>
            <label className="field">
              Primer vencimiento
              <input className="input" type="date" value={generador.primera} onChange={(e) => setGenerador((g) => ({ ...g, primera: e.target.value }))} />
            </label>
            <button
              type="button"
              className="btn"
              disabled={!puedeGenerar}
              title={puedeGenerar ? undefined : 'Captura primero el monto inicial'}
              onClick={() => setCuotas(generarCuotas(cuenta.montoInicial, numeroGenerar, generador.primera))}
            >
              Generar cuotas mensuales
            </button>
          </div>

          {cuotas.length > 0 && (
            <div className="tablewrap">
              <table style={{ minWidth: 0 }}>
                <thead>
                  <tr>
                    <th>N.º</th>
                    <th>Vencimiento</th>
                    <th>Monto</th>
                    <th>Acción</th>
                  </tr>
                </thead>
                <tbody>
                  {cuotas.map((q, i) => (
                    <tr key={i}>
                      <td>{i + 1}</td>
                      <td>
                        <input className="input" type="date" aria-label={`Vencimiento de la cuota ${i + 1}`} value={q.fechaVencimiento} onChange={cambiarCuota(i, 'fechaVencimiento')} />
                      </td>
                      <td>
                        <input className="input" inputMode="decimal" aria-label={`Monto de la cuota ${i + 1}`} value={q.monto} onChange={cambiarCuota(i, 'monto')} />
                      </td>
                      <td>
                        <button type="button" className="btn" onClick={() => setCuotas((lista) => lista.filter((_, j) => j !== i))}>
                          Quitar
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <div className="spacer" />
          <button
            type="button"
            className="btn"
            onClick={() =>
              setCuotas((lista) => [
                ...lista,
                { fechaVencimiento: lista.length ? sumarMeses(lista.at(-1).fechaVencimiento, 1) : generador.primera, monto: '' },
              ])
            }
          >
            + Añadir cuota
          </button>
          <p className="muted">
            Suma de cuotas: {importe(aTexto(suma), cuenta.moneda)} · Monto inicial:{' '}
            {IMPORTE.test(cuenta.montoInicial) ? importe(cuenta.montoInicial, cuenta.moneda) : '—'}
          </p>
        </fieldset>

        <div className="card col12">
          {revisando ? (
            <>
              <h3>Revisión antes de guardar</h3>
              <p>
                Deudor: <strong>{elegido.datos?.nombre ?? '—'}</strong> · Referencia: <strong>{cuenta.referenciaExterna.trim() || '—'}</strong> · Producto:{' '}
                <strong>{cuenta.producto.trim() || '—'}</strong>
              </p>
              <p>
                Monto inicial: <strong>{importe(cuenta.montoInicial, cuenta.moneda)}</strong> · Originación: <strong>{fecha(cuenta.fechaOriginacion)}</strong> ·
                Acuerdo: <strong>{fecha(fechaAcuerdo)}</strong> · Gestor: <strong>{nombreGestor ? nombreUsuario(nombreGestor) : 'Sin asignar'}</strong>
              </p>
              <p>
                {cuotas.length} cuotas, de {fecha(cuotas[0].fechaVencimiento)} a {fecha(cuotas.at(-1).fechaVencimiento)}.
              </p>
              <div className="notice ok">No se podrán renegociar el plan ni las cuotas después de confirmar.</div>
              <div className="row">
                <button type="button" className="btn" disabled={guardando} onClick={() => setRevisando(false)}>
                  Corregir
                </button>
                <button type="button" className="btn primary" disabled={guardando} onClick={confirmar}>
                  {guardando ? 'Guardando…' : 'Confirmar cuenta, plan y cuotas'}
                </button>
              </div>
            </>
          ) : (
            <div className="row between">
              <div>
                <strong>Revisión antes de guardar</strong>
                <p className="muted">{problema ?? 'Todo cuadra. Revisa el resumen y confirma.'}</p>
              </div>
              <button type="button" className="btn primary" disabled={!!problema} onClick={() => setRevisando(true)}>
                Revisar cuenta y plan
              </button>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
