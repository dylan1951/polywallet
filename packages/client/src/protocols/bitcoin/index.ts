import { EProtocol, Transfer } from '@packages/shared';
import { Protocol } from '../index';
import Decimal from 'decimal.js';
import { CoinType, PrivateKey } from '../../trust-wallet';
import { TransactionPreview } from '../../index';

export class Bitcoin extends Protocol<EProtocol.Bitcoin> {
    async balance(opts: { address: string; contract?: string }): Promise<Decimal> {
        return Decimal(0);
    }

    coinType: CoinType = CoinType.bitcoin;

    deriveKey(index: number): PrivateKey {
        return this.wallet.getDerivedKey(this.coinType, 0, 0, index);
    }

    multiplier: bigint = 10n ** 8n;

    async transfer(opts: {
        from: string;
        to: string;
        amount: Decimal;
        contract?: string;
    }): Promise<TransactionPreview> {
        return {
            hash: '',
            fee: Decimal(0),
            send: async () => {},
        };
    }

    async transferHistory(opts: { address: string }): Promise<Transfer[]> {
        return [];
    }
}
