# SolvIA

- Lee la documentación pertinente de `docs/` antes de modificar el módulo relacionado.
- La interfaz debe seguir `docs/SolvIA_wireframes.html`.
- Solo existen los roles administrador y gestor.
- La autenticación principal usa Neon Auth; después, la verificación facial es obligatoria para todos los usuarios (decisión del 28 de octubre de 2026; los wireframes y el mapa funcional aún la llaman opcional).
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
- `POST /usuarios` crea cuentas reales en Neon Auth: no lo ejecutes en pruebas sin autorización del usuario.
- Los reportes son inmutables (no admiten UPDATE ni DELETE): no guardes reportes de prueba sin autorización; prueba su SQL en una transacción revertida.
- "Hoy" para la API es la fecha en America/Mexico_City, no la UTC.

## Reportes e IA (bloque F)

- El texto de los reportes lo redacta Gemini (`GEMINI_API_KEY`, `GEMINI_MODEL`, `GEMINI_MODEL_RESPALDO`) consultando las métricas por MCP: el servidor MCP está en `BackEnd/src/reportes/mcp/servidor-solvia.ts`. Una métrica nueva para el LLM se agrega ahí como herramienta de solo lectura, sin datos personales de deudores.
- El PDF se arma en el navegador (`FrontEnd/src/lib/pdfReporte.js`, jsPDF) y el backend lo valida y lo guarda en `reportes.archivo_pdf`.

## Convenciones del backend (`BackEnd/`)

- Los errores siguen el contrato `{ error: { code, message, details } }` con `ApiError` (`src/common/api-error.ts`); los mensajes de los triggers se traducen en `src/common/api-exception.filter.ts`.
- Las rutas de negocio usan `@Protegido()` y `@Roles()` (`src/auth/decoradores.ts`); el gestor solo ve lo suyo y un recurso ajeno responde 404.
- Documenta cada ruta nueva en `docs/openapi.yaml`.
- Antes de dar por terminado un cambio: `npm run lint` y `npm run build` en `BackEnd/` (`tsc` marca errores conocidos en specs viejos; ver `PROGRESO.md`).

## Convenciones del frontend (`FrontEnd/`)

- Las llamadas a la API pasan por `src/lib/api.js` y las cargas de datos por `src/lib/useCarga.js`.
- Formato de importes y fechas en `src/lib/formato.js`; componentes compartidos (carga, error, vacío, paginación) en `src/components/comunes.jsx`.
- La sesión y el rol salen de `useSesion()` (`src/sesion/SesionContext.jsx`).
- Las gráficas usan Recharts (`src/components/Graficas.jsx`) con la paleta validada; Recharts, jsPDF, jspdf-autotable y html2canvas se cargan bajo demanda (`lazy` / `import()`) para que ningún archivo del bundle pase de 500 kB.
- Antes de dar por terminado un cambio: `npm run lint` y `npm run build` en `FrontEnd/`.
