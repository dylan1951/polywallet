import { publicProcedure, router } from '../../trpc';
import { z } from 'zod';
import { db } from '../../db';
import { eq, and } from 'drizzle-orm';
import { listenForConfirmations } from './websocket';
import { _addresses } from '../../db/schema';
import { EProtocol, ProtocolNetworks, type Transfer } from '@packages/shared';
import Decimal from 'decimal.js';
import { helpers } from './helper';

const nanoProcedure = publicProcedure
    .input(z.object({ network: z.enum(ProtocolNetworks[EProtocol.Nano]) }))
    .use(({ ctx: { user }, input: { network }, next }) => {
        return next({
            ctx: {
                user,
                helper: helpers[network],
                network,
            },
        });
    });

export const nanoRouter = router({
    getAddresses: nanoProcedure.query(async ({ ctx: { user, network, helper } }) => {
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
        .mutation(async ({ ctx: { user, network, helper }, input: { address, index } }) => {
            await db.insert(_addresses).values({
                userId: user.id,
                address,
                index,
                network,
            });
        }),
    getAccountInfo: nanoProcedure
        .input(z.object({ address: z.string() }))
        .query(async ({ input: { address }, ctx: { helper } }) => {
            return await helper.accountInfo(address);
        }),
    getBalance: nanoProcedure
        .input(z.object({ address: z.string() }))
        .query(async ({ input: { address }, ctx: { helper } }) => {
            const result = await helper.accountsBalances([address]);
            return result[address];
        }),
    workGenerate: nanoProcedure
        .input(z.object({ hash: z.string() }))
        .mutation(async ({ input: { hash }, ctx: { helper } }) => {
            return helper.workGenerate(hash);
        }),
    processBlock: nanoProcedure
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
        .mutation(async ({ input: block, ctx: { helper } }) => {
            await helper.processBlock(block);
        }),
    accountsReceivable: nanoProcedure
        .input(z.object({ accounts: z.array(z.string()) }))
        .query(async ({ input: { accounts }, ctx: { helper } }) => {
            return helper.accountsReceivable(accounts);
        }),
    getTransfers: nanoProcedure
        .input(z.object({ address: z.string() }))
        .query(async ({ input: { address }, ctx: { network, helper } }) => {
            const { history } = await helper.accountHistory(address);

            const { blocks } = await helper.blocksInfo(
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
    healthCheck: nanoProcedure.query(async ({ ctx: { helper } }) => {
        const version = await helper.version();
        return version.network === 'live';
    }),
});

// void listenForConfirmations();
