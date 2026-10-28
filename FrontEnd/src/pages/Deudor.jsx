import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import { Cargando, ErrorCarga, ErrorFormulario, PillPlan, Titulo } from '../components/comunes.jsx';
import { api } from '../lib/api.js';
import { importe } from '../lib/formato.js';
import { useCarga } from '../lib/useCarga.js';
import { useSesion } from '../sesion/SesionContext.jsx';

const VACIO = { nombre: '', curp: '', rfc: '', telefono: '', ciudad: '', segmento: '', scoreBuro: '' };

export default function Deudor() {
  const { id } = useParams();
  const nuevo = !id;
  const { cargando, datos, error, recargar } = useCarga(() => (nuevo ? Promise.resolve(null) : api(`/deudores/${id}`)), [id]);

  const volver = (
    <Link to="/deudores" className="btn">
      Volver a deudores
    </Link>
  );

  if (cargando) return <><Titulo titulo="Deudor">{volver}</Titulo><Cargando /></>;
  if (error) return <><Titulo titulo="Deudor">{volver}</Titulo><ErrorCarga error={error} onReintentar={recargar} /></>;

  // La key reinicia el formulario cuando llegan datos nuevos del servidor.
  return <FichaDeudor key={datos ? JSON.stringify(datos) : 'nuevo'} deudor={datos} volver={volver} />;
}

function FichaDeudor({ deudor, volver }) {
  const { usuario } = useSesion();
  const esAdmin = usuario.rol === 'administrador';
  const navigate = useNavigate();
  const [actual, setActual] = useState(deudor);
  const [form, setForm] = useState(() =>
    deudor ? Object.fromEntries(Object.keys(VACIO).map((k) => [k, deudor[k] ?? ''])) : VACIO,
  );
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState(null);
  const [aviso, setAviso] = useState(null);

  const cambiar = (campo) => (ev) => setForm((f) => ({ ...f, [campo]: ev.target.value }));

  async function guardar(ev) {
    ev.preventDefault();
    setGuardando(true);
    setError(null);
    setAviso(null);
    const cuerpo = {
      nombre: form.nombre.trim(),
      curp: form.curp.trim().toUpperCase() || null,
      rfc: form.rfc.trim().toUpperCase() || null,
      telefono: form.telefono.trim() || null,
      ciudad: form.ciudad.trim() || null,
      segmento: form.segmento.trim() || null,
      scoreBuro: Number(form.scoreBuro),
    };
    try {
      if (!actual) {
        const creado = await api('/deudores', { method: 'POST', body: cuerpo });
        navigate(`/deudores/${creado.id}`, { replace: true });
        return;
      }
      const actualizado = await api(`/deudores/${actual.id}`, { method: 'PATCH', body: cuerpo });
      setActual((a) => ({ ...a, ...actualizado }));
      setAviso('Cambios guardados.');
    } catch (e) {
      setError(e);
    } finally {
      setGuardando(false);
    }
  }

  const soloLectura = !esAdmin;

  return (
    <>
      <Titulo
        titulo={actual ? actual.nombre : 'Registrar deudor'}
        subtitulo={esAdmin ? 'El score del buró se captura manualmente.' : 'Detalle del deudor.'}
      >
        {volver}
      </Titulo>
      <div className="grid">
        <form className={`card ${actual ? 'col7' : 'col12'}`} onSubmit={guardar}>
          <h3>Datos del deudor</h3>
          <ErrorFormulario error={error} />
          {aviso && <div className="notice ok">{aviso}</div>}
          <fieldset disabled={soloLectura || guardando} style={{ border: 0, padding: 0, margin: 0 }}>
            <div className="form-grid">
              <label className="field wide">
                Nombre
                <input className="input" required maxLength={200} value={form.nombre} onChange={cambiar('nombre')} />
              </label>
              <label className="field">
                CURP
                <input className="input" maxLength={18} value={form.curp} onChange={cambiar('curp')} />
              </label>
              <label className="field">
                RFC
                <input className="input" maxLength={13} value={form.rfc} onChange={cambiar('rfc')} />
              </label>
              <label className="field">
                Teléfono
                <input className="input" maxLength={20} value={form.telefono} onChange={cambiar('telefono')} />
              </label>
              <label className="field">
                Ciudad
                <input className="input" maxLength={100} value={form.ciudad} onChange={cambiar('ciudad')} />
              </label>
              <label className="field">
                Segmento
                <input className="input" maxLength={50} value={form.segmento} onChange={cambiar('segmento')} />
              </label>
              <label className="field">
                Score ficticio (0 a 1000)
                <input className="input" type="number" required min={0} max={1000} step={1} value={form.scoreBuro} onChange={cambiar('scoreBuro')} />
              </label>
            </div>
          </fieldset>
          {esAdmin && (
            <button type="submit" className="btn primary" disabled={guardando}>
              {guardando ? 'Guardando…' : actual ? 'Guardar cambios' : 'Registrar deudor'}
            </button>
          )}
          <div className="note">Debe existir CURP o RFC. La base comprueba unicidad y formato básico, no identidad oficial.</div>
        </form>

        {actual && (
          <div className="card col5">
            <h3>Cuentas vinculadas</h3>
            {actual.cuentas.length === 0 ? (
              <p className="muted">Sin cuentas visibles.</p>
            ) : (
              <div className="tablewrap">
                <table style={{ minWidth: 0 }}>
                  <thead>
                    <tr>
                      <th>Cuenta</th>
                      <th className="num">Saldo</th>
                      <th>Situación</th>
                    </tr>
                  </thead>
                  <tbody>
                    {actual.cuentas.map((c) => (
                      <tr key={c.id}>
                        <td>
                          <Link to={`/cuentas/${c.id}`} className="link">
                            {c.referenciaExterna ?? `#${c.id}`}
                          </Link>
                        </td>
                        <td className="num">{importe(c.saldo, c.moneda)}</td>
                        <td>
                          <PillPlan estado={c.estadoPlan} liquidada={c.cuentaLiquidada} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            {esAdmin && (
              <>
                <div className="spacer" />
                <Link to={`/cuentas/nueva?deudor=${actual.id}`} className="btn">
                  Crear cuenta y plan
                </Link>
              </>
            )}
          </div>
        )}
      </div>
    </>
  );
}
