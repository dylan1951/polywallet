import { drizzle as drizzleNodePostgres } from 'drizzle-orm/node-postgres';
import { drizzle as drizzlePgLite } from 'drizzle-orm/pglite';
import * as schema from './schema';
import { Pool } from 'pg';
import { PgDatabase, PgQueryResultHKT } from 'drizzle-orm/pg-core';

function getDatabase() {
    if (process.env.DATABASE_URL || process.env.DATABASE_HOST) {
        const client = new Pool({
            ...(process.env.DATABASE_URL ? { connectionString: process.env.DATABASE_URL } : {
                host: process.env.DATABASE_HOST!,
                port: parseInt(process.env.DATABASE_PORT!),
                user: process.env.DATABASE_USER!,
                password: process.env.DATABASE_PASSWORD!,
                database: process.env.DATABASE_NAME!,
            }),
            ...(process.env.DATABASE_CA && {
                ssl: {
                    rejectUnauthorized: true,
                    ca: process.env.DATABASE_CA,
                }
            }),
        });

        return drizzleNodePostgres({
            client,
            schema,
            casing: 'snake_case',
        });
    } else {
        return drizzlePgLite({
            schema,
            casing: 'snake_case',
            connection: {
                dataDir: './pglite'
            }
        });
    }
}

export const db: PgDatabase<PgQueryResultHKT, typeof schema> = getDatabase();

