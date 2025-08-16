import { WebSocketServer } from 'ws';
import { applyWSSHandler } from '@trpc/server/adapters/ws';
import {publicProcedure, router} from './trpc';
import {nanoRouter} from "./protocols/nano/router";
import {createContext} from "./context";
import {z} from "zod";
import EventEmitter, {on} from "events";
import {tracked} from "@trpc/server";
import {_transactions} from "./db/schema";
import {db} from "./db";
import {and, eq, lte} from "drizzle-orm";
import {Transaction} from "@packages/shared";
import {ethereumRouter} from "./protocols/ethereum/router";
import webhookRouter from './protocols/ethereum/webhook';
import express from 'express';
import * as http from 'node:http';

export const ee = new EventEmitter<{
    transaction: [tx: Transaction, userId: string];
}>();

const appRouter = router({
    nano: nanoRouter,
    ethereum: ethereumRouter,
    onTransaction: publicProcedure
        .input(z.object({ lastEventId: z.string().nullish() }).optional())
        .subscription(async function* ({signal, ctx: { user }}) {
            try {
                for await (const [tx, userId] of on(ee, 'transaction', { signal })) {
                    if (user.id === userId) {
                        console.log("Yielding transaction to subscription");
                        yield tracked(tx.hash, tx);
                    }
                }
            } finally {
                console.log("Subscription closed");
            }
        }),
    acknowledge: publicProcedure
        .input(z.object({ id: z.number() }))
        .mutation(async ({input: {id}, ctx: {user}}) => {
            await db.update(_transactions).set({ acknowledged: true }).where(and(
                eq(_transactions.userId, user.id),
                lte(_transactions.id, id)
            ));
        })
});

// Export type router type signature,
// NOT the router itself.
export type AppRouter = typeof appRouter;

const app = express();
app.use('/webhook', webhookRouter);

const server = http.createServer(app);
const wss = new WebSocketServer({ server });

applyWSSHandler({
    wss,
    router: appRouter,
    createContext
});

const PORT = 3001;
server.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 HTTP + WS server listening on http://0.0.0.0:${PORT}`);
});
