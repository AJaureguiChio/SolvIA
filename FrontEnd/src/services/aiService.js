/**
 * Servicio cliente para interactuar con el microservicio de IA (FaceNet / FastAPI).
 * Soporta tanto el proxy de Vite (/ai) como URL directa si es necesario.
 */

const API_BASE = '/ai';
const FALLBACK_DIRECT = 'http://localhost:8000';

async function fetchWithFallback(endpoint, options) {
  try {
    const res = await fetch(`${API_BASE}${endpoint}`, options);
    return res;
  } catch (err) {
    // Si el proxy falla, intentar directo al puerto 8000
    try {
      const directRes = await fetch(`${FALLBACK_DIRECT}${endpoint}`, options);
      return directRes;
    } catch {
      throw new Error(
        'No se pudo conectar con el microservicio de IA en el puerto 8000. ' +
        'Asegúrate de ejecutar "uvicorn app.main:app --port 8000" en services/ai-service.'
      );
    }
  }
}

/**
 * Comprueba el estado del servicio de IA.
 */
export async function checkAiHealth() {
  try {
    const res = await fetchWithFallback('/health', { method: 'GET' });
    if (!res.ok) return { online: false, error: `HTTP ${res.status}` };
    const data = await res.json();
    return { online: true, ...data };
  } catch (err) {
    return { online: false, error: err.message };
  }
}

/**
 * Registra imágenes de un usuario para extraer embeddings biométricos (Enrolamiento).
 * @param {string} userId - Identificador de usuario.
 * @param {string[]} images - Lista de imágenes en Base64 / data URL.
 */
export async function enrollFace(userId, images) {
  const res = await fetchWithFallback('/enroll', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ user_id: userId, images }),
  });

  const data = await res.json().catch(() => ({}));

  if (!res.ok) {
    const detail = data.detail || 'Error al enrolar el rostro.';
    throw new Error(detail);
  }

  return data; // { user_id, accepted, rejected, reasons }
}

/**
 * Verifica 1:1 el rostro capturado contra la galería del usuario.
 * @param {string} userId - Identificador del usuario que intenta acceder.
 * @param {string} image - Fotograma capturado en Base64 / data URL.
 */
export async function verifyFace(userId, image) {
  const res = await fetchWithFallback('/verify', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ user_id: userId, image }),
  });

  const data = await res.json().catch(() => ({}));

  if (!res.ok) {
    const detail = data.detail || 'Fallo en la verificación biométrica.';
    throw new Error(detail);
  }

  return data; // { match: boolean, score: number }
}
