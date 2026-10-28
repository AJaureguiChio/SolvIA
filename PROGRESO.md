# Progreso de SolvIA

Última actualización: 2026-10-27. Entrega: viernes 30 de octubre de 2026 (antes era el 23). **La verificación facial (bloque D) es requisito de la entrega final.**

Plan acordado: A) base de datos · B) backend de negocio · C) frontend · D) microservicio facial y flujo completo (obligatorio) · E) dashboard con Recharts · F) reporte ejecutivo (solo si hay tiempo).

La verificación facial es obligatoria en la entrega como funcionalidad del sistema. Para cada usuario sigue siendo un paso adicional opcional, que se exige solo si inscribió su rostro (AGENTS.md y wireframes).

## Hecho

### Bloque A — Base de datos (rama Neon `desarrollo`)
- `db/migrations/001_zona_horaria.sql`: zona horaria `America/Mexico_City` para la base.
- `db/migrations/002_facial.sql`: tablas `facial_plantillas` (galería cifrada AES-256-GCM, 1:1 con `perfiles_usuario`) y `facial_intentos` (auditoría inmutable, índice por usuario y fecha).
- `db/seed/demo.sql`: 2 gestores demo (`gestor1@solvia.demo`, `gestor2@solvia.demo`, creados en Neon Auth), 12 deudores ficticios y 14 cuentas SOL-001…SOL-014 con fechas relativas a `CURRENT_DATE`. Hay cuentas al corriente, atrasadas de 5 a 92 días, cubiertas y liquidadas, con recargos, intereses, descuentos y una reversión de pago.
- `BackEnd/scripts/db.mjs` con `npm run db:migrate` y `npm run db:seed [-- --reset]`. Solo corre si `NEON_BRANCH=desarrollo`.

### Bloque B — Backend de negocio (NestJS, `/api/v1`)
- Base común:
  - `src/main.ts`: prefijo, CORS con credenciales, ValidationPipe y filtro global.
  - `src/common/api-error.ts` y `api-exception.filter.ts`: errores `{ error: { code, message, details } }`, que también traducen los errores de los triggers de PostgreSQL.
  - `src/common/validacion.ts`: paginación, IDs, importes y fechas.
  - `src/common/cartera.sql.ts`: saldo, cobertura FIFO de cuotas, días de mora y prioridad P en SQL.
  - `src/common/alcance.ts`: el gestor solo ve lo suyo y un ID ajeno da 404.
- Autenticación:
  - `src/auth/decoradores.ts`: `@Protegido()` = NeonAuth + FaceVerified + Roles; `@Roles()` y `@Usuario()`.
  - `src/auth/guards/roles/roles.guard.ts`: guard de roles real.
  - `src/auth/guards/neon-auth/neon-auth.guard.ts`: errores con el formato del contrato.
  - `src/auth/me.controller.ts`: `GET /me` con estado facial.
- Módulos `src/deudores`, `src/cuentas`, `src/pagos`, `src/movimientos`, `src/panel` y `src/usuarios` (dto, service, controller).
  - Endpoints: ver `docs/openapi.yaml`.
  - El panel ya calcula los datos del bloque E: `/panel/resumen` (totales, morosidad por rangos, pagos por mes frente a lo esperado, próximos vencimientos) y `/panel/prioridades` (ranking por P con sus componentes).
- `src/database/database.service.ts`: las fechas se leen como texto y la zona horaria se fija en la conexión.
- OpenAPI 3.0.3 en dos módulos para Apidog (cada uno con su servidor):
  - `docs/openapi.yaml`: los 19 endpoints de la API de SolvIA.
  - `docs/openapi-neon-auth.yaml`: rutas de Neon Auth (sign-up, sign-in, get-session, token, sign-out, jwks).

