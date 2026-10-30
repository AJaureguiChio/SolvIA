import { FaceDetector } from '@mediapipe/tasks-vision';
import wasmLoaderPath from '@mediapipe/tasks-vision/vision_wasm_internal.js?url';
import wasmBinaryPath from '@mediapipe/tasks-vision/vision_wasm_internal.wasm?url';

// Detección de rostros en el navegador con MediaPipe Face Detector, que usa
// BlazeFace (short range): un detector ligero que corre en tiempo real sobre
// la cámara. Solo decide si la captura sirve; la identificación (embeddings y
// comparación) la hace el microservicio de Python.
// El modelo se sirve desde public/models para no depender de un CDN; el WASM
// lo empaqueta Vite y solo se descarga en las pantallas con cámara.
const MODELO = '/models/blaze_face_short_range.tflite';

// Mismo criterio que el microservicio (FACE_MIN_SIZE = 80 px), con margen:
// el rostro debe ocupar al menos este ancho en píxeles del video.
export const ANCHO_MINIMO = 110;

let promesa = null;

// Un solo detector para toda la sesión (cargar el WASM tarda unos segundos).
export function cargarDetector() {
  promesa ??= FaceDetector.createFromOptions(
    { wasmLoaderPath, wasmBinaryPath },
    {
      baseOptions: { modelAssetPath: MODELO, delegate: 'CPU' },
      runningMode: 'VIDEO',
      minDetectionConfidence: 0.6,
    },
  ).catch((error) => {
    promesa = null;
    throw error;
  });
  return promesa;
}

// Evalúa un fotograma: estado de la captura y recuadros normalizados (0–1).
export function evaluar(detector, video, instante) {
  const { detections } = detector.detectForVideo(video, instante);
  const cajas = detections
    .map((d) => d.boundingBox)
    .filter(Boolean)
    .map((c) => ({
      x: c.originX / video.videoWidth,
      y: c.originY / video.videoHeight,
      ancho: c.width / video.videoWidth,
      alto: c.height / video.videoHeight,
      anchoPx: c.width,
    }));

  let estado = 'listo';
  if (cajas.length === 0) estado = 'sin_rostro';
  else if (cajas.length > 1) estado = 'varios';
  else if (cajas[0].anchoPx < ANCHO_MINIMO) estado = 'lejos';
  return { estado, cajas };
}

export const MENSAJES = {
  cargando: 'Cargando el detector de rostros…',
  sin_rostro: 'No se detecta un rostro: colócate frente a la cámara.',
  varios: 'Hay más de un rostro: debe aparecer solo una persona.',
  lejos: 'Acércate un poco a la cámara.',
  listo: 'Rostro detectado.',
  no_disponible: 'La detección en el navegador no está disponible; el servidor validará la captura.',
};
