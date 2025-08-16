import {publicProcedure, router} from "../../trpc";
import {z} from "zod";
import {db} from "../../db";
import {TRPCError} from "@trpc/server";
import * as nano from "./helper"
import {eq, and} from "drizzle-orm";
import {listenForConfirmations} from "./websocket";
import {_addresses} from "../../db/schema";
import { ENetwork, EProtocol, ProtocolNetworks } from '@packages/shared';

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
    getAddresses: nanoProcedure.query(async ({ctx: {user, network}}) => {
        return db.query._addresses.findMany({
            where: and(eq(_addresses.userId, user.id), eq(_addresses.network, network)),
            columns: {
                userId: false,
                address: true,
                index: true,
            }
        });
    }),
    addAddress: nanoProcedure
        .input(z.object({ address: z.string(), index: z.number() }))
        .mutation(async ({ctx: {user}, input: {address, index}}) => {
            const {rowCount} = await db.insert(_addresses).values({
                userId: user.id,
                address,
                index,
                network: ENetwork.NANO_MAINNET,
            });

            if (rowCount !== 1) {
                throw new TRPCError({code: "BAD_REQUEST", message: 'Failed to create address'});
            }
        }),
    getAccountInfo: publicProcedure
        .input(z.string().describe('address'))
        .query(async ({input: address}) => {
            return await nano.accountInfo(address);
        }),
    getBalance: publicProcedure
        .input(z.string().describe('address'))
        .query(async ({input: address}) => {
            const result = await nano.accountsBalances([address]);
            return result[address];
        }),
    workGenerate: publicProcedure
        .input(z.string().describe("hash"))
        .mutation(async ({input: hash}) => {
            return nano.workGenerate(hash);
        }),
    processBlock: publicProcedure
        .input(z.object({
            type: z.literal("state"),
            account: z.string(),
            previous: z.string(),
            representative: z.string(),
            balance: z.string(),
            link: z.string(),
            link_as_account: z.string(),
            signature: z.string(),
            work: z.string(),
        }))
        .mutation(async ({input: block}) => {
            await nano.processBlock(block);
        }),
    accountsReceivable: publicProcedure
        .input(z.array(z.string()))
        .query(async ({input: accounts}) => {
            return nano.accountsReceivable(accounts);
        }),
    acknowledgeReceipt: publicProcedure
        .input(z.string().describe('txHash'))
        .mutation(async ({input: txHash}) => {

        })
});

void listenForConfirmations();