### Bloque C — Frontend (React 19 + Vite, primera parte; probada en navegador el 27 de octubre)
- Dependencias: `react-router` 8 (modo declarativo) y `@neondatabase/auth` (cliente de Neon Auth).
- `src/lib/auth.js`: cliente de Neon Auth; el JWT sale de `getSession()` (`session.token`, que el SDK toma del header `set-auth-jwt` y guarda en caché hasta poco antes de caducar).
- `src/lib/api.js`: `fetch` con `Authorization: Bearer` y errores del contrato (`ApiError` con `status`, `code` y `details`).
- `src/sesion/SesionContext.jsx`: estados `cargando`, `anonimo`, `listo`, `sin_perfil`, `inactivo` y `error`, a partir de `getSession()` y `GET /me`.
- `src/App.jsx`: rutas protegidas y por rol (`/deudores/nuevo` solo administrador, `/cuentas/:id/pago` solo gestor).
- Pantallas según los wireframes, con estados de carga, vacío y error:
  - Login (1), con avisos para usuario sin perfil o desactivado.
  - Panel (4 y 5): indicadores, pagos por mes frente a lo esperado, próximos vencimientos y prioridades. Las gráficas quedan para el bloque E.
  - Deudores (6) y ficha (7): búsqueda y paginación; el administrador registra y edita.
  - Cuentas (8): filtros por texto, cumplimiento y gestor (administrador) u orden (gestor).
  - Detalle de cuenta (10): resumen y pestañas de plan y cuotas, pagos, movimientos y asignaciones; el administrador reasigna gestor.
  - Registro de pago (11): validación previa y paso de confirmación.
- `src/index.css` toma los estilos de `docs/SolvIA_wireframes.html`. Se borraron los archivos de la plantilla de Vite.
- `vite.config.js` lee el `.env` de la raíz (`envDir: '..'`) y fija el puerto 5173.
- Pantalla 9, `src/pages/NuevaCuenta.jsx` (`/cuentas/nueva`, solo administrador):
  - Pasos 1 (cuenta), 2 (cuotas) y 3 (revisar y confirmar).
  - Deudor con búsqueda; se preselecciona con `?deudor=ID`. Gestor opcional.
  - Generador de cuotas mensuales: reparte el monto y los centavos sobrantes van a la última cuota; si el día no existe en el mes, se usa el último.
  - Tabla de cuotas editable (añadir y quitar).
  - Valida antes de enviar las mismas reglas que los triggers: suma exacta en centavos, acuerdo no anterior a la originación, vencimientos no anteriores al acuerdo y estrictamente crecientes.
  - Se llega desde "Crear cuenta y plan" en la cartera y en la ficha del deudor. Los estilos `.steps` vienen del wireframe.
- `ErrorFormulario` (`comunes.jsx`) ya no muestra el nombre técnico de la restricción: un CURP, RFC o referencia externa repetidos dan un mensaje legible.

### Bloques D, E y F
- Sin empezar.

## En curso
- **Usuario temporal** `prueba.registro@solvia.demo` (rama `desarrollo`, sin perfil), creado al probar `sign-up`. **No borrarlo:** el usuario pidió conservarlo; sirve para probar el aviso de usuario sin perfil.
- **Datos modificados por las pruebas** (rama `desarrollo`; `npm run db:seed -- --reset` los elimina):
  - Cuenta 3 (SOL-003): pagos 29 (100.00, 26 oct) y de 50.00 (27 oct) de gestor1; saldo 4,850.00.
  - SOL-009 (sin gestor en el seed) quedó asignada a gestor1; el 27 de octubre se reasignó a gestor2 y de vuelta a gestor1 desde la interfaz.
  - Deudor 13 "Deudor Prueba Navegador" (RFC `DPN261027AB1`, Tlaxcala) con dos cuentas: la 15, SOL-015 (3,000.00 en 3 cuotas, de gestor2), y la 17, SOL-016 (2,500.50 en 3 cuotas de 833.50, de gestor1, creada desde la pantalla 9). El id 16 se consumió en un intento que dio 409.
  - El seed no conoce el deudor 13 ni la cuenta 15: `--reset` los borra porque vacía las tablas de negocio.

## Pendiente (prioridad para la demo)
1. **Bloque D (facial), obligatorio** (detalle abajo).
2. **Bloque C (frontend), resto:** pantallas de administrador 12 (movimiento de saldo) y 13 (gestión de usuarios).
3. **Bloque E (dashboard):** Recharts sobre `/panel/resumen` y `/panel/prioridades`, y la lista de cuentas con `orden=prioridad`. El backend ya está listo.
4. **Bloque D (facial, obligatorio para la entrega):**
   - Microservicio FastAPI en `Services/ai-service` con `/health`, `/enroll` y `/verify` (MTCNN + Inception-ResNet-v1 VGGFace2, umbral 0.40).
   - En NestJS: `POST /facial/inscripciones` y `POST /facial/verificaciones` (multipart, campo `captura`), cifrado de la galería, cookie `solvia_face` (JWT HS256 de 30 min), `FaceVerifiedGuard` real, `cookie-parser` y bloqueo 429 tras 5 fallos en 15 min.
   - En el frontend: `/configuracion-facial` y `/verifica-rostro`.
