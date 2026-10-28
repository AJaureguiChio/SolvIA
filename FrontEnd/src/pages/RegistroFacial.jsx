import { Navigate, useNavigate } from 'react-router';
import RegistroRostro from '../components/RegistroRostro.jsx';
import { useSesion } from '../sesion/SesionContext.jsx';

// Primer acceso: quien aún no tiene rostro registrado lo registra aquí antes
// de entrar (única excepción a la verificación facial obligatoria).
export default function RegistroFacial() {
  const { estado, usuario, recargar, cerrarSesion } = useSesion();
  const navigate = useNavigate();

  if (estado === 'listo') return <Navigate to="/" replace />;
  if (estado === 'requiere_verificacion') return <Navigate to="/verifica-rostro" replace />;
  if (estado !== 'requiere_inscripcion' && estado !== 'cargando') return <Navigate to="/login" replace />;

  return (
    <div className="auth-shell">
      <div className="auth-panel" style={{ width: 'min(100%, 540px)' }}>
        <span className="badge">Primer acceso</span>
        <h2>Registra tu rostro</h2>
        <p>
          {usuario?.nombre || usuario?.email}, SolvIA verifica tu rostro en cada acceso. Antes de continuar, registra tu rostro con tres capturas.
        </p>
        <RegistroRostro
          onRegistrado={async () => {
            await recargar();
            navigate('/', { replace: true });
          }}
        />
        <button type="button" className="btn" onClick={cerrarSesion}>
          Volver al acceso
        </button>
        <div className="notice" style={{ marginTop: 15 }}>
          No se conserva ninguna fotografía: solo una representación numérica cifrada de tu rostro.
        </div>
      </div>
    </div>
  );
}
