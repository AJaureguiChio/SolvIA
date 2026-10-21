"""
Carga del modelo y extracción de embeddings.  (Hitos 1-2)

Usamos facenet-pytorch, que son dos piezas encadenadas:
  - MTCNN                -> encuentra la cara en la foto y la recorta/endereza a 160x160
  - InceptionResnetV1    -> convierte esa cara recortada en un vector de 512 números
                            (el "embedding"). Viene pre-entrenado (pesos "vggface2").

Nota: InceptionResnetV1 ya devuelve el vector con norma 1. Aun así lo pasamos por
normalize() por seguridad; volver a normalizar un vector unitario no lo cambia.

La primera vez que corre, torch descarga los pesos (~110 MB) a la carpeta de
cache de torch (~/.cache/torch  o  C:\\Users\\PC\\.cache\\torch). Necesitas red esa vez.
"""

from __future__ import annotations

import base64
import binascii
from dataclasses import dataclass

import cv2
import numpy as np
from PIL import Image

from .config import settings

# --- Singletons del modelo (se cargan una sola vez) --------------------------
_mtcnn = None
_resnet = None


def _load():
    global _mtcnn, _resnet
    if _mtcnn is None:
        import torch
        from facenet_pytorch import MTCNN, InceptionResnetV1

        torch.set_grad_enabled(False)
        _mtcnn = MTCNN(
            image_size=settings.image_size,
            keep_all=True,          # devuelve TODAS las caras -> podemos rechazar si hay >1
            device="cpu",
        )
        _resnet = InceptionResnetV1(pretrained=settings.pretrained).eval()
    return _mtcnn, _resnet


def get_model():
    """Fuerza la carga/descarga al arrancar, no en el primer request."""
    _load()


# --- Utilidad de plomería: base64 -> imagen BGR (esto NO es tu chamba de IA) ---
def decode_image(data: str) -> np.ndarray:
    """Acepta 'data:image/jpeg;base64,...' o base64 puro. Devuelve ndarray BGR."""
    if "," in data and data.strip().startswith("data:"):
        data = data.split(",", 1)[1]
    try:
        raw = base64.b64decode(data, validate=True)
    except (binascii.Error, ValueError) as exc:
        raise ValueError("base64 invalido") from exc
    buf = np.frombuffer(raw, dtype=np.uint8)
    img = cv2.imdecode(buf, cv2.IMREAD_COLOR)
    if img is None:
        raise ValueError("no se pudo decodificar la imagen")
    return img


def to_pil_rgb(bgr: np.ndarray) -> Image.Image:
    """OpenCV trabaja en BGR; MTCNN espera una imagen PIL en RGB."""
    return Image.fromarray(cv2.cvtColor(bgr, cv2.COLOR_BGR2RGB))


@dataclass
class DetectedFace:
    embedding: np.ndarray   # (512,) NORMALIZADO (norma L2 = 1)
    det_score: float        # confianza del detector para esta cara
    bbox_px: int            # lado menor del bounding box, en pixeles


class NoFaceError(Exception):
    ...


class MultipleFacesError(Exception):
    ...


class LowQualityError(Exception):
    ...


def normalize(v: np.ndarray, epsilon: float = 1e-10) -> np.ndarray:
    """TODO (Hito 2): devuelve v / ||v||_2. Cuida el caso de norma 0."""
    norm = np.linalg.norm(v)
    if norm <= epsilon:
        return np.zeros_like(v)
    else:
        return v / norm


def extract_embedding(bgr: np.ndarray) -> DetectedFace:
    """
    TODO (Hitos 1-2):
      mtcnn, resnet = _load()
      pil = to_pil_rgb(bgr)

      1. boxes, probs = mtcnn.detect(pil)
           - boxes: array (n, 4) con [x1, y1, x2, y2] por cara, o None si no hay
           - probs: array (n,) con la confianza por cara
      2. si boxes is None            -> NoFaceError
         si len(boxes) > 1           -> MultipleFacesError   (en login no toleramos 2 caras)
      3. control de calidad sobre la unica cara:
           probs[0] >= settings.min_det_score               si no -> LowQualityError
           lado = min(x2 - x1, y2 - y1) de boxes[0]
           lado >= settings.min_face_px                      si no -> LowQualityError
      4. faces = mtcnn.extract(pil, boxes[:1], None)   # tensor con la cara alineada 160x160
                                                       # ajusta unsqueeze/squeeze segun la
                                                       # forma real que te salga al imprimirla
      5. emb = resnet(faces).detach().cpu().numpy().reshape(-1)   # -> (512,)
      6. return DetectedFace(embedding=normalize(emb),
                             det_score=float(probs[0]),
                             bbox_px=int(lado))
    """

    mtcnn, resnet = _load()

    pil = to_pil_rgb(bgr)
    boxes, probs = mtcnn.detect(pil)

    if boxes is None or len(boxes) == 0:
        raise NoFaceError
    if len(boxes) > 1:
        raise MultipleFacesError
    
    x1, y1, x2, y2 = boxes[0]
    det_score = float(probs[0])
    lado = min(x2 - x1, y2 - y1)
    
    if det_score < settings.min_det_score or lado < settings.min_face_px:
        raise LowQualityError
    
    faces = mtcnn.extract(pil, boxes[:1], None)
    if faces is None:
        raise NoFaceError
        
    if faces.ndim == 3:
        faces = faces.unsqueeze(0)
    
    emb = resnet(faces).detach().cpu().numpy().reshape(-1)
    
    return DetectedFace(
        embedding=normalize(emb),
        det_score=det_score,
        bbox_px=int(lado)
    )
    
    
