-- SolvIA: esquema de dominio para PostgreSQL / Neon.
-- Requisito previo: Neon Auth habilitado en esta rama y neon_auth."user"(id)
-- existente con id de tipo UUID. Confirmar este tipo en la instancia real.
-- Ejecutar como una migracion, despues de habilitar Neon Auth por CLI.
-- Los identificadores CURP/RFC y scores son ficticios para la demostracion.

BEGIN;

CREATE TABLE public.perfiles_usuario (
    id uuid PRIMARY KEY REFERENCES neon_auth."user"(id) ON DELETE RESTRICT,
    rol text NOT NULL CHECK (rol IN ('administrador', 'gestor')),
    activo boolean NOT NULL DEFAULT true
);

CREATE TABLE public.deudores (
    id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    curp text UNIQUE,
    rfc text UNIQUE,
    nombre text NOT NULL CHECK (btrim(nombre) <> ''),
    telefono text,
    ciudad text,
    segmento text,
    -- Escala ficticia interna, no equivale a una escala oficial de buro.
    score_buro smallint NOT NULL CHECK (score_buro BETWEEN 0 AND 1000),
    CONSTRAINT deudor_identificado CHECK (curp IS NOT NULL OR rfc IS NOT NULL),
    CONSTRAINT curp_formato_basico CHECK (
        curp IS NULL OR (
            char_length(curp) = 18 AND curp = upper(curp)
            AND curp = btrim(curp)
        )
    ),
    CONSTRAINT rfc_formato_basico CHECK (
        rfc IS NULL OR (
            char_length(rfc) IN (12, 13) AND rfc = upper(rfc)
            AND rfc = btrim(rfc)
        )
    )
);

CREATE TABLE public.cuentas (
    id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    deudor_id bigint NOT NULL REFERENCES public.deudores(id) ON DELETE RESTRICT,
    referencia_externa text UNIQUE,
    producto text,
    monto_inicial numeric(16, 2) NOT NULL CHECK (monto_inicial > 0),
    moneda varchar(3) NOT NULL DEFAULT 'MXN' CHECK (moneda ~ '^[A-Z]{3}$'),
    fecha_originacion date,
    responsable_id uuid REFERENCES public.perfiles_usuario(id) ON DELETE RESTRICT,
    -- Ultimo administrador que cambio responsable_id; el trigger guarda el historial.
    asignacion_modificada_por uuid
        REFERENCES public.perfiles_usuario(id) ON DELETE RESTRICT
);

-- La PK compartida impide dos planes para una misma cuenta.
-- El trigger diferido de abajo obliga a crear la cuenta, el plan y las
-- cuotas completas en la MISMA transaccion.
CREATE TABLE public.planes_pago (
    cuenta_id bigint PRIMARY KEY REFERENCES public.cuentas(id) ON DELETE RESTRICT,
    fecha_acuerdo date NOT NULL
);

CREATE TABLE public.cuotas (
    id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    cuenta_id bigint NOT NULL
        REFERENCES public.planes_pago(cuenta_id) ON DELETE RESTRICT,
    numero integer NOT NULL CHECK (numero > 0),
    fecha_vencimiento date NOT NULL,
    monto numeric(16, 2) NOT NULL CHECK (monto > 0),
    CONSTRAINT cuota_numero_unico UNIQUE (cuenta_id, numero)
);

CREATE TABLE public.pagos (
    id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    cuenta_id bigint NOT NULL REFERENCES public.cuentas(id) ON DELETE RESTRICT,
    fecha_pago date NOT NULL,
    monto numeric(16, 2) NOT NULL CHECK (monto > 0),
    registrado_por uuid NOT NULL
        REFERENCES public.perfiles_usuario(id) ON DELETE RESTRICT,
    registrado_en timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT pago_misma_cuenta UNIQUE (id, cuenta_id)
);

