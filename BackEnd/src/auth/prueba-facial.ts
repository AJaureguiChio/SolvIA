import type { CookieOptions, Request } from 'express';
import { jwtVerify, SignJWT } from 'jose';

// Prueba temporal de verificación facial: JWT HS256 en la cookie httpOnly
// solvia_face, ligado al ID de Neon Auth. La firma la clave FACE_JWT_SECRET,
// que solo conoce el backend.
export const COOKIE_FACIAL = 'solvia_face';
export const VIGENCIA_FACIAL_SEGUNDOS = 30 * 60;
const EMISOR = 'solvia-api';
const AUDIENCIA = 'solvia-face';

const clave = (secreto: string) => new TextEncoder().encode(secreto);

export function firmarPruebaFacial(usuarioId: string, secreto: string) {
  return new SignJWT({})
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(usuarioId)
    .setIssuer(EMISOR)
    .setAudience(AUDIENCIA)
    .setIssuedAt()
    .setExpirationTime(`${VIGENCIA_FACIAL_SEGUNDOS}s`)
    .sign(clave(secreto));
}

// true solo si la cookie existe, es válida, no ha caducado y es del usuario.
export async function pruebaFacialVigente(
  request: Request,
  usuarioId: string,
  secreto: string,
) {
  const token = leerCookie(request, COOKIE_FACIAL);
  if (!token) return false;
  try {
    const { payload } = await jwtVerify(token, clave(secreto), {
      algorithms: ['HS256'],
      issuer: EMISOR,
      audience: AUDIENCIA,
    });
    return payload.sub === usuarioId;
  } catch {
    return false;
  }
}

export function opcionesCookieFacial(seguro: boolean): CookieOptions {
  return {
    httpOnly: true,
    // Frontend y API comparten sitio en desarrollo (localhost); con dominios
    // distintos en producción hace falta SameSite=None y Secure.
    sameSite: seguro ? 'none' : 'lax',
    secure: seguro,
    path: '/api/v1',
    maxAge: VIGENCIA_FACIAL_SEGUNDOS * 1000,
  };
}

// Sin cookie-parser: basta con leer una cookie del header.
function leerCookie(request: Request, nombre: string) {
  for (const parte of (request.headers.cookie ?? '').split(';')) {
    const [clave, ...valor] = parte.trim().split('=');
    if (clave === nombre) return decodeURIComponent(valor.join('='));
  }
  return null;
}
