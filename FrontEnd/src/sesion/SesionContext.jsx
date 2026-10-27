import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { api, ApiError } from '../lib/api.js';
import { authClient } from '../lib/auth.js';

const SesionContext = createContext(null);

// estado: cargando | anonimo | listo | sin_perfil | inactivo | error
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
      setUsuario(await api('/me'));
      setEstado('listo');
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
