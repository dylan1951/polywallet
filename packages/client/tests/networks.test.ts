import { expect, test } from "bun:test";
import {HDWallet, CoinTypeExt, HexCoding} from "../src/trust-wallet";
import Decimal from "decimal.js";
import {PolyWallet} from "../src";
import {ENetwork} from "@packages/shared"

declare module "bun:test" {
    interface Matchers<T> {
        toDecimalEqual(expected: Decimal): T;
        toDecimalBeGreaterThan(expected: Decimal): T;
    }
}

function generateMnemonic() {
    return HDWallet.create(128, "").mnemonic();
}

const fundedWallet = new PolyWallet(process.env.MNEMONIC!);

expect.extend({
    toDecimalEqual(received, expected: Decimal) {
        if (!Decimal.isDecimal(received) || !Decimal.isDecimal(expected)) {
            throw new Error('Invalid usage');
        }

        const pass = received.equals(expected);
        return {
            pass,
            message: () => `expected ${received.toString()} ${pass ? "not " : ""}to equal ${expected.toString()}`,
        };
    },
    toDecimalBeGreaterThan(received, expected: Decimal) {
        if (!Decimal.isDecimal(received) || !Decimal.isDecimal(expected)) {
            throw new Error('Invalid usage');
        }

        const pass = received.greaterThan(expected);
        return {
            pass,
            message: () => `expected ${received.toString()} ${pass ? "not " : ""}to be greater than ${expected.toString()}`,
        };
    }
});

test.each(Object.values(ENetwork))("%s", async (network) => {
    const coinType = fundedWallet.networks[network].coinType;

    const defaultAddress = fundedWallet.wallet.getAddressForCoin(coinType);
    const balance = await fundedWallet.networks[network].balance(defaultAddress);

    expect(balance, `Must fund ${defaultAddress}`).toDecimalBeGreaterThan(Decimal(0));
    console.log('Default account funded ✅');

    const testAddress = await fundedWallet.networks[network].generateAddress();
    expect(CoinTypeExt.validate(coinType, testAddress)).toBeTrue();
    console.log('Generated address ✅');

    const randomWallet = new PolyWallet(generateMnemonic());

    const randomAddress1 = await randomWallet.networks[network].generateAddress();
    expect(CoinTypeExt.validate(coinType, randomAddress1)).toBeTrue();

    const randomAddress2 = await randomWallet.networks[network].generateAddress();
    expect(CoinTypeExt.validate(coinType, randomAddress2)).toBeTrue();

    expect(randomAddress1).not.toBe(randomAddress2);

    const balance1 = await randomWallet.networks[network].balance(randomAddress1);
    expect(balance1).toDecimalEqual(Decimal(0));

    const { hash, fee, send } = await fundedWallet.networks[network].transaction({
        amount: fundedWallet.networks[network].smallest,
        from: defaultAddress,
        to: randomAddress1,
    });

    expect(hash).toHaveLength(64);
    expect(fee).toDecimalEqual(Decimal(0));

    console.log('Transaction signed ✅');

    await send();

    console.log('Transaction sent ✅');

    for await (const tx of randomWallet.transactions()) {
        expect(tx.hash).toBe(hash);
        expect(tx.token.network).toBe(network);
        expect(tx.recipient).toBe(randomAddress1);
        expect(tx.amount).toDecimalEqual(fundedWallet.networks[network].smallest);
        expect(tx.source).toBe(defaultAddress);
        expect(tx.token.contract).not.toBeDefined();
        break;
    }

    console.log('Transaction received ✅');

    const balance2 = await randomWallet.networks[network].balance(randomAddress1);

    expect(balance2).toDecimalEqual(fundedWallet.networks[network].smallest);

    console.log('Passed ✅');

}, { timeout: 30000 });

