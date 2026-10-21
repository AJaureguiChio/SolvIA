"""
FastAPI: wiring de endpoints.  (Hito 6)

La logica de IA vive en face_engine / matcher / store. Aqui solo:
  - decodificar entrada
  - traducir excepciones de dominio a codigos HTTP claros (Hito 7)
  - orquestar
"""

from __future__ import annotations

from contextlib import asynccontextmanager

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware

from . import face_engine, matcher, store
from .config import settings
from .schemas import (
    EnrollRequest,
    EnrollResponse,
    IdentifyRequest,
    IdentifyResponse,
    VerifyRequest,
    VerifyResponse,
)


@asynccontextmanager
async def lifespan(app: FastAPI):
    face_engine.get_model()   # carga/descarga el modelo al arrancar, no en el 1er request
    store.load()
    yield


app = FastAPI(title="SolvIA - AI face service", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health")
def health() -> dict:
    return {"status": "ok", "model": f"facenet-pytorch/{settings.pretrained}"}


@app.post("/enroll", response_model=EnrollResponse)
def enroll(req: EnrollRequest) -> EnrollResponse:
    """Registra k imágenes de un usuario extrayendo y almacenando sus embeddings."""
    embeddings = []
    reasons = []

    for idx, img_b64 in enumerate(req.images):
        try:
            bgr = face_engine.decode_image(img_b64)
            detected = face_engine.extract_embedding(bgr)
            embeddings.append(detected.embedding)
        except face_engine.NoFaceError:
            reasons.append(f"Foto {idx + 1}: No se detectó ningún rostro.")
        except face_engine.MultipleFacesError:
            reasons.append(f"Foto {idx + 1}: Múltiples rostros detectados.")
        except face_engine.LowQualityError:
            reasons.append(f"Foto {idx + 1}: Calidad o tamaño de rostro insuficiente.")
        except ValueError as exc:
            reasons.append(f"Foto {idx + 1}: Formato base64/imagen inválido ({exc}).")
        except Exception as exc:
            reasons.append(f"Foto {idx + 1}: Error inesperado ({exc}).")

    accepted = len(embeddings)
    rejected = len(reasons)

    if accepted == 0:
        raise HTTPException(
            status_code=422,
            detail=f"No se pudo registrar ningún rostro válido: {'; '.join(reasons)}",
        )

    store.add(req.user_id, embeddings)
    return EnrollResponse(
        user_id=req.user_id,
        accepted=accepted,
        rejected=rejected,
        reasons=reasons,
    )


@app.post("/verify", response_model=VerifyResponse)
def verify(req: VerifyRequest) -> VerifyResponse:
    """Verifica 1:1 la identidad del usuario contra su galería registrada."""
    gallery = store.get(req.user_id)
    if not gallery:
        raise HTTPException(
            status_code=404,
            detail=f"El usuario '{req.user_id}' no tiene biometría registrada.",
        )

    try:
        bgr = face_engine.decode_image(req.image)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=f"Imagen o base64 inválido: {exc}")

    try:
        face = face_engine.extract_embedding(bgr)
    except face_engine.NoFaceError:
        raise HTTPException(status_code=422, detail="No se detectó ningún rostro en la imagen.")
    except face_engine.MultipleFacesError:
        raise HTTPException(status_code=422, detail="Se detectaron múltiples rostros; se requiere solo uno.")
    except face_engine.LowQualityError:
        raise HTTPException(status_code=422, detail="Rostro de baja calidad o muy pequeño.")
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Error en extracción biométrica: {exc}")

    match, score = matcher.verify(face.embedding, gallery)
    return VerifyResponse(match=match, score=score)


@app.post("/identify", response_model=IdentifyResponse)
def identify(req: IdentifyRequest) -> IdentifyResponse:
    """Identificación biométrica 1:N sobre todos los usuarios registrados."""
    users = store.all_users()
    if not users:
        raise HTTPException(status_code=404, detail="No hay usuarios registrados en el sistema.")

    try:
        bgr = face_engine.decode_image(req.image)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=f"Imagen o base64 inválido: {exc}")

    try:
        face = face_engine.extract_embedding(bgr)
    except face_engine.NoFaceError:
        raise HTTPException(status_code=422, detail="No se detectó ningún rostro en la imagen.")
    except face_engine.MultipleFacesError:
        raise HTTPException(status_code=422, detail="Se detectaron múltiples rostros.")
    except face_engine.LowQualityError:
        raise HTTPException(status_code=422, detail="Rostro de baja calidad o muy pequeño.")
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Error en extracción biométrica: {exc}")

    user_id, score = matcher.identify(face.embedding, users)
    return IdentifyResponse(user_id=user_id, score=score)

