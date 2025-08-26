import { integer, pgTable, text, unique, pgEnum, boolean, timestamp, primaryKey } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';
import { raw, hash, balance } from './types';
import { ENetwork } from '@packages/shared';

export const _users = pgTable('users', {
    id: text().primaryKey(),
    subscribed: boolean().notNull().default(false),
    webhookUrl: text(),
    webhookLastRenewed: timestamp(),
});

export const userRelations = relations(_users, ({ many }) => ({
    addresses: many(_addresses),
}));

export const network = pgEnum('network', ENetwork);

export const _transfers = pgTable('transfers', {
    id: text().primaryKey(),
    network: network().notNull(),
    contract: text(),
    to: text().notNull(),
    from: text().notNull(),
    amount: balance().notNull(),
    blockNum: integer().notNull(),
});

export const _addresses = pgTable(
    'addresses',
    {
        address: text().primaryKey(),
        userId: text()
            .references(() => _users.id)
            .notNull(),
        index: integer().notNull(),
        network: network().notNull(),
    },
    (t) => [unique().on(t.userId, t.index, t.network)]
);

export const addressRelations = relations(_addresses, ({ one }) => ({
    user: one(_users, {
        fields: [_addresses.userId],
        references: [_users.id],
    }),
}));
