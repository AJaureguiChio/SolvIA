# SolvIA — Sistema Inteligente de Verificación y Seguimiento de Cumplimiento de Pagos

Proyecto académico para la materia de **Temas Selectos de Sistemas Inteligentes**. Aplicación web para el análisis del cumplimiento de planes de pago de deudores, con dashboard estadístico, login mediante reconocimiento facial y generación automática de reportes ejecutivos en PDF usando IA.

📄 Documento completo de definición del proyecto: [`docs/definicion_proyecto.md`](./docs/definicion_proyecto.md)

---

## Estructura del repositorio

Este es un **monorepo**: un solo repositorio con una carpeta por componente.

```
solvia/
├── frontend/          # Aplicación en React (Vite) — dashboard y login facial
├── backend/           # API en NestJS — lógica de negocio, autenticación, DB
├── services/           # Microservicios (actualmente solo ai-service)
│   └── ai-service/      # Python (FastAPI) — reconocimiento facial
├── docs/               # Documentación del proyecto (definición, diagramas, etc.)
├── .gitignore          # Reglas combinadas (Node + Python) para todo el repo
└── README.md
```

---

## Tecnologías

| Componente | Tecnología |
|------------|------------|
| Frontend | React + Vite |
| Backend / API | NestJS + Prisma |
| Base de datos | PostgreSQL |
| Microservicio de IA | Python + FastAPI + DeepFace/OpenCV |
| Generación de reportes | MCP + LLM (Node.js) + jsPDF/jspdf-autotable (frontend) |

---

## Requisitos previos

- [Node.js](https://nodejs.org/) v20 o superior
- [Python](https://www.python.org/) 3.10 o superior
- [PostgreSQL](https://www.postgresql.org/) (local o una instancia en la nube, ej. [Neon](https://neon.tech) / [Supabase](https://supabase.com))

---

## Cómo levantar el proyecto en local

Cada servicio se corre en su propia terminal.

### 1. Frontend

```bash
cd frontend
npm install
npm run dev
```

Disponible en `http://localhost:5173`

### 2. Backend

```bash
cd backend
npm install
npm run start:dev
```

Disponible en `http://localhost:3000`

### 3. Microservicio de IA (Python)

```bash
cd services/ai-service
python -m venv venv
source venv/bin/activate      # en Windows: venv\Scripts\activate
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```

Disponible en `http://localhost:8000`

---

## Variables de entorno

Cada carpeta tiene su propio `.env` (no se sube al repo — usar `.env.example` como referencia).

**backend/.env**
```
DATABASE_URL=postgresql://usuario:password@localhost:5432/solvia
AI_SERVICE_URL=http://localhost:8000
JWT_SECRET=cambiar_este_valor
```

**services/ai-service/.env**
```
PORT=8000
```

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

Proyecto en desarrollo del **7 de septiembre al 13 de noviembre** (sin actividades del 22 de septiembre al 2 de octubre por exámenes parciales). Cronograma detallado por semana en [`docs/definicion_proyecto.md`](./docs/definicion_proyecto.md).