-- impacto_saldo positivo: incrementa deuda; negativo: reduce deuda.
-- reversion_pago corrige un pago capturado equivocadamente; reembolso indica
-- devolucion efectiva al deudor. Ambos apuntan al pago original.
CREATE TABLE public.movimientos_saldo (
    id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    cuenta_id bigint NOT NULL REFERENCES public.cuentas(id) ON DELETE RESTRICT,
    tipo text NOT NULL CHECK (tipo IN (
        'interes', 'recargo', 'descuento', 'condonacion',
        'reembolso', 'reversion_pago', 'ajuste_cargo', 'ajuste_abono'
    )),
    impacto_saldo numeric(16, 2) NOT NULL,
    fecha_efectiva date NOT NULL,
    motivo text NOT NULL CHECK (btrim(motivo) <> ''),
    pago_origen_id bigint,
    registrado_por uuid NOT NULL
        REFERENCES public.perfiles_usuario(id) ON DELETE RESTRICT,
    registrado_en timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT movimiento_pago_misma_cuenta
        FOREIGN KEY (pago_origen_id, cuenta_id)
        REFERENCES public.pagos(id, cuenta_id) ON DELETE RESTRICT,
    CONSTRAINT movimiento_signo CHECK (
        (tipo IN ('interes', 'recargo', 'reembolso',
                  'reversion_pago', 'ajuste_cargo') AND impacto_saldo > 0)
        OR
        (tipo IN ('descuento', 'condonacion', 'ajuste_abono')
         AND impacto_saldo < 0)
    ),
    CONSTRAINT movimiento_origen_pago CHECK (
        (tipo IN ('reembolso', 'reversion_pago') AND pago_origen_id IS NOT NULL)
        OR
        (tipo NOT IN ('reembolso', 'reversion_pago')
         AND pago_origen_id IS NULL)
    )
);

CREATE TABLE public.historial_asignaciones (
    id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    cuenta_id bigint NOT NULL REFERENCES public.cuentas(id) ON DELETE RESTRICT,
    responsable_anterior_id uuid
        REFERENCES public.perfiles_usuario(id) ON DELETE RESTRICT,
    responsable_nuevo_id uuid
        REFERENCES public.perfiles_usuario(id) ON DELETE RESTRICT,
    realizada_por uuid NOT NULL
        REFERENCES public.perfiles_usuario(id) ON DELETE RESTRICT,
    realizada_en timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT asignacion_cambio_real CHECK (
        responsable_anterior_id IS DISTINCT FROM responsable_nuevo_id
    )
);

-- El propio PDF queda almacenado en Postgres; cada destinatario tiene
-- una fila y el contenido binario se guarda una sola vez.
CREATE TABLE public.reportes (
    id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    titulo text NOT NULL CHECK (btrim(titulo) <> ''),
    generado_por uuid NOT NULL
        REFERENCES public.perfiles_usuario(id) ON DELETE RESTRICT,
    generado_en timestamptz NOT NULL DEFAULT now(),
    periodo_desde date,
    periodo_hasta date,
    archivo_pdf bytea NOT NULL CHECK (octet_length(archivo_pdf) > 0),
    CONSTRAINT reporte_periodo_valido CHECK (
        (periodo_desde IS NULL AND periodo_hasta IS NULL)
        OR
        (periodo_desde IS NOT NULL AND periodo_hasta IS NOT NULL
         AND periodo_desde <= periodo_hasta)
    )
);

CREATE TABLE public.reporte_destinatarios (
    reporte_id bigint NOT NULL REFERENCES public.reportes(id) ON DELETE RESTRICT,
    usuario_id uuid NOT NULL
        REFERENCES public.perfiles_usuario(id) ON DELETE RESTRICT,
    entregado_en timestamptz,
    PRIMARY KEY (reporte_id, usuario_id)
);

