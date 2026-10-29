import { useState } from 'react';
import { Link, useSearchParams } from 'react-router';
import { Cargando, ErrorCarga, ErrorFormulario, Titulo, Vacio } from '../components/comunes.jsx';
import { api } from '../lib/api.js';
import { nombreUsuario } from '../lib/formato.js';
import { useCarga } from '../lib/useCarga.js';
import { useSesion } from '../sesion/SesionContext.jsx';

// Acciones que piden confirmación antes de llamar a la API.
const ACCIONES = {
  desactivar: {
    boton: 'Desactivar',
    pregunta: (u) => `¿Desactivar a ${nombreUsuario(u)}? Ya no podrá entrar a SolvIA.`,
    ejecutar: (u) => api(`/usuarios/${u.id}`, { method: 'PATCH', body: { activo: false } }),
    hecho: (u) => `${nombreUsuario(u)} quedó desactivado.`,
  },
  activar: {
    boton: 'Activar',
    pregunta: (u) => `¿Activar de nuevo a ${nombreUsuario(u)}?`,
    ejecutar: (u) => api(`/usuarios/${u.id}`, { method: 'PATCH', body: { activo: true } }),
    hecho: (u) => `${nombreUsuario(u)} quedó activo.`,
  },
  rol: {
    boton: 'Cambiar rol',
    pregunta: (u) => `¿Cambiar a ${nombreUsuario(u)} al rol ${u.rol === 'gestor' ? 'administrador' : 'gestor'}?`,
    ejecutar: (u) =>
      api(`/usuarios/${u.id}`, { method: 'PATCH', body: { rol: u.rol === 'gestor' ? 'administrador' : 'gestor' } }),
    hecho: (u) => `${nombreUsuario(u)} ahora es ${u.rol === 'gestor' ? 'administrador' : 'gestor'}.`,
  },
  rostro: {
    boton: 'Restablecer rostro',
    pregunta: (u) =>
      `¿Restablecer el rostro de ${nombreUsuario(u)}? Se borra su registro facial y deberá registrarlo de nuevo en su siguiente acceso.`,
    ejecutar: (u) => api(`/usuarios/${u.id}/restablecimiento-facial`, { method: 'POST' }),
    hecho: (u) => `Se restableció el rostro de ${nombreUsuario(u)}. Lo registrará de nuevo al entrar.`,
  },
};

