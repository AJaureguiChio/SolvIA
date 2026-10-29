import { lazy, Suspense, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { ErrorFormulario, Titulo } from '../components/comunes.jsx';
import { api } from '../lib/api.js';
import { fecha, hoy, importe, nombreUsuario } from '../lib/formato.js';
import { useCarga } from '../lib/useCarga.js';

// Recharts y las librerías de PDF se cargan solo en esta pantalla.
const graficas = () => import('../components/Graficas.jsx');
const GraficaPagos = lazy(() => graficas().then((m) => ({ default: m.GraficaPagos })));
const GraficaMorosidad = lazy(() => graficas().then((m) => ({ default: m.GraficaMorosidad })));
const GraficaCartera = lazy(() => graficas().then((m) => ({ default: m.GraficaCartera })));

const mesLargo = new Intl.DateTimeFormat('es-MX', { month: 'long', year: 'numeric', timeZone: 'UTC' });

// Por omisión: desde el primer día de hace cinco meses hasta hoy (México).
function periodoInicial() {
  const hasta = hoy();
  const [a, m] = hasta.split('-').map(Number);
  const inicio = new Date(Date.UTC(a, m - 1 - 5, 1));
  return { desde: inicio.toISOString().slice(0, 10), hasta };
}

export default function NuevoReporte() {
  const navigate = useNavigate();
  const inicial = periodoInicial();
  const [config, setConfig] = useState({
    titulo: `Cumplimiento de pagos · ${mesLargo.format(new Date(`${inicial.hasta}T00:00:00Z`))}`,
    desde: inicial.desde,
    hasta: inicial.hasta,
    indicaciones: '',
  });
  const [destinatarios, setDestinatarios] = useState(null);
  const [entregar, setEntregar] = useState(true);
  const [borrador, setBorrador] = useState(null);
  const [texto, setTexto] = useState('');
  const [estado, setEstado] = useState(null);
  const [error, setError] = useState(null);
  const refPagos = useRef(null);
  const refMorosidad = useRef(null);
  const refCartera = useRef(null);

  const gestores = useCarga(() => api('/usuarios', { params: { rol: 'gestor', activo: true } }), []);
  const listaGestores = gestores.datos?.items ?? [];
  // Mientras el administrador no toque la lista, van todos los gestores activos.
  const elegidos = destinatarios ?? listaGestores.map((g) => g.id);
  const paso = borrador ? 2 : 1;
  const ocupado = estado !== null;

  const cambiar = (campo) => (ev) => setConfig({ ...config, [campo]: ev.target.value });

  function alternar(id) {
    setDestinatarios(elegidos.includes(id) ? elegidos.filter((x) => x !== id) : [...elegidos, id]);
  }

  async function redactar(ev) {
    ev?.preventDefault();
    setEstado('redactando');
    setError(null);
    try {
      const datos = await api('/reportes/previsualizaciones', {
        method: 'POST',
        body: { desde: config.desde, hasta: config.hasta, indicaciones: config.indicaciones.trim() || undefined },
      });
      setBorrador(datos);
      setTexto(datos.texto);
    } catch (e) {
      setError(e);
    } finally {
      setEstado(null);
    }
  }

  async function generar() {
    setEstado('generando');
    setError(null);
    try {
      const { generarPdfReporte } = await import('../lib/pdfReporte.js');
      const pdf = await generarPdfReporte({
        titulo: config.titulo.trim(),
        periodoDesde: borrador.periodoDesde,
        periodoHasta: borrador.periodoHasta,
        texto,
        resumen: borrador.resumen,
        prioridades: borrador.prioridades,
        graficas: [
          { titulo: 'Pagos por mes frente a lo esperado', nodo: refPagos.current },
          { titulo: 'Morosidad por días de atraso', nodo: refMorosidad.current },
          { titulo: 'Estado de la cartera', nodo: refCartera.current },
        ],
      });
      setEstado('guardando');
      const form = new FormData();
      form.append('pdf', pdf, 'reporte.pdf');
      form.append('titulo', config.titulo.trim());
      form.append('periodoDesde', borrador.periodoDesde);
      form.append('periodoHasta', borrador.periodoHasta);
      form.append('destinatarioIds', JSON.stringify(elegidos));
      form.append('entregar', String(entregar));
      const reporte = await api('/reportes', { method: 'POST', form });
      const n = elegidos.length;
      navigate('/reportes', {
        replace: true,
        state: {
          aviso: `Se guardó "${reporte.titulo}". ${
            n === 0 ? 'Sin destinatarios.' : entregar ? `Entregado a ${n} gestor(es).` : `${n} gestor(es) con entrega pendiente.`
          }`,
        },
      });
    } catch (e) {
      setError(e);
      setEstado(null);
    }
  }

  const tituloValido = config.titulo.trim().length > 0;
  const periodoValido = config.desde && config.hasta && config.desde <= config.hasta && config.hasta <= hoy();

  return (
    <>
      <Titulo titulo="Generar y entregar reporte" subtitulo="El administrador revisa el contenido antes de distribuir el PDF.">
        <Link to="/reportes" className="btn">
          Cancelar
        </Link>
      </Titulo>
      <div className="steps">
        <span className={paso >= 1 ? 'active' : ''}>1. Configurar</span>
        <span className={paso >= 2 ? 'active' : ''}>2. Revisar contenido</span>
        <span className={estado === 'generando' || estado === 'guardando' ? 'active' : ''}>3. Generar y entregar</span>
      </div>
      <ErrorFormulario error={error} />

      <div className="grid">
        <form className="card col5" onSubmit={redactar}>
          <h3>Configuración</h3>
          <fieldset disabled={ocupado} style={{ border: 0, padding: 0, margin: 0 }}>
            <label className="field">
              Título
              <input className="input" required maxLength={200} value={config.titulo} onChange={cambiar('titulo')} />
            </label>
            <div className="form-grid">
              <label className="field">
                Desde
                <input className="input" type="date" required max={config.hasta} value={config.desde} onChange={cambiar('desde')} />
              </label>
              <label className="field">
                Hasta
                <input className="input" type="date" required min={config.desde} max={hoy()} value={config.hasta} onChange={cambiar('hasta')} />
              </label>
            </div>
            <label className="field">
              Indicaciones para la IA (opcional)
              <textarea
                className="input"
                rows={2}
                maxLength={500}
                placeholder="Por ejemplo: enfatiza las cuentas con más de 60 días de mora."
                value={config.indicaciones}
                onChange={cambiar('indicaciones')}
              />
            </label>

            <h3 className="section">Destinatarios</h3>
            {gestores.cargando ? (
              <p className="muted">Cargando gestores…</p>
            ) : listaGestores.length === 0 ? (
              <p className="muted">No hay gestores activos.</p>
            ) : (
              listaGestores.map((g) => (
                <label key={g.id} className="checkline">
                  <input type="checkbox" checked={elegidos.includes(g.id)} onChange={() => alternar(g.id)} /> {nombreUsuario(g)}
                </label>
              ))
            )}
            <label className="checkline" style={{ marginTop: 10 }}>
              <input type="checkbox" checked={entregar} onChange={(e) => setEntregar(e.target.checked)} /> Confirmar la entrega al generar
            </label>
          </fieldset>
          <button type="submit" className="btn" style={{ marginTop: 12 }} disabled={ocupado || !periodoValido}>
            {estado === 'redactando' ? 'Redactando…' : borrador ? 'Volver a redactar con IA' : 'Redactar borrador con IA'}
          </button>
          {estado === 'redactando' && (
            <p className="muted">Gemini consulta las métricas de SolvIA por MCP y redacta el texto; tarda unos 20 segundos.</p>
          )}
        </form>

        <div className="card col7">
          <h3>Vista previa del documento</h3>
          {!borrador ? (
            <div className="placeholder" style={{ minHeight: 270 }}>
              Configura el periodo y pulsa “Redactar borrador con IA”.
              <br />
              El reporte incluye indicadores, gráficas, cuentas prioritarias y la interpretación en lenguaje natural.
            </div>
          ) : (
            <>
              <p className="muted">
                {fecha(borrador.periodoDesde)} – {fecha(borrador.periodoHasta)} · Modelo {borrador.modelo} · Herramientas MCP consultadas:{' '}
                {borrador.herramientasConsultadas.length ? borrador.herramientasConsultadas.join(', ') : 'ninguna'}
              </p>
              <p>
                Saldo total <strong>{importe(borrador.resumen.totales.saldoTotal)}</strong> · Vencido{' '}
                <strong>{importe(borrador.resumen.totales.montoVencido)}</strong> · Morosidad{' '}
                <strong>{borrador.resumen.totales.indiceMorosidad} %</strong>
              </p>
              <label className="field">
                Texto del reporte (puedes editarlo; conserva los encabezados “## ”)
                <textarea className="input" rows={16} value={texto} disabled={ocupado} onChange={(e) => setTexto(e.target.value)} />
              </label>
              <Suspense fallback={<div className="skeleton" style={{ height: 240, margin: 0 }} />}>
                <div ref={refPagos} className="captura-grafica">
                  <GraficaPagos datos={borrador.resumen.pagosPorPeriodo} />
                </div>
                <div ref={refMorosidad} className="captura-grafica">
                  <GraficaMorosidad datos={borrador.resumen.morosidad} />
                </div>
                <div ref={refCartera} className="captura-grafica">
                  <GraficaCartera totales={borrador.resumen.totales} />
                </div>
              </Suspense>
              <div className="row" style={{ marginTop: 12 }}>
                <Link to="/reportes" className="btn">
                  Volver a reportes
                </Link>
                <button type="button" className="btn primary" disabled={ocupado || !tituloValido || !texto.trim()} onClick={generar}>
                  {estado === 'generando' ? 'Generando PDF…' : estado === 'guardando' ? 'Guardando…' : 'Generar PDF y registrar destinatarios'}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
      <div className="notice">Revisa el periodo, el texto y los destinatarios antes de generar: el PDF guardado no se edita ni se elimina.</div>
    </>
  );
}
