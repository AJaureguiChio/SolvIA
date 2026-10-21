import { useState } from 'react';
import CameraCapture from './CameraCapture';
import { enrollFace } from '../services/aiService';

/**
 * Pantalla 'face-settings': Mi verificación facial.
 * Cumple con SolvIA_wireframes.html para el registro (enrolamiento)
 * y revocación de la biometría del usuario actual.
 */
export default function FaceSettings({ currentUser, onBiometricStatusChange }) {
  const [capturedImages, setCapturedImages] = useState([]);
  const [loading, setLoading] = useState(false);
  const [feedback, setFeedback] = useState(null); // { type: 'success' | 'error', message: string, reasons?: string[] }

  const maxPhotos = 4; // Recomendado por el microservicio (embeddings_per_user = 4)

  const handleCapturePhoto = (base64) => {
    if (capturedImages.length >= maxPhotos) {
      setFeedback({
        type: 'error',
        message: `Ya tienes el máximo de ${maxPhotos} fotos. Elimina alguna si deseas cambiarla.`
      });
      return;
    }
    setCapturedImages((prev) => [...prev, base64]);
    setFeedback(null);
  };

  const removePhoto = (index) => {
    setCapturedImages((prev) => prev.filter((_, i) => i !== index));
  };

  const handleEnroll = async () => {
    if (capturedImages.length === 0) {
      setFeedback({
        type: 'error',
        message: 'Captura al menos una fotografía de tu rostro antes de guardar.'
      });
      return;
    }

    setLoading(true);
    setFeedback(null);

    try {
      const result = await enrollFace(currentUser.id, capturedImages);
      setFeedback({
        type: 'success',
        message: `¡Registro biométrico completado! Se aceptaron ${result.accepted} fotos para tu perfil.`
      });

      if (onBiometricStatusChange) {
        onBiometricStatusChange(currentUser.id, true);
      }
    } catch (err) {
      setFeedback({
        type: 'error',
        message: err.message
      });
    } finally {
      setLoading(false);
    }
  };

  const handleRevoke = () => {
    if (window.confirm("¿Seguro que deseas desactivar tu verificación facial?")) {
      setCapturedImages([]);
      if (onBiometricStatusChange) {
        onBiometricStatusChange(currentUser.id, false);
      }
      setFeedback({
        type: 'success',
        message: 'Verificación facial desactivada correctamente.'
      });
    }
  };

  return (
    <div className="page">
      <div className="page-title">
        <div>
          <h2>Mi verificación facial</h2>
          <p>Opción personal de seguridad; requiere sesión activa.</p>
        </div>
        <span className="badge">
          Rol: {currentUser.role === 'administrador' ? 'Administrador' : 'Gestor'}
        </span>
      </div>

      {feedback && (
        <div className={`notice ${feedback.type === 'error' ? 'error' : 'success'}`}>
          <strong>{feedback.type === 'error' ? 'Aviso de captura:' : 'Operación exitosa:'}</strong> {feedback.message}
        </div>
      )}

      <div className="grid">
        {/* Columna izquierda: Cámara y capturas */}
        <div className="card col7">
          <h3>Registrar rostro</h3>
          <p>
            Sitúa tu rostro centrado dentro del marco guía con buena iluminación.
            Se recomiendan de 1 a {maxPhotos} tomas para mayor precisión del modelo FaceNet.
          </p>

          <CameraCapture
            onCapture={handleCapturePhoto}
            label={capturedImages.length < maxPhotos ? `Tomar captura (${capturedImages.length}/${maxPhotos})` : "Límite de capturas alcanzado"}
            disabled={capturedImages.length >= maxPhotos || loading}
          />

          <div style={{ marginTop: 12 }}>
            <strong style={{ fontSize: 12, color: 'var(--ink)' }}>
              Tomas preparadas ({capturedImages.length} de {maxPhotos}):
            </strong>
            <div className="captured-grid">
              {capturedImages.map((img, idx) => (
                <div key={idx} className="captured-thumb">
                  <img src={img} alt={`Captura ${idx + 1}`} />
                  <button type="button" onClick={() => removePhoto(idx)} title="Eliminar">×</button>
                </div>
              ))}
              {Array.from({ length: Math.max(0, maxPhotos - capturedImages.length) }).map((_, idx) => (
                <div key={`empty-${idx}`} className="captured-empty">
                  + Espacio libre
                </div>
              ))}
            </div>
          </div>

          <button
            type="button"
            id="btn-save-enrollment"
            className="btn primary full"
            onClick={handleEnroll}
            disabled={loading || capturedImages.length === 0}
          >
            {loading ? "Procesando embeddings biométricos..." : "Guardar plantilla facial en SolvIA"}
          </button>
        </div>

        {/* Columna derecha: Estado y Revocación */}
        <div className="card col5">
          <h3>Estado de la verificación</h3>
          <div style={{ margin: '10px 0 14px' }}>
            {currentUser.hasBiometrics ? (
              <span className="pill success">● Configurado y activo</span>
            ) : (
              <span className="pill warning">○ No configurado</span>
            )}
          </div>

          <p>
            {currentUser.hasBiometrics
              ? "Tu identidad biométrica está activa. Tras iniciar sesión con correo y contraseña, se solicitará la verificación de tu rostro."
              : "Cuando se active, la verificación facial se solicitará como segundo factor después de ingresar tus credenciales."}
          </p>

          <div className="notice">
            No se conservará una fotografía como credencial permanente en la base de datos; solo se almacenan los vectores matemáticos (embeddings) de 512 dimensiones extraídos por InceptionResnetV1.
          </div>

          {currentUser.hasBiometrics && (
            <button
              type="button"
              id="btn-revoke-face"
              className="btn danger full"
              onClick={handleRevoke}
            >
              Desactivar verificación facial
            </button>
          )}

          <div style={{ marginTop: 24, borderTop: '1px solid var(--line)', paddingTop: 14 }}>
            <h4 style={{ margin: '0 0 8px', fontSize: 12 }}>Recomendaciones para el registro:</h4>
            <ul style={{ margin: 0, paddingLeft: 18, fontSize: 11, color: 'var(--muted)', lineHeight: 1.6 }}>
              <li>Mantén una expresión neutral o ligera sonrisa.</li>
              <li>Evita contraluces fuertes o sombras densas sobre el rostro.</li>
              <li>Retira accesorios que cubran ojos o frente (gorras o gafas oscuras).</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
