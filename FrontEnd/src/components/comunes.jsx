import { ESTADO_CUOTA, ESTADO_PLAN } from '../lib/formato.js';

export function Titulo({ titulo, subtitulo, children }) {
  return (
    <div className="page-title">
      <div>
        <h2>{titulo}</h2>
        {subtitulo && <p>{subtitulo}</p>}
      </div>
      {children && <div className="row">{children}</div>}
    </div>
  );
}

export function Cargando() {
  return (
    <div className="card" aria-busy="true" aria-label="Cargando información">
      <div className="skeleton" style={{ width: '50%' }} />
      <div className="skeleton" style={{ width: '90%' }} />
      <div className="skeleton" style={{ width: '73%' }} />
    </div>
  );
}

export function ErrorCarga({ error, onReintentar }) {
  return (
    <>
      <div className="notice error" role="alert">
        {error?.status === 404
          ? 'No se encontró el registro o no tienes acceso a él.'
          : error?.message || 'No se pudo cargar esta vista. Comprueba la conexión e inténtalo nuevamente.'}
      </div>
      {onReintentar && error?.status !== 404 && (
        <button type="button" className="btn primary" onClick={onReintentar}>
          Reintentar
        </button>
      )}
    </>
  );
}

export function Vacio({ titulo = 'Aún no hay información', texto }) {
  return (
    <div className="empty">
      <div>
        <h3>{titulo}</h3>
        {texto && <p>{texto}</p>}
      </div>
    </div>
  );
}

export function Stat({ nombre, valor, detalle }) {
  return (
    <div className="card stat">
      <small>{nombre}</small>
      <strong>{valor}</strong>
      {detalle && <em>{detalle}</em>}
    </div>
  );
}

export function PillPlan({ estado, liquidada }) {
  if (liquidada) return <span className="pill ok">Liquidada</span>;
  return <span className={`pill ${estado === 'atrasado' ? 'alerta' : estado === 'cubierto' ? 'ok' : ''}`}>{ESTADO_PLAN[estado] ?? estado}</span>;
}

export function PillCuota({ estado }) {
  return <span className={`pill ${estado === 'vencida' ? 'alerta' : estado === 'pagada' ? 'ok' : ''}`}>{ESTADO_CUOTA[estado] ?? estado}</span>;
}

export function Paginacion({ page, pageSize, total, onCambiar }) {
  const paginas = Math.max(1, Math.ceil(total / pageSize));
  if (paginas <= 1) return null;
  return (
    <div className="paginacion">
      <button type="button" className="btn" disabled={page <= 1} onClick={() => onCambiar(page - 1)}>
        Anterior
      </button>
      <span>
        Página {page} de {paginas} · {total} registros
      </span>
      <button type="button" className="btn" disabled={page >= paginas} onClick={() => onCambiar(page + 1)}>
        Siguiente
      </button>
    </div>
  );
}

// Restricciones UNIQUE de la base que llegan en details.constraint con DUPLICATE_IDENTIFIER.
const DUPLICADOS = {
  deudores_curp_key: 'Ya existe un deudor con ese CURP.',
  deudores_rfc_key: 'Ya existe un deudor con ese RFC.',
  cuentas_referencia_externa_key: 'Ya existe una cuenta con esa referencia externa.',
};

// Muestra los errores por campo de INVALID_INPUT o el mensaje general.
// El nombre técnico de la restricción (details.constraint) no se muestra.
export function ErrorFormulario({ error }) {
  if (!error) return null;
  const { constraint, ...resto } = error.details ?? {};
  const campos = Object.entries(resto);
  return (
    <div className="notice error" role="alert">
      {(error.code === 'DUPLICATE_IDENTIFIER' && DUPLICADOS[constraint]) || error.message}
      {campos.length > 0 && (
        <ul style={{ margin: '6px 0 0', paddingLeft: 18 }}>
          {campos.map(([campo, mensajes]) => (
            <li key={campo}>{[].concat(mensajes).join(' · ')}</li>
          ))}
        </ul>
      )}
    </div>
  );
}
