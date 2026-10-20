-- Datos ficticios para la demo de SolvIA. Se carga con `npm run db:seed`
-- (BackEnd) dentro de una transaccion. Las fechas son relativas a
-- CURRENT_DATE para que los estados de mora sigan teniendo sentido el dia
-- de la presentacion. CURP, RFC, nombres y telefonos son inventados.
--
-- Requisitos: un administrador activo en perfiles_usuario y las identidades
-- gestor1@solvia.demo y gestor2@solvia.demo en neon_auth."user".

INSERT INTO public.perfiles_usuario (id, rol)
SELECT u.id, 'gestor'
  FROM neon_auth."user" u
 WHERE u.email IN ('gestor1@solvia.demo', 'gestor2@solvia.demo')
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.deudores
    (curp, rfc, nombre, telefono, ciudad, segmento, score_buro)
VALUES
    ('GOMR850312HNLRRB04', 'GOMR850312AB1', 'Ramón Gómez Ruiz', '8110000001', 'Monterrey', 'Consumo', 640),
    ('LOPA900725MNLPRN08', NULL, 'Ana López Pérez', '8110000002', 'San Nicolás', 'Consumo', 580),
    ('HERJ781104HCHRRS02', NULL, 'Jesús Hernández Reyes', '6140000003', 'Chihuahua', 'Consumo', 455),
    ('MARL950218MCLRZR06', NULL, 'Lorena Martínez Ruiz', '8440000004', 'Saltillo', 'Nómina', 510),
    ('SAGC880930HNLNRR01', NULL, 'Carlos Sánchez García', '8110000005', 'Guadalupe', 'Nómina', 390),
    ('TORM820611MTSRRR09', NULL, 'Mariana Torres Rivera', '8340000006', 'Ciudad Victoria', 'Consumo', 720),
    ('RAVE990105HNLMLD03', NULL, 'Eduardo Ramírez Vela', '8110000007', 'Apodaca', 'Consumo', 690),
    ('FLCD870420MJCLRN05', NULL, 'Diana Flores Cruz', '3330000008', 'Guadalajara', 'Consumo', 530),
    ('CAMP930814HDFSRB07', NULL, 'Pablo Castro Medina', '5550000009', 'Ciudad de México', 'PyME', 610),
    ('VEAS010322MNLGLF00', NULL, 'Sofía Vega Alanís', '8110000010', 'Monterrey', 'Nómina', 750),
    (NULL, 'DIN180509KT3', 'Distribuidora Industrial del Norte', '8180000011', 'Monterrey', 'PyME', 560),
    (NULL, 'CSN190501QX2', 'Comercializadora Sierra Norte', '8180000012', 'Santa Catarina', 'PyME', 420);

-- Ayudantes temporales: desaparecen al cerrar la conexion del seed.
CREATE FUNCTION pg_temp.admin() RETURNS uuid LANGUAGE sql AS $$
    SELECT id FROM public.perfiles_usuario
     WHERE rol = 'administrador' AND activo
     ORDER BY id LIMIT 1
$$;

CREATE FUNCTION pg_temp.gestor(p_email text) RETURNS uuid LANGUAGE sql AS $$
    SELECT p.id FROM public.perfiles_usuario p
      JOIN neon_auth."user" u ON u.id = p.id
     WHERE u.email = p_email AND p.rol = 'gestor' AND p.activo
$$;

CREATE FUNCTION pg_temp.deudor(p_ident text) RETURNS bigint LANGUAGE sql AS $$
    SELECT id FROM public.deudores WHERE curp = p_ident OR rfc = p_ident
$$;

CREATE FUNCTION pg_temp.venc(p_cuenta bigint, p_numero int)
RETURNS date LANGUAGE sql AS $$
    SELECT fecha_vencimiento FROM public.cuotas
     WHERE cuenta_id = p_cuenta AND numero = p_numero
$$;

-- Cuenta + plan + cuotas mensuales iguales (el centavo sobrante va en la
-- ultima). El acuerdo se fecha p_meses meses y p_dias dias antes de hoy.
CREATE FUNCTION pg_temp.cuenta(
    p_deudor bigint, p_ref text, p_producto text, p_monto numeric,
    p_meses int, p_dias int, p_cuotas int, p_responsable uuid
) RETURNS bigint LANGUAGE plpgsql AS $$
DECLARE
    v_acuerdo date := (CURRENT_DATE
        - make_interval(months => p_meses, days => p_dias))::date;
    v_base numeric(16, 2) := trunc(p_monto / p_cuotas, 2);
    v_id bigint;
