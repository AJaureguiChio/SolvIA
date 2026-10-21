import { useState } from 'react';

/**
 * Pantalla 'login': Iniciar sesión.
 * Cumple con SolvIA_wireframes.html.
 * Roles permitidos: únicamente 'administrador' y 'gestor' (Regla AGENTS.md).
 */
export default function LoginView({ onLoginAttempt, availableUsers }) {
  const [selectedEmail, setSelectedEmail] = useState(availableUsers[0]?.email || 'admin@solvia.edu');
  const [password, setPassword] = useState('password123');
  const [forceBiometrics, setForceBiometrics] = useState(true);

  const currentUser = availableUsers.find(u => u.email === selectedEmail) || availableUsers[0];

  const handleSubmit = (e) => {
    e.preventDefault();
    onLoginAttempt({
      ...currentUser,
      requireFace: forceBiometrics || currentUser.hasBiometrics
    });
  };

  return (
    <div className="auth-shell">
      <div className="auth-panel">
        <div className="logo" style={{ marginBottom: 10 }}>SolvIA</div>
        <h2>Iniciar sesión</h2>
        <p>Acceso para administradores y gestores autorizados.</p>

        <form onSubmit={handleSubmit}>
          <label className="field">
            Usuario / Correo electrónico
            <select
              className="input"
              value={selectedEmail}
              onChange={(e) => {
                const email = e.target.value;
                setSelectedEmail(email);
                const u = availableUsers.find(item => item.email === email);
                if (u) setForceBiometrics(u.hasBiometrics);
              }}
            >
              {availableUsers.map(u => (
                <option key={u.id} value={u.email}>
                  {u.name} — {u.email} ({u.role === 'administrador' ? 'Administrador' : 'Gestor'})
                </option>
              ))}
            </select>
          </label>

          <label className="field">
            Contraseña
            <input
              type="password"
              className="input"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              required
            />
          </label>

          <label className="checkline">
            <input
              id="demo-face"
              type="checkbox"
              checked={forceBiometrics}
              onChange={(e) => setForceBiometrics(e.target.checked)}
            />
            <span>Esta cuenta tiene activada la verificación facial (paso 2)</span>
          </label>

          <button
            type="submit"
            id="btn-login-submit"
            className="btn primary full"
            style={{ marginTop: 8 }}
          >
            Iniciar sesión
          </button>
        </form>

        <p style={{ textAlign: 'center', marginTop: 14 }}>
          <button
            type="button"
            className="link"
            onClick={() => alert("El proceso de recuperación se gestiona a través de la cuenta institucional.")}
          >
            ¿Olvidaste tu contraseña?
          </button>
        </p>

        <div className="notice" style={{ marginTop: 16 }}>
          Si habilitaste la verificación facial, se solicitará la cámara después de iniciar sesión para comprobar tu identidad.
        </div>
      </div>
    </div>
  );
}
