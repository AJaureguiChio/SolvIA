import { useRef, useEffect, useState } from 'react';

/**
 * Componente que renderiza el stream de la cámara web,
 * la guía ovalada de encuadre según SolvIA_wireframes.html
 * y captura el fotograma en Base64 JPEG.
 */
export default function CameraCapture({ onCapture, label = "Capturar rostro", disabled = false }) {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const [streamActive, setStreamActive] = useState(false);
  const [cameraError, setCameraError] = useState(null);
  const [flash, setFlash] = useState(false);

  useEffect(() => {
    let activeStream = null;

    async function startCamera() {
      setCameraError(null);
      try {
        if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
          throw new Error("Tu navegador no soporta acceso a la cámara o requiere HTTPS / localhost.");
        }

        const mediaStream = await navigator.mediaDevices.getUserMedia({
          video: {
            width: { ideal: 640 },
            height: { ideal: 480 },
            facingMode: 'user'
          },
          audio: false
        });

        activeStream = mediaStream;
        if (videoRef.current) {
          videoRef.current.srcObject = mediaStream;
          videoRef.current.onloadedmetadata = () => {
            setStreamActive(true);
          };
        }
      } catch (err) {
        console.error("Error al acceder a la cámara:", err);
        setCameraError(
          err.name === 'NotAllowedError'
            ? "Permiso denegado para usar la cámara. Por favor autoriza el acceso en tu navegador."
            : `No se pudo iniciar la cámara: ${err.message}`
        );
      }
    }

    startCamera();

    return () => {
      if (activeStream) {
        activeStream.getTracks().forEach(track => track.stop());
      }
    };
  }, []);

  const handleCapture = () => {
    if (!videoRef.current || !canvasRef.current) return;
    const video = videoRef.current;
    const canvas = canvasRef.current;

    const width = video.videoWidth || 640;
    const height = video.videoHeight || 480;

    canvas.width = width;
    canvas.height = height;

    const ctx = canvas.getContext('2d');
    // Invertir horizontalmente para contrarrestar el modo espejo y guardar la orientación natural
    ctx.translate(width, 0);
    ctx.scale(-1, 1);
    ctx.drawImage(video, 0, 0, width, height);

    // Flash visual de feedback
    setFlash(true);
    setTimeout(() => setFlash(false), 300);

    const base64Data = canvas.toDataURL('image/jpeg', 0.92);
    if (onCapture) {
      onCapture(base64Data);
    }
  };

  return (
    <div className="camera-box">
      <div className="camera-screen">
        {cameraError ? (
          <div style={{ padding: 20, textAlign: 'center', color: '#ffb3b3', fontSize: 12 }}>
            <p><strong>Cámara no disponible</strong></p>
            <p>{cameraError}</p>
          </div>
        ) : (
          <>
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              className="camera-video"
            />
            <div className="camera-overlay">
              <div className="face-oval"></div>
              <span className="camera-instruction">Sitúa tu rostro dentro de la guía</span>
            </div>
            {flash && <div className="flash-effect" />}
            <canvas ref={canvasRef} style={{ display: 'none' }} />
          </>
        )}
      </div>

      <div style={{ marginTop: 10 }}>
        <button
          type="button"
          id="btn-camera-capture"
          className="btn primary full"
          onClick={handleCapture}
          disabled={disabled || !streamActive || !!cameraError}
        >
          📷 {label}
        </button>
      </div>
    </div>
  );
}
