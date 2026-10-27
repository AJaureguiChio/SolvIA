import { useState } from 'react';
import { Link, useSearchParams } from 'react-router';
import { Cargando, ErrorCarga, Paginacion, Titulo, Vacio } from '../components/comunes.jsx';
import { api } from '../lib/api.js';
import { useCarga } from '../lib/useCarga.js';
import { useSesion } from '../sesion/SesionContext.jsx';

const PAGE_SIZE = 20;

export default function Deudores() {
  const { usuario } = useSesion();
  const esAdmin = usuario.rol === 'administrador';
  const [params, setParams] = useSearchParams();
  const q = params.get('q') ?? '';
  const page = Number(params.get('page') ?? 1);
  const [busqueda, setBusqueda] = useState(q);

  const { cargando, datos, error, recargar } = useCarga(
    () => api('/deudores', { params: { q, page, pageSize: PAGE_SIZE } }),
    [q, page],
  );

  function buscar(ev) {
    ev.preventDefault();
    setParams(busqueda.trim() ? { q: busqueda.trim() } : {});
  }

  return (
    <>
      <Titulo
        titulo="Deudores"
        subtitulo={esAdmin ? 'Personas registradas y su score ficticio.' : 'Solo personas vinculadas a mis cuentas.'}
      >
        {esAdmin && (
          <Link to="/deudores/nuevo" className="btn primary">
            Registrar deudor
          </Link>
        )}
      </Titulo>

      <form className="filters" style={{ gridTemplateColumns: '1fr auto' }} onSubmit={buscar}>
        <label className="field">
          Nombre, CURP o RFC
          <input className="input" type="search" value={busqueda} maxLength={100} onChange={(e) => setBusqueda(e.target.value)} />
        </label>
        <button type="submit" className="btn">
          Buscar
        </button>
      </form>

      {cargando ? (
        <Cargando />
      ) : error ? (
        <ErrorCarga error={error} onReintentar={recargar} />
      ) : datos.items.length === 0 ? (
        <Vacio titulo="Sin deudores" texto={q ? 'Ningún deudor coincide con la búsqueda.' : 'Aún no hay deudores registrados.'} />
      ) : (
        <>
          <div className="tablewrap">
            <table>
              <thead>
                <tr>
                  <th>Deudor</th>
                  <th>Identificador</th>
                  <th>Ciudad</th>
                  <th>Segmento</th>
                  <th className="num">Score</th>
                  <th className="num">Cuentas</th>
                  <th>Acción</th>
                </tr>
              </thead>
              <tbody>
                {datos.items.map((d) => (
                  <tr key={d.id}>
                    <td>{d.nombre}</td>
                    <td>{d.curp ? `CURP ${d.curp}` : `RFC ${d.rfc}`}</td>
                    <td>{d.ciudad ?? '—'}</td>
                    <td>{d.segmento ?? '—'}</td>
                    <td className="num">{d.scoreBuro}</td>
                    <td className="num">{d.numeroCuentas}</td>
                    <td>
                      <Link to={`/deudores/${d.id}`} className="btn">
                        Ver ficha
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Paginacion
            page={datos.page}
            pageSize={datos.pageSize}
            total={datos.total}
            onCambiar={(p) => setParams({ ...(q ? { q } : {}), page: String(p) })}
          />
        </>
      )}
      <div className="note">CURP y RFC son identificadores únicos de los deudores ficticios. No se consulta un buró externo.</div>
    </>
  );
}
