import { useRef, useState } from 'react';
import { api } from '../lib/api.js';
import Camara from './Camara.jsx';

// Varias capturas dan una galería más robusta a cambios de luz y de ángulo.
const CAPTURAS = 3;

// Toma CAPTURAS fotos y las envía a POST /facial/inscripciones. Las fotos solo
// viven en memoria hasta el envío; el backend guarda los embeddings cifrados.
export default function RegistroRostro({ onRegistrado }) {
  const camara = useRef(null);
  const [lista, setLista] = useState(false);
  const [fotos, setFotos] = useState([]);
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState(null);

  async function capturar() {
    setError(null);
    const foto = await camara.current.capturar();
    if (foto) setFotos((f) => [...f, foto]);
  }

  async function registrar() {
    setEnviando(true);
    setError(null);
    const form = new FormData();
    fotos.forEach((foto, i) => form.append('captura', foto, `captura-${i + 1}.jpg`));
    try {
      await api('/facial/inscripciones', { method: 'POST', form });
      await onRegistrado();
    } catch (e) {
      setError(e.message);
      setFotos([]);
      setEnviando(false);
    }
  }

  const completas = fotos.length >= CAPTURAS;

  return (
    <>
      <Camara ref={camara} onEstado={setLista} />
      <p className="muted" style={{ margin: '10px 0 0' }}>
        Coloca tu rostro dentro de la guía, de frente y con buena luz. Mueve ligeramente la cabeza entre una captura y otra.
      </p>
      {error && (
        <div className="notice error" role="alert" style={{ marginTop: 10 }}>
          {error}
        </div>
      )}
      <div className="row" style={{ marginTop: 10 }}>
        <span className="pill">
          Capturas: {Math.min(fotos.length, CAPTURAS)} de {CAPTURAS}
        </span>
        {fotos.length > 0 && !enviando && (
          <button type="button" className="link" onClick={() => setFotos([])}>
            Empezar de nuevo
          </button>
        )}
      </div>
      {!completas ? (
        <button type="button" className="btn primary" disabled={!lista} onClick={capturar}>
          Tomar captura {fotos.length + 1}
        </button>
      ) : (
        <button type="button" className="btn primary" disabled={enviando} onClick={registrar}>
          {enviando ? 'Registrando…' : 'Registrar mi rostro'}
        </button>
      )}
    </>
  );
}
