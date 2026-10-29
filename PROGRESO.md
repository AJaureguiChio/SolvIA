# Progreso de SolvIA

Última actualización: 2026-10-29. Entrega: viernes 30 de octubre de 2026 (antes era el 23). **La verificación facial (bloque D) es requisito de la entrega final.**

Plan acordado: A) base de datos · B) backend de negocio · C) frontend · D) microservicio facial y flujo completo (obligatorio) · E) dashboard con Recharts · F) reporte ejecutivo (solo si hay tiempo).

La verificación facial es obligatoria para todos los usuarios (AGENTS.md, decisión del 28 de octubre): quien no tiene rostro lo registra en su primer acceso y quien lo tiene lo verifica. Los wireframes y el mapa funcional todavía la llaman opcional.

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
- Pantalla 13, `src/pages/Usuarios.jsx` (`/usuarios`, solo administrador; enlace "Usuarios" en la cabecera), 29 de octubre:
  - Filtros por rol y estado. Tabla con usuario y correo, rol, activo, cuentas (enlace a la cartera filtrada por gestor), rostro (`facialInscrito`) y acciones.
  - Activar o desactivar, cambiar de rol y restablecer rostro, cada una con confirmación. En la fila propia solo queda restablecer rostro (el backend da `SELF_MODIFICATION`).
  - Si un gestor tiene cuentas, desactivarlo o cambiarle el rol no llama a la API: avisa y preselecciona el gestor en "Reasignar cuenta" (gestor actual → cuenta → nuevo gestor o sin asignar, con `PATCH /cuentas/:id/asignacion`).
  - Sin botón "Invitar usuario": `POST /usuarios` sigue pendiente.
- Pantalla 12, `src/pages/RegistrarMovimiento.jsx` (`/cuentas/:id/movimiento`, solo administrador; botón "Nuevo movimiento" en el detalle de cuenta), 29 de octubre:
  - Tipo, importe positivo, fecha efectiva, pago de origen (solo reembolso y reversión) y motivo (máx. 500).
  - Valida antes de enviar lo mismo que el trigger: fecha entre el acuerdo (o el pago de origen) y hoy, abono no mayor al saldo, y reversión no mayor a lo que queda por revertir del pago. Solo se ofrecen pagos con monto pendiente de revertir.
  - Panel "Efecto previsto" (saldo anterior, impacto con signo y saldo estimado), paso de revisión y confirmación. Al terminar vuelve al detalle en la pestaña Movimientos con el aviso del nuevo saldo (`Cuenta.jsx` acepta `state.pestana`).
- `ErrorFormulario` (`comunes.jsx`) ya no muestra el nombre técnico de la restricción: un CURP, RFC o referencia externa repetidos dan un mensaje legible.

### Bloque D — Verificación facial obligatoria (28 de octubre)
Política decidida por el usuario: **obligatoria para todos**. Tras Neon Auth, quien no tiene rostro lo registra (excepción de primer acceso) y quien lo tiene lo verifica. Sin prueba facial vigente, las rutas de negocio dan 401 `FACE_VERIFICATION_REQUIRED`.
- **Microservicio** `Services/ai-service/main.py` (FastAPI, puerto 8000):
  - MTCNN detecta el rostro e Inception-ResNet-v1 (VGGFace2, facenet-pytorch) extrae un embedding normalizado de 512 dimensiones.
  - `GET /health`, `POST /enroll` (captura → embedding) y `POST /verify` (captura + galería → `coincide`, `score`). Las dos últimas exigen `X-Internal-Key`.
  - Rechaza capturas sin rostro, con varios rostros, con un rostro de menos de 80 px y de más de 5 MB.
  - Umbral de similitud coseno 0.60 (`FACE_THRESHOLD`). No guarda nada y lee el `.env` de la raíz.
  - Dependencias en `requirements.txt`.
