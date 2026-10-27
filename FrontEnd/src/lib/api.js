import { obtenerJwt } from './auth.js';

const BASE = import.meta.env.VITE_API_URL ?? 'http://localhost:3000/api/v1';

// Error con el formato del contrato: { error: { code, message, details } }.
export class ApiError extends Error {
  constructor(status, code, message, details = {}) {
    super(message);
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

function query(params) {
  const limpio = Object.entries(params ?? {}).filter(([, v]) => v !== undefined && v !== null && v !== '');
  return limpio.length ? `?${new URLSearchParams(limpio)}` : '';
}

export async function api(ruta, { method = 'GET', params, body } = {}) {
  const token = await obtenerJwt();
  if (!token) throw new ApiError(401, 'UNAUTHENTICATED', 'La sesión terminó. Vuelve a iniciar sesión.');

  let respuesta;
  try {
    respuesta = await fetch(`${BASE}${ruta}${query(params)}`, {
      method,
      credentials: 'include',
      headers: {
        Authorization: `Bearer ${token}`,
        ...(body ? { 'Content-Type': 'application/json' } : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
    });
  } catch {
    throw new ApiError(0, 'NETWORK', 'No fue posible conectar con el servidor de SolvIA.');
  }

  const datos = await respuesta.json().catch(() => null);
  if (!respuesta.ok) {
    const e = datos?.error;
    throw new ApiError(respuesta.status, e?.code ?? 'UNKNOWN', e?.message ?? `Error ${respuesta.status}`, e?.details);
  }
  return datos;
}