5. `POST /usuarios` (invitación en Neon Auth). Si no da tiempo, los usuarios se crean desde la consola o el MCP de Neon.
6. **Bloque F (opcional):** reporte ejecutivo con métricas, texto generado por LLM y PDF para el administrador.

## Cómo correrlo

Todas las variables van en el `.env` de la raíz del repositorio, que no se versiona.

| Variable | Uso |
|---|---|
| `DATABASE_URL` | Conexión con pooler (backend) |
| `DATABASE_URL_UNPOOLED` | Conexión directa (migraciones y seed) |
| `NEON_BRANCH` | Debe ser `desarrollo` para migrar o sembrar |
| `NEON_AUTH_BASE_URL` | URL de Neon Auth (emisor del JWT) |
| `NEON_AUTH_JWKS_URL` | JWKS para verificar el JWT |
| `FRONTEND_ORIGIN` | Orígenes de CORS separados por comas; por defecto `http://localhost:5173` |
| `VITE_NEON_AUTH_URL` | URL de Neon Auth para el navegador; en el `.env` vale `${NEON_AUTH_BASE_URL}` |
| `VITE_API_URL` | URL de la API para el navegador; por defecto `http://localhost:3000/api/v1` |
| `PORT` | Opcional, por defecto 3000 |
| `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `AWS_REGION` | Aún no se usan en el código |

Bloque D (por crear): `AI_SERVICE_URL`, `AI_INTERNAL_KEY`, `FACE_GALLERY_KEY` y `FACE_JWT_SECRET`.

```bash
# Base de datos (rama desarrollo)
cd BackEnd
npm install
npm run db:migrate
npm run db:seed              # se niega si ya hay datos
npm run db:seed -- --reset   # vacía las tablas de negocio y vuelve a sembrar

# Backend
npm run start:dev            # http://localhost:3000/api/v1
npm run build && npm run lint

# Frontend
cd ../FrontEnd
npm install
npm run dev                  # http://localhost:5173

