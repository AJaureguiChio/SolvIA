/**
 * Panel principal (admin-home o manager-home) según SolvIA_wireframes.html.
 * Roles: 'administrador' y 'gestor'.
 */
export default function DashboardView({ user, onNavigateToFaceSettings, onLogout }) {
  const isAdmin = user.role === 'administrador';

  return (
    <div>
      {/* Header institucional según wireframes */}
      <div className="apphead">
        <div className="logo">SolvIA</div>
        <div className="appnav">
          <button type="button" className="active">Panel</button>
          <button type="button">Deudores</button>
          <button type="button">Cuentas</button>
          <button type="button">Reportes</button>
          <button
            type="button"
            onClick={onNavigateToFaceSettings}
            style={{ color: '#2b5879', fontWeight: 600 }}
          >
            👤 Mi verificación facial
          </button>
        </div>
        <div className="right">
          <span>{isAdmin ? 'Administrador' : 'Gestor'}: <strong>{user.name}</strong></span>
          <span className="avatar">{user.name.charAt(0)}</span>
          <button
            type="button"
            className="btn"
            style={{ padding: '4px 8px', fontSize: 11 }}
            onClick={onLogout}
          >
            Cerrar sesión
          </button>
        </div>
      </div>

      <div className="page">
        {/* Callout de seguridad facial */}
        <div className="card" style={{ marginBottom: 20, background: '#f5f8fa', borderColor: '#a9bcc8' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
            <div>
              <strong style={{ fontSize: 13, color: '#273844' }}>Estado de tu seguridad biométrica: </strong>
              {user.hasBiometrics ? (
                <span className="pill success">● Verificación facial activada</span>
              ) : (
                <span className="pill warning">○ Verificación facial pendiente</span>
              )}
              <p style={{ margin: '4px 0 0', fontSize: 11, color: '#566975' }}>
                {user.hasBiometrics
                  ? 'Tu rostro está registrado en el microservicio. Se te solicitará como paso 2 en el próximo inicio de sesión.'
                  : 'Aún no registras tu rostro. Ve a configuración facial para tomar tus fotos y enrolarte.'}
              </p>
            </div>
            <button
              type="button"
              className="btn primary"
              onClick={onNavigateToFaceSettings}
            >
              {user.hasBiometrics ? 'Revisar / Actualizar rostro' : 'Configurar mi rostro ahora'}
            </button>
          </div>
        </div>

        {/* Título del Panel */}
        <div className="page-title">
          <div>
            <h2>{isAdmin ? 'Panel del administrador' : 'Mi panel de gestor'}</h2>
            <p>{isAdmin ? 'Indicadores globales de la cartera de cuentas.' : 'Solo cuentas asignadas al gestor.'}</p>
          </div>
          <span className="badge">
            {isAdmin ? 'Ámbito Global' : 'Ámbito Asignado'}
          </span>
        </div>

        {/* Estadísticas según el rol */}
        {isAdmin ? (
          <div className="grid">
            <div className="card stat col3">
              <small>Cuentas activas</small>
              <strong>128</strong>
              <em>Todas las asignaciones</em>
            </div>
            <div className="card stat col3">
              <small>Al corriente</small>
              <strong>74 %</strong>
              <em>Según el plan pactado</em>
            </div>
            <div className="card stat col3">
              <small>Atrasadas</small>
              <strong>21</strong>
              <em>Cuotas vencidas</em>
            </div>
            <div className="card stat col3">
              <small>Por asignar</small>
              <strong>8</strong>
              <em>Requieren un gestor</em>
            </div>

            <div className="card col7">
              <h3>Tendencia de pagos</h3>
              <div style={{ height: 160, background: '#f5f7f8', border: '1px dashed var(--line)', borderRadius: 4, display: 'grid', placeItems: 'center', color: 'var(--muted)', fontSize: 12 }}>
                Gráfica de importes recuperados por periodo
              </div>
            </div>

            <div className="card col5">
              <h3>Estado de la cartera</h3>
              <div style={{ height: 160, background: '#f5f7f8', border: '1px dashed var(--line)', borderRadius: 4, display: 'grid', placeItems: 'center', color: 'var(--muted)', fontSize: 12 }}>
                Distribución de cumplimiento (74% al corriente)
              </div>
            </div>
          </div>
        ) : (
          <div className="grid">
            <div className="card stat col4">
              <small>Cuentas asignadas</small>
              <strong>16</strong>
              <em>Cuentas bajo mi gestión</em>
            </div>
            <div className="card stat col4">
              <small>Al corriente</small>
              <strong>12</strong>
              <em>Cumplimiento regular</em>
            </div>
            <div className="card stat col4">
              <small>Atrasadas</small>
              <strong>4</strong>
              <em>Requieren seguimiento</em>
            </div>

            <div className="card col12">
              <h3>Cuentas que necesitan atención prioritaria</h3>
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12, marginTop: 8 }}>
                  <thead>
                    <tr style={{ background: '#e8edf0', textAlign: 'left' }}>
                      <th style={{ padding: 8 }}>Cuenta</th>
                      <th style={{ padding: 8 }}>Deudor</th>
                      <th style={{ padding: 8 }}>Vencimiento</th>
                      <th style={{ padding: 8 }}>Situación</th>
                      <th style={{ padding: 8 }}>Saldo</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr style={{ borderTop: '1px solid #d7dfe3' }}>
                      <td style={{ padding: 8 }}>CTA-104</td>
                      <td style={{ padding: 8 }}>Deudor 104</td>
                      <td style={{ padding: 8 }}>15 oct 2026</td>
                      <td style={{ padding: 8 }}><span className="pill warning">Atrasado</span></td>
                      <td style={{ padding: 8 }}>MXN 3,900.00</td>
                    </tr>
                    <tr style={{ borderTop: '1px solid #d7dfe3', background: '#f9fafb' }}>
                      <td style={{ padding: 8 }}>CTA-117</td>
                      <td style={{ padding: 8 }}>Deudor 117</td>
                      <td style={{ padding: 8 }}>18 oct 2026</td>
                      <td style={{ padding: 8 }}><span className="pill success">Al corriente</span></td>
                      <td style={{ padding: 8 }}>MXN 1,150.00</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}
      </div>

      <div className="screen-footer">
        <span>SolvIA · Sistema Inteligente de Cobranza Extrajudicial</span>
        <span>Reconocimiento facial biométrico con FaceNet (512-dim)</span>
      </div>
    </div>
  );
}
