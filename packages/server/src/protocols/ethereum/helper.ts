import { Alchemy, Network, Webhook, WebhookType } from 'alchemy-sdk';
import { ethers } from 'ethers';
import { ENetwork, EProtocol, NetworkConfirmationThresholds, ProtocolNetworks } from '@packages/shared';
import { db } from '../../db';
import { and, eq, gt, or } from 'drizzle-orm';
import { _addresses, _transfers } from '../../db/schema';
import { ee } from '../../index';

const WEBHOOK_URL = process.env.PUBLIC_URL + '/webhook/alchemy';

class EthereumHelper {
    alchemy: Alchemy;
    provider: ethers.AlchemyProvider;
    addressActivityWebhook?: Webhook;
    confirmationThreshold: number;
    private latestBlockNumber?: number;
    private lastBlockAtMs?: number;

    constructor(
        public chainId: number,
        public alchemyNetwork: Network,
        public network: ENetwork
    ) {
        this.confirmationThreshold = NetworkConfirmationThresholds[network];

        this.alchemy = new Alchemy({
            apiKey: process.env.ALCHEMY_API_KEY,
            network: this.alchemyNetwork,
            authToken: process.env.ALCHEMY_NOTIFY_AUTH_TOKEN,
        });

        this.provider = new ethers.AlchemyProvider(this.chainId, process.env.ALCHEMY_API_KEY);

        this.provider
            .on('block', async (blockNumber: number) => {
                console.log(`${this.alchemyNetwork} latest block`, blockNumber);
                this.latestBlockNumber = blockNumber;
                this.lastBlockAtMs = Date.now();

                const transfers = await db.query._transfers.findMany({
                    where: and(
                        eq(_transfers.network, this.network),
                        gt(_transfers.blockNum, blockNumber - this.confirmationThreshold)
                    ),
                });

                for (const transfer of transfers) {
                    const addresses = await db.query._addresses.findMany({
                        where: or(eq(_addresses.address, transfer.from), eq(_addresses.address, transfer.to)),
                    });

                    for (const address of addresses) {
                        ee.emit(
                            'transfer',
                            {
                                asset: { network: this.network },
                                to: transfer.to,
                                amount: transfer.amount,
                                from: transfer.from,
                                id: transfer.id,
                                confirmations: blockNumber - transfer.blockNum + 1,
                                blockNum: transfer.blockNum,
                            },
                            address.userId
                        );
                    }
                }
            })
            .then(() => {
                console.log(`Started Alchemy 'newHeads' subscription for ${this.alchemyNetwork}`);
            });
    }

    isHealthy(maxAgeMs: number = 60_000): boolean {
        return this.lastBlockAtMs !== undefined && Date.now() - this.lastBlockAtMs < maxAgeMs;
    }

    async getLatestBlockNumber() {
        if (this.latestBlockNumber !== undefined) {
            return this.latestBlockNumber;
        }

        return this.provider.getBlockNumber();
    }

    async watchAddress(address: string) {
        if (this.addressActivityWebhook) {
            return this.alchemy.notify.updateWebhook(this.addressActivityWebhook.id, {
                addAddresses: [address],
            });
        } else {
            const { webhooks } = await this.alchemy.notify.getAllWebhooks();

            for (const webhook of webhooks) {
                if (webhook.url !== WEBHOOK_URL) {
                    await this.alchemy.notify.deleteWebhook(webhook.id);
                    console.log('Deleted Alchemy webhook');
                } else if (webhook.network === this.alchemyNetwork && webhook.type === WebhookType.ADDRESS_ACTIVITY) {
                    this.addressActivityWebhook = webhook;
                    return this.alchemy.notify.updateWebhook(webhook.id, {
                        addAddresses: [address],
                    });
                }
            }

            this.addressActivityWebhook = await this.alchemy.notify.createWebhook(
                WEBHOOK_URL,
                WebhookType.ADDRESS_ACTIVITY,
                {
                    addresses: [address],
                    network: this.alchemyNetwork,
                }
            );

            console.log('Created new Alchemy webhook', this.addressActivityWebhook);
        }
    }
}

export const helpers: Record<ProtocolNetworks[EProtocol.Ethereum][number], EthereumHelper> = {
    [ENetwork.POLYGON_AMOY]: new EthereumHelper(80002, Network.MATIC_AMOY, ENetwork.POLYGON_AMOY),
    [ENetwork.ETH_MAINNET]: new EthereumHelper(1, Network.ETH_MAINNET, ENetwork.ETH_MAINNET),
    [ENetwork.POLYGON_MAINNET]: new EthereumHelper(137, Network.MATIC_MAINNET, ENetwork.POLYGON_MAINNET),
    [ENetwork.ETH_SEPOLIA]: new EthereumHelper(11155111, Network.ETH_SEPOLIA, ENetwork.ETH_SEPOLIA),
};

export const alchemyNetworkToENetworkMap: {
    [key in Network]?: ProtocolNetworks[EProtocol.Ethereum][number];
} = {
    [Network.MATIC_AMOY]: ENetwork.POLYGON_AMOY,
};
