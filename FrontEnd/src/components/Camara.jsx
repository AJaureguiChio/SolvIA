import { useEffect, useImperativeHandle, useRef, useState } from 'react';

const ERRORES_CAMARA = {
  NotAllowedError: 'Permite el acceso a la cámara en el navegador para continuar.',
  NotFoundError: 'No se encontró una cámara en este equipo.',
  NotReadableError: 'La cámara está en uso por otra aplicación.',
};

// Unas 10 evaluaciones por segundo bastan para guiar al usuario.
const INTERVALO_MS = 100;

// Vista previa de la cámara frontal con detección de rostros en tiempo real
// (BlazeFace, MediaPipe). El padre llama a `capturar()` con una ref y recibe un
// JPEG; la imagen no se guarda en el navegador. `onEstado(true)` solo cuando
// hay exactamente un rostro de tamaño suficiente, o si el detector no pudo
// cargarse (entonces valida únicamente el microservicio).
export default function Camara({ onEstado, ref }) {
  const video = useRef(null);
  const [error, setError] = useState(() =>
    navigator.mediaDevices ? null : 'Este navegador no permite usar la cámara (se requiere HTTPS o localhost).',
  );
  const [lista, setLista] = useState(false);
  const [deteccion, setDeteccion] = useState({ estado: 'cargando', cajas: [] });
  const [mensajes, setMensajes] = useState(null);

  useEffect(() => {
    if (!navigator.mediaDevices) return;
    let flujo;
    let vigente = true;
    navigator.mediaDevices
      .getUserMedia({ video: { facingMode: 'user', width: { ideal: 640 }, height: { ideal: 480 } }, audio: false })
      .then((stream) => {
        if (!vigente) return stream.getTracks().forEach((t) => t.stop());
        flujo = stream;
        video.current.srcObject = stream;
        return video.current.play();
      })
      .then(() => vigente && setLista(true))
      .catch((e) => vigente && setError(ERRORES_CAMARA[e?.name] ?? 'No fue posible abrir la cámara.'));
    return () => {
      vigente = false;
      flujo?.getTracks().forEach((t) => t.stop());
    };
  }, []);

  // Bucle de detección sobre el video mientras la cámara está abierta.
  useEffect(() => {
    if (!lista) return;
    let vigente = true;
    let cuadro = 0;
    let ultimo = 0;
    import('../lib/detectorRostro.js')
      .then(async ({ cargarDetector, evaluar, MENSAJES }) => {
        const detector = await cargarDetector();
        if (!vigente) return;
        setMensajes(MENSAJES);
        const paso = (ahora) => {
          if (!vigente) return;
          const v = video.current;
          if (v && v.readyState >= 2 && ahora - ultimo >= INTERVALO_MS) {
            ultimo = ahora;
            setDeteccion(evaluar(detector, v, ahora));
          }
          cuadro = requestAnimationFrame(paso);
        };
        cuadro = requestAnimationFrame(paso);
      })
      .catch(() => {
        if (!vigente) return;
        setMensajes(null);
        setDeteccion({ estado: 'no_disponible', cajas: [] });
      });
    return () => {
      vigente = false;
      cancelAnimationFrame(cuadro);
    };
  }, [lista]);

  const valida = deteccion.estado === 'listo' || deteccion.estado === 'no_disponible';
  useEffect(() => onEstado?.(lista && !error && valida), [lista, error, valida, onEstado]);

  useImperativeHandle(ref, () => ({
    capturar() {
      const v = video.current;
      const lienzo = document.createElement('canvas');
      lienzo.width = v.videoWidth;
      lienzo.height = v.videoHeight;
      lienzo.getContext('2d').drawImage(v, 0, 0);
      return new Promise((resolver) => lienzo.toBlob(resolver, 'image/jpeg', 0.92));
    },
  }));

  const aviso =
    deteccion.estado === 'no_disponible'
      ? 'La detección en el navegador no está disponible; el servidor validará la captura.'
      : (mensajes?.[deteccion.estado] ?? 'Cargando el detector de rostros…');

  return (
    <>
      <div className="camera">
        {error ? (
          <div role="alert">
            <div className="face" />
            {error}
          </div>
        ) : (
          <>
            <video ref={video} muted playsInline aria-label="Vista previa de la cámara" />
            {lista ? <div className="face guia" aria-hidden="true" /> : <span style={{ position: 'absolute' }}>Abriendo la cámara…</span>}
            {/* El video se muestra en espejo: los recuadros también. */}
            {deteccion.cajas.map((c, i) => (
              <div
                key={i}
                className={`caja-rostro ${deteccion.estado === 'listo' ? 'ok' : ''}`}
                aria-hidden="true"
                style={{
                  left: `${(1 - c.x - c.ancho) * 100}%`,
                  top: `${c.y * 100}%`,
                  width: `${c.ancho * 100}%`,
                  height: `${c.alto * 100}%`,
                }}
              />
            ))}
          </>
        )}
      </div>
      {lista && !error && (
        <p className={`deteccion ${deteccion.estado === 'listo' ? 'ok' : ''}`} role="status">
          {aviso}
        </p>
      )}
    </>
  );
}
