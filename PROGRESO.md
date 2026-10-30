# Progreso de SolvIA

Última actualización: 2026-10-29. Entrega: viernes 30 de octubre de 2026 (antes era el 23). **La verificación facial (bloque D) es requisito de la entrega final.**

Plan acordado: A) base de datos · B) backend de negocio · C) frontend · D) microservicio facial y flujo completo (obligatorio) · E) dashboard con Recharts · F) reporte ejecutivo.

**Estado al cerrar el 29 de octubre:** los bloques A a F están implementados y en `main`. Solo falta que el usuario pruebe en su navegador el bloque F, el alta de usuarios y el panel con gráficas (ver "Siguiente paso").

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
- `POST /usuarios` (29 de octubre; `usuarios.service.ts`): el backend hace el mismo `sign-up/email` de Neon Auth (con `Origin` = primer valor de `FRONTEND_ORIGIN`) y luego inserta el perfil. Si el correo ya tiene identidad sin perfil, solo crea el perfil (`identidadNueva: false`, la contraseña se ignora); así un reintento no duplica la identidad. Correo de un usuario de SolvIA: 409 `DUPLICATE_IDENTIFIER`; Neon Auth caído: 503 `AUTH_SERVICE_UNAVAILABLE`. No usa la API de Neon (`/auth/users`), que crea usuarios sin contraseña. Documentado en `docs/openapi.yaml`.
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
  - Botón "Nuevo usuario" (`POST /usuarios`): nombre, correo, contraseña temporal (botón "Generar", 12 caracteres sin ambiguos) y rol. El aviso muestra la contraseña temporal una sola vez.
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
  - Colores de la paleta validada de la skill dataviz (azul `#2a78d6` y naranja `#eb6834`, marcas distintas: barra frente a línea). El texto va siempre en tinta neutra, nunca en el color de la serie.
- Recharts se descarga aparte, solo al dibujar las gráficas del panel (`React.lazy` + `Suspense`, con un marcador de la altura de cada gráfica). `MedidorPrioridad` vive en `comunes.jsx` porque no usa Recharts.
- `Panel.jsx` (administrador y gestor, cada uno con su alcance): tendencia de pagos, estado de la cartera con los saldos, morosidad por días de atraso, próximos vencimientos y prioridades. Las tablas de pagos y de morosidad quedan en un "Ver tabla" plegable bajo cada gráfica.
- La lista de cuentas ya se ordenaba por prioridad (`orden=prioridad`) desde el bloque C.

### Bloque F — Reportes ejecutivos con IA (29 de octubre)
Decisiones del usuario: el LLM es **Gemini** (`GEMINI_API_KEY` en el `.env`) y la conexión es **MCP real con herramientas**.
- **Servidor MCP** `BackEnd/src/reportes/mcp/servidor-solvia.ts` (`@modelcontextprotocol/sdk`): herramientas de solo lectura `listar_gestores`, `resumen_cartera` (periodo del reporte), `cuentas_prioritarias` (límite) y `cumplimiento_por_gestor`; las tres últimas aceptan `gestorId` (desde el 30 de octubre). No entrega nombres de deudores, solo referencias de cuenta. Vive en el proceso del backend y se conecta por `InMemoryTransport`, un servidor y un cliente por petición.
- **`reportes.service.ts`:**
  - `POST /reportes/previsualizaciones`: calcula el resumen y las prioridades con `PanelService` y pide el texto a Gemini con `mcpToTool(cliente)` (`@google/genai`, llamada automática a herramientas, máx. 8). Instrucciones: cuatro secciones fijas (`## Resumen ejecutivo`, `## Tendencias`, `## Riesgos`, `## Recomendaciones`), solo cifras de las herramientas y 350 palabras como máximo. No escribe en `reportes`.
  - Modelo `GEMINI_MODEL` (por defecto `gemini-3.5-flash`). Ante 503 o 429 reintenta una vez y luego usa `GEMINI_MODEL_RESPALDO` (por defecto `gemini-2.5-flash`). Si todo falla: 503 `LLM_UNAVAILABLE`.
  - `POST /reportes` (multipart, campo `pdf`): valida tipo, cabecera `%PDF-` y 10 MB como máximo (415 / 413 `PDF_TOO_LARGE`) y guarda el reporte y sus destinatarios en una transacción. Con `entregar=true` confirma la entrega en el mismo alta.
  - `GET /reportes`, `GET /reportes/{id}` y `GET /reportes/{id}/pdf`: el administrador ve todo; el gestor solo lo que se le entregó (lo demás, 404).
  - `POST /reportes/{id}/entregas`: confirma una sola vez (409 `DELIVERY_ALREADY_CONFIRMED`; un no destinatario da 422 `INVALID_RECIPIENT`).
  - `api-exception.filter.ts` traduce los mensajes de los triggers de reportes.
