import { Injectable, OnModuleDestroy, OnModuleInit, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Pool, types } from 'pg';
import type { PoolClient } from 'pg';

// Las fechas de negocio (DATE) se entregan tal cual, 'YYYY-MM-DD', sin
// convertirlas a Date con la zona horaria del proceso.
types.setTypeParser(types.builtins.DATE, (valor) => valor);

@Injectable()
export class DatabaseService implements OnModuleInit, OnModuleDestroy {
    private readonly pool: Pool;

    constructor(private readonly config: ConfigService) {
        this.pool = new Pool({
            connectionString: this.config.getOrThrow<string>('DATABASE_URL'),
            max: 5,
            // CURRENT_DATE de los triggers debe ser la fecha de Mexico; el
            // pooler conserva GMT aunque la base tenga otra zona por defecto.
            options: '-c TimeZone=America/Mexico_City',
        });
    }

    private readonly logger = new Logger(DatabaseService.name);

    async onModuleInit(): Promise<void> {
        await this.pool.query('SELECT 1 FROM public.deudores LIMIT 1');
        this.logger.log('Conexión a Neon comprobada; tabla deudores disponible');
    }

    async query(sql: string, params: unknown[] = []) {
        return this.pool.query(sql, params);
    }

    async transaction<T>(
        work: (client: PoolClient) => Promise<T>,
    ): Promise<T> {
        const client = await this.pool.connect();

        try {
            await client.query('BEGIN');
            const result = await work(client);
            await client.query('COMMIT');
            return result;
        } catch (error) {
            await client.query('ROLLBACK');
            throw error;
        } finally {
            client.release();
        }
    }

    async onModuleDestroy(): Promise<void> {
        await this.pool.end();
    }
}