BEGIN
    INSERT INTO public.cuentas (
        deudor_id, referencia_externa, producto, monto_inicial,
        fecha_originacion, responsable_id, asignacion_modificada_por
    ) VALUES (
        p_deudor, p_ref, p_producto, p_monto, v_acuerdo - 3, p_responsable,
        CASE WHEN p_responsable IS NOT NULL THEN pg_temp.admin() END
    ) RETURNING id INTO v_id;

    INSERT INTO public.planes_pago (cuenta_id, fecha_acuerdo)
    VALUES (v_id, v_acuerdo);

    INSERT INTO public.cuotas (cuenta_id, numero, fecha_vencimiento, monto)
    SELECT v_id, k, (v_acuerdo + make_interval(months => k))::date,
           CASE WHEN k = p_cuotas THEN p_monto - v_base * (p_cuotas - 1)
                ELSE v_base END
      FROM generate_series(1, p_cuotas) AS k;

    RETURN v_id;
END;
$$;

-- Pago capturado por el gestor responsable de la cuenta.
CREATE FUNCTION pg_temp.pago(p_cuenta bigint, p_fecha date, p_monto numeric)
RETURNS bigint LANGUAGE sql AS $$
    INSERT INTO public.pagos (cuenta_id, fecha_pago, monto, registrado_por)
    SELECT id, p_fecha, p_monto, responsable_id
      FROM public.cuentas WHERE id = p_cuenta
    RETURNING id
$$;

CREATE FUNCTION pg_temp.movimiento(
    p_cuenta bigint, p_tipo text, p_impacto numeric, p_fecha date,
    p_motivo text, p_pago bigint DEFAULT NULL
) RETURNS void LANGUAGE sql AS $$
    INSERT INTO public.movimientos_saldo (
        cuenta_id, tipo, impacto_saldo, fecha_efectiva, motivo,
        pago_origen_id, registrado_por
    ) VALUES (
        p_cuenta, p_tipo, p_impacto, p_fecha, p_motivo, p_pago,
        pg_temp.admin()
    )
$$;

DO $$
DECLARE
    g1 uuid := pg_temp.gestor('gestor1@solvia.demo');
    g2 uuid := pg_temp.gestor('gestor2@solvia.demo');
    c bigint;
    p bigint;