- **Frontend:**
  - `pages/Reportes.jsx` (pantalla 14, `/reportes`, ambos roles; enlace en la cabecera): lista con periodo, autor, destinatarios y estado de entrega, "Descargar PDF" y "Entregar" (pendientes).
  - `pages/NuevoReporte.jsx` (pantalla 15, `/reportes/nuevo`, solo administrador; botón "Generar reporte" en el panel): configurar (título, periodo, indicaciones para la IA, gestores destinatarios, confirmar entrega) → redactar con IA → revisar y editar el texto con las gráficas → generar el PDF y guardar.
  - `lib/pdfReporte.js`: PDF A4 con jsPDF (encabezado, indicadores, secciones del texto con viñetas, gráficas capturadas con html2canvas en JPEG, tabla de prioridades con jspdf-autotable y pie con número de página). jsPDF, autotable y html2canvas se cargan bajo demanda.
  - `api.js` acepta `archivo: true` para descargar un `Blob`.
- `docs/openapi.yaml`: rutas de reportes y esquemas `Reporte` y `ReporteDetalle`.

## En curso
- **Usuario temporal** `prueba.registro@solvia.demo` (rama `desarrollo`, sin perfil), creado al probar `sign-up`. **No borrarlo:** el usuario pidió conservarlo; sirve para probar el aviso de usuario sin perfil.
- **Datos modificados por las pruebas** (rama `desarrollo`; `npm run db:seed -- --reset` los elimina):
  - Cuenta 3 (SOL-003): pagos 29 (100.00, 26 oct) y de 50.00 (27 oct) de gestor1; saldo 4,850.00.
  - SOL-009 (sin gestor en el seed) quedó asignada a gestor1; el 27 de octubre se reasignó a gestor2 y de vuelta a gestor1 desde la interfaz.
  - Deudor 13 "Deudor Prueba Navegador" (RFC `DPN261027AB1`, Tlaxcala) con dos cuentas: la 15, SOL-015 (3,000.00 en 3 cuotas, de gestor2), y la 17, SOL-016 (2,500.50 en 3 cuotas de 833.50, de gestor1, creada desde la pantalla 9). El id 16 se consumió en un intento que dio 409.
  - El seed no conoce el deudor 13 ni la cuenta 15: `--reset` los borra porque vacía las tablas de negocio.

## Pendiente (prioridad para la demo)
1. **Probar el bloque F en el navegador:** redactar un borrador, guardar el PDF con destinatarios, entregar y descargarlo como gestor. Cada reporte guardado es **permanente** (inmutable) en `desarrollo`.
2. **Probar el alta de un usuario** desde la pantalla 13 (crea una identidad real en Neon Auth de `desarrollo`).
3. **Revisar el panel con datos reales** (bloque E) como administrador y como gestor.
4. ~~Detección de rostro en el navegador~~: hecha el 30 de octubre (MediaPipe, BlazeFace). Falta probarla con la cámara real.
5. ~~Verificación facial con cámara real~~ y ~~pantallas 12 y 13~~: probadas por el usuario. El 29 de octubre el administrador principal, gestor1 y gestor2 tienen rostro registrado; `admin@solvia.com` no.

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
| `GEMINI_API_KEY` | Clave de Gemini para redactar los reportes (bloque F) |
| `GEMINI_MODEL`, `GEMINI_MODEL_RESPALDO` | Opcionales; por defecto `gemini-3.5-flash` y `gemini-2.5-flash` |

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
  - Pantalla 12 probada por el usuario en su navegador el 29 de octubre.
- **`POST /usuarios` (29 de octubre):** `npm run lint` y `npm run build` del backend y del frontend, sin errores (`tsc` solo marca los specs viejos ya conocidos). El `sign-up` de Neon Auth con la URL y el `Origin` del backend respondió 400 `PASSWORD_TOO_SHORT` con una contraseña corta (no crea nada). La búsqueda por correo en `neon_auth."user"` responde en `desarrollo`.
  - **No verificado:** el alta completa (crea una identidad real en Neon Auth; la hace el usuario desde la pantalla 13) ni Redocly sobre el YAML (no está instalado localmente).
