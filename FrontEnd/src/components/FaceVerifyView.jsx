import { useState } from 'react';
import CameraCapture from './CameraCapture';
import { verifyFace } from '../services/aiService';

/**
 * Pantalla 'face': Verifica tu rostro.
 * Cumple con SolvIA_wireframes.html.
 * Realiza la verificación biométrica 1:1 contra la plantilla del usuario.
 */
export default function FaceVerifyView({ user, onVerificationSuccess, onCancel }) {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null); // { success: boolean, message: string, score?: number }

  const handleCaptureForVerification = async (base64Image) => {
    setLoading(true);
    setResult(null);

    try {
      const response = await verifyFace(user.id, base64Image);
      if (response.match) {
        setResult({
          success: true,
          message: `Identidad verificada exitosamente (Similitud: ${(response.score * 100).toFixed(1)}%). Redirigiendo a tu panel...`,
          score: response.score
        });

        setTimeout(() => {
          onVerificationSuccess();
        }, 1200);
      } else {
        setResult({
          success: false,
          message: `El rostro no coincide con la plantilla registrada (Similitud: ${(response.score * 100).toFixed(1)}% < umbral requerido).`,
          score: response.score
        });
      }
    } catch (err) {
      setResult({
        success: false,
        message: err.message
      });
    } finally {
      setLoading(false);
    }
  };

  // Simulación de respaldo conforme al wireframe
  const handleSimulateSuccess = () => {
    setResult({
      success: true,
      message: "Verificación simulada con éxito. Redirigiendo...",
      score: 0.95
    });
    setTimeout(() => {
      onVerificationSuccess();
    }, 800);
  };

  return (
    <div className="auth-shell">
      <div className="auth-panel wide">
        <span className="badge">Paso adicional opcional</span>
        <h2>Verifica tu rostro</h2>
        <p>
          Usuario: <strong>{user.name}</strong> ({user.role === 'administrador' ? 'Administrador' : 'Gestor'}).
          <br />
          Permite el uso de la cámara y sitúa tu rostro dentro de la guía.
        </p>

        {result && (
          <div className={`notice ${result.success ? 'success' : 'error'}`}>
            <strong>{result.success ? 'Acceso concedido:' : 'Aviso biométrico:'}</strong> {result.message}
          </div>
        )}

        <CameraCapture
          onCapture={handleCaptureForVerification}
          label={loading ? "Comparando con FaceNet..." : "Comprobar mi rostro e iniciar sesión"}
          disabled={loading || (result && result.success)}
        />

        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 12 }}>
          <button
            type="button"
            className="btn subtle full"
            onClick={handleSimulateSuccess}
            disabled={loading}
          >
            Simular verificación satisfactoria
          </button>

          <button
            type="button"
            className="btn full"
            onClick={onCancel}
            disabled={loading}
          >
            Volver al acceso
          </button>
        </div>

        <p className="muted" style={{ marginTop: 16 }}>
          Si la cámara falla o no tienes buena iluminación, contacta al administrador del sistema para restablecer tu biometría.
        </p>
      </div>
    </div>
  );
}
