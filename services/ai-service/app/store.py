"""
Persistencia de embeddings.  (Hito 5)

Para desarrollar: dict en memoria + volcado a un .npz.
Version final del proyecto: pgvector en la Postgres del monorepo (se coordina con
el equipo de backend). Mantener esta interfaz para poder cambiar la implementacion.
"""

from __future__ import annotations

import os

import numpy as np

from .config import settings

# user_id -> lista de embeddings (cada uno ndarray (512,) normalizado)
_db: dict[str, list[np.ndarray]] = {}


def add(user_id: str, embeddings: list[np.ndarray]) -> None:
    """Agrega/reemplaza los embeddings del usuario y persiste a disco."""
    _db[user_id] = list(embeddings[:settings.embeddings_per_user])
    save()


def get(user_id: str) -> list[np.ndarray] | None:
    """Devuelve los embeddings del usuario o None si no existe."""
    return _db.get(user_id)


def all_users() -> dict[str, list[np.ndarray]]:
    """Devuelve todo el diccionario (para identify 1:N)."""
    return _db


def save() -> None:
    """Vuelca _db a settings.store_path."""
    dir_name = os.path.dirname(settings.store_path)
    if dir_name:
        os.makedirs(dir_name, exist_ok=True)

    if not _db:
        np.savez_compressed(settings.store_path, __empty__=np.array([]))
        return

    arrays_dict = {}
    for uid, embs in _db.items():
        if embs:
            arrays_dict[uid] = np.stack(embs, axis=0)

    np.savez_compressed(settings.store_path, **arrays_dict)


def load() -> None:
    """Rellena _db desde settings.store_path si existe."""
    global _db
    if not os.path.exists(settings.store_path):
        return

    try:
        data = np.load(settings.store_path)
        _db.clear()
        for uid in data.files:
            if uid == "__empty__":
                continue
            arr = data[uid]
            if arr.ndim == 1:
                _db[uid] = [arr]
            else:
                _db[uid] = [arr[i] for i in range(len(arr))]
    except Exception as exc:
        print(f"[store] Error al cargar embeddings: {exc}")

