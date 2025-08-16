import { drizzle } from 'drizzle-orm/node-postgres';
import * as schema from './schema';
import {Pool} from "pg";

const pool = new Pool({
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

export const db = drizzle({
    client: pool,
    schema,
    casing: 'snake_case'
});

// deploy
