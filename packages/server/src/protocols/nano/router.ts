import { publicProcedure, router } from '../../trpc';
import { z } from 'zod';
import { db } from '../../db';
import * as nano from './helper';
import { eq, and } from 'drizzle-orm';
import { listenForConfirmations } from './websocket';
import { _addresses } from '../../db/schema';
import { EProtocol, ProtocolNetworks, type Transfer } from '@packages/shared';
import Decimal from 'decimal.js';

const nanoProcedure = publicProcedure
    .input(z.object({ network: z.enum(ProtocolNetworks[EProtocol.Nano]) }))
    .use(({ ctx: { user }, input: { network }, next }) => {
        return next({
            ctx: {
                user,
                network,
            },
        });
    });

export const nanoRouter = router({
    getAddresses: nanoProcedure.query(async ({ ctx: { user, network } }) => {
        return db.query._addresses.findMany({
            where: and(eq(_addresses.userId, user.id), eq(_addresses.network, network)),
            columns: {
                userId: false,
                address: true,
                index: true,
            },
        });
    }),
    addAddress: nanoProcedure
        .input(z.object({ address: z.string(), index: z.number() }))
        .mutation(async ({ ctx: { user, network }, input: { address, index } }) => {
            await db.insert(_addresses).values({
                userId: user.id,
                address,
                index,
                network,
            });
        }),
    getAccountInfo: publicProcedure.input(z.string().describe('address')).query(async ({ input: address }) => {
        return await nano.accountInfo(address);
    }),
    getBalance: publicProcedure.input(z.string().describe('address')).query(async ({ input: address }) => {
        const result = await nano.accountsBalances([address]);
        return result[address];
    }),
    workGenerate: publicProcedure.input(z.string().describe('hash')).mutation(async ({ input: hash }) => {
        return nano.workGenerate(hash);
    }),
    processBlock: publicProcedure
        .input(
            z.object({
                type: z.literal('state'),
                account: z.string(),
                previous: z.string(),
                representative: z.string(),
                balance: z.string(),
                link: z.string(),
                link_as_account: z.string(),
                signature: z.string(),
                work: z.string(),
            })
        )
        .mutation(async ({ input: block }) => {
            await nano.processBlock(block);
        }),
    accountsReceivable: publicProcedure.input(z.array(z.string())).query(async ({ input: accounts }) => {
        return nano.accountsReceivable(accounts);
    }),
    getTransfers: nanoProcedure
        .input(z.object({ address: z.string() }))
        .query(async ({ input: { address }, ctx: { network } }) => {
            const { history } = await nano.accountHistory(address);

            const { blocks } = await nano.blocksInfo(
                history.filter((entry) => entry.type === 'receive').map((entry) => entry.hash)
            );

            return history.map(
                (entry) =>
                    ({
                        asset: { network },
                        amount: Decimal(entry.amount).div(10n ** 30n),
                        id: entry.type === 'send' ? entry.hash : blocks[entry.hash]!.contents.link,
                        to: entry.type === 'send' ? entry.account : address,
                        from: entry.type === 'receive' ? entry.account : address,
                        confirmations: 1,
                    }) satisfies Transfer
            );
        }),
});

void listenForConfirmations();
