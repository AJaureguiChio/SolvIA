"""
Comparacion de embeddings: 1:1 (verify) y 1:N (identify).  (Hitos 2-4)

Todos los embeddings que entran aqui YA vienen normalizados desde face_engine,
asi que la similitud coseno es simplemente el producto punto.
"""

from __future__ import annotations

import numpy as np

from .config import settings


def cosine_sim(a: np.ndarray, b: np.ndarray) -> float:
    """TODO (Hito 2): producto punto de dos vectores unitarios -> float en [-1, 1]."""
    dot = np.dot(a, b)
    return float(np.clip(dot, -1.0, 1.0))


def best_score(probe: np.ndarray, gallery: list[np.ndarray]) -> float:
    """
    Mejor similitud del 'probe' contra los k embeddings guardados
    de una persona ('gallery'). Estrategia 'mejor de N'.
    """
    if not gallery:
        return -1.0
    return float(max(cosine_sim(probe, g) for g in gallery))


def verify(probe: np.ndarray, gallery: list[np.ndarray]) -> tuple[bool, float]:
    """
    score = best_score(...); match = score >= settings.match_threshold.
    Devuelve (match, score).
    """
    score = best_score(probe, gallery)
    match = score >= settings.match_threshold
    return match, score


def identify(
    probe: np.ndarray, all_users: dict[str, list[np.ndarray]]
) -> tuple[str | None, float]:
    """
    Recorre todos los usuarios y obtiene el mejor puntaje.
    Si ese score >= threshold -> (user_id, score); si no -> (None, score).
    """
    if not all_users:
        return None, -1.0

    best_uid = None
    max_s = -1.0

    for uid, gallery in all_users.items():
        s = best_score(probe, gallery)
        if s > max_s:
            max_s = s
            best_uid = uid

    if max_s >= settings.match_threshold:
        return best_uid, max_s
    return None, max_s