- **Backend:**
  - `src/auth/prueba-facial.ts`: cookie httpOnly `solvia_face` (JWT HS256 de 30 min, `sub` = usuario, `SameSite=Lax`, `Path=/api/v1`; `FACE_COOKIE_SECURE=true` la cambia a `None` + `Secure`).
  - `FaceVerifiedGuard` real: exige la cookie del mismo usuario del JWT. `/me` devuelve `facial.verificado` real.
  - `src/facial/`:
    - `POST /facial/inscripciones` acepta de 1 a 5 capturas. Reemplazar un rostro ya registrado exige prueba vigente (403 `FACE_REENROLL_FORBIDDEN`).
    - `POST /facial/verificaciones`: el score nunca se devuelve. Responde 401 `FACE_MISMATCH` con `intentosRestantes`, 429 `FACE_LOCKED` tras 5 fallos en 15 min (el contador se reinicia con un acierto o un registro), 409 `FACE_NOT_ENROLLED`, 422 `FACE_CAPTURE_INVALID` con `motivo` y 503 `FACE_SERVICE_UNAVAILABLE`.
    - `DELETE /facial/verificacion` borra la cookie.
    - Galería: k vectores float32 cifrados con AES-256-GCM (`FACE_GALLERY_KEY`). Cada intento queda en `facial_intentos`.
  - `POST /usuarios/{id}/restablecimiento-facial` (administrador): borra la plantilla. `GET /usuarios` incluye `facialInscrito`.
  - Sin `cookie-parser`: la cookie se lee del header.
- **Frontend:**
  - `components/Camara.jsx` (getUserMedia, captura JPEG en memoria) y `components/RegistroRostro.jsx` (3 capturas).
  - Pantallas `/registro-facial` (primer acceso), `/verifica-rostro` (pantalla 2) y `/configuracion-facial` (pantalla 3, enlace "Mi rostro" en la cabecera, para registrar de nuevo).
  - Sesión con estados `requiere_inscripcion` y `requiere_verificacion`; si la prueba caduca a mitad de uso, `api.js` vuelve a pedirla. Al cerrar sesión se borra la cookie.
- `.env`: se agregaron `AI_SERVICE_URL`, `AI_INTERNAL_KEY`, `FACE_GALLERY_KEY` (32 bytes en base64) y `FACE_JWT_SECRET`, generados al azar. Si se pierde `FACE_GALLERY_KEY`, las galerías no se pueden descifrar y hay que registrar de nuevo.
- `docs/openapi.yaml`: rutas faciales, restablecimiento y respuestas `CapturaInvalida` y `ServicioFacialCaido` (válido con Redocly). `AGENTS.md`: la verificación facial ya es obligatoria.

### Bloque E — Dashboard con Recharts (29 de octubre)
- `recharts` 3.10.1. `src/components/Graficas.jsx`:
  - `GraficaPagos`: barras de lo pagado por mes y línea de lo esperado (cuotas que vencían), un solo eje, leyenda y tooltip con importes.
  - `GraficaCartera`: barras horizontales de cuentas al corriente, atrasadas, cubiertas sin liquidar y liquidadas, con el número junto a cada barra.
  - `GraficaMorosidad`: cuentas vigentes por rango de días de mora, en una rampa de un solo tono (más oscuro = más mora); el tooltip incluye el monto vencido.
  - `MedidorPrioridad`: barra 0–100 junto a la P en la tabla de prioridades.
  - Colores de la paleta validada de la skill dataviz (azul `#2a78d6` y naranja `#eb6834`, marcas distintas: barra frente a línea). El texto va siempre en tinta neutra, nunca en el color de la serie.
- `Panel.jsx` (administrador y gestor, cada uno con su alcance): tendencia de pagos, estado de la cartera con los saldos, morosidad por días de atraso, próximos vencimientos y prioridades. Las tablas de pagos y de morosidad quedan en un "Ver tabla" plegable bajo cada gráfica.
- La lista de cuentas ya se ordenaba por prioridad (`orden=prioridad`) desde el bloque C.

### Bloque F
- Sin empezar.

## En curso
- **Usuario temporal** `prueba.registro@solvia.demo` (rama `desarrollo`, sin perfil), creado al probar `sign-up`. **No borrarlo:** el usuario pidió conservarlo; sirve para probar el aviso de usuario sin perfil.
- **Datos modificados por las pruebas** (rama `desarrollo`; `npm run db:seed -- --reset` los elimina):
  - Cuenta 3 (SOL-003): pagos 29 (100.00, 26 oct) y de 50.00 (27 oct) de gestor1; saldo 4,850.00.
  - SOL-009 (sin gestor en el seed) quedó asignada a gestor1; el 27 de octubre se reasignó a gestor2 y de vuelta a gestor1 desde la interfaz.
  - Deudor 13 "Deudor Prueba Navegador" (RFC `DPN261027AB1`, Tlaxcala) con dos cuentas: la 15, SOL-015 (3,000.00 en 3 cuotas, de gestor2), y la 17, SOL-016 (2,500.50 en 3 cuotas de 833.50, de gestor1, creada desde la pantalla 9). El id 16 se consumió en un intento que dio 409.
  - El seed no conoce el deudor 13 ni la cuenta 15: `--reset` los borra porque vacía las tablas de negocio.

