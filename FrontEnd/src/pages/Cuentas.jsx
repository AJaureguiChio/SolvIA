import { useState } from 'react';
import { Link, useSearchParams } from 'react-router';
import { Cargando, ErrorCarga, Paginacion, PillPlan, Titulo, Vacio } from '../components/comunes.jsx';
import { api } from '../lib/api.js';
import { importe, nombreUsuario } from '../lib/formato.js';
import { useCarga } from '../lib/useCarga.js';
import { useSesion } from '../sesion/SesionContext.jsx';

const PAGE_SIZE = 20;

export default function Cuentas() {
  const { usuario } = useSesion();
  const esAdmin = usuario.rol === 'administrador';
  const [params, setParams] = useSearchParams();
  const filtros = {
    q: params.get('q') ?? '',
    estadoPlan: params.get('estadoPlan') ?? '',
    gestor: params.get('gestor') ?? '',
    orden: params.get('orden') ?? 'prioridad',
  };
  const page = Number(params.get('page') ?? 1);
  const [busqueda, setBusqueda] = useState(filtros.q);

  const gestores = useCarga(
    () => (esAdmin ? api('/usuarios', { params: { rol: 'gestor', activo: true } }) : Promise.resolve({ items: [] })),
    [esAdmin],
  );

  const { cargando, datos, error, recargar } = useCarga(
    () =>
      api('/cuentas', {
        params: {
          q: filtros.q,
          estadoPlan: filtros.estadoPlan,
          responsableId: filtros.gestor && filtros.gestor !== 'sin' ? filtros.gestor : undefined,
          sinAsignar: filtros.gestor === 'sin' ? true : undefined,
          orden: filtros.orden,
          page,
          pageSize: PAGE_SIZE,
        },
      }),
    [filtros.q, filtros.estadoPlan, filtros.gestor, filtros.orden, page],
  );

  function aplicar(cambios) {
    const siguiente = { ...filtros, ...cambios };
    setParams(Object.fromEntries(Object.entries(siguiente).filter(([, v]) => v)));
  }

  return (
    <>
      <Titulo
        titulo={esAdmin ? 'Cartera de cuentas' : 'Mis cuentas'}
        subtitulo={esAdmin ? 'Todas las cuentas, con o sin responsable.' : 'Únicamente las cuentas que tengo asignadas.'}
      />

      <form
        className="filters"
        onSubmit={(ev) => {
          ev.preventDefault();
          aplicar({ q: busqueda.trim() });
        }}
      >
        <label className="field">
          Cuenta o deudor
          <input className="input" type="search" maxLength={100} value={busqueda} onChange={(e) => setBusqueda(e.target.value)} />
        </label>
        <label className="field">
          Cumplimiento
          <select className="input" value={filtros.estadoPlan} onChange={(e) => aplicar({ estadoPlan: e.target.value })}>
            <option value="">Todos</option>
            <option value="al_corriente">Al corriente</option>
            <option value="atrasado">Atrasado</option>
            <option value="cubierto">Cubierto</option>
          </select>
        </label>
        {esAdmin ? (
          <label className="field">
            Gestor
            <select className="input" value={filtros.gestor} onChange={(e) => aplicar({ gestor: e.target.value })}>
              <option value="">Todos</option>
              <option value="sin">Sin asignar</option>
              {(gestores.datos?.items ?? []).map((g) => (
                <option key={g.id} value={g.id}>
                  {nombreUsuario(g)}
                </option>
              ))}
            </select>
          </label>
        ) : (
          <label className="field">
            Orden
            <select className="input" value={filtros.orden} onChange={(e) => aplicar({ orden: e.target.value })}>
              <option value="prioridad">Prioridad</option>
              <option value="saldo">Saldo</option>
              <option value="id">Alta</option>
            </select>
          </label>
        )}
        <button type="submit" className="btn">
          Filtrar
        </button>
      </form>

      {cargando ? (
        <Cargando />
      ) : error ? (
        <ErrorCarga error={error} onReintentar={recargar} />
      ) : datos.items.length === 0 ? (
        <Vacio titulo="Sin cuentas" texto="No hay cuentas que coincidan con los filtros." />
      ) : (
        <>
          <div className="tablewrap">
            <table>
              <thead>
                <tr>
                  <th>Cuenta</th>
                  <th>Deudor</th>
                  <th className="num">Saldo</th>
                  <th className="num">Vencido</th>
                  <th>Plan</th>
                  <th className="num">Días de mora</th>
                  <th className="num">Prioridad</th>
                  {esAdmin && <th>Gestor</th>}
                  <th>Acción</th>
                </tr>
              </thead>
              <tbody>
                {datos.items.map((c) => (
                  <tr key={c.id}>
                    <td>{c.referenciaExterna ?? `#${c.id}`}</td>
                    <td>{c.deudor.nombre}</td>
                    <td className="num">{importe(c.saldo, c.moneda)}</td>
                    <td className="num">{importe(c.montoVencido, c.moneda)}</td>
                    <td>
                      <PillPlan estado={c.estadoPlan} liquidada={c.cuentaLiquidada} />
                    </td>
                    <td className="num">{c.diasMora}</td>
                    <td className="num">{c.prioridad}</td>
                    {esAdmin && <td>{nombreUsuario(c.responsable)}</td>}
                    <td>
                      <Link to={`/cuentas/${c.id}`} className="btn">
                        Abrir
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
            onCambiar={(p) => setParams({ ...Object.fromEntries(params), page: String(p) })}
          />
        </>
      )}
      <div className="note">Saldo y cumplimiento son calculados. No existe un formulario para editarlos directamente.</div>
    </>
  );
}