export default function Usuarios() {
  const { usuario: yo } = useSesion();
  const [params, setParams] = useSearchParams();
  const filtros = { rol: params.get('rol') ?? '', activo: params.get('activo') ?? '' };
  const [pendiente, setPendiente] = useState(null);
  const [aviso, setAviso] = useState(null);
  const [gestorOrigen, setGestorOrigen] = useState('');
  // Cambia tras cada acción para que la sección de reasignación recargue sus listas.
  const [version, setVersion] = useState(0);
  const [creando, setCreando] = useState(false);

  const { cargando, datos, error, recargar } = useCarga(
    () => api('/usuarios', { params: { rol: filtros.rol, activo: filtros.activo } }),
    [filtros.rol, filtros.activo],
  );

  function aplicar(cambios) {
    const siguiente = { ...filtros, ...cambios };
    setParams(Object.fromEntries(Object.entries(siguiente).filter(([, v]) => v)));
  }

  function pedir(accion, u) {
    setAviso(null);
    // Un gestor con cuentas no se puede desactivar ni cambiar de rol: primero se reasignan.
    if ((accion === 'desactivar' || accion === 'rol') && u.rol === 'gestor' && u.cuentasAsignadas > 0) {
      setPendiente(null);
      setGestorOrigen(u.id);
      setAviso({
        tipo: 'error',
        texto: `${nombreUsuario(u)} tiene ${u.cuentasAsignadas} cuenta(s) asignada(s). Reasígnalas abajo antes de continuar.`,
      });
      return;
    }
    setPendiente({ accion, usuario: u, error: null, enviando: false });
  }

  async function confirmar() {
    const { accion, usuario: u } = pendiente;
    setPendiente({ ...pendiente, enviando: true, error: null });
    try {
      await ACCIONES[accion].ejecutar(u);
      setPendiente(null);
      setAviso({ tipo: 'ok', texto: ACCIONES[accion].hecho(u) });
      recargar();
      setVersion((v) => v + 1);
    } catch (e) {
      setPendiente({ ...pendiente, enviando: false, error: e });
    }
  }

  return (
    <>
      <Titulo titulo="Usuarios y asignaciones" subtitulo="El administrador administra el rol, el estado y el rostro de cada perfil.">
        {!creando && (
          <button
            type="button"
            className="btn primary"
            onClick={() => {
              setCreando(true);
              setAviso(null);
            }}
          >
            Nuevo usuario
          </button>
        )}
      </Titulo>

      {creando && (
        <NuevoUsuario
          onCancelar={() => setCreando(false)}
          onCreado={(texto) => {
            setCreando(false);
            setAviso({ tipo: 'ok', texto });
            recargar();
            setVersion((v) => v + 1);
          }}
        />
      )}

      <form className="filters" onSubmit={(ev) => ev.preventDefault()}>
        <label className="field">
          Rol
          <select className="input" value={filtros.rol} onChange={(e) => aplicar({ rol: e.target.value })}>
            <option value="">Todos</option>
            <option value="administrador">Administrador</option>
            <option value="gestor">Gestor</option>
          </select>
        </label>
        <label className="field">
          Estado
          <select className="input" value={filtros.activo} onChange={(e) => aplicar({ activo: e.target.value })}>
            <option value="">Todos</option>
            <option value="true">Activos</option>
            <option value="false">Inactivos</option>
          </select>
        </label>
      </form>

      {aviso && (
        <div className={`notice ${aviso.tipo}`} role="status">
          {aviso.texto}
        </div>
      )}

      {pendiente && (
        <div className="card" style={{ marginBottom: 15 }}>
          <p style={{ marginTop: 0 }}>{ACCIONES[pendiente.accion].pregunta(pendiente.usuario)}</p>
          <ErrorFormulario error={pendiente.error} />
          <div className="row">
            <button type="button" className="btn primary" disabled={pendiente.enviando} onClick={confirmar}>
              {pendiente.enviando ? 'Guardando…' : 'Confirmar'}
            </button>
            <button type="button" className="btn" disabled={pendiente.enviando} onClick={() => setPendiente(null)}>
              Cancelar
            </button>
          </div>
        </div>
      )}

      {cargando && !datos ? (
        <Cargando />
      ) : error ? (
        <ErrorCarga error={error} onReintentar={recargar} />
      ) : datos.items.length === 0 ? (
        <Vacio titulo="Sin usuarios" texto="No hay usuarios que coincidan con los filtros." />
      ) : (
        <div className="tablewrap">
          <table>
            <thead>
              <tr>
                <th>Usuario</th>
                <th>Rol</th>
                <th>Activo</th>
                <th className="num">Cuentas</th>
                <th>Rostro</th>
                <th>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {datos.items.map((u) => {
                const soyYo = u.id === yo.id;
                return (
                  <tr key={u.id}>
                    <td>
                      {u.nombre || '—'}
                      {soyYo && ' (tú)'}
                      <br />
                      <small>{u.email}</small>
                    </td>
                    <td>
                      <span className="pill">{u.rol === 'administrador' ? 'Administrador' : 'Gestor'}</span>
                    </td>
                    <td>{u.activo ? 'Sí' : <span className="pill alerta">No</span>}</td>
                    <td className="num">
                      {u.rol === 'gestor' ? <Link to={`/cuentas?gestor=${u.id}`}>{u.cuentasAsignadas}</Link> : '—'}
                    </td>
                    <td>{u.facialInscrito ? <span className="pill ok">Registrado</span> : <span className="pill">Sin registrar</span>}</td>
                    <td>
                      <div className="row" style={{ gap: 6 }}>
                        {/* El backend no permite modificarse a uno mismo (SELF_MODIFICATION). */}
                        {!soyYo && (
                          <>
                            <button type="button" className="btn" onClick={() => pedir(u.activo ? 'desactivar' : 'activar', u)}>
                              {u.activo ? 'Desactivar' : 'Activar'}
                            </button>
                            <button type="button" className="btn" onClick={() => pedir('rol', u)}>
                              {u.rol === 'gestor' ? 'Hacer administrador' : 'Hacer gestor'}
                            </button>
                          </>
                        )}
                        <button
                          type="button"
                          className="btn"
                          disabled={!u.facialInscrito}
                          title={u.facialInscrito ? undefined : 'No tiene rostro registrado'}
                          onClick={() => pedir('rostro', u)}
                        >
                          Restablecer rostro
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <h3 className="section">Reasignar cuenta</h3>
      <ReasignarCuenta
        version={version}
        gestorOrigen={gestorOrigen}
        onGestorOrigen={setGestorOrigen}
        onReasignada={(texto) => {
          setAviso({ tipo: 'ok', texto });
          recargar();
          setVersion((v) => v + 1);
        }}
      />
      <div className="note">
        Antes de desactivar a un gestor o cambiarlo de rol, reasigna todas sus cuentas. Cada cambio queda en el historial de
        asignaciones de la cuenta. Cada usuario nuevo registra su rostro en su primer acceso.
      </div>
    </>
  );
}

// Contraseña temporal legible, sin caracteres que se confundan (0/O, 1/l).
function contrasenaTemporal() {
  const letras = 'abcdefghijkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const azar = crypto.getRandomValues(new Uint32Array(12));
  return Array.from(azar, (n) => letras[n % letras.length]).join('');
}

function NuevoUsuario({ onCancelar, onCreado }) {
  const [datos, setDatos] = useState({ nombre: '', email: '', password: contrasenaTemporal(), rol: 'gestor' });
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState(null);
  const cambiar = (campo) => (ev) => setDatos({ ...datos, [campo]: ev.target.value });

  async function guardar(ev) {
    ev.preventDefault();
    setGuardando(true);
    setError(null);
    try {
      const creado = await api('/usuarios', { method: 'POST', body: { ...datos, nombre: datos.nombre.trim(), email: datos.email.trim() } });
      onCreado(
        creado.identidadNueva
          ? `Se creó a ${nombreUsuario(creado)} (${creado.email}) con la contraseña temporal ${datos.password}. Compártela por un medio seguro; al entrar registrará su rostro.`
          : `${creado.email} ya tenía cuenta en Neon Auth: se le asignó el rol y conserva su contraseña. Al entrar registrará su rostro.`,
      );
    } catch (e) {
      setError(e);
      setGuardando(false);
    }
  }

  return (
    <form className="card" style={{ marginBottom: 15 }} onSubmit={guardar}>
      <h3>Nuevo usuario</h3>
      <ErrorFormulario error={error} />
      <fieldset disabled={guardando} style={{ border: 0, padding: 0, margin: 0 }}>
        <div className="form-grid">
          <label className="field">
            Nombre
            <input className="input" required maxLength={100} value={datos.nombre} onChange={cambiar('nombre')} />
          </label>
          <label className="field">
            Correo
            <input className="input" type="email" required maxLength={256} value={datos.email} onChange={cambiar('email')} />
          </label>
          <label className="field">
            Contraseña temporal
            <span className="row" style={{ gap: 6, flexWrap: 'nowrap' }}>
              <input className="input" required minLength={8} maxLength={128} value={datos.password} onChange={cambiar('password')} />
              <button type="button" className="btn" onClick={() => setDatos({ ...datos, password: contrasenaTemporal() })}>
                Generar
              </button>
            </span>
          </label>
          <label className="field">
            Rol
            <select className="input" value={datos.rol} onChange={cambiar('rol')}>
              <option value="gestor">Gestor</option>
              <option value="administrador">Administrador</option>
            </select>
          </label>
        </div>
      </fieldset>
      <div className="notice">
        Se crea la cuenta en Neon Auth y el perfil en SolvIA. Si el correo ya tiene cuenta en Neon Auth sin perfil, solo se le
        asigna el rol y conserva su contraseña.
      </div>
      <div className="row">
        <button type="submit" className="btn primary" disabled={guardando}>
          {guardando ? 'Creando…' : 'Crear usuario'}
        </button>
        <button type="button" className="btn" disabled={guardando} onClick={onCancelar}>
          Cancelar
        </button>
      </div>
    </form>
  );
}

function ReasignarCuenta({ version, gestorOrigen, onGestorOrigen, onReasignada }) {
  const [cuentaId, setCuentaId] = useState('');
  const [destino, setDestino] = useState('');
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState(null);

  // Independiente de los filtros de la tabla: siempre todos los gestores.
  const listaGestores = useCarga(() => api('/usuarios', { params: { rol: 'gestor' } }), [version]);
  const gestores = listaGestores.datos?.items ?? [];
  const cuentas = useCarga(
    () =>
      gestorOrigen
        ? api('/cuentas', { params: { responsableId: gestorOrigen, orden: 'id', pageSize: 100 } })
        : Promise.resolve({ items: [] }),
    [gestorOrigen, version],
  );
  const lista = cuentas.datos?.items ?? [];
  const activos = gestores.filter((g) => g.activo && g.id !== gestorOrigen);

  function cambiarOrigen(id) {
    onGestorOrigen(id);
    setCuentaId('');
    setError(null);
  }

  async function guardar(ev) {
    ev.preventDefault();
    setGuardando(true);
    setError(null);
    try {
      await api(`/cuentas/${cuentaId}/asignacion`, { method: 'PATCH', body: { responsableId: destino || null } });
      const cuenta = lista.find((c) => String(c.id) === cuentaId);
      const nuevo = gestores.find((g) => g.id === destino);
      setCuentaId('');
      onReasignada(`${cuenta?.referenciaExterna ?? `Cuenta #${cuentaId}`} quedó asignada a ${nombreUsuario(nuevo)}.`);
    } catch (e) {
      setError(e);
    } finally {
      setGuardando(false);
    }
  }

  return (
    <form className="card" onSubmit={guardar}>
      <ErrorFormulario error={error} />
      <div className="form-grid">
        <label className="field">
          Gestor actual
          <select className="input" value={gestorOrigen} onChange={(e) => cambiarOrigen(e.target.value)}>
            <option value="">Elige un gestor</option>
            {gestores.map((g) => (
              <option key={g.id} value={g.id}>
                {nombreUsuario(g)} ({g.cuentasAsignadas})
              </option>
            ))}
          </select>
        </label>
        <label className="field">
          Cuenta
          <select
            className="input"
            value={cuentaId}
            disabled={!gestorOrigen || cuentas.cargando || lista.length === 0}
            onChange={(e) => setCuentaId(e.target.value)}
          >
            <option value="">
              {!gestorOrigen ? '—' : cuentas.cargando ? 'Cargando…' : lista.length === 0 ? 'Sin cuentas asignadas' : 'Elige una cuenta'}
            </option>
            {lista.map((c) => (
              <option key={c.id} value={c.id}>
                {c.referenciaExterna ?? `#${c.id}`} · {c.deudor.nombre}
              </option>
            ))}
          </select>
        </label>
        <label className="field">
          Nuevo gestor
          <select className="input" value={destino} onChange={(e) => setDestino(e.target.value)}>
            <option value="">Sin asignar</option>
            {activos.map((g) => (
              <option key={g.id} value={g.id}>
                {nombreUsuario(g)}
              </option>
            ))}
          </select>
        </label>
      </div>
      {cuentas.error && <ErrorCarga error={cuentas.error} onReintentar={cuentas.recargar} />}
      <button type="submit" className="btn primary" disabled={!cuentaId || guardando}>
        {guardando ? 'Guardando…' : 'Confirmar reasignación'}
      </button>
    </form>
  );
}
