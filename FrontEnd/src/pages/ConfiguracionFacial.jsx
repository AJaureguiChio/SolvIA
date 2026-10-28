import { useState } from 'react';
import { Titulo } from '../components/comunes.jsx';
import RegistroRostro from '../components/RegistroRostro.jsx';

// Pantalla 3: estado del registro facial propio y nuevo registro.
// Como la verificación es obligatoria, no se puede desactivar; para entrar
// aquí el usuario ya verificó su rostro en esta sesión.
export default function ConfiguracionFacial() {
  const [registrando, setRegistrando] = useState(false);
  const [aviso, setAviso] = useState(null);

  return (
    <>
      <Titulo titulo="Mi verificación facial" subtitulo="Se solicita después de cada inicio de sesión." />
      {aviso && <div className="notice ok">{aviso}</div>}
      <div className="grid">
        <div className="card col7">
          <h3>Registrar rostro de nuevo</h3>
          {registrando ? (
            <RegistroRostro
              onRegistrado={() => {
                setRegistrando(false);
                setAviso('Rostro registrado de nuevo. Se usará a partir del próximo acceso.');
              }}
            />
          ) : (
            <>
              <p>Hazlo si cambió tu apariencia o si la verificación falla con frecuencia. El registro nuevo reemplaza al anterior.</p>
              <button
                type="button"
                className="btn primary"
                onClick={() => {
                  setAviso(null);
                  setRegistrando(true);
                }}
              >
                Registrar de nuevo
              </button>
            </>
          )}
        </div>
        <div className="card col5">
          <h3>Estado</h3>
          <span className="pill ok">Activa · verificada en esta sesión</span>
          <p>La verificación dura 30 minutos; después se vuelve a pedir.</p>
          <div className="notice">
            No se conserva ninguna fotografía. La verificación facial es obligatoria y no se puede desactivar; si pierdes el acceso, un
            administrador puede restablecer tu registro.
          </div>
        </div>
      </div>
    </>
  );
}
