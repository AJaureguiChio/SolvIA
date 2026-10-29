import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import { Cargando, ErrorCarga, ErrorFormulario, Titulo } from '../components/comunes.jsx';
import { api } from '../lib/api.js';
import { fecha, hoy, importe, TIPO_MOVIMIENTO } from '../lib/formato.js';
import { useCarga } from '../lib/useCarga.js';

const IMPORTE = /^\d{1,14}(\.\d{1,2})?$/;
// Igual que el backend: los abonos reducen la deuda y el resto la aumenta.
const ABONOS = ['descuento', 'condonacion', 'ajuste_abono'];
const CON_PAGO = ['reembolso', 'reversion_pago'];

export default function RegistrarMovimiento() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { cargando, datos: cuenta, error: errorCarga, recargar } = useCarga(() => api(`/cuentas/${id}`), [id]);
  const pagos = useCarga(() => api(`/cuentas/${id}/pagos`, { params: { pageSize: 100 } }), [id]);
  const [tipo, setTipo] = useState('interes');
  const [monto, setMonto] = useState('');
  const [fechaEfectiva, setFechaEfectiva] = useState(hoy());
  const [pagoOrigenId, setPagoOrigenId] = useState('');
  const [motivo, setMotivo] = useState('');
  const [revisando, setRevisando] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState(null);

  const cancelar = (
    <Link to={`/cuentas/${id}`} className="btn">
      Cancelar
    </Link>
  );

  if (cargando) return <><Titulo titulo="Registrar movimiento de saldo">{cancelar}</Titulo><Cargando /></>;
  if (errorCarga) return <><Titulo titulo="Registrar movimiento de saldo">{cancelar}</Titulo><ErrorCarga error={errorCarga} onReintentar={recargar} /></>;

  const esAbono = ABONOS.includes(tipo);
  const requierePago = CON_PAGO.includes(tipo);
  const saldo = Number(cuenta.saldo);
  const valor = Number(monto);
  const impacto = esAbono ? -valor : valor;

  // Solo los pagos con monto aún por revertir pueden ser origen.
  const pagosDisponibles = (pagos.datos?.items ?? [])
    .map((p) => ({ ...p, disponible: Number(p.monto) - Number(p.montoRevertido) }))
    .filter((p) => p.disponible > 0);
  const pagoOrigen = pagosDisponibles.find((p) => p.id === pagoOrigenId);
  const fechaMinima = requierePago && pagoOrigen ? pagoOrigen.fechaPago : cuenta.plan?.fechaAcuerdo;

  // Validación previa; el trigger de la base aplica de nuevo las mismas reglas.
  let problema = null;
  if (!IMPORTE.test(monto) || valor <= 0) problema = 'Captura un importe positivo con hasta dos decimales.';
  else if (esAbono && valor > saldo) problema = `El abono no puede exceder el saldo de ${importe(cuenta.saldo, cuenta.moneda)}.`;
  else if (requierePago && !pagoOrigen) problema = 'Elige el pago de origen.';
  else if (requierePago && valor > pagoOrigen.disponible)
    problema = `No se puede revertir más de ${importe(pagoOrigen.disponible, cuenta.moneda)} de ese pago.`;
  else if (!fechaEfectiva) problema = 'Indica la fecha efectiva.';
  else if (fechaEfectiva > hoy()) problema = 'La fecha efectiva no puede ser futura.';
  else if (fechaMinima && fechaEfectiva < fechaMinima)
    problema = `La fecha no puede ser anterior a ${requierePago ? 'la del pago' : 'la del acuerdo'} (${fecha(fechaMinima)}).`;
  else if (!motivo.trim()) problema = 'Describe el motivo del movimiento.';

  function cambiarTipo(nuevo) {
    setTipo(nuevo);
    if (!CON_PAGO.includes(nuevo)) setPagoOrigenId('');
  }

  async function confirmar() {
    setGuardando(true);
    setError(null);
    try {
      const movimiento = await api(`/cuentas/${id}/movimientos`, {
        method: 'POST',
        body: {
          tipo,
          monto: valor.toFixed(2),
          fechaEfectiva,
          motivo: motivo.trim(),
          ...(requierePago ? { pagoOrigenId } : {}),
        },
      });
      navigate(`/cuentas/${id}`, {
        replace: true,
        state: {
          pestana: 'movimientos',
          aviso: `${TIPO_MOVIMIENTO[tipo]} de ${importe(monto, cuenta.moneda)} registrado. Nuevo saldo: ${importe(movimiento.saldoCuenta, cuenta.moneda)}.`,
        },
      });
    } catch (e) {
      setError(e);
      setRevisando(false);
      setGuardando(false);
    }
  }

  return (
    <>
      <Titulo titulo="Registrar movimiento de saldo" subtitulo="Solo para administrador. No edita pagos anteriores.">
        {cancelar}
      </Titulo>
      <div className="grid">
        <form
          className="card col7"
          onSubmit={(ev) => {
            ev.preventDefault();
            if (!problema) setRevisando(true);
          }}
        >
          <h3>Datos del movimiento</h3>
          <ErrorFormulario error={error} />
          <fieldset disabled={revisando || guardando} style={{ border: 0, padding: 0, margin: 0 }}>
            <label className="field">
              Cuenta
              <input className="input" readOnly value={`${cuenta.referenciaExterna ?? `#${cuenta.id}`} · ${cuenta.deudor.nombre}`} />
            </label>
            <label className="field">
              Tipo
              <select className="input" value={tipo} onChange={(e) => cambiarTipo(e.target.value)}>
                {Object.entries(TIPO_MOVIMIENTO).map(([clave, nombre]) => (
                  <option key={clave} value={clave}>
                    {nombre} ({ABONOS.includes(clave) ? 'reduce' : 'aumenta'} el saldo)
                  </option>
                ))}
              </select>
            </label>
            <label className="field">
              Importe ({cuenta.moneda})
              <input className="input" inputMode="decimal" required placeholder="0.00" value={monto} onChange={(e) => setMonto(e.target.value.trim())} />
            </label>
            <label className="field">
              Fecha efectiva
              <input className="input" type="date" required min={fechaMinima} max={hoy()} value={fechaEfectiva} onChange={(e) => setFechaEfectiva(e.target.value)} />
            </label>
            {requierePago && (
              <label className="field">
                Pago de origen
                <select className="input" value={pagoOrigenId} disabled={pagos.cargando} onChange={(e) => setPagoOrigenId(e.target.value)}>
                  <option value="">
                    {pagos.cargando ? 'Cargando…' : pagosDisponibles.length === 0 ? 'No hay pagos por revertir' : 'Elige un pago'}
                  </option>
                  {pagosDisponibles.map((p) => (
                    <option key={p.id} value={p.id}>
                      Pago #{p.id} · {fecha(p.fechaPago)} · {importe(p.monto, cuenta.moneda)}
                      {Number(p.montoRevertido) > 0 ? ` (quedan ${importe(p.disponible, cuenta.moneda)})` : ''}
                    </option>
                  ))}
                </select>
              </label>
            )}
            {pagos.error && requierePago && <ErrorCarga error={pagos.error} onReintentar={pagos.recargar} />}
            <label className="field">
              Motivo
              <textarea className="input" rows={3} required maxLength={500} value={motivo} onChange={(e) => setMotivo(e.target.value)} />
            </label>
          </fieldset>
          {monto && problema && <div className="notice error">{problema}</div>}
          {!revisando ? (
            <button type="submit" className="btn primary" disabled={!!problema}>
              Revisar movimiento
            </button>
          ) : (
            <div className="row">
              <button type="button" className="btn" disabled={guardando} onClick={() => setRevisando(false)}>
                Corregir
              </button>
              <button type="button" className="btn primary" disabled={guardando} onClick={confirmar}>
                {guardando ? 'Registrando…' : 'Confirmar movimiento'}
              </button>
            </div>
          )}
        </form>
        <div className="card col5">
          <h3>Efecto previsto</h3>
          <p>
            Saldo anterior: <strong>{importe(cuenta.saldo, cuenta.moneda)}</strong>
          </p>
          <p>
            Impacto:{' '}
            <strong>{problema && !valor ? '—' : `${esAbono ? '−' : '+'} ${importe(valor, cuenta.moneda)}`}</strong>
          </p>
          <p>
            Saldo estimado: <strong>{problema ? '—' : importe(saldo + impacto, cuenta.moneda)}</strong>
          </p>
          <div className="notice">Reembolso y reversión deben señalar un pago original de la misma cuenta.</div>
          {revisando && <div className="notice ok">Revisa los datos y confirma. El movimiento no podrá editarse ni borrarse.</div>}
        </div>
      </div>
    </>
  );
}
