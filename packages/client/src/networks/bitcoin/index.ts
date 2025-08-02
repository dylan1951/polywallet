import {Network} from "../index";
import  {type HDWallet, CoinType} from "../../trust-wallet";
import type {TRPCClient} from "@trpc/client";
import type {AppRouter} from "server/src";
import {type TransactionPreview} from "../../index";
import Decimal from "decimal.js";
import {ENetwork} from "@packages/shared";

export class Bitcoin extends Network<ENetwork.bitcoin> {
    constructor(wallet: InstanceType<typeof HDWallet>, trpc: TRPCClient<AppRouter>[ENetwork.bitcoin]) {
        super(wallet, trpc);
    }

    coinType: InstanceType<typeof CoinType> = Bitcoin.CoinType;
    multiplier: bigint = 10n ** 8n;

    balance(address: string, contract: string | undefined): Promise<Decimal> {
        return Promise.resolve(Decimal(0));
    }

    generateAddress(): Promise<string> {
        return Promise.resolve("");
    }

    numberAccounts(): Promise<number> {
        return Promise.resolve(0);
    }

    transaction(opts: { from: string; to: string; amount: Decimal; contract?: string }): Promise<TransactionPreview> {
        return Promise.resolve({
            hash: "",
            fee: Decimal(0),
            send: () => Promise.resolve("")
        });
    }

    get finalityThreshold() {
        return 6;
    }
}