- **Bloque E (29 de octubre):** `npm run lint` y `npm run build`, sin errores ni avisos. Recharts se carga diferido (`lazy` en `Panel.jsx`): `Graficas` pesa 390 kB y el bundle principal 455 kB (antes 845 kB en uno solo, con el aviso de 500 kB).
  - Las cuatro gráficas se renderizaron con datos de ejemplo en una página temporal (ya borrada), con Chrome headless a 1280 y 390 px de ancho: sin errores de consola, tooltip correcto al pasar el cursor y etiquetas en tinta `#27313a`.
  - **No verificado:** el panel con datos reales en el navegador (necesita sesión con rostro).
- **Bloque F (29 de octubre):** backend (`tsc`, `npm run lint` y `npm run build`) y frontend (`npm run lint` y `npm run build`) sin errores; ningún archivo del bundle pasa de 500 kB.
  - Borrador real con el contexto Nest compilado (sin HTTP): en 21 s Gemini (`gemini-3.5-flash`) llamó por MCP a las tres herramientas y devolvió las cuatro secciones con cifras de la cartera.
  - Más tarde Google respondió 503 ("high demand") a los dos modelos: el reintento y el respaldo funcionaron y la API respondió 503 `LLM_UNAVAILABLE`.
  - PDF generado en Chrome headless con métricas reales: 2 páginas y 103 KB. Primero faltaban barras y líneas (html2canvas no resuelve los `clip-path` de Recharts; ahora se quitan en la copia capturada) y pesaba 4.6 MB en PNG (ahora es JPEG).
  - SQL de alta y entrega con los triggers reales, dentro de una transacción **revertida**: alta del reporte con el PDF de 105,533 bytes, destinatario gestor (1 fila), un administrador como destinatario es rechazado, entrega confirmada (1) y repetida rechazada, DELETE rechazado (inmutable) y el PDF leído de vuelta empieza con `%PDF-`. Después, la lista sigue vacía (0 reportes).
  - **No verificado:** el recorrido completo en el navegador con sesión (redactar, guardar, entregar y descargar como gestor) ni Redocly sobre el YAML.
- **Detección en el navegador (30 de octubre):** `npm run lint` y `npm run build` sin errores ni avisos. `Camara.jsx` en una página Vite temporal (ya borrada) con Chrome headless y cámara simulada (`.y4m`):
  - Un rostro de frente (Bradley Cooper): "Rostro detectado.", 1 recuadro verde y botón habilitado. La primera carga del WASM tardó unos 20 s; las siguientes, de 3 a 7 s.
  - Dos rostros cercanos (Cooper y Rudd): "Hay más de un rostro", 2 recuadros y botón deshabilitado.
  - Un rostro lejano: "Acércate un poco a la cámara." y botón deshabilitado.
  - Imagen sin personas: "No se detecta un rostro" y botón deshabilitado.
  - Foto grupal con caras de unos 30 px: no detecta ninguna (BlazeFace short range es para rostros cercanos) y bloquea la captura.
  - La consola solo mostró el aviso informativo de TensorFlow Lite (delegado XNNPACK) y el 404 del `favicon.ico` de la página de prueba.
  - **No verificado:** con la cámara real del usuario.
- **Alcance de reportes (30 de octubre):** backend (`tsc`, `npm run lint` y `npm run build`) y frontend (`npm run lint` y `npm run build`) sin errores. Con Gemini real, sin HTTP (no escribe en la base):
  - Indicaciones "Concéntrate solo en el Gestor Uno" sin alcance fijo: el LLM llamó a `listar_gestores` y a las herramientas con el id de gestor1; `alcance.origen = indicaciones`; gráficas con 9 cuentas (antes 16), tabla solo de Gestor Uno y el texto no menciona a Gestor Dos.
  - Alcance fijo gestor2: 7 cuentas y tabla solo de Gestor Dos aunque las indicaciones pidieran Gestor Uno. En esa prueba el texto aún llamaba "Gestor Uno" a los datos de gestor2: ahora el LLM recibe el nombre del gestor fijado y la orden de ignorar a otros gestores. Repetida la prueba: el texto habla de "Gestor Dos (demo)" y no menciona a Gestor Uno.
  - Sin indicaciones: toda la cartera (16 cuentas, ambos gestores en la tabla).
  - `alcanceConsultado()` con bitácoras simuladas: sin consultas → cartera; cartera + gestor1 → gestor1; gestor1 y gestor2 → cartera; fijo gestor2 → gestor2; solo `cumplimiento_por_gestor` → cartera.
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
- **Alta de usuarios** (29 de octubre, decisión del usuario): el administrador crea identidad y perfil desde la pantalla 13 con contraseña temporal, en lugar de vincular solo identidades existentes.
- **Reportes** (29 de octubre): el PDF lo arma el navegador con jsPDF (como pide `definicion_proyecto.md`) y el backend lo valida y lo guarda en `reportes.archivo_pdf` (como pide el contrato). La previsualización no se guarda en el servidor: el borrador vive en la pantalla hasta que se guarda el PDF; el backend no vuelve a comprobar que las cifras del PDF coincidan con la base.
- **LLM vía MCP:** el servidor MCP está dentro del backend (transporte en memoria), no es un proceso aparte. Gemini decide qué herramientas llamar; el backend registra cuáles usó (`herramientasConsultadas`).
- **Índice de morosidad** (27 de octubre): cuentas atrasadas entre cuentas vigentes (sin liquidar), igual que "Al corriente". Antes dividía entre todas las cuentas. Cambiado en `panel.service.ts` y en `docs/openapi.yaml`.
- **Seed:** `--reset` es opt-in y nunca toca `perfiles_usuario` ni `neon_auth`.

