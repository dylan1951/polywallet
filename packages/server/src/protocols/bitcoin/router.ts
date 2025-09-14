import { publicProcedure, router } from '../../trpc';
import { z } from 'zod';
import { EProtocol, ProtocolNetworks } from '@packages/shared';
import { db } from '../../db';
import { _addresses } from '../../db/schema';
import { and, eq } from 'drizzle-orm';

const bitcoinProcedure = publicProcedure
    .input(z.object({ network: z.enum(ProtocolNetworks[EProtocol.Bitcoin]) }))
    .use(({ ctx: { user }, input: { network }, next }) => {
        return next({
            ctx: {
                user,
                network: network,
            },
        });
    });

export const bitcoinRouter = router({
    addAddress: bitcoinProcedure
        .input(z.object({ address: z.string(), index: z.number() }))
        .mutation(async ({ ctx: { user, network }, input: { address, index } }) => {
            await db.insert(_addresses).values({
                userId: user.id,
                address: address,
                index,
                network,
            });
        }),
    getAddresses: bitcoinProcedure.query(async ({ ctx: { user, network } }) => {
        return db.query._addresses.findMany({
            where: and(eq(_addresses.userId, user.id), eq(_addresses.network, network)),
            columns: {
                userId: false,
                address: true,
                index: true,
            },
        });
    }),
});
