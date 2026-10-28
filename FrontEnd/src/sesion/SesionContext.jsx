import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { api, ApiError, cuandoSeExijaRostro } from '../lib/api.js';
import { authClient } from '../lib/auth.js';

const SesionContext = createContext(null);

// estado: cargando | anonimo | requiere_inscripcion | requiere_verificacion | listo | sin_perfil | inactivo | error
// La verificación facial es obligatoria: sin rostro registrado se pide registrarlo
// (primer acceso) y, si ya existe, verificarlo antes de usar SolvIA.
function estadoFacial(perfil) {
  if (!perfil.facial.inscrito) return 'requiere_inscripcion';
  if (!perfil.facial.verificado) return 'requiere_verificacion';
  return 'listo';
}

export function SesionProvider({ children }) {
  const [estado, setEstado] = useState('cargando');
  const [usuario, setUsuario] = useState(null);
  const [error, setError] = useState(null);

  const cargarPerfil = useCallback(async () => {
    setEstado('cargando');
    setError(null);
    const { data } = await authClient.getSession();
    if (!data?.session) {
      setUsuario(null);
      setEstado('anonimo');
      return;
    }
    try {
      const perfil = await api('/me');
      setUsuario(perfil);
      setEstado(estadoFacial(perfil));
    } catch (e) {
      setUsuario(null);
      if (e instanceof ApiError && e.code === 'PROFILE_REQUIRED') setEstado('sin_perfil');
      else if (e instanceof ApiError && e.code === 'PROFILE_INACTIVE') setEstado('inactivo');
      else {
        setError(e);
        setEstado('error');
      }
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- carga inicial de la sesión
    cargarPerfil();
    // Si la prueba facial caduca mientras se usa la app, se vuelve a pedir.
    cuandoSeExijaRostro(() => setEstado((actual) => (actual === 'listo' ? 'requiere_verificacion' : actual)));
  }, [cargarPerfil]);

  const iniciarSesion = useCallback(
    async (email, password) => {
      const { error: fallo } = await authClient.signIn.email({ email, password });
      if (fallo) return fallo;
      await cargarPerfil();
      return null;
    },
    [cargarPerfil],
  );

  const cerrarSesion = useCallback(async () => {
    // Borra la prueba facial antes de cerrar la sesión de Neon Auth.
    await api('/facial/verificacion', { method: 'DELETE' }).catch(() => {});
    await authClient.signOut();
    setUsuario(null);
    setEstado('anonimo');
  }, []);

  return (
    <SesionContext.Provider value={{ estado, usuario, error, iniciarSesion, cerrarSesion, recargar: cargarPerfil }}>
      {children}
    </SesionContext.Provider>
  );
}

// eslint-disable-next-line react-refresh/only-export-components
export function useSesion() {
  return useContext(SesionContext);
}
