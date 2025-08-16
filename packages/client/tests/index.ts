import {CoinTypeExt, HDWallet} from "../src/trust-wallet";
import {PolyWallet} from "../src";
import {expect} from "bun:test";
import { ENetwork } from '@packages/shared';
import Decimal from "decimal.js";
import type { test as bunTest } from 'bun:test';

declare module "bun:test" {
    interface Matchers<T> {
        toDecimalEqual(expected: Decimal, customMessage?: string): T;
        toDecimalBeGreaterThan(expected: Decimal, customMessage?: string): T;
    }
}

function generateMnemonic(): string {
    return HDWallet.create(128, "").mnemonic();
}

expect.extend({
    toDecimalEqual(received, expected: Decimal, customMessage?: string) {
        if (!Decimal.isDecimal(received) || !Decimal.isDecimal(expected)) {
            throw new Error('Invalid usage');
        }

        let pass = received.equals(expected);

        if (this.isNot) {
            pass = !pass;
        }

        if (customMessage) {
            return {
                pass,
                message: customMessage,
            }
        }

        return {
            pass,
            message: `expected ${received} to${pass ? "" : " not"} equal ${expected}`,
        };
    },
    toDecimalBeGreaterThan(received, expected: Decimal, customMessage?: string) {
        if (!Decimal.isDecimal(received) || !Decimal.isDecimal(expected)) {
            throw new Error('Invalid usage');
        }

        let pass = received.greaterThan(expected);

        if (this.isNot) {
            pass = !pass;
        }

        if (customMessage) {
            return {
                pass,
                message: customMessage,
            }
        }

        return {
            pass,
            message: `expected ${received} to${pass ? "" : " not"} be greater than ${expected}`
        };
    }
});

export function chainSuite(network: ENetwork, test: typeof bunTest): void {
    console.log(`Running ${network} tests`);

    test(`Setup - ${network}`, async () => {
        expect(process.env.MNEMONIC, `MNEMONIC environment variable is not set. You could use this one: "${generateMnemonic()}"`).toBeTruthy();

        if (!process.env.SERVER_URL) {
            console.log('SERVER_URL environment variable is not set, using wss://polywallet.dev/api');
        }
    });

    test(`${network}`, async () => {
        const fundedWallet = new PolyWallet(process.env.MNEMONIC!);
        const coinType = fundedWallet.networks[network].coinType;
        const defaultAddress = HDWallet.createWithMnemonic(process.env.MNEMONIC!, "").getAddressForCoin(coinType);

        expect(CoinTypeExt.deriveAddress(coinType, fundedWallet.networks[network].deriveKey(0))).toEqual(defaultAddress);

        const balance = await fundedWallet.balance({ network, address: defaultAddress });

        expect(balance).toDecimalBeGreaterThan(Decimal(0), `Must fund ${defaultAddress}`);
        console.log('Default account funded ✅');

        const testAddress = await fundedWallet.networks[network].newAddress();
        expect(CoinTypeExt.validate(coinType, testAddress)).toBeTrue();
        console.log('Generated address ✅');

        const randomWallet = new PolyWallet(generateMnemonic());

        const randomAddress = await randomWallet.networks[network].newAddress();
        expect(CoinTypeExt.validate(coinType, randomAddress)).toBeTrue();

        const balance1 = await randomWallet.balance({ network, address: randomAddress });
        expect(balance1).toDecimalEqual(Decimal(0));

        const { hash, fee, send } = await fundedWallet.transfer({
            amount: fundedWallet.networks[network].smallest,
            from: defaultAddress,
            to: randomAddress,
            network,
        });

        console.log(`Maximum fee is ${fee}`);
        console.log(`Transaction hash is ${hash}`);
        console.log('Transaction signed ✅');

        await send();

        console.log('Transaction sent ✅');

        for await (const tx of randomWallet.transactions()) {
            expect(tx.hash).toBe(hash);
            expect(tx.asset.network).toBe(network);
            expect(tx.recipient).toBe(randomAddress);
            expect(tx.amount).toDecimalEqual(fundedWallet.networks[network].smallest);
            expect(tx.source).toBe(defaultAddress);
            expect(tx.asset.contract).not.toBeDefined();
            break;
        }

        console.log('Transaction received ✅');

        const balance2 = await randomWallet.balance({ network, address: randomAddress });

        expect(balance2).toDecimalEqual(fundedWallet.networks[network].smallest);

        console.log('Passed ✅');
    }, { timeout: 30_000 });
}
