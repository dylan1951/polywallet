import { Protocol } from '../index';
import { ENetwork, EProtocol, type Transfer } from '@packages/shared';
import { AnySigner, CoinType, HexCoding, PrivateKey, Hash } from '../../trust-wallet';
import { TransactionPreview } from '../../index';
import { Decimal } from 'decimal.js';
import { TW } from '@trustwallet/wallet-core';

export class Ethereum extends Protocol<EProtocol.Ethereum> {
    async balance({ address }: { address: string }): Promise<Decimal> {
        const balanceWei = await this.trpc.getBalance.query({
            address,
            network: this.network,
        });
        return Decimal(balanceWei).div(this.multiplier);
    }

    private get chainId(): number {
        switch (this.network) {
            case ENetwork.POLYGON_AMOY:
                return 80002;
        }
    }

    coinType: CoinType = CoinType.ethereum;

    deriveKey(index: number): PrivateKey {
        return this.wallet.getDerivedKey(this.coinType, 0, 0, index);
    }

    multiplier: bigint = 10n ** 18n;

    async transferHistory({ address }: { address: string }): Promise<Transfer[]> {
        return this.trpc.getTransfers.query({ address, network: this.network });
    }

    async transfer({ from, to, amount }: { from: string; to: string; amount: Decimal }): Promise<TransactionPreview> {
        console.log('Sending transaction', { from, to, amount });
        const account = this.accounts.get(from);

        if (!account) {
            throw Error('Account not found');
        }

        const gasQuantity = 21_000n;

        const { maxPriorityFeePerGas, maxFeePerGas } = await this.trpc.getFeeData.query({ network: this.network });
        const transactionCount = await this.trpc.getTransactionCount.query({ address: from, network: this.network });

        const amountWei = BigInt(amount.mul(this.multiplier).toFixed());

        const input = TW.Ethereum.Proto.SigningInput.create({
            privateKey: account.privateKey.data(),
            toAddress: to,
            nonce: HexCoding.decode(transactionCount.toString(16)),
            chainId: HexCoding.decode(this.chainId.toString(16)),
            maxFeePerGas: HexCoding.decode(maxFeePerGas.toString(16)),
            maxInclusionFeePerGas: HexCoding.decode(maxPriorityFeePerGas.toString(16)),
            gasLimit: HexCoding.decode(gasQuantity.toString(16)),
            txMode: TW.Ethereum.Proto.TransactionMode.Enveloped,
            transaction: TW.Ethereum.Proto.Transaction.create({
                transfer: TW.Ethereum.Proto.Transaction.Transfer.create({
                    amount: HexCoding.decode(amountWei.toString(16)),
                }),
            }),
        });

        const validationError = TW.Ethereum.Proto.SigningInput.verify(input);

        if (validationError) {
            throw Error(validationError);
        }

        const encoded = TW.Ethereum.Proto.SigningInput.encode(input).finish();
        const signed = AnySigner.sign(encoded, this.coinType);
        const transaction = TW.Ethereum.Proto.SigningOutput.decode(signed);

        return {
            fee: Decimal(gasQuantity * maxFeePerGas).div(this.multiplier),
            hash: HexCoding.encode(Hash.keccak256(transaction.encoded)),
            send: () =>
                this.trpc.sendTransaction.mutate({
                    rawTransaction: HexCoding.encode(transaction.encoded),
                    network: this.network,
                }),
        };
    }
}
