import { initTRPC } from '@trpc/server';
import type {Context} from "./context";
import superjson, {SuperJSON} from 'superjson';
import Decimal from "decimal.js";

SuperJSON.registerCustom<Decimal, string>(
    {
        isApplicable: (v): v is Decimal => Decimal.isDecimal(v),
        serialize: v => v.toJSON(),
        deserialize: v => new Decimal(v),
    },
    'decimal.js'
);

/**
 * Initialization of tRPC backend
 * Should be done only once per backend!
 */
const t = initTRPC.context<Context>().create({
    transformer: superjson
});

/**
 * Export reusable router and procedure helpers
 * that can be used throughout the router
 */
export const router = t.router;
export const publicProcedure = t.procedure;
