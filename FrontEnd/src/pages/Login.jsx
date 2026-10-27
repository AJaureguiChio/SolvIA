import { useState } from 'react';
import { Navigate, useLocation } from 'react-router';
import { useSesion } from '../sesion/SesionContext.jsx';

const MENSAJES = {
  INVALID_EMAIL_OR_PASSWORD: 'Correo o contraseña incorrectos.',
  MISSING_OR_NULL_ORIGIN: 'La base de datos rechazó el origen de la aplicación.',
  INVALID_ORIGIN: 'Este dominio no está entre los dominios de confianza de la base de datos.',
};

export default function Login() {
  const { estado, iniciarSesion, cerrarSesion } = useSesion();
  const location = useLocation();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState(null);

  if (estado === 'listo') return <Navigate to={location.state?.desde ?? '/'} replace />;

  async function enviar(ev) {
    ev.preventDefault();
    setEnviando(true);
    setError(null);
    try {
      const fallo = await iniciarSesion(email.trim(), password);
      if (fallo) setError(MENSAJES[fallo.code] ?? fallo.message ?? 'No fue posible iniciar sesión.');
    } catch (e) {
      setError(MENSAJES[e.code] ?? e.message ?? 'No fue posible iniciar sesión.');
    } finally {
      setEnviando(false);
    }
  }

  const sinAcceso = estado === 'sin_perfil' || estado === 'inactivo';

  return (
    <div className="auth-shell">
      <div className="auth-panel">
        <div className="logo" style={{ display: 'inline-block' }}>
          SolvIA
        </div>
        <h2>Iniciar sesión</h2>
        <p>Acceso para administradores y gestores autorizados.</p>

        {sinAcceso ? (
          <>
            <div className="notice error" role="alert">
              {estado === 'sin_perfil'
                ? 'Tu cuenta existe en la base de datos, pero aún no tiene un perfil en SolvIA. Pide a un administrador que te asigne un rol.'
                : 'Tu usuario está desactivado. Contacta a un administrador.'}
            </div>
            <button type="button" className="btn" onClick={cerrarSesion}>
              Usar otra cuenta
            </button>
          </>
        ) : (
          <form onSubmit={enviar}>
            {error && (
              <div className="notice error" role="alert">
                {error}
              </div>
            )}
            {estado === 'error' && (
              <div className="notice error" role="alert">
                No fue posible conectar con el servidor de SolvIA.
              </div>
            )}
            <label className="field">
              Correo electrónico
              <input className="input" type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
            </label>
            <label className="field">
              Contraseña
              <input
                className="input"
                type="password"
                autoComplete="current-password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </label>
            <button type="submit" className="btn primary" disabled={enviando}>
              {enviando ? 'Entrando…' : 'Iniciar sesión'}
            </button>
          </form>
        )}
        <div className="notice" style={{ marginTop: 15 }}>
          Si habilitaste la verificación facial, se solicitará después de iniciar sesión.
        </div>
      </div>
    </div>
  );
}
