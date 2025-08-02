import {and, eq, ne, relations, sql, SQL} from "drizzle-orm";
import {
    boolean,
    customType,
    integer,
    jsonb,
    numeric,
    pgEnum,
    pgTable,
    primaryKey,
    text,
    unique
} from "drizzle-orm/pg-core";
import {_users} from "../../db/schema";
import {hash, raw} from "../../db/types";

export const nanoReceivable = pgTable("nano_receivable", {
    blockHash: hash().primaryKey(),
    address: text().references(() => nanoAccount.address).notNull(),
    amount: raw().notNull(),
    source: text().notNull(),
});

export const nanoAccount = pgTable("nano_account", {
    address: text().primaryKey(),
    userId: text().references(() => _users.id).notNull(),
    index: integer().notNull(),
}, (t) => [
    unique().on(t.userId, t.index),
]);

export const receivableRelations = relations(nanoReceivable, ({ one }) => ({
    account: one(nanoAccount, {
        fields: [nanoReceivable.address],
        references: [nanoAccount.address],
    }),
}));

export const accountRelations = relations(nanoAccount, ({ many }) => ({
    receivable: many(nanoReceivable),
}));
