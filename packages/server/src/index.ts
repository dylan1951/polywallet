import { WebSocketServer } from 'ws';
import { applyWSSHandler } from '@trpc/server/adapters/ws';
import { publicProcedure, router } from './trpc';
import { nanoRouter } from './protocols/nano/router';
import { createContext } from './context';
import { z } from 'zod';
import EventEmitter, { on } from 'events';
import { tracked } from '@trpc/server';
import { _transfers } from './db/schema';
import { db } from './db';
import { type Transfer } from '@packages/shared';
import { ethereumRouter } from './protocols/ethereum/router';
import webhookRouter from './protocols/ethereum/webhook';
import express from 'express';
import * as http from 'node:http';
import { bitcoinRouter } from './protocols/bitcoin/router';

export const ee = new EventEmitter<{
    transfer: [tx: Transfer & { blockNum: number }, userId: string];
}>();

ee.on('transfer', async (tx) => {
    await db
        .insert(_transfers)
        .values({
            network: tx.asset.network,
            to: tx.to,
            from: tx.from,
            amount: tx.amount,
            blockNum: tx.blockNum,
            id: tx.id,
        })
        .onConflictDoUpdate({
            target: _transfers.id,
            set: {
                // In case of re-org?
                blockNum: tx.blockNum,
            },
        });
});

const appRouter = router({
    nano: nanoRouter,
    ethereum: ethereumRouter,
    bitcoin: bitcoinRouter,
    onTransaction: publicProcedure
        .input(z.object({ lastEventId: z.string().nullish() }).optional())
        .subscription(async function* ({ signal, ctx: { user } }) {
            try {
                for await (const [tx, userId] of on(ee, 'transfer', { signal })) {
                    if (user.id === userId) {
                        console.log(`Yielding transfer to subscription for user ${userId}`, tx);
                        yield tracked(tx.id, tx);
                    }
                }
            } finally {
                console.log('Subscription closed');
            }
        }),
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
    createContext,
});

const PORT = 3001;
server.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 HTTP + WS server listening on http://0.0.0.0:${PORT}`);
});
