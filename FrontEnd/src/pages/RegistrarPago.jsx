import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import { Cargando, ErrorCarga, ErrorFormulario, Titulo } from '../components/comunes.jsx';
import { api } from '../lib/api.js';
import { fecha, hoy, importe } from '../lib/formato.js';
import { useCarga } from '../lib/useCarga.js';
import { useSesion } from '../sesion/SesionContext.jsx';

const IMPORTE = /^\d{1,14}(\.\d{1,2})?$/;

export default function RegistrarPago() {
  const { id } = useParams();
  const { usuario } = useSesion();
  const navigate = useNavigate();
  const { cargando, datos: cuenta, error: errorCarga, recargar } = useCarga(() => api(`/cuentas/${id}`), [id]);
  const [fechaPago, setFechaPago] = useState(hoy());
  const [monto, setMonto] = useState('');
  const [revisando, setRevisando] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState(null);

  const cancelar = (
    <Link to={`/cuentas/${id}`} className="btn">
      Cancelar
    </Link>
  );

  if (cargando) return <><Titulo titulo="Registrar pago">{cancelar}</Titulo><Cargando /></>;
  if (errorCarga) return <><Titulo titulo="Registrar pago">{cancelar}</Titulo><ErrorCarga error={errorCarga} onReintentar={recargar} /></>;

  const esResponsable = cuenta.responsable?.id === usuario.id;
  const saldo = Number(cuenta.saldo);
  const valor = Number(monto);
  const fechaMinima = cuenta.plan?.fechaAcuerdo;

  // Validación previa; la base aplica de nuevo las mismas reglas.
  let problema = null;
  if (!IMPORTE.test(monto) || valor <= 0) problema = 'Captura un importe positivo con hasta dos decimales.';
  else if (valor > saldo) problema = `El pago no puede exceder el saldo de ${importe(cuenta.saldo, cuenta.moneda)}.`;
  else if (!fechaPago) problema = 'Indica la fecha del pago.';
  else if (fechaPago > hoy()) problema = 'La fecha del pago no puede ser futura.';
  else if (fechaMinima && fechaPago < fechaMinima) problema = `La fecha no puede ser anterior al acuerdo (${fecha(fechaMinima)}).`;

  async function confirmar() {
    setGuardando(true);
    setError(null);
    try {
      const pago = await api(`/cuentas/${id}/pagos`, { method: 'POST', body: { fechaPago, monto: valor.toFixed(2) } });
      navigate(`/cuentas/${id}`, {
        replace: true,
        state: { aviso: `Pago de ${importe(pago.monto, cuenta.moneda)} registrado. Nuevo saldo: ${importe(pago.saldoCuenta, cuenta.moneda)}.` },
      });
    } catch (e) {
      setError(e);
      setRevisando(false);
      setGuardando(false);
    }
  }

  return (
    <>
      <Titulo titulo="Registrar pago" subtitulo="Solo el gestor activo asignado puede registrar el pago.">
        {cancelar}
      </Titulo>
      {!esResponsable ? (
        <div className="notice error">Esta cuenta no está asignada a ti; no puedes registrar pagos en ella.</div>
      ) : (
        <div className="grid">
          <form
            className="card col7"
            onSubmit={(ev) => {
              ev.preventDefault();
              if (!problema) setRevisando(true);
            }}
          >
            <h3>Datos del pago</h3>
            <ErrorFormulario error={error} />
            <fieldset disabled={revisando || guardando} style={{ border: 0, padding: 0, margin: 0 }}>
              <label className="field">
                Cuenta asignada
                <input className="input" readOnly value={`${cuenta.referenciaExterna ?? `#${cuenta.id}`} · ${cuenta.deudor.nombre}`} />
              </label>
              <label className="field">
                Fecha del pago
                <input className="input" type="date" required min={fechaMinima} max={hoy()} value={fechaPago} onChange={(e) => setFechaPago(e.target.value)} />
              </label>
              <label className="field">
                Monto ({cuenta.moneda})
                <input className="input" inputMode="decimal" required placeholder="0.00" value={monto} onChange={(e) => setMonto(e.target.value.trim())} />
              </label>
            </fieldset>
            {monto && problema && <div className="notice error">{problema}</div>}
            <div className="notice">
              El pago no puede exceder el saldo ni tener fecha futura o anterior al acuerdo. Una vez registrado, se conserva como historial.
            </div>
            {!revisando ? (
              <button type="submit" className="btn primary" disabled={!!problema}>
                Revisar pago
              </button>
            ) : (
              <div className="row">
                <button type="button" className="btn" disabled={guardando} onClick={() => setRevisando(false)}>
                  Corregir
                </button>
                <button type="button" className="btn primary" disabled={guardando} onClick={confirmar}>
                  {guardando ? 'Registrando…' : 'Confirmar registro de pago'}
                </button>
              </div>
            )}
          </form>
          <div className="card col5">
            <h3>Antes de confirmar</h3>
            <p>
              Saldo actual: <strong>{importe(cuenta.saldo, cuenta.moneda)}</strong>
            </p>
            <p>
              Exigible a hoy: <strong>{importe(cuenta.montoExigible, cuenta.moneda)}</strong>
            </p>
            <p>
              Pago propuesto: <strong>{problema ? '—' : importe(valor, cuenta.moneda)}</strong>
            </p>
            <p>
              Saldo estimado: <strong>{problema ? '—' : importe(saldo - valor, cuenta.moneda)}</strong>
            </p>
            {revisando && <div className="notice ok">Revisa los datos y confirma. El pago no podrá editarse.</div>}
          </div>
        </div>
      )}
    </>
  );
}
