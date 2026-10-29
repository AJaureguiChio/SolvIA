import { useState } from 'react';
import { Link, useLocation, useSearchParams } from 'react-router';
import { Cargando, ErrorCarga, ErrorFormulario, Paginacion, Titulo, Vacio } from '../components/comunes.jsx';
import { api } from '../lib/api.js';
import { fecha, fechaHora, nombreUsuario } from '../lib/formato.js';
import { useCarga } from '../lib/useCarga.js';
import { useSesion } from '../sesion/SesionContext.jsx';

async function descargarPdf(reporte) {
  const blob = await api(`/reportes/${reporte.id}/pdf`, { archivo: true });
  const url = URL.createObjectURL(blob);
  const enlace = document.createElement('a');
  enlace.href = url;
  enlace.download = `${reporte.titulo.replace(/[\\/:*?"<>|]+/g, '').trim() || 'reporte'}.pdf`;
  enlace.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export default function Reportes() {
  const { usuario } = useSesion();
  const esAdmin = usuario.rol === 'administrador';
  const location = useLocation();
  const [params, setParams] = useSearchParams();
  const page = Number(params.get('page') ?? 1);
  const [aviso, setAviso] = useState(location.state?.aviso ?? null);
  const [error, setError] = useState(null);
  const [ocupado, setOcupado] = useState(null);

  const { cargando, datos, error: errorCarga, recargar } = useCarga(() => api('/reportes', { params: { page, pageSize: 20 } }), [page]);

  async function accion(id, trabajo) {
    setOcupado(id);
    setError(null);
    try {
      await trabajo();
    } catch (e) {
      setError(e);
    } finally {
      setOcupado(null);
    }
  }

  // Confirma la entrega a los destinatarios que aún la tienen pendiente.
  const entregarPendientes = (r) =>
    accion(r.id, async () => {
      const detalle = await api(`/reportes/${r.id}`);
      const pendientes = detalle.destinatarios.filter((d) => !d.entregadoEn).map((d) => d.usuario.id);
      await api(`/reportes/${r.id}/entregas`, { method: 'POST', body: { usuarioIds: pendientes } });
      setAviso(`"${r.titulo}" quedó entregado a ${pendientes.length} gestor(es).`);
      recargar();
    });

  return (
    <>
      <Titulo
        titulo="Reportes ejecutivos"
        subtitulo={esAdmin ? 'Todos los reportes generados.' : 'Reportes en los que figuro como destinatario.'}
      >
        {esAdmin && (
          <Link to="/reportes/nuevo" className="btn primary">
            Generar reporte
          </Link>
        )}
      </Titulo>

      {aviso && <div className="notice ok">{aviso}</div>}
      <ErrorFormulario error={error} />

      {cargando && !datos ? (
        <Cargando />
      ) : errorCarga ? (
        <ErrorCarga error={errorCarga} onReintentar={recargar} />
      ) : datos.items.length === 0 ? (
        <Vacio
          titulo="Sin reportes"
          texto={esAdmin ? 'Genera el primer reporte ejecutivo.' : 'Aún no se te ha entregado ningún reporte.'}
        />
      ) : (
        <>
          <div className="tablewrap">
            <table>
              <thead>
                <tr>
                  <th>Reporte</th>
                  <th>Periodo</th>
                  <th>Generado</th>
                  {esAdmin && <th>Destinatarios</th>}
                  <th>Entrega</th>
                  <th>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {datos.items.map((r) => {
                  const pendientes = r.destinatarios - r.entregados;
                  return (
                    <tr key={r.id}>
                      <td>{r.titulo}</td>
                      <td>
                        {fecha(r.periodoDesde)} – {fecha(r.periodoHasta)}
                      </td>
                      <td>
                        {fechaHora(r.generadoEn)}
                        {esAdmin && (
                          <>
                            <br />
                            <small>{nombreUsuario(r.generadoPor)}</small>
                          </>
                        )}
                      </td>
                      {esAdmin && <td>{r.destinatarios === 0 ? '—' : `${r.destinatarios} gestor(es)`}</td>}
                      <td>
                        {!esAdmin || (r.destinatarios > 0 && pendientes === 0) ? (
                          <span className="pill ok">Entregado</span>
                        ) : r.destinatarios === 0 ? (
                          <span className="pill">Sin destinatarios</span>
                        ) : (
                          <span className="pill alerta">{pendientes} pendiente(s)</span>
                        )}
                      </td>
                      <td>
                        <div className="row" style={{ gap: 6 }}>
                          <button type="button" className="btn" disabled={ocupado === r.id} onClick={() => accion(r.id, () => descargarPdf(r))}>
                            Descargar PDF
                          </button>
                          {esAdmin && pendientes > 0 && (
                            <button type="button" className="btn" disabled={ocupado === r.id} onClick={() => entregarPendientes(r)}>
                              Entregar
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <Paginacion page={datos.page} pageSize={datos.pageSize} total={datos.total} onCambiar={(p) => setParams({ page: String(p) })} />
        </>
      )}
      <div className="note">Los PDF y sus entregas se conservan como historial: no se editan ni se eliminan.</div>
    </>
  );
}
