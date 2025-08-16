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
import {and, asc, eq, lte} from "drizzle-orm";
import {Transaction} from "@packages/shared";
import {} from './protocols/ethereum/webhook';
import {ethereumRouter} from "./protocols/ethereum/router";

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

const wss = new WebSocketServer({ host: "0.0.0.0", port: 3001 });

wss.on('connection', (ws) => {
    console.log('Client connected');
})

applyWSSHandler({
    wss,
    router: appRouter,
    createContext
});

console.log(`🚀 tRPC server listening on ws://${wss.options.host}:${wss.options.port}`);