-- Protege la integridad del plan. Las comprobaciones diferidas ven el
-- resultado final de la transaccion cuenta -> plan -> cuotas.
CREATE FUNCTION public.validar_plan_completo()
RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
    v_cuenta_id bigint;
    v_monto numeric(16, 2);
    v_fecha_origen date;
    v_fecha_acuerdo date;
    v_total numeric(16, 2);
    v_num_cuotas bigint;
BEGIN
    IF TG_TABLE_NAME = 'cuentas' THEN
        v_cuenta_id := NEW.id;
    ELSE
        v_cuenta_id := NEW.cuenta_id;
    END IF;

    SELECT c.monto_inicial, c.fecha_originacion, p.fecha_acuerdo
      INTO v_monto, v_fecha_origen, v_fecha_acuerdo
      FROM public.cuentas c
      JOIN public.planes_pago p ON p.cuenta_id = c.id
     WHERE c.id = v_cuenta_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'La cuenta % necesita un plan de pago', v_cuenta_id;
    END IF;

    IF v_fecha_origen IS NOT NULL AND v_fecha_acuerdo < v_fecha_origen THEN
        RAISE EXCEPTION 'El acuerdo precede a la originacion de la cuenta %',
            v_cuenta_id;
    END IF;

    SELECT count(*), sum(monto)
      INTO v_num_cuotas, v_total
      FROM public.cuotas
     WHERE cuenta_id = v_cuenta_id;

    IF v_num_cuotas = 0 OR v_total <> v_monto THEN
        RAISE EXCEPTION
            'Las cuotas de la cuenta % deben sumar exactamente %',
            v_cuenta_id, v_monto;
    END IF;

    IF EXISTS (
        SELECT 1 FROM (
            SELECT numero, fecha_vencimiento,
                   row_number() OVER (ORDER BY numero) AS posicion,
                   lag(fecha_vencimiento) OVER (ORDER BY numero)
                       AS vencimiento_previo
              FROM public.cuotas
             WHERE cuenta_id = v_cuenta_id
        ) q
        WHERE q.numero <> q.posicion
           OR q.fecha_vencimiento < v_fecha_acuerdo
           OR (q.vencimiento_previo IS NOT NULL
               AND q.fecha_vencimiento <= q.vencimiento_previo)
    ) THEN
        RAISE EXCEPTION
            'Cuotas invalidas: numeros consecutivos y vencimientos crecientes para la cuenta %',
            v_cuenta_id;
    END IF;

    RETURN NULL;
END;
$$;

CREATE CONSTRAINT TRIGGER cuenta_plan_completo
AFTER INSERT ON public.cuentas
DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW EXECUTE FUNCTION public.validar_plan_completo();

CREATE CONSTRAINT TRIGGER cuotas_plan_completo
AFTER INSERT ON public.cuotas
DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW EXECUTE FUNCTION public.validar_plan_completo();

CREATE FUNCTION public.bloquear_cambios_confirmados()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
    RAISE EXCEPTION 'El registro de % es inmutable; registre una correccion nueva',
        TG_TABLE_NAME;
END;
$$;

CREATE TRIGGER plan_inmutable
BEFORE UPDATE OR DELETE ON public.planes_pago
FOR EACH ROW EXECUTE FUNCTION public.bloquear_cambios_confirmados();

CREATE TRIGGER cuota_inmutable
BEFORE UPDATE OR DELETE ON public.cuotas
FOR EACH ROW EXECUTE FUNCTION public.bloquear_cambios_confirmados();

CREATE TRIGGER pago_inmutable
BEFORE UPDATE OR DELETE ON public.pagos
FOR EACH ROW EXECUTE FUNCTION public.bloquear_cambios_confirmados();

CREATE TRIGGER movimiento_inmutable
BEFORE UPDATE OR DELETE ON public.movimientos_saldo
FOR EACH ROW EXECUTE FUNCTION public.bloquear_cambios_confirmados();

CREATE TRIGGER historial_inmutable
BEFORE UPDATE OR DELETE ON public.historial_asignaciones
FOR EACH ROW EXECUTE FUNCTION public.bloquear_cambios_confirmados();

