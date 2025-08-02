import {publicProcedure, router} from "../../trpc";
import {z} from "zod";
import {nanoAccount} from "./model";
import {db} from "../../db";
import {tracked, TRPCError} from "@trpc/server";
import * as nano from "./helper"
import {eq} from "drizzle-orm";
import {listenForConfirmations} from "./websocket";

export const nanoRouter = router({
    getAccounts: publicProcedure.query(async ({ctx: {user}}) => {
        return db.query.nanoAccount.findMany({
            where: eq(nanoAccount.userId, user.id),
            columns: {
                userId: false,
                address: true,
                index: true,
            }
        });
    }),
    addAddress: publicProcedure
        .input(z.object({ address: z.string(), index: z.number() }))
        .mutation(async ({ctx: {user}, input: {address, index}}) => {
            const {rowCount} = await db.insert(nanoAccount).values({
                userId: user.id,
                address,
                index,
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
            return nano.processBlock(block);
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
