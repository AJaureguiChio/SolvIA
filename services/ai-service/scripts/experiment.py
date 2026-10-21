"""
Script de calibración empírica y experimento (Hito 2-3).

Compara embeddings para calcular el margen de separación ("hueco") entre:
  1. Tus fotos vs tus fotos (genuinos)
  2. Tus fotos vs otros (impostores)

Uso:
  Opción A (Carpetas temporales en data/temp_photos/ - No se suben a Git):
      python -m scripts.experiment

  Opción B (Pasando las rutas directamente por consola):
      python -m scripts.experiment --me yo1.jpg yo2.jpg yo3.jpg --others compa1.jpg mclovin.jpg
"""

import argparse
import itertools
from pathlib import Path

import cv2

from app.face_engine import (
    extract_embedding,
    NoFaceError,
    MultipleFacesError,
    LowQualityError,
)
from app.matcher import cosine_sim

TEMP_DIR = Path("./data/temp_photos")
ME_DIR = TEMP_DIR / "yo"
OTHERS_DIR = TEMP_DIR / "otros"


def load_embeddings_from_paths(paths: list[str | Path], label: str):
    """Carga imágenes, extrae y normaliza los embeddings usando face_engine."""
    results = []
    print(f"\n--- Procesando fotos de [{label}] ({len(paths)} encontradas) ---")
    for p in paths:
        path_str = str(p)
        bgr = cv2.imread(path_str)
        if bgr is None:
            print(f"  [!] [No se pudo leer archivo]: {path_str}")
            continue

        try:
            detected = extract_embedding(bgr)
            print(
                f"  [OK] {Path(path_str).name}: Cara detectada (calidad={detected.det_score:.2f}, lado={detected.bbox_px}px)"
            )
            results.append((Path(path_str).name, detected.embedding))
        except NoFaceError:
            print(f"  [FAIL] {Path(path_str).name}: No se detecto ninguna cara (NoFaceError)")
        except MultipleFacesError:
            print(f"  [FAIL] {Path(path_str).name}: Se detectaron multiples caras (MultipleFacesError)")
        except LowQualityError:
            print(f"  [FAIL] {Path(path_str).name}: Cara de baja calidad o muy pequena (LowQualityError)")
        except Exception as e:
            print(f"  [FAIL] {Path(path_str).name}: Error inesperado ({e})")

    return results


def get_images_from_dir(folder: Path) -> list[Path]:
    extensions = ("*.jpg", "*.jpeg", "*.png", "*.webp")
    photos = []
    for ext in extensions:
        photos.extend(folder.glob(ext))
        photos.extend(folder.glob(ext.upper()))
    return sorted(list(set(photos)))


def main():
    parser = argparse.ArgumentParser(description="Experimento de calibración de umbral facial.")
    parser.add_argument("--me", nargs="+", help="Rutas a fotos tuyas")
    parser.add_argument("--others", nargs="+", help="Rutas a fotos de otros (compañeros, McLovin, etc.)")
    args = parser.parse_args()

    if args.me and args.others:
        me_paths = [Path(p) for p in args.me]
        other_paths = [Path(p) for p in args.others]
    else:
        # Modo carpetas temporales
        ME_DIR.mkdir(parents=True, exist_ok=True)
        OTHERS_DIR.mkdir(parents=True, exist_ok=True)

        me_paths = get_images_from_dir(ME_DIR)
        other_paths = get_images_from_dir(OTHERS_DIR)

        if not me_paths and not other_paths:
            print("\n[+] Se preparo la estructura de carpetas temporales:")
            print(f"    - Coloca tus fotos en:            {ME_DIR.resolve()}")
            print(f"    - Coloca las fotos de otros en:   {OTHERS_DIR.resolve()}")
            print("\n[INFO] Recuerda: estas carpetas estan dentro de data/ y .gitignore las ignora automaticamente.")
            print("       Una vez copiadas tus fotos, vuelve a ejecutar:")
            print("       python -m scripts.experiment\n")
            return

    me_embs = load_embeddings_from_paths(me_paths, "TU")
    other_embs = load_embeddings_from_paths(other_paths, "OTROS")

    if len(me_embs) < 2:
        print("\n[!] Necesitas al menos 2 fotos validas tuyas para poder comparar 'tu vs tu'.")
        return
    if len(other_embs) < 1:
        print("\n[!] Necesitas al menos 1 foto valida de otra persona para comparar 'tu vs otros'.")
        return

    # 1. Tu vs Tu
    tu_vs_tu = []
    print("\n" + "=" * 50)
    print(" COMPARACIONES: TU VS TU")
    print("=" * 50)
    for (name1, emb1), (name2, emb2) in itertools.combinations(me_embs, 2):
        sim = cosine_sim(emb1, emb2)
        tu_vs_tu.append(sim)
        print(f"  {name1} <-> {name2}: {sim:.4f}")

    # 2. Tu vs Otros
    tu_vs_otros = []
    print("\n" + "=" * 50)
    print(" COMPARACIONES: TU VS OTROS")
    print("=" * 50)
    for (name_me, emb_me), (name_other, emb_other) in itertools.product(me_embs, other_embs):
        sim = cosine_sim(emb_me, emb_other)
        tu_vs_otros.append(sim)
        print(f"  {name_me} <-> {name_other}: {sim:.4f}")

    # Resumen del experimento
    min_tu = min(tu_vs_tu)
    max_tu = max(tu_vs_tu)
    min_otros = min(tu_vs_otros)
    max_otros = max(tu_vs_otros)
    gap = min_tu - max_otros
    recommended_threshold = max_otros + (gap / 2.0) if gap > 0 else (min_tu + max_otros) / 2.0

    print("\n" + "=" * 50)
    print(" RESULTADOS FINALES DEL EXPERIMENTO")
    print("=" * 50)
    print(f"tu vs tu:        {', '.join(f'{s:.2f}' for s in tu_vs_tu)}")
    print(f"tu vs companero: {', '.join(f'{s:.2f}' for s in tu_vs_otros)}")
    print("-" * 50)
    print(f"Rango 'Tu vs Tu':      [{min_tu:.4f} a {max_tu:.4f}]")
    print(f"Rango 'Tu vs Otros':   [{min_otros:.4f} a {max_otros:.4f}]")
    print("-" * 50)

    if gap > 0:
        print(f"[OK] HUECO DETECTADO! Separacion de {gap:.4f}")
        print(f"-> Umbral sugerido (MATCH_THRESHOLD): {recommended_threshold:.2f}")
        print(f"   (Fijalo en tu archivo .env: MATCH_THRESHOLD={recommended_threshold:.2f})")
    else:
        print(f"[!] TRASLAPE DETECTADO (Hueco negativo: {gap:.4f})")
        print("   Revisa si alguna foto tuya tiene mala iluminacion, angulo forzado o lentes oscuros.")
    print("=" * 50 + "\n")


if __name__ == "__main__":
    main()
