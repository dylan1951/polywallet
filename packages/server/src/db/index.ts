import { drizzle } from 'drizzle-orm/node-postgres';
import * as schema from './schema';
import {Pool} from "pg";

console.log('process.env.DATABASE_CA_CERT', process.env.DATABASE_CA_CERT);
console.log('process.env.DATABASE_CA', process.env.DATABASE_CA);

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: {
        rejectUnauthorized: true,
        ca: process.env.DATABASE_CA_CERT,
    },
});

export const db = drizzle({
    client: pool,
    schema,
    casing: 'snake_case'
});