## Pendiente (prioridad para la demo)
1. **Probar la pantalla 12 en el navegador:** un cargo, un abono, un abono mayor al saldo (bloqueado) y una reversión con su pago de origen.
2. ~~Verificación facial con cámara real~~: hecha por el usuario. El 29 de octubre el administrador principal, gestor1 y gestor2 tienen rostro registrado; `admin@solvia.com` no.
3. **Revisar el panel con datos reales** (bloque E) como administrador y como gestor.
4. Opcional: detección de rostro en el navegador (`face-api.js` o MediaPipe, como dice `docs/definicion_proyecto.md`), para avisar antes de enviar la captura. Hoy la detección la hace solo el microservicio.
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

| `AI_SERVICE_URL` | URL del microservicio facial (`http://localhost:8000`) |
| `AI_INTERNAL_KEY` | Clave compartida backend ↔ microservicio (header `X-Internal-Key`) |
| `FACE_GALLERY_KEY` | Clave AES-256 (32 bytes en base64) de las galerías faciales |
| `FACE_JWT_SECRET` | Firma de la cookie `solvia_face` |
| `FACE_THRESHOLD`, `FACE_MIN_SIZE` | Opcionales del microservicio (0.60 y 80 px) |
| `FACE_COOKIE_SECURE` | Opcional; `true` para `SameSite=None; Secure` con dominios distintos |

Desde la raíz del repositorio, cada módulo arranca con su script (en consolas separadas):

```bash
npm run dev:backend      # NestJS en modo watch, puerto 3000
npm run dev:frontend     # Vite, puerto 5173 (otro puerto: npm run dev:frontend -- -- --port 5199)
npm run dev:ai-service   # microservicio facial, puerto 8000 (requiere el venv instalado)
```

Instalación y comandos por módulo:

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

# Microservicio facial (Python 3.14; ver requirements.txt)
cd ../Services/ai-service
venv\Scripts\python -m pip install torch torchvision --index-url https://download.pytorch.org/whl/cpu
venv\Scripts\python -m pip install facenet-pytorch==2.6.0 --no-deps
venv\Scripts\python -m pip install -r requirements.txt
venv\Scripts\python -m uvicorn main:app --host 127.0.0.1 --port 8000
# La primera vez descarga los pesos de VGGFace2 (107 MB). Sin el microservicio nadie puede entrar.
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
  - `npm run lint` sin avisos (desde el bloque D).
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
- **Bloque D (28 de octubre):**
  - Calibración con fotos públicas: las de prueba de facenet-pytorch más una foto de Wikipedia de tres de esas personas. Misma persona: 0.684, 0.716 y 0.744. Personas distintas: hasta 0.540 (Angelina Jolie contra Kate Siegel), por eso el umbral pasó de 0.50 a 0.60.
  - Microservicio: la foto grupal da 422 `multiples_rostros`, la petición sin clave da 401, Cooper contra Cooper coincide (0.716) y Rudd contra Cooper no (0.417).
  - De punta a punta en Chrome con cámara simulada (archivo `.y4m`):
    - gestor1 sin rostro es enviado a `/registro-facial`; 3 capturas dan 201 y entra al panel.
    - Al cerrar sesión, la cookie se borra (204).
    - Un impostor (Paul Rudd) recibe "El rostro no coincide… Te quedan 4 intentos".
    - El titular (otra foto de Cooper) da 201 y entra; ve sus 9 cuentas.
  - Por HTTP:
    - Sin cookie, 401 `FACE_VERIFICATION_REQUIRED`. Con cookie, 200. La cookie de gestor1 con el token de gestor2 da 401, igual que una firma falsa.
    - Reinscribirse sin verificar da 403 y la respuesta no incluye el score.
    - Un gestor que intenta restablecer recibe 403. Sin captura, 400. Con varios rostros, 422.
    - 5 impostores dan 401 con 4…0 intentos restantes; el sexto y el titular durante el bloqueo, 429.
    - Sin rostro registrado (gestor2), 409. Con el microservicio detenido, 503.
  - En la base: 3 vectores, 6,144 bytes cifrados, IV de 12 y etiqueta de 16 bytes; la bitácora registra cada resultado.
  - Backend: `tsc` y `npm run lint` limpios, salvo los specs viejos ya conocidos. Frontend: `npm run lint` y `npm run build`, sin errores.
  - **No verificado:** cámara real, el restablecimiento por un administrador verificado (requiere que el administrador registre su rostro) y la expiración de la cookie a los 30 min durante el uso.
