import { customType } from 'drizzle-orm/pg-core';
import Decimal from 'decimal.js';

export const raw = customType<{ data: bigint; driverData: string }>({
    dataType() {
        return 'numeric(39,0)';
    },
    toDriver(value: bigint) {
        return value.toString();
    },
    fromDriver(value: string) {
        return BigInt(value);
    },
});

export const balance = customType<{ data: Decimal; driverData: string }>({
    dataType() {
        return 'numeric(50,30)';
    },
    toDriver(value: Decimal) {
        return value.toFixed();
    },
    fromDriver(value: string) {
        return Decimal(value);
    },
});

export const hash = customType<{ data: string; driverData: Buffer }>({
    dataType() {
        return 'bytea';
    },
    toDriver(hash: string): Buffer {
        return Buffer.from(hash, 'hex');
    },
    fromDriver(hashBuffer: Buffer): string {
        return hashBuffer.toString('hex').padStart(64, '0');
    },
});