# Microservicio facial (bloque D, aún vacío)
# Services/ai-service solo tiene un venv con Python 3.14; conviene recrearlo con
# Python 3.11 o 3.12 por compatibilidad con PyTorch y facenet-pytorch:
#   py -3.12 -m venv venv && venv\Scripts\activate
#   pip install fastapi uvicorn facenet-pytorch pillow python-multipart
#   uvicorn main:app --port 8000
```

## Cómo lo verifiqué
- **Migraciones:** se corrieron dos veces; la segunda no aplicó nada.
- **Seed:**
  - `resumen_planes()` da 4 cuentas al corriente, 7 atrasadas, 1 cubierta sin liquidar y 2 cubiertas y liquidadas.
  - Saldo, exigible, mora y P se revisaron cuenta por cuenta: P va de 36.7 a 100.
  - Volver a sembrar sin `--reset` se rechaza.
- **Reglas de la base,** probadas dentro de transacciones revertidas:
  - Se rechazan el pago de un gestor no asignado, el pago mayor al saldo, el pago con fecha futura y el DELETE de un pago.
  - Un pago válido sí se acepta.
- **Zona horaria:** el pooler ignoraba el `ALTER DATABASE` y la conexión seguía en GMT. Con la opción de arranque de la conexión, las consultas por pooler devuelven America/Mexico_City.
- **Backend:**
  - `tsc --noEmit` y `npm run build` sin errores.
  - `npm run lint` solo muestra el aviso del stub `FaceVerifiedGuard`.
  - Script temporal (ya borrado) que ejecutó cada consulta de los servicios contra `desarrollo`: todas responden.
  - El gestor 1 recibe 404 al pedir una cuenta del gestor 2.
  - El panel del gestor 1 muestra 7 cuentas y un índice de morosidad de 57.1.
- **OpenAPI:** `npx @redocly/cli lint docs/openapi.yaml` da la especificación por válida, con 12 advertencias de estilo (licencia, descripción de tags, servidor localhost y respuestas 4xx en las rutas de Neon).
- **Recorrido HTTP con JWT real (26 de octubre, rama `desarrollo`):**
  - `sign-up`: 200; correo repetido, 422; contraseña corta, 400. `sign-in`, `get-session` y `token`: 200.
  - `/me`: sin token, 401; usuario sin perfil, 403 `PROFILE_REQUIRED`; administrador, gestor1 y gestor2, 200 con su rol.
  - `/cuentas?orden=prioridad`: 14 cuentas para el administrador, 7 para gestor1 y 6 para gestor2, ordenadas por P.
  - `/cuentas/3` (de gestor1): 200 para el administrador y gestor1, 404 para gestor2.
  - `POST /cuentas/3/pagos`: gestor2, 404; administrador, 403; monto mayor al saldo, 422 `SALDO_INSUFICIENTE`; fecha futura, 422 `FECHA_FUERA_DE_RANGO`; gestor1, 201 (pago 29 de 100.00, saldo de 5000.00 a 4900.00).
- **Frontend (26 de octubre):**
  - `npm run lint` sin errores; `npm run build` correcto.
  - El bundle apunta a Neon Auth de `desarrollo` y no contiene secretos.
  - CORS con credenciales desde `localhost:5173`: el preflight de Neon Auth y el del backend responden 204. La cookie de sesión de Neon es `SameSite=None; Partitioned`.
- **Navegador (27 de octubre):** Chrome headless con `playwright-core` (scripts en el scratchpad de la sesión, fuera del repo), contra el backend y el Vite del usuario. Sin errores de consola salvo los 4xx esperados.
  - gestor1: panel, mis cuentas, detalle de SOL-003, deudores (solo los suyos) y "Sin permiso" en `/deudores/nuevo`. Pago de 50.00 en SOL-003: monto mayor al saldo bloqueado, fecha por omisión 27/10 (México), paso de confirmación, 201 y saldo de 4,900.00 a 4,850.00.
  - Administrador: panel con "Por asignar", cartera con columna de gestor, ficha de deudor y "Sin permiso" en `/cuentas/3/pago`. Alta del deudor 13 (201), edición (200), RFC repetido (409, ya con mensaje legible), reasignación de SOL-009 (200 dos veces) y pestaña Asignaciones con el historial.
  - `prueba.registro@solvia.demo`: aviso de usuario sin perfil y botón "Usar otra cuenta".
- **Crear y asignar una cuenta por HTTP (27 de octubre):** cuotas que no suman, 422 `PLAN_INVALID`; gestor, 403; administrador, 201 (SOL-015, sin gestor, al corriente, saldo 3000.00); referencia repetida, 409 `DUPLICATE_IDENTIFIER`; aparece en `sinAsignar=true`; asignación a gestor2, 200; UUID inexistente, 422 `INVALID_ASSIGNMENT`; gestor2 la ve (200) y gestor1 no (404); el historial registra el cambio.
- **Morosidad (27 de octubre, noche):** el panel del administrador muestra 7 atrasadas, "Morosidad 53.8 %" (7 de 13 vigentes) y "Al corriente 38 %" (5 de 13), con denominadores ya coherentes. El backend del usuario está en modo watch y recompiló solo.
- **Pantalla 9 en el navegador:**
  - Desde la ficha del deudor 13, el deudor sale preseleccionado.
  - Un acuerdo anterior a la originación se bloquea.
  - El generador produjo 30 nov, 30 dic y 30 ene con 833.50 cada una. Al cambiar una cuota a 800.00, aparece el aviso de descuadre y el botón se desactiva.
  - La revisión y la confirmación dieron 201 y redirigen al detalle con el aviso. Una referencia repetida da 409, con el mensaje legible.
  - gestor1 ve "Sin permiso" en `/cuentas/nueva`, no ve el botón y sí ve SOL-016 en sus cuentas.
  - `npm run lint` y `npm run build` del frontend, sin errores.
- **No verificado:** tests unitarios (por decisión, el bloque B se hizo sin tests).

## Decisiones y desvíos
- **`/me` usa `Authorization: Bearer`** en lugar de la cookie de Neon Auth: esa cookie es del dominio de Neon y el navegador no la envía al backend. `NeonSessionService` quedó en el código pero ya no se usa.
- **`facial.verificado` devuelve siempre `true`** y `FaceVerifiedGuard` deja pasar todo hasta el bloque D, para no bloquear el frontend.
- **Zona horaria:** además de `ALTER DATABASE`, se pasa `-c TimeZone=America/Mexico_City` en el Pool, porque el pooler de Neon (PgBouncer) no respeta el ajuste de la base.
- **Se sigue `docs/SolvIA_contrato_API_v1.md`** (camelCase). `docs/contrato_api.md` (snake_case) queda como versión anterior.
- **Movimientos:** el cliente envía siempre un monto positivo y el backend aplica el signo según el tipo.
- **Prioridad P** se calcula en SQL. Solo `/panel/prioridades` filtra P > 0; `/cuentas?orden=prioridad` muestra todas.
- **`pagosPorPeriodo`** cuenta los pagos brutos, incluido uno que después se revirtió (SOL-008). Pasar a monto neto es un cambio pequeño si se prefiere.
- **Queda fuera por ahora:** `POST /usuarios` (depende de las invitaciones de Neon Auth) y los reportes (bloque F).
- **Índice de morosidad** (27 de octubre): cuentas atrasadas entre cuentas vigentes (sin liquidar), igual que "Al corriente". Antes dividía entre todas las cuentas. Cambiado en `panel.service.ts` y en `docs/openapi.yaml`.
- **Seed:** `--reset` es opt-in y nunca toca `perfiles_usuario` ni `neon_auth`.

## Problemas conocidos
- **Carga lenta en recargas completas:** al abrir una URL directamente, la pantalla tarda de 3 a 5 s (`getSession`, luego `/me`, luego los datos). Navegando dentro de la app es rápido.
- **La rama por defecto del proyecto Neon es `production`.** Cualquier herramienta sin rama explícita apunta ahí; conviene cambiar la rama por defecto o pasar siempre la de `desarrollo`.
- **Contraseñas demo.** En `desarrollo`, `albertojairzinho@hotmail.com`, gestor1, gestor2, `admin@solvia.com` y el usuario temporal comparten la misma contraseña (no está en el repositorio). La cuenta `credential` del administrador se creó el 26 de octubre.
- **Apidog y Neon Auth:**
  - Sin header `Origin`, Neon responde 403 `MISSING_OR_NULL_ORIGIN`; hay que ponerlo en el módulo de Neon Auth (`http://localhost:5173`).
  - El JWT es el header `set-auth-jwt` de `get-session`. Si la cookie de sesión está vacía, no hay JWT válido y `/me` falla.
  - Probado por el usuario el 26 de octubre: los endpoints responden con el token guardado en una variable.
