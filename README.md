# SolvIA — Sistema Inteligente de Verificación y Seguimiento de Cumplimiento de Pagos

Proyecto académico para la materia de **Temas Selectos de Sistemas Inteligentes**. Aplicación web para dar seguimiento al cumplimiento de los planes de pago de una cartera de deudores. Incluye un panel estadístico, verificación facial obligatoria y reportes ejecutivos en PDF que redacta un LLM.

📄 Definición del proyecto: [`docs/definicion_proyecto.md`](./docs/definicion_proyecto.md) · Estado y bitácora de avance: [`PROGRESO.md`](./PROGRESO.md)

---

## Funcionalidades

- **Acceso en dos pasos:** inicio de sesión con Neon Auth y, después, verificación facial **obligatoria para todos los usuarios**. Quien aún no tiene rostro lo registra en su primer acceso. Sin una prueba facial vigente, la API responde 401 `FACE_VERIFICATION_REQUIRED`.
- **Roles:** administrador y gestor. El gestor solo ve sus cuentas y deudores; pedir un recurso ajeno da 404.
- **Cartera:** deudores, cuentas con plan de cuotas, pagos, movimientos de saldo (recargos, intereses, descuentos, reembolsos y reversiones) e historial de asignaciones.
- **Panel:** indicadores, pagos por mes frente a lo esperado, estado de la cartera, morosidad por días de atraso, próximos vencimientos y ranking de prioridad de cobro (Recharts).
- **Reportes ejecutivos con IA:** Gemini consulta las métricas por **MCP** (herramientas de solo lectura, sin datos personales de deudores) y redacta el texto. El navegador arma el PDF con las gráficas y la tabla, y el backend lo guarda de forma inmutable y registra su entrega a los gestores.
- **Gestión de usuarios:** alta (identidad en Neon Auth + perfil), cambio de rol, activación y restablecimiento del rostro.

### Componentes de IA

| Componente | Dónde | Qué hace |
|---|---|---|
| Detección de rostro en el navegador | `FrontEnd/src/lib/detectorRostro.js` | MediaPipe Face Detector (BlazeFace short range) guía la captura: un solo rostro y cerca de la cámara |
| Reconocimiento facial | `Services/ai-service/main.py` | MTCNN detecta el rostro e Inception-ResNet-v1 (VGGFace2) extrae un embedding de 512 dimensiones; coincide si la similitud coseno es ≥ 0.60 |
| Redacción de reportes | `BackEnd/src/reportes/` | Gemini, con llamada automática a las herramientas del servidor MCP `servidor-solvia.ts` |

Los diagramas de arquitectura, secuencia y flujo para los manuales están en [`.archify/`](./.archify) (HTML interactivo y PNG).

---

## Estructura del repositorio

```
Solvia/
├── BackEnd/              # API NestJS (/api/v1): negocio, autenticación, facial, reportes y servidor MCP
│   ├── src/              # un módulo por recurso (deudores, cuentas, pagos, panel, reportes, facial…)
│   └── scripts/db.mjs    # migraciones y datos de demostración
├── FrontEnd/             # React 19 + Vite: pantallas, cámara, gráficas y PDF
├── Services/
│   └── ai-service/       # Microservicio Python (FastAPI) de reconocimiento facial
├── db/
│   ├── migrations/       # SQL incremental (zona horaria, tablas faciales)
│   └── seed/demo.sql     # 12 deudores y 14 cuentas ficticias
├── docs/                 # definición, esquema, contrato de API, OpenAPI, wireframes
├── .archify/             # diagramas para los manuales
├── .env.example          # plantilla de variables de entorno
├── neon.ts               # configuración del proyecto Neon
├── package.json          # scripts para arrancar cada módulo desde la raíz
├── AGENTS.md             # reglas de trabajo del proyecto
└── PROGRESO.md           # avance, verificación y problemas conocidos
```

---

## Tecnologías

