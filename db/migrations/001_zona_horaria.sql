-- Las fechas de negocio (vencimientos, pagos, CURRENT_DATE de los triggers)
-- se interpretan en hora de Mexico. Se fija en la base y no por conexion
-- porque DATABASE_URL usa el pooler en modo transaccion.
DO $$
BEGIN
    EXECUTE format(
        'ALTER DATABASE %I SET timezone TO %L',
        current_database(), 'America/Mexico_City'
    );
END;
$$;
