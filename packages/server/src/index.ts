import { WebSocketServer } from 'ws';
import { applyWSSHandler } from '@trpc/server/adapters/ws';
import {publicProcedure, router} from './trpc';
import {nanoRouter} from "./coins/nano/router";
import {createContext} from "./context";
import {bitcoinRouter} from "./coins/bitcoin/router";
import {z} from "zod";
import EventEmitter, {on} from "events";
import {tracked} from "@trpc/server";
import {_transactions} from "./db/schema";
import {db} from "./db";
import {and, asc, eq, lte} from "drizzle-orm";
import {Transaction} from "@packages/shared";

export const ee = new EventEmitter<{
    transaction: [tx: Transaction, userId: string];
}>();

const appRouter = router({
    nano: nanoRouter,
    bitcoin: bitcoinRouter,
    onTransaction: publicProcedure
        .input(z.object({ lastEventId: z.string().nullish() }).optional())
        .subscription(async function* ({signal, ctx: { user }}) {
            for await (const [tx, userId] of on(ee, 'transaction', { signal })) {
                if (user.id === userId) {
                    console.log("Yielding transaction to subscription");
                    yield tracked(tx.hash, tx);
                }
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

const wss = new WebSocketServer({ port: 3001 });

applyWSSHandler({
    wss,
    router: appRouter,
    createContext
});

console.log('🚀 tRPC server listening on http://localhost:3001');
