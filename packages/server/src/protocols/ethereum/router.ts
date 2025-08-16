import { publicProcedure, router } from '../../trpc';
import { db } from '../../db';
import { z } from 'zod';
import { helpers } from './helper';
import { _addresses, network } from '../../db/schema';
import { TRPCError } from '@trpc/server';
import { eq, and } from 'drizzle-orm';
import { ProtocolNetworks, EProtocol } from '@packages/shared';

const ethereumProcedure = publicProcedure
    .input(z.object({ network: z.enum(ProtocolNetworks[EProtocol.Ethereum]) }))
    .use(({ ctx: { user }, input: { network }, next }) => {
        return next({
            ctx: {
                user,
                helper: helpers[network],
                network: network,
            },
        });
    });

export const ethereumRouter = router({
    addAddress: ethereumProcedure
        .input(z.object({ address: z.string(), index: z.number() }))
        .mutation(async ({ ctx: { user, helper, network }, input: { address, index } }) => {
            await db.insert(_addresses).values({
                userId: user.id,
                address: address,
                index,
                network,
            });

            await helper.watchAddress(address);
            console.log(`Alchemy now watching ${address}`);
        }),
    getBalance: ethereumProcedure
        .input(z.object({ address: z.string() }))
        .query(async ({ input: { address }, ctx: { helper } }) => {
            return helper.provider.getBalance(address);
        }),
    getAddresses: ethereumProcedure.query(async ({ ctx: { user, network } }) => {
        return db.query._addresses.findMany({
            where: and(eq(_addresses.userId, user.id), eq(_addresses.network, network)),
            columns: {
                userId: false,
                address: true,
                index: true,
            },
        });
    }),
    getFeeData: ethereumProcedure.query(async ({ ctx: { helper } }) => {
        const { maxPriorityFeePerGas, maxFeePerGas } = await helper.provider.getFeeData();

        if (!maxFeePerGas || !maxPriorityFeePerGas) {
            throw Error('Max fee per gas is not set');
        }

        return {
            maxPriorityFeePerGas,
            maxFeePerGas,
        };
    }),
    getTransactionCount: ethereumProcedure
        .input(z.object({ address: z.string() }))
        .query(async ({ input: { address }, ctx: { helper } }) => {
            return helper.provider.getTransactionCount(address);
        }),
    sendTransaction: ethereumProcedure
        .input(z.object({ rawTransaction: z.string() }))
        .mutation(async ({ input: { rawTransaction }, ctx: { helper } }) => {
            await helper.provider.broadcastTransaction(rawTransaction);
        }),
});
