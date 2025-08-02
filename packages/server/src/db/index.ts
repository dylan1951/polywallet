import { drizzle } from 'drizzle-orm/node-postgres';
import * as schema from './schema';
import {Pool} from "pg";

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: {
        rejectUnauthorized: true,
        ca: process.env.DATABASE_CA,
    },
});

export const db = drizzle({
    client: pool,
    schema,
    casing: 'snake_case'
});
