import { CoinType, CoinTypeExt, HDWallet, PrivateKey, PublicKey } from '../trust-wallet';
import { Transfer, TransactionPreview } from '../index';
import type { TRPCClient, Resolver } from '@trpc/client';
import type { DefaultErrorShape } from '@trpc/server/unstable-core-do-not-import';
import type { AppRouter } from 'server/src';
import Decimal from 'decimal.js';
import { EProtocol, ProtocolNetworks } from '@packages/shared';
import { Mutex } from 'async-mutex';

export class Account {
    constructor(
        public coinType: CoinType,
        public privateKey: PrivateKey
    ) {}

    get publicKey(): PublicKey {
        return this.privateKey.getPublicKey(this.coinType);
    }

    get address(): string {
        return CoinTypeExt.deriveAddress(this.coinType, this.privateKey);
    }
}

type Client<P extends EProtocol> = TRPCClient<AppRouter>[P] & {
    addAddress: {
        mutate: Resolver<{
            input: {
                network: ProtocolNetworks[P][number];
                address: string;
                index: number;
            };
            output: void;
            errorShape: DefaultErrorShape;
            transformer: true;
        }>;
    };
    getAddresses: {
        query: Resolver<{
            input: {
                network: ProtocolNetworks[P][number];
            };
            output: {
                address: string;
                index: number;
            }[];
            errorShape: DefaultErrorShape;
            transformer: true;
        }>;
    };
};

export interface IProtocol {
    newAddress(): Promise<string>;
    transfer(opts: { from: string; to: string; amount: Decimal; contract?: string }): Promise<TransactionPreview>;
    balance(opts: { address: string; contract?: string }): Promise<Decimal>;
    deriveKey(index: number): PrivateKey;
    newAddress(): Promise<string>;
    transferHistory(opts: { address: string }): Promise<Transfer[]>;
    coinType: CoinType;
    smallest: Decimal;
}

export abstract class Protocol<P extends EProtocol> implements IProtocol {
    protected readonly wallet: HDWallet;
    public static CoinType: CoinType;
    public abstract coinType: CoinType;
    public abstract multiplier: bigint;
    accounts: Map<string, Account> = new Map<string, Account>();
    mutex: Mutex = new Mutex();

    constructor(
        wallet: HDWallet,
        protected trpc: Client<P>,
        readonly network: ProtocolNetworks[P][number]
    ) {
        this.wallet = wallet;
        this.mutex.acquire();

        this.trpc.getAddresses.query({ network: this.network }).then((addresses) => {
            addresses.forEach((account) => {
                this.accounts.set(account.address, new Account(this.coinType, this.deriveKey(account.index)));
            });

            this.mutex.release();
        });
    }

    abstract transferHistory(opts: { address: string }): Promise<Transfer[]>;

    abstract deriveKey(index: number): PrivateKey;

    async newAddress(): Promise<string> {
        await this.mutex.waitForUnlock();
        const index = this.accounts.size;
        const key = this.deriveKey(index);
        const account = new Account(this.coinType, key);
        await this.trpc.addAddress.mutate({ address: account.address, index, network: this.network });
        this.accounts.set(account.address, account);
        console.log(`New address ${account.address} created`);
        return account.address;
    }

    abstract transfer(opts: {
        from: string;
        to: string;
        amount: Decimal;
        contract?: string;
    }): Promise<TransactionPreview>;

    abstract balance(opts: { address: string; contract?: string }): Promise<Decimal>;

    get smallest(): Decimal {
        return Decimal(1).div(this.multiplier);
    }
}
