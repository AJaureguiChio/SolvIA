"""Microservicio facial de SolvIA.

Detecta el rostro con MTCNN y extrae un embedding de 512 dimensiones con
Inception-ResNet-v1 preentrenada en VGGFace2 (facenet-pytorch). No guarda
nada: NestJS conserva la galería cifrada y la envía al verificar.

Rutas:
  GET  /health   estado y modelo cargado.
  POST /enroll   captura -> embedding normalizado (para la galería).
  POST /verify   captura + galería -> coincide o no, con la mejor similitud.

Todas salvo /health exigen el header X-Internal-Key = AI_INTERNAL_KEY.
"""

import io
import json
import os
import secrets
from contextlib import asynccontextmanager

import numpy as np
import torch
from facenet_pytorch import MTCNN, InceptionResnetV1
from fastapi import Depends, FastAPI, File, Form, Header, HTTPException, UploadFile
from PIL import Image, ImageOps, UnidentifiedImageError


def cargar_env(ruta: str) -> None:
    """Lee el .env de la raíz del repositorio; las variables ya definidas tienen prioridad."""
    if not os.path.exists(ruta):
        return
    with open(ruta, encoding="utf-8") as archivo:
        for linea in archivo:
            clave, separador, valor = linea.strip().partition("=")
            if separador and clave and not clave.startswith("#"):
                os.environ.setdefault(clave.strip(), valor.strip().strip("\"'"))


cargar_env(os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "..", ".env"))

MODELO = "facenet-vggface2"
DIMENSION = 512
# Similitud coseno mínima para aceptar la identidad (embeddings normalizados).
# Calibrado con fotos de prueba: misma persona 0.68-0.74, personas distintas hasta 0.54.
UMBRAL = float(os.environ.get("FACE_THRESHOLD", "0.60"))
# Lado mínimo del rostro detectado, en píxeles, y probabilidad mínima de MTCNN.
ROSTRO_MINIMO = int(os.environ.get("FACE_MIN_SIZE", "80"))
PROBABILIDAD_MINIMA = 0.90
MAX_BYTES = 5 * 1024 * 1024
CLAVE_INTERNA = os.environ.get("AI_INTERNAL_KEY", "")

modelos: dict = {}


@asynccontextmanager
async def ciclo_de_vida(_app: FastAPI):
    torch.set_grad_enabled(False)
    # keep_all para detectar y rechazar capturas con varios rostros.
    modelos["detector"] = MTCNN(image_size=160, margin=20, keep_all=True, post_process=True, device="cpu")
    modelos["red"] = InceptionResnetV1(pretrained="vggface2").eval()
    yield
    modelos.clear()


app = FastAPI(title="SolvIA ai-service", version="1.0.0", lifespan=ciclo_de_vida)


def error(status: int, code: str, message: str):
    return HTTPException(status_code=status, detail={"code": code, "message": message})


def exigir_clave(x_internal_key: str = Header(default="")):
    if not CLAVE_INTERNA or not secrets.compare_digest(x_internal_key, CLAVE_INTERNA):
        raise error(401, "UNAUTHORIZED", "Clave interna inválida")


async def leer_imagen(captura: UploadFile) -> Image.Image:
    datos = await captura.read(MAX_BYTES + 1)
    if len(datos) > MAX_BYTES:
        raise error(413, "IMAGEN_GRANDE", "La captura supera 5 MB")
    try:
        imagen = Image.open(io.BytesIO(datos))
        # Respeta la orientación EXIF de las fotos de teléfono.
        return ImageOps.exif_transpose(imagen).convert("RGB")
    except (UnidentifiedImageError, OSError):
        raise error(400, "IMAGEN_INVALIDA", "La captura no es una imagen válida")


def embedding(imagen: Image.Image) -> np.ndarray:
    """Devuelve el embedding normalizado del único rostro de la imagen."""
    cajas, probabilidades = modelos["detector"].detect(imagen)
    if cajas is None:
        raise error(422, "sin_rostro", "No se detectó un rostro")
    validas = [i for i, p in enumerate(probabilidades) if p is not None and p >= PROBABILIDAD_MINIMA]
    if not validas:
        raise error(422, "sin_rostro", "No se detectó un rostro con claridad")
    if len(validas) > 1:
        raise error(422, "multiples_rostros", "Hay más de un rostro en la captura")

    caja = cajas[validas[0]]
    if min(caja[2] - caja[0], caja[3] - caja[1]) < ROSTRO_MINIMO:
        raise error(422, "rostro_pequeno", "Acércate a la cámara")

    rostro = modelos["detector"].extract(imagen, cajas[validas[:1]], None)
    vector = modelos["red"](rostro)[0].numpy()
    return vector / np.linalg.norm(vector)


@app.get("/health")
def health():
    return {"status": "ok" if modelos else "cargando", "modelo": MODELO, "dimension": DIMENSION, "umbral": UMBRAL}


@app.post("/enroll", dependencies=[Depends(exigir_clave)])
async def enroll(captura: UploadFile = File(...)):
    vector = embedding(await leer_imagen(captura))
    return {"modelo": MODELO, "dimension": DIMENSION, "embedding": vector.round(6).tolist()}


@app.post("/verify", dependencies=[Depends(exigir_clave)])
async def verify(captura: UploadFile = File(...), galeria: str = Form(...)):
    try:
        vectores = np.asarray(json.loads(galeria), dtype=np.float32)
    except (ValueError, TypeError):
        raise error(400, "GALERIA_INVALIDA", "La galería no es una lista de vectores")
    if vectores.ndim != 2 or vectores.shape[1] != DIMENSION or not 1 <= len(vectores) <= 10:
        raise error(400, "GALERIA_INVALIDA", f"Se esperaban de 1 a 10 vectores de {DIMENSION}")

    vector = embedding(await leer_imagen(captura))
    vectores = vectores / np.linalg.norm(vectores, axis=1, keepdims=True)
    similitud = float(np.max(vectores @ vector))
    return {"coincide": similitud >= UMBRAL, "score": round(similitud, 4), "umbral": UMBRAL}
