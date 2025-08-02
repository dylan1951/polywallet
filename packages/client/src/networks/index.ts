import {CoinType, HDWallet} from "../trust-wallet";
import {TransactionPreview} from "../index";
import type {TRPCClient} from "@trpc/client";
import type {AppRouter} from "server/src";
import Decimal from "decimal.js";
import {ENetwork} from "@packages/shared";

export abstract class Address {
    abstract get address(): string;
}

export abstract class Network<Network extends ENetwork> {
    protected readonly wallet: InstanceType<typeof HDWallet>;
    protected readonly trpc: TRPCClient<AppRouter>[Network];
    public static CoinType: InstanceType<typeof CoinType>;
    // public abstract coinType: InstanceType<typeof CoinType>;
    public abstract multiplier: bigint;

    protected constructor(wallet: InstanceType<typeof HDWallet>, trpc: TRPCClient<AppRouter>[Network]) {
        this.wallet = wallet;
        this.trpc = trpc;
    }

    abstract generateAddress(): Promise<string>;

    abstract transaction(opts: {
        from: string;
        to: string;
        amount: Decimal;
        contract?: string;
    }): Promise<TransactionPreview>;

    abstract balance(address: string, contract?: string): Promise<Decimal>;

    abstract numberAccounts(): Promise<number>;

    get smallest(): Decimal {
        return Decimal(1).div(this.multiplier);
    }

    abstract get finalityThreshold(): number;
}