CREATE TRIGGER reporte_inmutable
BEFORE UPDATE OR DELETE ON public.reportes
FOR EACH ROW EXECUTE FUNCTION public.bloquear_cambios_confirmados();

CREATE TRIGGER cuenta_no_eliminable
BEFORE DELETE ON public.cuentas
FOR EACH ROW EXECUTE FUNCTION public.bloquear_cambios_confirmados();

CREATE FUNCTION public.validar_cambio_perfil()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
    IF TG_OP = 'DELETE' THEN
        RAISE EXCEPTION 'Los usuarios de SolvIA se desactivan; no se eliminan';
    END IF;

    IF (NEW.rol <> 'gestor' OR NEW.activo = false)
       AND EXISTS (
           SELECT 1 FROM public.cuentas
           WHERE responsable_id = NEW.id
       ) THEN
        RAISE EXCEPTION 'Reasigne las cuentas antes de desactivar o cambiar el rol del gestor';
    END IF;

    RETURN NEW;
END;
$$;

CREATE TRIGGER perfil_sin_eliminacion
BEFORE DELETE OR UPDATE OF rol, activo ON public.perfiles_usuario
FOR EACH ROW EXECUTE FUNCTION public.validar_cambio_perfil();

CREATE FUNCTION public.validar_cambio_asignacion()
RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
    v_anterior uuid;
BEGIN
    IF TG_OP = 'INSERT' THEN
        v_anterior := NULL;
    ELSE
        v_anterior := OLD.responsable_id;
    END IF;

    IF v_anterior IS NOT DISTINCT FROM NEW.responsable_id THEN
        IF TG_OP = 'INSERT' AND NEW.asignacion_modificada_por IS NOT NULL THEN
            RAISE EXCEPTION 'No hay asignacion inicial que registrar';
        END IF;
        IF TG_OP = 'UPDATE' AND
           NEW.asignacion_modificada_por IS DISTINCT FROM
           OLD.asignacion_modificada_por THEN
            RAISE EXCEPTION 'El autor solo puede cambiar con el responsable';
        END IF;
        RETURN NEW;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM public.perfiles_usuario
         WHERE id = NEW.asignacion_modificada_por
           AND rol = 'administrador' AND activo
    ) THEN
        RAISE EXCEPTION 'La asignacion requiere un administrador activo';
    END IF;

    IF NEW.responsable_id IS NOT NULL AND NOT EXISTS (
        SELECT 1 FROM public.perfiles_usuario
         WHERE id = NEW.responsable_id
           AND rol = 'gestor' AND activo
    ) THEN
        RAISE EXCEPTION 'El responsable debe ser un gestor activo';
    END IF;

    RETURN NEW;
END;
$$;

CREATE TRIGGER cuenta_validar_asignacion
BEFORE INSERT OR UPDATE ON public.cuentas
FOR EACH ROW EXECUTE FUNCTION public.validar_cambio_asignacion();

CREATE FUNCTION public.guardar_historial_asignacion()
RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
    v_anterior uuid;
BEGIN
    IF TG_OP = 'INSERT' THEN
        v_anterior := NULL;
    ELSE
        v_anterior := OLD.responsable_id;
    END IF;

    IF v_anterior IS DISTINCT FROM NEW.responsable_id THEN
        INSERT INTO public.historial_asignaciones (
            cuenta_id, responsable_anterior_id, responsable_nuevo_id,
            realizada_por
        ) VALUES (
            NEW.id, v_anterior, NEW.responsable_id,
            NEW.asignacion_modificada_por
        );
    END IF;

    RETURN NULL;
END;
$$;

CREATE TRIGGER cuenta_historial_automatico
AFTER INSERT OR UPDATE ON public.cuentas
FOR EACH ROW EXECUTE FUNCTION public.guardar_historial_asignacion();

