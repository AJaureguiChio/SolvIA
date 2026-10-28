import { HttpStatus, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';
import type { UsuarioActual } from '../auth/guards/neon-auth/neon-auth.guard.js';
import { ApiError } from '../common/api-error.js';
import { DatabaseService } from '../database/database.service.js';

export type Captura = { buffer: Buffer; mimetype: string; size: number };

type ResultadoIntento =
  | 'match'
  | 'mismatch'
  | 'inscrito'
  | 'sin_rostro'
  | 'multiples_rostros'
  | 'rostro_pequeno'
  | 'error_servicio'
  | 'bloqueado';

const DIMENSION = 512;
const MAX_FALLOS = 5;
const VENTANA_FALLOS = '15 minutes';

// Motivos de captura rechazada que devuelve el microservicio (422).
const MOTIVOS_CAPTURA: Record<string, string> = {
  sin_rostro: 'No se detectó un rostro. Colócate de frente y con buena luz.',
  multiples_rostros:
    'Hay más de un rostro en la imagen. Asegúrate de estar solo.',
  rostro_pequeno: 'El rostro se ve muy pequeño. Acércate a la cámara.',
};

@Injectable()
export class FacialService {
  private readonly urlServicio: string;
  private readonly claveInterna: string;
  private readonly claveGaleria: Buffer;

  constructor(
    config: ConfigService,
    private readonly database: DatabaseService,
  ) {
    this.urlServicio = config.getOrThrow<string>('AI_SERVICE_URL');
    this.claveInterna = config.getOrThrow<string>('AI_INTERNAL_KEY');
    this.claveGaleria = Buffer.from(
      config.getOrThrow<string>('FACE_GALLERY_KEY'),
      'base64',
    );
    if (this.claveGaleria.length !== 32) {
      throw new Error('FACE_GALLERY_KEY debe ser de 32 bytes en base64');
    }
  }

  async estaInscrito(usuarioId: string) {
    const { rows } = await this.database.query(
      `SELECT 1 FROM public.facial_plantillas WHERE usuario_id = $1::uuid`,
      [usuarioId],
    );
    return rows.length > 0;
  }

  // Cada captura aporta un vector a la galería; reinscribirse la reemplaza.
  async inscribir(usuario: UsuarioActual, capturas: Captura[]) {
    const vectores: number[][] = [];
    for (const captura of capturas) {
      const respuesta = await this.llamar(
        usuario,
        'inscripcion',
        '/enroll',
        captura,
      );
      vectores.push(respuesta.embedding as number[]);
    }

    const { cifrado, iv, etiqueta } = this.cifrar(vectores);
    await this.database.query(
      `INSERT INTO public.facial_plantillas
           (usuario_id, galeria_cifrada, iv, auth_tag, num_vectores, dimension)
       VALUES ($1::uuid, $2, $3, $4, $5, $6)
       ON CONFLICT (usuario_id) DO UPDATE
          SET galeria_cifrada = EXCLUDED.galeria_cifrada,
              iv = EXCLUDED.iv,
              auth_tag = EXCLUDED.auth_tag,
              num_vectores = EXCLUDED.num_vectores,
              dimension = EXCLUDED.dimension,
              actualizada_en = now()`,
      [usuario.id, cifrado, iv, etiqueta, vectores.length, DIMENSION],
    );
    await this.registrar(usuario.id, 'inscripcion', 'inscrito');
    return { inscrito: true, capturas: vectores.length };
  }

  async verificar(usuario: UsuarioActual, captura: Captura) {
    const fallos = await this.fallosRecientes(usuario.id);
    if (fallos >= MAX_FALLOS) {
      await this.registrar(usuario.id, 'verificacion', 'bloqueado');
      throw new ApiError(
        HttpStatus.TOO_MANY_REQUESTS,
        'FACE_LOCKED',
        'Demasiados intentos fallidos. Espera 15 minutos e inténtalo de nuevo.',
      );
    }

    const galeria = await this.leerGaleria(usuario.id);
    const respuesta = await this.llamar(
      usuario,
      'verificacion',
      '/verify',
      captura,
      {
        galeria: JSON.stringify(galeria),
      },
    );
    const score = Number(respuesta.score);

    if (!respuesta.coincide) {
      await this.registrar(usuario.id, 'verificacion', 'mismatch', score);
      // El score no se devuelve: solo los intentos que quedan.
      throw new ApiError(
        HttpStatus.UNAUTHORIZED,
        'FACE_MISMATCH',
        'El rostro no coincide con el registrado.',
        { intentosRestantes: Math.max(0, MAX_FALLOS - fallos - 1) },
      );
    }
    await this.registrar(usuario.id, 'verificacion', 'match', score);
  }

  async restablecer(usuarioId: string) {
    const { rowCount } = await this.database.query(
      `DELETE FROM public.facial_plantillas WHERE usuario_id = $1::uuid`,
      [usuarioId],
    );
    return { restablecido: (rowCount ?? 0) > 0 };
  }

  private async fallosRecientes(usuarioId: string) {
    const { rows } = await this.database.query(
      `SELECT count(*)::int AS fallos
         FROM public.facial_intentos
        WHERE usuario_id = $1::uuid
          AND tipo = 'verificacion'
          AND resultado = 'mismatch'
          AND creado_en > now() - $2::interval
          AND creado_en > COALESCE((
                SELECT max(creado_en) FROM public.facial_intentos
                 WHERE usuario_id = $1::uuid
                   AND resultado IN ('match', 'inscrito')), '-infinity')`,
      [usuarioId, VENTANA_FALLOS],
    );
    return (rows[0] as { fallos: number }).fallos;
  }

  private async leerGaleria(usuarioId: string) {
    const { rows } = await this.database.query(
      `SELECT galeria_cifrada AS cifrado, iv, auth_tag AS etiqueta,
              num_vectores AS "numVectores", dimension
         FROM public.facial_plantillas
        WHERE usuario_id = $1::uuid`,
      [usuarioId],
    );
    const fila = rows[0] as
      | {
          cifrado: Buffer;
          iv: Buffer;
          etiqueta: Buffer;
          numVectores: number;
          dimension: number;
        }
      | undefined;
    if (!fila) {
      throw new ApiError(
        HttpStatus.CONFLICT,
        'FACE_NOT_ENROLLED',
        'Primero registra tu rostro.',
      );
    }
    return this.descifrar(fila);
  }

  // La galería son k vectores float32 contiguos cifrados con AES-256-GCM.
  private cifrar(vectores: number[][]) {
    const plano = Buffer.from(new Float32Array(vectores.flat()).buffer);
    const iv = randomBytes(12);
    const cifrador = createCipheriv('aes-256-gcm', this.claveGaleria, iv);
    const cifrado = Buffer.concat([cifrador.update(plano), cifrador.final()]);
    return { cifrado, iv, etiqueta: cifrador.getAuthTag() };
  }

  private descifrar(fila: {
    cifrado: Buffer;
    iv: Buffer;
    etiqueta: Buffer;
    numVectores: number;
    dimension: number;
  }) {
    const descifrador = createDecipheriv(
      'aes-256-gcm',
      this.claveGaleria,
      fila.iv,
    );
    descifrador.setAuthTag(fila.etiqueta);
    const plano = Buffer.concat([
      descifrador.update(fila.cifrado),
      descifrador.final(),
    ]);
    const valores = new Float32Array(
      plano.buffer,
      plano.byteOffset,
      plano.byteLength / 4,
    );
    return Array.from({ length: fila.numVectores }, (_, i) =>
      Array.from(
        valores.subarray(i * fila.dimension, (i + 1) * fila.dimension),
      ),
    );
  }

  // Envía la captura al microservicio y traduce sus errores al contrato.
  private async llamar(
    usuario: UsuarioActual,
    tipo: 'inscripcion' | 'verificacion',
    ruta: string,
    captura: Captura,
    campos: Record<string, string> = {},
  ): Promise<Record<string, unknown>> {
    const formulario = new FormData();
    formulario.append(
      'captura',
      new Blob([new Uint8Array(captura.buffer)], { type: captura.mimetype }),
      'captura.jpg',
    );
    for (const [nombre, valor] of Object.entries(campos))
      formulario.append(nombre, valor);

    let respuesta: Response;
    try {
      respuesta = await fetch(`${this.urlServicio}${ruta}`, {
        method: 'POST',
        headers: { 'X-Internal-Key': this.claveInterna },
        body: formulario,
        signal: AbortSignal.timeout(20000),
      });
    } catch {
      return this.fallaServicio(usuario.id, tipo);
    }

    const cuerpo = (await respuesta.json().catch(() => null)) as
      | (Record<string, unknown> & {
          detail?: { code?: string; message?: string };
        })
      | null;
    if (respuesta.ok && cuerpo) return cuerpo;

    const motivo = cuerpo?.detail?.code;
    if (respuesta.status === 422 && motivo && motivo in MOTIVOS_CAPTURA) {
      await this.registrar(usuario.id, tipo, motivo as ResultadoIntento);
      throw new ApiError(
        HttpStatus.UNPROCESSABLE_ENTITY,
        'FACE_CAPTURE_INVALID',
        MOTIVOS_CAPTURA[motivo],
        { motivo },
      );
    }
    if (respuesta.status === 400 || respuesta.status === 413) {
      throw ApiError.entradaInvalida(
        cuerpo?.detail?.message ?? 'La captura no es válida',
      );
    }
    return this.fallaServicio(usuario.id, tipo);
  }

  private async fallaServicio(
    usuarioId: string,
    tipo: 'inscripcion' | 'verificacion',
  ): Promise<never> {
    await this.registrar(usuarioId, tipo, 'error_servicio');
    throw new ApiError(
      HttpStatus.SERVICE_UNAVAILABLE,
      'FACE_SERVICE_UNAVAILABLE',
      'El servicio de reconocimiento facial no está disponible.',
    );
  }

  private async registrar(
    usuarioId: string,
    tipo: 'inscripcion' | 'verificacion',
    resultado: ResultadoIntento,
    score?: number,
  ) {
    await this.database.query(
      `INSERT INTO public.facial_intentos (usuario_id, tipo, resultado, score)
       VALUES ($1::uuid, $2, $3, $4)`,
      [
        usuarioId,
        tipo,
        resultado,
        score === undefined ? null : score.toFixed(4),
      ],
    );
  }
}
