import {
    integer,
    pgTable,
    varchar,
    text,
    numeric,
    real,
    unique,
    primaryKey,
    jsonb,
    pgEnum,
    boolean, customType
} from "drizzle-orm/pg-core";
import {relations} from "drizzle-orm";
import {raw, hash} from "./types";
import {ENetwork} from "@packages/shared";

export const _users = pgTable("users", {
    id: text().primaryKey(),
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

export * from "../coins/nano/model"
