# ai-service — reconocimiento facial (SolvIA)

Microservicio FastAPI que extrae embeddings faciales y verifica identidad por
similitud coseno contra los embeddings registrados.

Modelo: **facenet-pytorch** — MTCNN (detección + alineación) + InceptionResnetV1
(embedding de 512-d, pesos `vggface2`). No requiere compilador ni Build Tools.

## Setup

```bash
cd services/ai-service
python -m venv venv
venv\Scripts\activate            # Windows
pip install -r requirements.txt
copy .env.example .env           # Windows  (cp en bash)
```

La primera ejecución descarga los pesos del modelo (~110 MB) a la cache de torch
(`C:\Users\<user>\.cache\torch`). Necesitas conexión esa primera vez.

## Ejecutar

```bash
uvicorn app.main:app --reload --port 8000
# Swagger: http://localhost:8000/docs
```

## Orden sugerido de implementación (ver hitos)

| Archivo | Hito | Qué llenar |
|---|---|---|
| `scripts/probe.py` | 1 | correrlo con 3 fotos, entender la salida |
| `app/face_engine.py` | 1-2 | `normalize`, `extract_embedding` |
| `app/matcher.py` | 2-4 | `cosine_sim`, `best_score`, `verify`, `identify` |
| — | 3 | calibrar `MATCH_THRESHOLD` con fotos del equipo (FAR/FRR) |
| `app/store.py` | 5 | persistencia `.npz` (luego pgvector) |
| `app/main.py` | 6-7 | endpoints + mapeo de errores a HTTP |

## Endpoints

- `GET  /health`
- `POST /enroll`   — `{ user_id, images: [base64] }`
- `POST /verify`   — `{ user_id, image: base64 }` → `{ match, score }`  (login 1:1)
- `POST /identify` — `{ image: base64 }` → `{ user_id, score }`  (1:N, opcional)