| Componente | Tecnología |
|------------|------------|
| Frontend | React 19, Vite 8, React Router 8, Recharts, MediaPipe Tasks Vision, jsPDF + jspdf-autotable + html2canvas |
| Backend / API | NestJS 12, `pg` (SQL directo, sin ORM), `jose`, class-validator |
| Autenticación | Neon Auth (Better Auth, JWT) + cookie de prueba facial `solvia_face` |
| Base de datos | PostgreSQL en Neon (reglas de negocio en triggers) |
| Microservicio de IA | Python 3.14, FastAPI, PyTorch (CPU), facenet-pytorch |
| Reportes | Gemini (`@google/genai`) + Model Context Protocol (`@modelcontextprotocol/sdk`) |

---

## Requisitos previos

- [Node.js](https://nodejs.org/) v20 o superior
- [Python](https://www.python.org/) 3.14 (probado con esa versión)
- Un proyecto en [Neon](https://neon.tech) con Neon Auth y una rama `desarrollo`
- Una clave de la API de Gemini
- Navegador con cámara; `getUserMedia` solo funciona en `localhost` o HTTPS

---

## Variables de entorno

Todas las variables van en un único `.env` en la **raíz** del repositorio (no se versiona). El backend, el microservicio y Vite (`envDir: '..'`) lo leen de ahí. Parte de la plantilla [`.env.example`](./.env.example), que incluye los comandos para generar las claves aleatorias:

```bash
cp .env.example .env
```

| Variable | Uso |
|---|---|
| `DATABASE_URL` | Conexión con pooler (backend) |
| `DATABASE_URL_UNPOOLED` | Conexión directa (migraciones y seed) |
| `NEON_BRANCH` | Debe valer `desarrollo` para migrar o sembrar |
| `NEON_AUTH_BASE_URL`, `NEON_AUTH_JWKS_URL` | Emisor y JWKS del JWT de Neon Auth |
| `FRONTEND_ORIGIN` | Orígenes de CORS separados por comas (por defecto `http://localhost:5173`) |
| `VITE_NEON_AUTH_URL` | URL de Neon Auth para el navegador |
| `VITE_API_URL` | URL de la API (por defecto `http://localhost:3000/api/v1`) |
| `PORT` | Puerto del backend (por defecto 3000) |
| `AI_SERVICE_URL` | URL del microservicio facial (`http://localhost:8000`) |
| `AI_INTERNAL_KEY` | Clave compartida backend ↔ microservicio (header `X-Internal-Key`) |
| `FACE_GALLERY_KEY` | Clave AES-256 (32 bytes en base64) de las galerías faciales |
| `FACE_JWT_SECRET` | Firma de la cookie `solvia_face` |
| `FACE_THRESHOLD`, `FACE_MIN_SIZE` | Opcionales del microservicio (0.60 y 80 px) |
| `FACE_COOKIE_SECURE` | Opcional; `true` para `SameSite=None; Secure` con dominios distintos |
| `GEMINI_API_KEY` | Clave de Gemini para redactar los reportes |
| `GEMINI_MODEL`, `GEMINI_MODEL_RESPALDO` | Opcionales; por defecto `gemini-3.5-flash` y `gemini-2.5-flash` |
| `AWS_*` | Reservadas para almacenamiento; el código aún no las usa |

> Si se pierde `FACE_GALLERY_KEY`, las galerías guardadas no se pueden descifrar y cada usuario tiene que volver a registrar su rostro.

---

## Cómo levantar el proyecto en local

### 1. Instalación

```bash
# Backend
cd BackEnd
npm install

# Frontend
cd ../FrontEnd
npm install

# Microservicio facial
cd ../Services/ai-service
python -m venv venv
venv\Scripts\python -m pip install torch torchvision --index-url https://download.pytorch.org/whl/cpu
venv\Scripts\python -m pip install facenet-pytorch==2.6.0 --no-deps
venv\Scripts\python -m pip install -r requirements.txt
```

facenet-pytorch fija `torch<2.3`, por eso se instala con `--no-deps`; funciona con el torch reciente. La primera vez que arranca, el microservicio descarga los pesos de VGGFace2 (107 MB). En macOS o Linux, cambia `venv\Scripts\python` por `venv/bin/python`.

### 2. Base de datos (rama `desarrollo`)

El esquema base está en [`docs/SolvIA_esquema_final.sql`](./docs/SolvIA_esquema_final.sql). Sobre él se aplican las migraciones y los datos de demostración:

```bash
cd BackEnd
npm run db:migrate             # aplica db/migrations/*.sql pendientes
npm run db:seed                # carga la demo; se niega si ya hay datos
npm run db:seed -- --reset     # vacía las tablas de negocio y vuelve a sembrar
```

Los scripts se niegan a correr si `NEON_BRANCH` no es `desarrollo`. `--reset` nunca toca `perfiles_usuario` ni `neon_auth`.

### 3. Arranque

Desde la raíz, cada módulo en su propia consola:

```bash
npm run dev:backend      # NestJS en modo watch → http://localhost:3000/api/v1
npm run dev:frontend     # Vite → http://localhost:5173
npm run dev:ai-service   # FastAPI → http://localhost:8000 (requiere el venv)
```

**Sin el microservicio nadie puede entrar**, porque la verificación facial es obligatoria. Hay que levantarlo junto con el backend.

### 4. Comprobaciones

```bash
cd BackEnd  && npm run lint && npm run build
cd FrontEnd && npm run lint && npm run build
```

---

## Documentación

| Documento | Contenido |
|---|---|
| [`docs/definicion_proyecto.md`](./docs/definicion_proyecto.md) | Objetivos, alcance, roles del equipo y cronograma |
| [`docs/SolvIA_esquema_final.sql`](./docs/SolvIA_esquema_final.sql) · [`docs/SolvIA_explicacion_base_de_datos.md`](./docs/SolvIA_explicacion_base_de_datos.md) | Esquema de la base y su explicación |
| [`docs/SolvIA_contrato_API_v1.md`](./docs/SolvIA_contrato_API_v1.md) | Contrato vigente de la API (camelCase); `contrato_api.md` es la versión anterior |
| [`docs/openapi.yaml`](./docs/openapi.yaml) | OpenAPI 3.0.3 de la API de SolvIA |
| [`docs/openapi-neon-auth.yaml`](./docs/openapi-neon-auth.yaml) | Rutas de Neon Auth (sign-up, sign-in, sesión, token) |
| [`docs/SolvIA_mapa_funcional_y_pantallas.md`](./docs/SolvIA_mapa_funcional_y_pantallas.md) · [`docs/SolvIA_wireframes.html`](./docs/SolvIA_wireframes.html) | Pantallas y wireframes que sigue la interfaz |

Los wireframes y el mapa funcional todavía llaman opcional a la verificación facial. Desde el 28 de octubre es obligatoria.

---

## Equipo

| Integrante | Rol |
|------------|-----|
| Diego Asael Hernández Cardona | Líder de proyecto / Microservicio Python |
| Alberto Jairzinho Jáuregui Chio | FullStack (NestJS + React) |
| Rubén Mario Lozano Aguilera | Frontend / UX |
| Claudio Jesús Robles Mendo | IA - Reconocimiento facial |
| Josué Alejandro Lara Maldonado | IA - Generación de reportes |
| Juan Daniel Carrillo López | QA / Documentación |

Detalle completo de roles y responsabilidades en [`docs/definicion_proyecto.md`](./docs/definicion_proyecto.md).

---

## Cronograma

Proyecto en desarrollo del **7 de septiembre al 13 de noviembre** (sin actividades del 22 de septiembre al 2 de octubre por exámenes parciales). Cronograma detallado por semana en [`docs/definicion_proyecto.md`](./docs/definicion_proyecto.md); el avance real está en [`PROGRESO.md`](./PROGRESO.md).