CREATE FUNCTION public.bloquear_datos_base_cuenta()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
    IF NEW.deudor_id IS DISTINCT FROM OLD.deudor_id
       OR NEW.monto_inicial IS DISTINCT FROM OLD.monto_inicial
       OR NEW.moneda IS DISTINCT FROM OLD.moneda
       OR NEW.fecha_originacion IS DISTINCT FROM OLD.fecha_originacion THEN
        RAISE EXCEPTION 'Deudor, monto, moneda y origen de la cuenta son inmutables';
    END IF;
    RETURN NEW;
END;
$$;

CREATE TRIGGER cuenta_base_inmutable
BEFORE UPDATE ON public.cuentas
FOR EACH ROW EXECUTE FUNCTION public.bloquear_datos_base_cuenta();

-- Saldo actual: deuda original - pagos + cargos y abonos registrados.
CREATE FUNCTION public.saldo_cuenta(p_cuenta_id bigint)
RETURNS numeric LANGUAGE sql VOLATILE AS $$
    SELECT c.monto_inicial
         - COALESCE((SELECT sum(p.monto)
                       FROM public.pagos p
                      WHERE p.cuenta_id = c.id), 0)
         + COALESCE((SELECT sum(m.impacto_saldo)
                       FROM public.movimientos_saldo m
                      WHERE m.cuenta_id = c.id), 0)
      FROM public.cuentas c
     WHERE c.id = p_cuenta_id
$$;

CREATE FUNCTION public.validar_pago_nuevo()
RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
    v_responsable uuid;
    v_fecha_acuerdo date;
BEGIN
    -- El bloqueo de la cuenta serializa pagos y ajustes concurrentes.
    SELECT responsable_id INTO v_responsable
      FROM public.cuentas WHERE id = NEW.cuenta_id FOR UPDATE;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Cuenta inexistente';
    END IF;

    IF NEW.registrado_por IS DISTINCT FROM v_responsable
       OR NOT EXISTS (
           SELECT 1 FROM public.perfiles_usuario
            WHERE id = NEW.registrado_por AND rol = 'gestor' AND activo
       ) THEN
        RAISE EXCEPTION 'Solo el gestor activo asignado puede registrar el pago';
    END IF;

    SELECT fecha_acuerdo INTO v_fecha_acuerdo
      FROM public.planes_pago WHERE cuenta_id = NEW.cuenta_id;
    IF NOT FOUND OR NEW.fecha_pago < v_fecha_acuerdo
       OR NEW.fecha_pago > CURRENT_DATE THEN
        RAISE EXCEPTION 'La fecha del pago debe estar entre el acuerdo y hoy';
    END IF;

    IF public.saldo_cuenta(NEW.cuenta_id) < NEW.monto THEN
        RAISE EXCEPTION 'El pago excede el saldo pendiente';
    END IF;

    RETURN NEW;
END;
$$;

CREATE TRIGGER pago_validado
BEFORE INSERT ON public.pagos
FOR EACH ROW EXECUTE FUNCTION public.validar_pago_nuevo();

CREATE FUNCTION public.validar_movimiento_nuevo()
RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
    v_fecha_acuerdo date;
    v_importe_pago numeric(16, 2);
    v_fecha_pago date;
    v_revertido numeric(16, 2);
