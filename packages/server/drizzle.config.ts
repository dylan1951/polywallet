import 'dotenv/config';
import { defineConfig } from 'drizzle-kit';

export default defineConfig({
    out: './drizzle',
    schema: './src/db/schema.ts',
    dialect: 'postgresql',
    dbCredentials: {
        ...(process.env.DATABASE_URL ? { url: process.env.DATABASE_URL } : {
            host: process.env.DATABASE_HOST!,
            port: parseInt(process.env.DATABASE_PORT!),
            user: process.env.DATABASE_USER!,
            password: process.env.DATABASE_PASSWORD!,
            database: process.env.DATABASE_NAME!,
        }),
        ...(process.env.DATABASE_CA && {
            ssl: {
                rejectUnauthorized: true,
                ca: process.env.DATABASE_CA!
            }
        })

    },
    casing: "snake_case"
});
