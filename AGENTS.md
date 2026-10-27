# SolvIA

- Lee la documentación pertinente de `docs/` antes de modificar el módulo relacionado.
- La interfaz debe seguir `docs/SolvIA_wireframes.html`.
- Solo existen los roles administrador y gestor.
- La autenticación principal usa Neon Auth; el reconocimiento facial es una verificación adicional opcional.
- Trabaja y prueba los cambios de base de datos en la rama Neon `desarrollo`.
- No apliques cambios a `production` sin una instrucción explícita.
- No muestres ni incluyas en commits valores de `.env` o credenciales.
- Explica los cambios realizados y cómo los verificaste.

## Continuidad entre sesiones

- Al empezar, lee `PROGRESO.md` (sobre todo "Siguiente paso" y "Problemas conocidos") y `git log -5` para retomar donde se quedó.
- Al terminar una sesión, actualiza `PROGRESO.md` (hecho, verificación, pendientes y siguiente paso) antes del commit.
- En Neon pasa siempre la rama `desarrollo` de forma explícita: la rama por defecto del proyecto es `production`.
- Pide autorización antes de escribir en el esquema `neon_auth` (usuarios, cuentas y contraseñas).
- No borres el usuario `prueba.registro@solvia.demo` sin que el usuario lo pida.
- "Hoy" para la API es la fecha en America/Mexico_City, no la UTC.

## Convenciones del frontend (`FrontEnd/`)

- Las llamadas a la API pasan por `src/lib/api.js` y las cargas de datos por `src/lib/useCarga.js`.
- Formato de importes y fechas en `src/lib/formato.js`; componentes compartidos (carga, error, vacío, paginación) en `src/components/comunes.jsx`.
- La sesión y el rol salen de `useSesion()` (`src/sesion/SesionContext.jsx`).
- Antes de dar por terminado un cambio: `npm run lint` y `npm run build` en `FrontEnd/`.
