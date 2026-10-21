import { useState, useEffect } from 'react';
import LoginView from './components/LoginView';
import FaceVerifyView from './components/FaceVerifyView';
import FaceSettings from './components/FaceSettings';
import DashboardView from './components/DashboardView';
import { checkAiHealth } from './services/aiService';

// Usuarios de demostración (Únicamente roles 'administrador' y 'gestor' según AGENTS.md)
const INITIAL_USERS = [
  {
    id: 'user-admin-01',
    name: 'Carlos Administrador',
    email: 'admin@solvia.edu',
    role: 'administrador',
    hasBiometrics: false,
  },
  {
    id: 'user-gestor-01',
    name: 'Ana Gestora',
    email: 'gestor@solvia.edu',
    role: 'gestor',
    hasBiometrics: false,
  },
];

export default function App() {
  const [users, setUsers] = useState(() => {
    const saved = localStorage.getItem('solvia_demo_users');
    return saved ? JSON.parse(saved) : INITIAL_USERS;
  });

  const [currentView, setCurrentView] = useState('login'); // 'login' | 'face' | 'face-settings' | 'dashboard'
  const [activeUser, setActiveUser] = useState(users[0]);
  const [aiStatus, setAiStatus] = useState({ online: false, checking: true });

  // Guardar estado de usuarios en localStorage para persistir biometrías registradas
  useEffect(() => {
    localStorage.setItem('solvia_demo_users', JSON.stringify(users));
  }, [users]);

  // Verificar conectividad con el microservicio de IA en Python
  useEffect(() => {
    async function pingAiService() {
      const status = await checkAiHealth();
      setAiStatus({ online: status.online, checking: false, model: status.model });
    }
    pingAiService();
    const interval = setInterval(pingAiService, 8000);
    return () => clearInterval(interval);
  }, []);

  // Manejar intento de login
  const handleLoginAttempt = (userAttempt) => {
    const freshUser = users.find(u => u.id === userAttempt.id) || userAttempt;
    setActiveUser(freshUser);

    if (userAttempt.requireFace) {
      setCurrentView('face');
    } else {
      setCurrentView('dashboard');
    }
  };

  // Verificación facial exitosa
  const handleVerificationSuccess = () => {
    setCurrentView('dashboard');
  };

  // Actualizar estado biométrico tras enrolamiento o revocación
  const handleBiometricStatusChange = (userId, hasBiometrics) => {
    setUsers(prevUsers =>
      prevUsers.map(u => (u.id === userId ? { ...u, hasBiometrics } : u))
    );
    if (activeUser.id === userId) {
      setActiveUser(prev => ({ ...prev, hasBiometrics }));
    }
  };

  return (
    <div className="app-container">
      {/* Barra de control y navegación superior (Fiel a SolvIA_wireframes.html) */}
      <header className="toolbar">
        <strong>
          <span>SolvIA</span>
          <span style={{ fontWeight: 400, opacity: 0.8 }}>· Reconocimiento Facial</span>
        </strong>

        {/* Indicador de salud del microservicio Python */}
        <span
          className={`status-tag ${aiStatus.online ? 'status-online' : 'status-offline'}`}
          title={aiStatus.online ? `Conectado a ${aiStatus.model}` : "Inicia: uvicorn app.main:app --port 8000 en services/ai-service"}
        >
          {aiStatus.online ? '● Microservicio IA (FaceNet) Activo' : '○ Microservicio IA Desconectado (Puerto 8000)'}
        </span>

        {/* Selector rápido de vista para pruebas */}
        <label>
          Vista:
          <select
            value={currentView}
            onChange={(e) => setCurrentView(e.target.value)}
          >
            <option value="login">1. Inicio de sesión (Login)</option>
            <option value="face">2. Verificación facial (Segundo paso)</option>
            <option value="face-settings">3. Mi verificación facial (Registro)</option>
            <option value="dashboard">4. Panel ({activeUser.role})</option>
          </select>
        </label>

        {/* Selector de rol (Regla AGENTS.md: solo administrador o gestor) */}
        <label>
          Rol activo:
          <select
            value={activeUser.role}
            onChange={(e) => {
              const newRole = e.target.value;
              const match = users.find(u => u.role === newRole);
              if (match) setActiveUser(match);
            }}
          >
            <option value="administrador">Administrador</option>
            <option value="gestor">Gestor</option>
          </select>
        </label>

        {currentView !== 'login' && (
          <button
            type="button"
            onClick={() => setCurrentView('login')}
          >
            Salir al Login
          </button>
        )}
      </header>

      {/* Renderizado de vistas */}
      <main style={{ flex: 1 }}>
        {currentView === 'login' && (
          <LoginView
            onLoginAttempt={handleLoginAttempt}
            availableUsers={users}
          />
        )}

        {currentView === 'face' && (
          <FaceVerifyView
            user={activeUser}
            onVerificationSuccess={handleVerificationSuccess}
            onCancel={() => setCurrentView('login')}
          />
        )}

        {currentView === 'face-settings' && (
          <div>
            <div className="apphead">
              <div className="logo">SolvIA</div>
              <div className="appnav">
                <button type="button" onClick={() => setCurrentView('dashboard')}>
                  ← Volver al Panel
                </button>
                <button type="button" className="active">
                  Mi verificación facial
                </button>
              </div>
              <div className="right">
                <span>{activeUser.role === 'administrador' ? 'Administrador' : 'Gestor'}: <strong>{activeUser.name}</strong></span>
                <span className="avatar">{activeUser.name.charAt(0)}</span>
              </div>
            </div>

            <FaceSettings
              currentUser={activeUser}
              onBiometricStatusChange={handleBiometricStatusChange}
            />
          </div>
        )}

        {currentView === 'dashboard' && (
          <DashboardView
            user={activeUser}
            onNavigateToFaceSettings={() => setCurrentView('face-settings')}
            onLogout={() => setCurrentView('login')}
          />
        )}
      </main>
    </div>
  );
}
