import {Account, Protocol} from '../index'
import {AnySigner, CoinType, CoinTypeExt, HexCoding, PrivateKey} from "../../trust-wallet";
import {TW} from "@trustwallet/wallet-core";
import Decimal from "decimal.js";
import {EProtocol} from "@packages/shared";
import {TransactionPreview} from "../../index";

export class Nano extends Protocol<EProtocol.Nano> {
    static override CoinType: CoinType = CoinType.nano;
    coinType: CoinType = Nano.CoinType;
    multiplier: bigint = 10n ** 30n;

    static readonly representative = "nano_1banexkcfuieufzxksfrxqf6xy8e57ry1zdtq9yn7jntzhpwu4pg4hajojmq";

    deriveKey(index: number): PrivateKey {
        return this.wallet.getDerivedKey(this.coinType, index, 0, 0);
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

        await this.trpc.processBlock.mutate(JSON.parse(block.json));
        return HexCoding.encode(block.blockHash).slice(2).toUpperCase()
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

    async transfer({ from, to, amount }: { from: string; to: string; amount: Decimal }): Promise<TransactionPreview> {
        console.log("Sending transaction", { from, to, amount });
        const account = this.accounts.get(from);

        if (!account) {
            throw Error("Account not found");
        }

        let { frontier, balance, receivable } = await this.trpc.getAccountInfo.query(from);

        let newBalance = balance - BigInt(Decimal(amount).mul(this.multiplier).toFixed());

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

    async balance({ address }: { address: string }): Promise<Decimal> {
        const { balance, receivable } = await this.trpc.getBalance.query(address);
        return Decimal(balance + receivable).div(this.multiplier);
    }
}
