"""Contratos de entrada/salida de la API (esto es lo que acuerdas con el front)."""

from pydantic import BaseModel, Field


class EnrollRequest(BaseModel):
    user_id: str
    # Lista de imágenes en base64 (data URL o base64 puro; el server tolera ambos).
    images: list[str] = Field(min_length=1)


class EnrollResponse(BaseModel):
    user_id: str
    accepted: int          # cuántas capturas pasaron el control de calidad
    rejected: int
    reasons: list[str] = []  # motivos de rechazo, para depurar en el front


class VerifyRequest(BaseModel):
    user_id: str           # el login ya sabe quién dice ser -> 1:1
    image: str


class VerifyResponse(BaseModel):
    match: bool
    score: float           # similitud coseno con el mejor embedding del usuario


class IdentifyRequest(BaseModel):
    image: str             # 1:N, sin user_id


class IdentifyResponse(BaseModel):
    user_id: str | None
    score: float


class ErrorResponse(BaseModel):
    detail: str
