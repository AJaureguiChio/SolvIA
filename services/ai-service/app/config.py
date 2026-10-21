"""Configuración central del microservicio (se lee de .env)."""

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    port: int = 8000

    # Umbral de decisión (Hito 3). Similitud coseno >= threshold -> match.
    match_threshold: float = 0.40

    # Control de calidad en captura/enrollment (Hito 4).
    min_det_score: float = 0.90   # confianza del detector MTCNN (en caras claras da ~0.99)
    min_face_px: int = 80

    embeddings_per_user: int = 4

    store_path: str = "./data/embeddings.npz"

    # Parámetros del modelo (facenet-pytorch).
    image_size: int = 160         # lado del recorte de cara que consume el modelo
    pretrained: str = "vggface2"  # pesos pre-entrenados de InceptionResnetV1


settings = Settings()
