import { useCallback, useEffect, useRef, useState } from 'react';

// Ejecuta `cargar` cuando cambian las dependencias y expone datos, error y recarga.
// Al recargar se conservan los datos previos para no parpadear.
export function useCarga(cargar, deps) {
  const [estado, setEstado] = useState({ cargando: true, datos: null, error: null });
  const [version, setVersion] = useState(0);
  const cargarRef = useRef(cargar);
  const clave = JSON.stringify(deps);

  useEffect(() => {
    cargarRef.current = cargar;
  });

  useEffect(() => {
    let vigente = true;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- marca el inicio de la carga
    setEstado((previo) => ({ ...previo, cargando: true, error: null }));
    cargarRef
      .current()
      .then((datos) => vigente && setEstado({ cargando: false, datos, error: null }))
      .catch((error) => vigente && setEstado({ cargando: false, datos: null, error }));
    return () => {
      vigente = false;
    };
  }, [clave, version]);

  const recargar = useCallback(() => setVersion((v) => v + 1), []);

  return { ...estado, recargar };
}
