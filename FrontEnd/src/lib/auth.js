import { createAuthClient } from '@neondatabase/auth';

// Cliente de Neon Auth (Better Auth). La sesión vive en una cookie del dominio de Neon;
// el JWT para la API llega en el header set-auth-jwt y el SDK lo guarda en session.token.
export const authClient = createAuthClient(import.meta.env.VITE_NEON_AUTH_URL);

export async function obtenerJwt() {
  const { data } = await authClient.getSession();
  return data?.session?.token ?? null;
}
