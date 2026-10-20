-- Verificacion facial: galeria de embeddings cifrada y bitacora de intentos.
-- Requiere SolvIA_esquema_final.sql (perfiles_usuario y
-- bloquear_cambios_confirmados).

-- Una galeria por usuario. NestJS cifra con AES-256-GCM los k vectores
-- (512 floats cada uno) y guarda aqui solo el texto cifrado, el IV y la
-- etiqueta; la clave vive fuera de la base. Reinscribirse reemplaza la fila.
CREATE TABLE public.facial_plantillas (
    usuario_id uuid PRIMARY KEY
        REFERENCES public.perfiles_usuario(id) ON DELETE RESTRICT,
    galeria_cifrada bytea NOT NULL CHECK (octet_length(galeria_cifrada) > 0),
    iv bytea NOT NULL CHECK (octet_length(iv) = 12),
    auth_tag bytea NOT NULL CHECK (octet_length(auth_tag) = 16),
    num_vectores smallint NOT NULL CHECK (num_vectores BETWEEN 1 AND 10),
    dimension smallint NOT NULL DEFAULT 512 CHECK (dimension > 0),
    modelo text NOT NULL DEFAULT 'facenet-vggface2',
    version_clave smallint NOT NULL DEFAULT 1 CHECK (version_clave > 0),
    creada_en timestamptz NOT NULL DEFAULT now(),
    actualizada_en timestamptz NOT NULL DEFAULT now()
);

-- Auditoria de inscripciones y verificaciones. El score se guarda para
-- revision interna; la API nunca lo devuelve al cliente. Los mismatch
-- recientes alimentan el limite de 5 intentos en 15 minutos.
CREATE TABLE public.facial_intentos (
    id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    usuario_id uuid NOT NULL
        REFERENCES public.perfiles_usuario(id) ON DELETE RESTRICT,
    tipo text NOT NULL CHECK (tipo IN ('inscripcion', 'verificacion')),
    resultado text NOT NULL CHECK (resultado IN (
        'match', 'mismatch', 'inscrito', 'sin_rostro', 'multiples_rostros',
        'rostro_pequeno', 'error_servicio', 'bloqueado'
    )),
    score numeric(5, 4) CHECK (score IS NULL OR score BETWEEN -1 AND 1),
    creado_en timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX facial_intentos_usuario_fecha_idx
    ON public.facial_intentos(usuario_id, creado_en);

CREATE TRIGGER facial_intento_inmutable
BEFORE UPDATE OR DELETE ON public.facial_intentos
FOR EACH ROW EXECUTE FUNCTION public.bloquear_cambios_confirmados();