BEGIN
    IF pg_temp.admin() IS NULL OR g1 IS NULL OR g2 IS NULL THEN
        RAISE EXCEPTION 'Faltan el administrador activo o los gestores demo';
    END IF;

    -- Al corriente: tres cuotas vencidas, las tres pagadas a tiempo.
    c := pg_temp.cuenta(pg_temp.deudor('GOMR850312HNLRRB04'), 'SOL-001',
        'Crédito personal', 12000, 3, 5, 6, g1);
    PERFORM pg_temp.pago(c, pg_temp.venc(c, k) - 2, 2000)
       FROM generate_series(1, 3) AS k;

    -- Atrasada ~5 dias: la segunda cuota acaba de vencer sin pago.
    c := pg_temp.cuenta(pg_temp.deudor('LOPA900725MNLPRN08'), 'SOL-002',
        'Tarjeta de crédito', 9000, 2, 5, 6, g1);
    PERFORM pg_temp.pago(c, pg_temp.venc(c, 1) - 1, 1500);

    -- Atrasada ~20 dias.
    c := pg_temp.cuenta(pg_temp.deudor('HERJ781104HCHRRS02'), 'SOL-003',
        'Crédito automotriz', 10000, 3, 20, 4, g1);
    PERFORM pg_temp.pago(c, pg_temp.venc(c, k), 2500)
       FROM generate_series(1, 2) AS k;

    -- Atrasada ~45 dias: solo cubrio la primera cuota.
    c := pg_temp.cuenta(pg_temp.deudor('MARL950218MCLRZR06'), 'SOL-004',
        'Crédito personal', 18000, 3, 15, 6, g2);
    PERFORM pg_temp.pago(c, pg_temp.venc(c, 1) - 3, 3000);

    -- Atrasada ~90 dias, sin pagos y con recargo.
    c := pg_temp.cuenta(pg_temp.deudor('SAGC880930HNLNRR01'), 'SOL-005',
        'Préstamo de nómina', 12000, 4, 0, 12, g2);
    PERFORM pg_temp.movimiento(c, 'recargo', 350, pg_temp.venc(c, 1) + 5,
        'Recargo por falta de pago de la primera cuota');

    -- Plan cubierto y cuenta liquidada.
    c := pg_temp.cuenta(pg_temp.deudor('TORM820611MTSRRR09'), 'SOL-006',
        'Crédito personal', 3600, 5, 0, 3, g1);
    PERFORM pg_temp.pago(c, pg_temp.venc(c, k) - 4, 1200)
       FROM generate_series(1, 3) AS k;

    -- Plan cubierto pero cuenta NO liquidada: recargo posterior pendiente.
    c := pg_temp.cuenta(pg_temp.deudor('RAVE990105HNLMLD03'), 'SOL-007',
        'Tarjeta de crédito', 5000, 4, 0, 2, g2);
    PERFORM pg_temp.pago(c, pg_temp.venc(c, k) - 2, 2500)
       FROM generate_series(1, 2) AS k;
    PERFORM pg_temp.movimiento(c, 'recargo', 300, CURRENT_DATE - 10,
        'Comisión por pago tardío del periodo anterior');

    -- Pago revertido por captura equivocada: vuelve a quedar atrasada.
    c := pg_temp.cuenta(pg_temp.deudor('FLCD870420MJCLRN05'), 'SOL-008',
        'Crédito personal', 7200, 2, 10, 4, g1);
    PERFORM pg_temp.pago(c, pg_temp.venc(c, 1) - 1, 1800);
    p := pg_temp.pago(c, pg_temp.venc(c, 2) - 2, 1800);
    PERFORM pg_temp.movimiento(c, 'reversion_pago', 1800,
        pg_temp.venc(c, 2) - 1, 'Pago capturado en la cuenta equivocada', p);

    -- Sin gestor asignado y sin cuotas exigibles todavia.
    c := pg_temp.cuenta(pg_temp.deudor('CAMP930814HDFSRB07'), 'SOL-009',
        'Crédito PyME', 12000, 0, 10, 6, NULL);

    -- Al corriente, cuenta reciente.
    c := pg_temp.cuenta(pg_temp.deudor('VEAS010322MNLGLF00'), 'SOL-010',
        'Préstamo de nómina', 8000, 1, 3, 10, g2);
    PERFORM pg_temp.pago(c, pg_temp.venc(c, 1) - 1, 800);

    -- Atrasada ~12 dias con pago parcial (cubre 60 % de lo exigible).
    c := pg_temp.cuenta(pg_temp.deudor('DIN180509KT3'), 'SOL-011',
        'Crédito PyME', 10000, 1, 12, 5, g2);
    PERFORM pg_temp.pago(c, pg_temp.venc(c, 1) - 1, 1200);

    -- Segunda cuenta de un deudor: liquidada con ayuda de un descuento.
    c := pg_temp.cuenta(pg_temp.deudor('GOMR850312HNLRRB04'), 'SOL-012',
        'Tarjeta de crédito', 3000, 3, 0, 3, g1);
    PERFORM pg_temp.pago(c, pg_temp.venc(c, k) - 1, 1000)
       FROM generate_series(1, 2) AS k;
    PERFORM pg_temp.movimiento(c, 'descuento', -500, pg_temp.venc(c, 2) + 3,
        'Descuento por liquidación anticipada');
    PERFORM pg_temp.pago(c, pg_temp.venc(c, 2) + 5, 500);

    -- Atrasada ~60 dias, sin pagos y con intereses.
    c := pg_temp.cuenta(pg_temp.deudor('CSN190501QX2'), 'SOL-013',
        'Crédito PyME', 6000, 3, 0, 4, g1);
    PERFORM pg_temp.movimiento(c, 'interes', 180, CURRENT_DATE - 15,
        'Intereses moratorios del periodo');

    -- Deudor con cuentas de ambos gestores; esta va adelantada.
    c := pg_temp.cuenta(pg_temp.deudor('HERJ781104HCHRRS02'), 'SOL-014',
        'Crédito personal', 6000, 2, 0, 6, g2);
    PERFORM pg_temp.pago(c, pg_temp.venc(c, 1) - 3, 3000);
END;
$$;
