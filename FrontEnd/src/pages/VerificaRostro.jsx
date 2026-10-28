import { useRef, useState } from 'react';
import { Navigate, useLocation, useNavigate } from 'react-router';
import Camara from '../components/Camara.jsx';
import { api } from '../lib/api.js';
import { useSesion } from '../sesion/SesionContext.jsx';

// Paso obligatorio después de iniciar sesión con Neon Auth (pantalla 2).
export default function VerificaRostro() {
  const { estado, recargar, cerrarSesion } = useSesion();
  const navigate = useNavigate();
  const location = useLocation();
  const camara = useRef(null);
  const [lista, setLista] = useState(false);
  const [verificando, setVerificando] = useState(false);
  const [error, setError] = useState(null);
  const [bloqueado, setBloqueado] = useState(false);

  if (estado === 'listo') return <Navigate to={location.state?.desde ?? '/'} replace />;
  if (estado === 'requiere_inscripcion') return <Navigate to="/registro-facial" replace />;
  if (estado !== 'requiere_verificacion' && estado !== 'cargando') return <Navigate to="/login" replace />;

  async function verificar() {
    setVerificando(true);
    setError(null);
    try {
      const foto = await camara.current.capturar();
      const form = new FormData();
      form.append('captura', foto, 'captura.jpg');
      await api('/facial/verificaciones', { method: 'POST', form });
      await recargar();
      navigate(location.state?.desde ?? '/', { replace: true });
    } catch (e) {
      if (e.code === 'FACE_LOCKED') setBloqueado(true);
      const restantes = e.details?.intentosRestantes;
      setError(e.code === 'FACE_MISMATCH' && restantes !== undefined ? `${e.message} Te quedan ${restantes} intentos.` : e.message);
      setVerificando(false);
    }
  }

  return (
    <div className="auth-shell">
      <div className="auth-panel" style={{ width: 'min(100%, 540px)' }}>
        <span className="badge">Paso obligatorio</span>
        <h2>Verifica tu rostro</h2>
        <p>Permite el uso de la cámara y sitúa tu rostro dentro de la guía.</p>
        <Camara ref={camara} onEstado={setLista} />
        {error && (
          <div className="notice error" role="alert" style={{ marginTop: 10 }}>
            {error}
          </div>
        )}
        <button type="button" className="btn primary" disabled={!lista || verificando || bloqueado} onClick={verificar}>
          {verificando ? 'Verificando…' : 'Verificar rostro'}
        </button>
        <button type="button" className="btn" onClick={cerrarSesion}>
          Volver al acceso
        </button>
        <p className="muted">
          Tras 5 intentos fallidos en 15 minutos se bloquea la verificación. Si la cámara falla o tu apariencia cambió, pide a un administrador
          que restablezca tu registro facial.
        </p>
      </div>
    </div>
  );
}