BEGIN
    PERFORM 1 FROM public.cuentas WHERE id = NEW.cuenta_id FOR UPDATE;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Cuenta inexistente';
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM public.perfiles_usuario
         WHERE id = NEW.registrado_por
           AND rol = 'administrador' AND activo
    ) THEN
        RAISE EXCEPTION 'Solo un administrador activo registra movimientos de saldo';
    END IF;

    SELECT fecha_acuerdo INTO v_fecha_acuerdo
      FROM public.planes_pago WHERE cuenta_id = NEW.cuenta_id;
    IF NOT FOUND OR NEW.fecha_efectiva < v_fecha_acuerdo
       OR NEW.fecha_efectiva > CURRENT_DATE THEN
        RAISE EXCEPTION 'La fecha del movimiento debe estar entre el acuerdo y hoy';
    END IF;

    IF NEW.impacto_saldo < 0
       AND public.saldo_cuenta(NEW.cuenta_id) + NEW.impacto_saldo < 0 THEN
        RAISE EXCEPTION 'El movimiento dejaria un saldo negativo';
    END IF;

    IF NEW.tipo IN ('reembolso', 'reversion_pago') THEN
        SELECT monto, fecha_pago INTO v_importe_pago, v_fecha_pago
          FROM public.pagos
         WHERE id = NEW.pago_origen_id AND cuenta_id = NEW.cuenta_id;

        IF NOT FOUND OR NEW.fecha_efectiva < v_fecha_pago THEN
            RAISE EXCEPTION 'El origen del reembolso/reversion no es valido';
        END IF;

        SELECT COALESCE(sum(impacto_saldo), 0) INTO v_revertido
          FROM public.movimientos_saldo
         WHERE pago_origen_id = NEW.pago_origen_id
           AND tipo IN ('reembolso', 'reversion_pago');

        IF v_revertido + NEW.impacto_saldo > v_importe_pago THEN
            RAISE EXCEPTION 'No se puede revertir mas que el monto del pago original';
        END IF;
    END IF;

    RETURN NEW;
END;
$$;

CREATE TRIGGER movimiento_validado
BEFORE INSERT ON public.movimientos_saldo
FOR EACH ROW EXECUTE FUNCTION public.validar_movimiento_nuevo();

CREATE FUNCTION public.validar_reporte()
RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
    v_generado_en timestamptz;
BEGIN
    IF TG_TABLE_NAME = 'reportes' THEN
        IF NOT EXISTS (
            SELECT 1 FROM public.perfiles_usuario
             WHERE id = NEW.generado_por AND activo
        ) THEN
            RAISE EXCEPTION 'El autor del reporte debe estar activo';
        END IF;
    ELSE
        IF NOT EXISTS (
            SELECT 1 FROM public.perfiles_usuario
             WHERE id = NEW.usuario_id AND rol = 'gestor' AND activo
        ) THEN
            RAISE EXCEPTION 'El destinatario debe ser un gestor activo';
        END IF;

        SELECT generado_en INTO v_generado_en
          FROM public.reportes WHERE id = NEW.reporte_id;
        IF NEW.entregado_en IS NOT NULL
           AND NEW.entregado_en < v_generado_en THEN
            RAISE EXCEPTION 'La entrega no puede preceder al reporte';
        END IF;
    END IF;
    RETURN NEW;
END;
$$;

CREATE TRIGGER reporte_validado
BEFORE INSERT ON public.reportes
FOR EACH ROW EXECUTE FUNCTION public.validar_reporte();

CREATE TRIGGER destinatario_validado
BEFORE INSERT ON public.reporte_destinatarios
FOR EACH ROW EXECUTE FUNCTION public.validar_reporte();

CREATE FUNCTION public.validar_entrega_reporte()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
    IF TG_OP = 'DELETE' THEN
        RAISE EXCEPTION 'No se eliminan destinatarios historicos';
    END IF;

    IF NEW.reporte_id IS DISTINCT FROM OLD.reporte_id
       OR NEW.usuario_id IS DISTINCT FROM OLD.usuario_id
       OR OLD.entregado_en IS NOT NULL
       OR NEW.entregado_en IS NULL
       OR NEW.entregado_en < (SELECT generado_en FROM public.reportes
                              WHERE id = NEW.reporte_id) THEN
        RAISE EXCEPTION 'Solo puede confirmarse una entrega pendiente';
    END IF;

    RETURN NEW;
END;
$$;

CREATE TRIGGER entrega_reporte_confirmable
BEFORE UPDATE OR DELETE ON public.reporte_destinatarios
FOR EACH ROW EXECUTE FUNCTION public.validar_entrega_reporte();