- **"Hoy" es en America/Mexico_City.** Después de las 18:00 en México ya es el día siguiente en UTC: un pago con la fecha UTC da 422 `FECHA_FUERA_DE_RANGO`. El frontend debe calcular la fecha por omisión con `timeZone: 'America/Mexico_City'`.
- **El aviso `SECURITY WARNING` de `pg`** sobre `sslmode` es inofensivo; desaparece usando `sslmode=verify-full` en el `.env`.
- **Códigos de error de Better Auth:** el correo duplicado da 422 `USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL` y la contraseña corta 400 `PASSWORD_TOO_SHORT`, con formato `{ code, message }`.
- **Tests:**
  - 2 de 22 fallan desde antes de estos cambios: a los specs de `DatabaseService` y `NeonAuthGuard` les falta `ConfigService`.
  - Los specs nuevos generados por Nest (p. ej. `pagos.*.spec.ts`) no proveen `DatabaseService`.
  - `test/app.e2e-spec.ts` todavía espera `GET /`.
- **Microservicio facial:** `Services/ai-service` solo tiene un venv en Python 3.14, que probablemente no sea compatible con PyTorch.
- **Variables AWS:** existen en `.env` pero el código no las usa.

## Siguiente paso

**Al retomar la sesión (28 de octubre en adelante; entrega el 30):**
- `git status` debería estar limpio salvo `.env`.
- El usuario suele tener corriendo su backend (puerto 3000, `dist/main`) y su Vite (5173). No detenerlos; un cambio en el backend requiere que el usuario lo reinicie.
- La contraseña demo común no está en el repositorio: pedirla al usuario si hace falta probar por HTTP.
- Neon: proyecto `aged-paper-03532903`, rama `desarrollo` = `br-bold-dust-b4aymjsk`. La rama por defecto es `production` (`br-soft-frost-b4rpx0vq`): pasar siempre la rama de forma explícita.
- Para probar en el navegador sin intervención: `playwright-core` con el Chrome instalado (`C:/Program Files/Google/Chrome/Application/chrome.exe`), instalado en el scratchpad. En Git Bash, usar `MSYS_NO_PATHCONV=1` al pasar rutas como `/cuentas`.

Orden propuesto (la entrega es el 30 de octubre y la verificación facial es obligatoria):
1. Bloque D (facial): microservicio, endpoints en NestJS, `FaceVerifiedGuard` real y pantallas `/configuracion-facial` y `/verifica-rostro`. Antes, recrear el venv con Python 3.11 o 3.12.
2. Pantallas 12 (movimiento de saldo) y 13 (gestión de usuarios).
3. Bloque E (Recharts).
