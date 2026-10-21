# Progreso de SolvIA

Última actualización: 2026-10-20. Demo: viernes 23 de octubre de 2026.

Plan acordado: A) base de datos · B) backend de negocio · C) frontend · D) microservicio facial y flujo completo · E) dashboard con Recharts · F) reporte ejecutivo (solo si hay tiempo).

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
- `docs/openapi.yaml`: OpenAPI 3.0.3 de los 19 endpoints de la API y de las rutas de Neon Auth (sign-in, get-session, token, sign-out, jwks), para importar en Apidog.

### Bloques C, D, E y F
- Sin empezar.

## En curso
- **Pruebas en Apidog.** La especificación está lista, pero ningún endpoint se ha llamado todavía por HTTP con un JWT real de Neon Auth.
- **Contraseñas de los gestores.** Los dos gestores demo existen en Neon Auth pero no tienen contraseña, así que no pueden iniciar sesión. Por ahora solo se puede probar como administrador.

## Pendiente (prioridad para la demo)
1. Dar contraseña a gestor1 y gestor2 (rama `desarrollo`) y probar en Apidog `/me` y un recorrido por rol: listar cuentas, ver un detalle y registrar un pago como gestor; crear una cuenta y asignarla como administrador.
2. **Bloque C (frontend):**
   - React Router, login con Neon Auth (`@neondatabase/neon-js` o llamadas a Better Auth) y cliente HTTP con `Authorization: Bearer`.
   - Rutas protegidas y layout por rol.
   - Pantallas según `docs/SolvIA_wireframes.html`: deudores, cuentas, detalle de cuenta con cuotas y registro de pago.
   - Variable `FRONTEND_ORIGIN` en el backend si el puerto no es 5173.
3. **Bloque E (dashboard):** Recharts sobre `/panel/resumen` y `/panel/prioridades`, y la lista de cuentas con `orden=prioridad`. El backend ya está listo.
4. **Bloque D (facial):**
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

# Frontend (todavía es la plantilla de Vite)
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
- **No verificado:** llamadas HTTP reales con JWT y tests unitarios (por decisión, el bloque B se hizo sin tests).

## Decisiones y desvíos
- **`/me` usa `Authorization: Bearer`** en lugar de la cookie de Neon Auth: esa cookie es del dominio de Neon y el navegador no la envía al backend. `NeonSessionService` quedó en el código pero ya no se usa.
- **`facial.verificado` devuelve siempre `true`** y `FaceVerifiedGuard` deja pasar todo hasta el bloque D, para no bloquear el frontend.
- **Zona horaria:** además de `ALTER DATABASE`, se pasa `-c TimeZone=America/Mexico_City` en el Pool, porque el pooler de Neon (PgBouncer) no respeta el ajuste de la base.
- **Se sigue `docs/SolvIA_contrato_API_v1.md`** (camelCase). `docs/contrato_api.md` (snake_case) queda como versión anterior.
- **Movimientos:** el cliente envía siempre un monto positivo y el backend aplica el signo según el tipo.
- **Prioridad P** se calcula en SQL. Solo `/panel/prioridades` filtra P > 0; `/cuentas?orden=prioridad` muestra todas.
- **`pagosPorPeriodo`** cuenta los pagos brutos, incluido uno que después se revirtió (SOL-008). Pasar a monto neto es un cambio pequeño si se prefiere.
- **Queda fuera por ahora:** `POST /usuarios` (depende de las invitaciones de Neon Auth) y los reportes (bloque F).
- **Seed:** `--reset` es opt-in y nunca toca `perfiles_usuario` ni `neon_auth`.

## Problemas conocidos
- **La rama por defecto del proyecto Neon es `production`.** Cualquier herramienta sin rama explícita apunta ahí; conviene cambiar la rama por defecto o pasar siempre la de `desarrollo`.
- **Los gestores demo no tienen contraseña** y no pueden iniciar sesión.
- **Tests:**
  - 2 de 22 fallan desde antes de estos cambios: a los specs de `DatabaseService` y `NeonAuthGuard` les falta `ConfigService`.
  - Los specs nuevos generados por Nest (p. ej. `pagos.*.spec.ts`) no proveen `DatabaseService`.
  - `test/app.e2e-spec.ts` todavía espera `GET /`.
- **Microservicio facial:** `Services/ai-service` solo tiene un venv en Python 3.14, que probablemente no sea compatible con PyTorch.
- **Variables AWS:** existen en `.env` pero el código no las usa.

## Siguiente paso
Dar contraseña a `gestor1@solvia.demo` y `gestor2@solvia.demo` en Neon Auth (rama `desarrollo`). Después, levantar el backend (`cd BackEnd && npm run start:dev`) y probar en Apidog con `docs/openapi.yaml`:
1. `sign-in` y `get-session` para obtener el JWT.
2. `GET /me` como administrador y como gestor.
3. `GET /cuentas?orden=prioridad`.
4. `GET /cuentas/{id}`.
5. `POST /cuentas/{id}/pagos` como gestor asignado y como gestor ajeno (debe dar 404).

Corregir lo que falle y empezar el bloque C (frontend).