CREATE INDEX cuentas_deudor_idx ON public.cuentas(deudor_id);
CREATE INDEX cuentas_responsable_idx ON public.cuentas(responsable_id);
CREATE INDEX cuotas_cuenta_vencimiento_idx
    ON public.cuotas(cuenta_id, fecha_vencimiento);
CREATE INDEX pagos_cuenta_fecha_idx ON public.pagos(cuenta_id, fecha_pago);
CREATE INDEX movimientos_cuenta_fecha_idx
    ON public.movimientos_saldo(cuenta_id, fecha_efectiva);
CREATE INDEX movimientos_pago_origen_idx
    ON public.movimientos_saldo(pago_origen_id)
    WHERE pago_origen_id IS NOT NULL;
CREATE INDEX historial_cuenta_fecha_idx
    ON public.historial_asignaciones(cuenta_id, realizada_en);
CREATE INDEX reportes_autor_fecha_idx
    ON public.reportes(generado_por, generado_en);
CREATE INDEX destinatarios_usuario_idx
    ON public.reporte_destinatarios(usuario_id);

-- Cumplimiento al cierre de p_fecha. Una cuota no cubierta entra en mora
-- el dia DESPUES de su vencimiento; por eso exigible usa < p_fecha.
-- Los pagos, descuentos y reembolsos fechados el propio p_fecha si cuentan.
-- Los creditos se aplican a las cuotas por vencimiento (FIFO). Intereses
-- y recargos aumentan el saldo, sin alterar el plan pactado.
CREATE FUNCTION public.resumen_planes(p_fecha date DEFAULT CURRENT_DATE)
RETURNS TABLE (
    cuenta_id bigint,
    moneda varchar(3),
    monto_exigible numeric,
    credito_plan numeric,
    saldo numeric,
    estado_plan text,
    cuenta_liquidada boolean
)
LANGUAGE sql STABLE AS $$
    WITH totales AS (
        SELECT c.id, c.moneda, c.monto_inicial,
               COALESCE((
                   SELECT sum(q.monto) FROM public.cuotas q
                    WHERE q.cuenta_id = c.id
                      AND q.fecha_vencimiento < p_fecha
               ), 0) AS exigible,
               COALESCE((
                   SELECT sum(p.monto) FROM public.pagos p
                    WHERE p.cuenta_id = c.id AND p.fecha_pago <= p_fecha
               ), 0) AS pagado,
               COALESCE((
                   SELECT sum(m.impacto_saldo)
                     FROM public.movimientos_saldo m
                    WHERE m.cuenta_id = c.id
                      AND m.fecha_efectiva <= p_fecha
               ), 0) AS impacto,
               COALESCE((
                   SELECT sum(CASE
                       WHEN m.tipo IN ('descuento', 'condonacion', 'ajuste_abono')
                           THEN -m.impacto_saldo
                       WHEN m.tipo IN ('reembolso', 'reversion_pago',
                                       'ajuste_cargo')
                           THEN -m.impacto_saldo
                       ELSE 0
                   END)
                     FROM public.movimientos_saldo m
                    WHERE m.cuenta_id = c.id
                      AND m.fecha_efectiva <= p_fecha
               ), 0) AS credito_movimientos
          FROM public.cuentas c
    ), calculos AS (
        SELECT t.*,
               GREATEST(0, t.pagado + t.credito_movimientos) AS credito,
               t.monto_inicial - t.pagado + t.impacto AS saldo_calculado
          FROM totales t
    )
    SELECT r.id, r.moneda, r.exigible, r.credito,
           r.saldo_calculado,
           CASE
               WHEN r.credito >= r.monto_inicial THEN 'cubierto'
               WHEN r.credito < r.exigible THEN 'atrasado'
               ELSE 'al_corriente'
           END,
           r.saldo_calculado = 0
      FROM calculos r
$$;

COMMIT;
