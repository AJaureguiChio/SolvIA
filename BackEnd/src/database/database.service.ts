import { Injectable, OnModuleDestroy, OnModuleInit, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Pool } from 'pg';
import type { PoolClient } from 'pg';

@Injectable()
export class DatabaseService implements OnModuleInit, OnModuleDestroy {
    private readonly pool: Pool;

    constructor(private readonly config: ConfigService) {
        this.pool = new Pool({
            connectionString: this.config.getOrThrow<string>('DATABASE_URL'),
            max: 5,
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