### Detección de rostros en el navegador (30 de octubre)
Lo pedía `docs/definicion_proyecto.md` (componente de IA del frontend) y faltaba: antes solo detectaba el microservicio.
- `@mediapipe/tasks-vision` 1.2.0, MediaPipe Face Detector con **BlazeFace short range**. El modelo oficial (`blaze_face_short_range.tflite`, 230 KB, Apache 2.0) está en `FrontEnd/public/models/` para no depender de un CDN; el WASM (14 MB) lo empaqueta Vite con `?url` y solo se descarga en las pantallas con cámara.
- `src/lib/detectorRostro.js`: un detector por sesión (`runningMode: VIDEO`, confianza 0.6). Estados: `sin_rostro`, `varios`, `lejos` (rostro de menos de 110 px de ancho, con margen sobre los 80 px que exige el microservicio) y `listo`.
- `components/Camara.jsx`: evalúa unas 10 veces por segundo, dibuja el recuadro de cada rostro (en espejo, como el video; verde cuando es válido) y muestra la indicación. `onEstado(true)`, y por tanto el botón de captura, solo con un rostro válido. Si el detector no carga, la captura sigue habilitada y valida el microservicio. Sirve a `/registro-facial`, `/verifica-rostro` y `/configuracion-facial`.
- El detector se carga con `import()`: no entra en el bundle principal.

### Diagramas para los manuales (30 de octubre)
En `.archify/<tipo>-<nombre>-<fecha>/`, cada uno como HTML interactivo (archify, con tarjetas explicativas y fuentes citadas del commit `d35dad7`) y PNG exportado desde el visor:
- Manual técnico: `architecture-sistemas-inteligentes` (cómo se relacionan visión por computadora, LLM vía MCP y la prueba facial), `architecture-componentes-ia`, `sequence-verificacion-facial`, `dataflow-pipeline-facial`, `lifecycle-sesion-facial` y `sequence-reporte-mcp`.
- Manual de usuario: `workflow-acceso-facial-usuario` y `workflow-reporte-ia-usuario`.
- Todos pasaron las comprobaciones automáticas de archify (validación, entrega y navegador). Los archivos de trabajo (candidatos JSON y recibos) se borraron; para editar un diagrama hay que regenerar su candidato.

### Alcance de los reportes (30 de octubre)
El usuario detectó que, al pedir en las indicaciones "concéntrate en el Gestor Uno", el texto cambiaba pero las gráficas y la tabla seguían siendo de toda la cartera (con Gestor Dos). Causa: `previsualizar()` calculaba `resumen` y `prioridades` con `PanelService` para toda la cartera, independientemente de lo que consultara el LLM, y las herramientas MCP no aceptaban un gestor.
- Las herramientas MCP aceptan `gestorId` y anotan en una bitácora qué consultó el LLM. `alcanceConsultado()` decide el alcance: el fijado por el administrador o, si no, el único gestor cuyos indicadores (`resumen_cartera`, `cuentas_prioritarias`) consultó el LLM, aunque también haya pedido la cartera completa; si comparó varios gestores, toda la cartera.
- `resumen` y `prioridades` se calculan **después** de redactar, con ese alcance (`vistaDe()` usa la misma vista que el panel de ese gestor). La respuesta incluye `alcance: { gestor, origen: seleccion | indicaciones | cartera }`.
- `gestorId` opcional en `POST /reportes/previsualizaciones` (selector "Alcance" de la pantalla 15, como en el wireframe): las herramientas ignoran cualquier otro gestor y el LLM recibe el nombre del gestor. Un gestor inexistente o inactivo da 422 `INVALID_SCOPE`.
- Pantalla 15: muestra el alcance y su origen en la vista previa; con alcance de un gestor, los destinatarios se preseleccionan con ese gestor. El PDF lleva una línea "Alcance" en el encabezado.

