import {publicProcedure, router} from "../../trpc";
import {db} from "../../db";
import {eq} from "drizzle-orm";
import {nanoAccount} from "../nano/model";

export const bitcoinRouter = router({
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
});
