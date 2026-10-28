import { useEffect, useImperativeHandle, useRef, useState } from 'react';

const ERRORES_CAMARA = {
  NotAllowedError: 'Permite el acceso a la cámara en el navegador para continuar.',
  NotFoundError: 'No se encontró una cámara en este equipo.',
  NotReadableError: 'La cámara está en uso por otra aplicación.',
};

// Vista previa de la cámara frontal. El padre llama a `capturar()` con una ref
// y recibe un JPEG; la imagen no se guarda en el navegador.
export default function Camara({ onEstado, ref }) {
  const video = useRef(null);
  const [error, setError] = useState(() =>
    navigator.mediaDevices ? null : 'Este navegador no permite usar la cámara (se requiere HTTPS o localhost).',
  );
  const [lista, setLista] = useState(false);

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

  useEffect(() => onEstado?.(lista && !error), [lista, error, onEstado]);

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

  return (
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
        </>
      )}
    </div>
  );
}