## Problemas conocidos
- **Cuota de Gemini:** el 30 de octubre a medianoche `gemini-3.5-flash` respondió 429 (límite de peticiones) tras varias pruebas seguidas; el reintento pasó a `gemini-2.5-flash`, que sí respondió. Evitar ráfagas de pruebas antes de la demo.
- **Gemini saturado:** el 29 de octubre por la noche Google respondió 503 "high demand" a `gemini-3.5-flash` y a `gemini-2.5-flash`. La pantalla 15 muestra "El modelo de lenguaje no respondió"; hay que esperar unos minutos o cambiar `GEMINI_MODEL` / `GEMINI_MODEL_RESPALDO` en el `.env` (la clave da acceso, entre otros, a `gemini-flash-latest`, `gemini-3.8-flash` y `gemini-2.5-pro`).
- **Reportes permanentes:** un trigger impide UPDATE y DELETE en `reportes`; cada prueba que guarde un PDF deja un registro definitivo en `desarrollo` (solo `npm run db:seed -- --reset` vacía las tablas de negocio). Para probar el SQL sin dejar rastro, usar una transacción revertida (así se hizo el 29 de octubre).
- **Avisos de npm:** `npm install` avisa que bloqueó los scripts de `core-js` y `protobufjs` (allowScripts); no afectan el funcionamiento.
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

**Al retomar la sesión (30 de octubre, día de la entrega):**
- `git status` debería estar limpio salvo `.env`.
- El usuario suele tener corriendo su backend (puerto 3000, `dist/main`) y su Vite (5173). No detenerlos; un cambio en el backend requiere que el usuario lo reinicie.
- La contraseña demo común no está en el repositorio: pedirla al usuario si hace falta probar por HTTP.
- Neon: proyecto `aged-paper-03532903`, rama `desarrollo` = `br-bold-dust-b4aymjsk`. La rama por defecto es `production` (`br-soft-frost-b4rpx0vq`): pasar siempre la rama de forma explícita.
- Para probar en el navegador sin intervención: `playwright-core` con el Chrome instalado (`C:/Program Files/Google/Chrome/Application/chrome.exe`), instalado en el scratchpad. En Git Bash, usar `MSYS_NO_PATHCONV=1` al pasar rutas como `/cuentas`.

- Probar la verificación facial con cámara de forma automática: Chrome con `--use-fake-device-for-media-stream --use-file-for-fake-video-capture=<foto>.y4m`. Los scripts del 28 de octubre (`facial-e2e.mjs`, `facial-http.mjs`, `calibrar.py`, `a_y4m.py`) estaban en el scratchpad de esa sesión.
- Probar el backend sin HTTP ni rostro: `NestFactory.createApplicationContext(AppModule)` sobre `BackEnd/dist` y llamar al servicio con un `UsuarioActual` armado a mano (administrador principal `91a21c17-e691-482d-91c6-77e2cd3b903f`, gestor1 `9796da71-af00-44ce-9ffc-b2b895754078`). Los scripts del 29 de octubre (`borrador2.mjs`: borrador con Gemini; `borrador-sin-llm.mjs`; `reporte-sql.mjs`: SQL en transacción revertida; `pdf.mjs` + página Vite temporal: PDF en Chrome headless) estaban en el scratchpad de esa sesión.
- Para revisar gráficas o el PDF sin sesión: una página Vite temporal dentro de `FrontEnd/` (`npx vite <carpeta> --port 51xx`) que importe los componentes; borrarla al terminar.

Orden propuesto para el 30 de octubre:
1. **El usuario prueba en su navegador** (reiniciar antes el backend si corre desde `dist/main`):
   - Pantalla 15 como administrador: redactar el borrador con IA, editarlo, generar el PDF con gestor1 como destinatario y "Confirmar la entrega al generar".
   - Pantalla 14: el administrador ve el reporte entregado; gestor1 lo ve y descarga el PDF; gestor2 no lo ve.
   - Pantalla 13: alta de un usuario de prueba (crea una cuenta real en Neon Auth de `desarrollo`); al entrar debe pedir el registro facial.
   - Panel con gráficas como administrador y como gestor.
2. Corregir lo que salga de esas pruebas y actualizar este archivo.
3. Si hay tiempo: detección de rostro en el navegador antes de enviar la captura.
