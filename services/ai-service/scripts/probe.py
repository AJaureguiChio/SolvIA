"""
Hito 1 - sacar UN embedding sin API.

Uso:
    python -m scripts.probe ruta/a/foto.jpg
    python -m scripts.probe foto1.jpg foto2.jpg foto3.jpg

Que tienes que observar:
  - exactamente 1 cara por foto
  - prob (confianza del detector) > 0.9
  - embedding.shape == (512,)
  - la norma L2 del embedding ~ 1.0  (este modelo ya lo entrega normalizado)

La primera corrida descarga los pesos (~110 MB) a la cache de torch.
"""

import sys

import cv2
import numpy as np
import torch
from facenet_pytorch import MTCNN, InceptionResnetV1
from PIL import Image

torch.set_grad_enabled(False)


def main(paths: list[str]) -> None:
    mtcnn = MTCNN(image_size=160, keep_all=True, device="cpu")
    resnet = InceptionResnetV1(pretrained="vggface2").eval()

    for path in paths:
        bgr = cv2.imread(path)
        if bgr is None:
            print(f"[!] no pude leer {path}")
            continue

        pil = Image.fromarray(cv2.cvtColor(bgr, cv2.COLOR_BGR2RGB))
        boxes, probs = mtcnn.detect(pil)

        print(f"\n{path}")
        if boxes is None:
            print("  caras detectadas : 0")
            continue

        print(f"  caras detectadas : {len(boxes)}")
        faces = mtcnn.extract(pil, boxes, None)          # tensor (n, 3, 160, 160)
        embs = resnet(faces).cpu().numpy()               # (n, 512)
        for i, (box, prob, emb) in enumerate(zip(boxes, probs, embs)):
            x1, y1, x2, y2 = box.astype(int)
            print(f"  cara[{i}] prob={prob:.3f} "
                  f"bbox=[{x1},{y1},{x2},{y2}] "
                  f"lado={min(x2 - x1, y2 - y1)}px "
                  f"emb.shape={emb.shape} ||emb||={np.linalg.norm(emb):.3f}")

    # TODO (Hito 2): con 2 embeddings, imprime su similitud coseno
    #   y compara "tu vs tu" contra "tu vs companero".


if __name__ == "__main__":
    if len(sys.argv) < 2:
        print(__doc__)
        sys.exit(1)
    main(sys.argv[1:])
