import type { UsuarioActual } from '../auth/guards/neon-auth/neon-auth.guard.js';
import type { DatabaseService } from '../database/database.service.js';
import { ApiError } from './api-error.js';

// El administrador ve toda la cartera (null = sin filtro); el gestor solo
// las cuentas que tiene asignadas actualmente.
export function filtroGestor(usuario: UsuarioActual): string | null {
  return usuario.rol === 'gestor' ? usuario.id : null;
}

// Comprueba que la cuenta existe y es visible para el usuario. Una cuenta
// ajena responde 404 para no confirmar su existencia.
export async function exigirCuentaVisible(
  database: DatabaseService,
  usuario: UsuarioActual,
  cuentaId: string,
): Promise<{ responsableId: string | null }> {
  const { rows } = await database.query(
    `SELECT responsable_id::text AS "responsableId"
       FROM public.cuentas
      WHERE id = $1::bigint
        AND ($2::uuid IS NULL OR responsable_id = $2::uuid)`,
    [cuentaId, filtroGestor(usuario)],
  );
  if (!rows[0]) throw ApiError.noEncontrado('Cuenta');
  return rows[0] as { responsableId: string | null };
}
