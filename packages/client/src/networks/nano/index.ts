import {Address, Network} from '../index'
import {AnySigner, CoinType, CoinTypeExt, HDWallet, HexCoding, PrivateKey, PublicKey} from "../../trust-wallet";
import {TW} from "@trustwallet/wallet-core";
import type {AppRouter} from "server/src";
import type {TRPCClient} from '@trpc/client';
import {Mutex} from 'async-mutex';
import {type Unsubscribable} from '@trpc/server/observable';
import Decimal from "decimal.js";
import {ENetwork} from "@packages/shared";
import {TransactionPreview} from "../../index";

class NanoAccount extends Address {
    address: string;
    privateKey: InstanceType<typeof PrivateKey>;
    publicKey: InstanceType<typeof PublicKey>;

    constructor(address: string, privateKey: InstanceType<typeof PrivateKey>) {
        super();
        this.address = address;
        this.privateKey = privateKey;
        this.publicKey = privateKey.getPublicKey(CoinType.nano);
    }
}

export class Nano extends Network<ENetwork.nano> {
    static override CoinType: InstanceType<typeof CoinType> = CoinType.nano;
    coinType: InstanceType<typeof CoinType> = Nano.CoinType;

    accounts: Map<string, NanoAccount> = new Map<string, NanoAccount>();
    mutex: Mutex = new Mutex();
    subscription?: Unsubscribable;
    multiplier: bigint = 10n ** 30n;

    static readonly representative = "nano_1banexkcfuieufzxksfrxqf6xy8e57ry1zdtq9yn7jntzhpwu4pg4hajojmq";

    constructor(wallet: InstanceType<typeof HDWallet>, trpc: TRPCClient<AppRouter>[ENetwork.nano]) {
        super(wallet, trpc);

        this.mutex.acquire();

        this.trpc.getAccounts.query().then(accounts => {
            accounts.forEach(account => {
                this.accounts.set(account.address, new NanoAccount(account.address, this.deriveKey(account.index)));
            });

            this.mutex.release();
        });
    }

    deriveKey(index: number): InstanceType<typeof PrivateKey> {
        return this.wallet.getDerivedKey(this.coinType, index, 0, 0);
    }

    async generateAddress(): Promise<string> {
        await this.mutex.waitForUnlock();
        const index = this.accounts.size;
        const key = this.deriveKey(index);
        const address = CoinTypeExt.deriveAddress(this.coinType, key);

        await this.trpc.addAddress.mutate({address, index});
        this.accounts.set(address, new NanoAccount(address, key));
        return address;
    }

    async numberAccounts(): Promise<number> {
        await this.mutex.waitForUnlock();
        return this.accounts.size;
    }

    async receive({ address, linkBlock, amount }: { address: string, linkBlock: string, amount: bigint }): Promise<string> {
        const account = this.accounts.get(address);

        if (!account) {
            throw Error("Account not found");
        }

        const { frontier, balance } = await this.trpc.getAccountInfo.query(address);

        let work: string;

        if (frontier) {
            work = await this.trpc.workGenerate.mutate(frontier);
        } else {
            work = await this.trpc.workGenerate.mutate(HexCoding.encode(account.publicKey.data()).slice(2));
        }

        const input = TW.Nano.Proto.SigningInput.create({
            privateKey: account.privateKey.data(),
            publicKey: account.publicKey.data(),
            parentBlock: frontier ? HexCoding.decode(frontier) : null,
            linkBlock: HexCoding.decode(linkBlock),
            representative: Nano.representative,
            balance: (balance + amount).toString(),
            work,
        });

        const validationError = TW.Nano.Proto.SigningInput.verify(input);

        if (validationError) {
            throw Error(validationError);
        }

        const encoded = TW.Nano.Proto.SigningInput.encode(input).finish();
        const outputData = AnySigner.sign(encoded, this.coinType);
        const block = TW.Nano.Proto.SigningOutput.decode(outputData);

        if (block.error) {
            throw Error(block.errorMessage);
        }

        return this.trpc.processBlock.mutate(JSON.parse(block.json));
    }

    async receiveAll(account: string): Promise<{frontier: string | null, received: bigint}> {
        const receivable = await this.trpc.accountsReceivable.query([account]).then(r => r[account]);
        let received = 0n;
        let frontier = null;

        for (const [linkBlock, { amount }] of Object.entries(receivable)) {
            frontier = await this.receive({address: account, linkBlock, amount: BigInt(amount) });
            console.log(`Received ${linkBlock}: ${amount}`);
            received += BigInt(amount);
        }

        return { frontier, received };
    }

    async transaction({ from, to, amount }: { from: string; to: string; amount: Decimal }): Promise<TransactionPreview> {
        const account = this.accounts.get(from);

        if (!account) {
            throw Error("Account not found");
        }

        let { frontier, balance, receivable } = await this.trpc.getAccountInfo.query(from);

        let newBalance = balance - BigInt(Decimal(amount).mul(this.multiplier).toString());

        if (newBalance < 0) {
            if (frontier && !receivable) {
                throw Error("Insufficient funds");
            }

            const result = await this.receiveAll(from);
            frontier = result.frontier;
            newBalance += result.received;

            if (newBalance < 0) {
                throw Error("Insufficient funds");
            }
        }

        let work: string;

        if (frontier) {
            work = await this.trpc.workGenerate.mutate(frontier);
        } else {
            work = await this.trpc.workGenerate.mutate(HexCoding.encode(account.publicKey.data()).slice(2));
        }

        const input = TW.Nano.Proto.SigningInput.create({
            privateKey: account.privateKey.data(),
            publicKey: account.publicKey.data(),
            parentBlock: frontier ? HexCoding.decode(frontier) : null,
            linkRecipient: to,
            representative: Nano.representative,
            balance: newBalance.toString(),
        });

        const validationError = TW.Nano.Proto.SigningInput.verify(input);

        if (validationError) {
            throw Error(validationError);
        }

        const encoded = TW.Nano.Proto.SigningInput.encode(input).finish();
        const outputData = AnySigner.sign(encoded, this.coinType);
        const block = TW.Nano.Proto.SigningOutput.decode(outputData);

        return {
            fee: Decimal(0),
            hash: HexCoding.encode(block.blockHash).slice(2).toUpperCase(),
            send: () => this.trpc.processBlock.mutate({...JSON.parse(block.json), work})
        };
    }

    async balance(address: string): Promise<Decimal> {
        const { balance, receivable } = await this.trpc.getBalance.query(address);
        return Decimal(balance + receivable).div(this.multiplier);
    }

    get finalityThreshold() {
        return 1;
    }
}
