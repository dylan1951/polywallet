import {
    integer,
    pgTable,
    text,
    unique,
    pgEnum,
    boolean,
    timestamp,
} from "drizzle-orm/pg-core";
import {relations} from "drizzle-orm";
import {raw, hash} from "./types";
import {ENetwork} from "@packages/shared";

export const _users = pgTable("users", {
    id: text().primaryKey(),
    subscribed: boolean().notNull().default(false),
    webhookUrl: text(),
    webhookLastRenewed: timestamp()
});

export const userRelations = relations(_users, ({ many }) => ({

}));

export const network = pgEnum("network", ENetwork);

export const _transactions = pgTable("transactions", {
    id: integer().primaryKey().generatedAlwaysAsIdentity(),
    network: network().notNull(),
    contract: text(),
    userId: text().references(() => _users.id).notNull(),
    address: text().notNull(),
    amount: raw().notNull(),
    hash: hash().notNull(),
    acknowledged: boolean().notNull().default(false),
    source: text().notNull(),
});

export const _addresses = pgTable("addresses", {
    address: text().primaryKey(),
    userId: text().references(() => _users.id).notNull(),
    index: integer().notNull(),
    network: network().notNull(),
    watching: boolean().notNull().default(true),
}, (t) => [
    unique().on(t.userId, t.index, t.network),
]);