- **Pantallas 12 y 13 (29 de octubre):** `npm run lint` y `npm run build` del frontend, sin errores.
  - Pantalla 13 probada por el usuario en su navegador: listado, aviso al desactivar un gestor con cuentas y reasignación.
  - **No verificado:** la pantalla 12 en el navegador (necesita el rostro del administrador).
- **Bloque E (29 de octubre):** `npm run lint` y `npm run build`, sin errores. El build avisa que el bundle pasa de 500 kB (Recharts); no bloquea.
  - Las cuatro gráficas se renderizaron con datos de ejemplo en una página temporal (ya borrada), con Chrome headless a 1280 y 390 px de ancho: sin errores de consola, tooltip correcto al pasar el cursor y etiquetas en tinta `#27313a`.
  - **No verificado:** el panel con datos reales en el navegador (necesita sesión con rostro).
- **No verificado:** tests unitarios (por decisión, el bloque B se hizo sin tests).

## Decisiones y desvíos
- **`/me` usa `Authorization: Bearer`** en lugar de la cookie de Neon Auth: esa cookie es del dominio de Neon y el navegador no la envía al backend. `NeonSessionService` quedó en el código pero ya no se usa.
- **Verificación facial obligatoria para todos** (28 de octubre, decisión del usuario), como dice el contrato de la API. Los wireframes y `docs/SolvIA_mapa_funcional_y_pantallas.md` todavía la llaman opcional.
- **La IA facial vive en Python;** NestJS solo cifra, guarda, limita intentos y emite la prueba. El microservicio no tiene estado y recibe la galería en cada verificación.
- **Python 3.14 + torch 2.14 CPU:** facenet-pytorch 2.6 fija `torch<2.3`, así que se instala con `--no-deps`; funciona con torch reciente.
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
- **Plantilla facial de prueba de gestor1:** se borró el 28 de octubre con permiso del usuario; gestor1 vuelve a pedir el registro facial en su primer acceso. Las filas de prueba de `facial_intentos` se quedan porque la tabla es inmutable.
- **Sin el microservicio (puerto 8000) nadie puede entrar:** la verificación es obligatoria. Hay que levantarlo junto con el backend.
- **Cámara:** `getUserMedia` solo funciona en HTTPS o `localhost`.
- **Variables AWS:** existen en `.env` pero el código no las usa.

## Siguiente paso

**Al retomar la sesión (28 de octubre en adelante; entrega el 30):**
- `git status` debería estar limpio salvo `.env`.
- El usuario suele tener corriendo su backend (puerto 3000, `dist/main`) y su Vite (5173). No detenerlos; un cambio en el backend requiere que el usuario lo reinicie.
- La contraseña demo común no está en el repositorio: pedirla al usuario si hace falta probar por HTTP.
- Neon: proyecto `aged-paper-03532903`, rama `desarrollo` = `br-bold-dust-b4aymjsk`. La rama por defecto es `production` (`br-soft-frost-b4rpx0vq`): pasar siempre la rama de forma explícita.
- Para probar en el navegador sin intervención: `playwright-core` con el Chrome instalado (`C:/Program Files/Google/Chrome/Application/chrome.exe`), instalado en el scratchpad. En Git Bash, usar `MSYS_NO_PATHCONV=1` al pasar rutas como `/cuentas`.

- Probar la verificación facial con cámara de forma automática: Chrome con `--use-fake-device-for-media-stream --use-file-for-fake-video-capture=<foto>.y4m`. Los scripts del 28 de octubre (`facial-e2e.mjs`, `facial-http.mjs`, `calibrar.py`, `a_y4m.py`) estaban en el scratchpad de esa sesión.

Orden propuesto (entrega el 30 de octubre):
1. Que el usuario pruebe la pantalla 12 (movimiento de saldo) y el panel con gráficas en su navegador.
2. Opcional: dividir el bundle (carga diferida del panel o de Recharts) para quitar el aviso de 500 kB.
3. Si hay tiempo: detección de rostro en el navegador, `POST /usuarios` o el bloque F.
