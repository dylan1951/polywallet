import { Network, Alchemy, WebhookType, Webhook } from 'alchemy-sdk';
import { ethers } from 'ethers';
import { ENetwork, EProtocol, ProtocolNetworks } from '@packages/shared';

const WEBHOOK_URL = process.env.PUBLIC_URL + '/webhook/alchemy';

class EthereumHelper {
    alchemy: Alchemy;
    provider: ethers.AlchemyProvider;
    addressActivityWebhook?: Webhook;

    constructor(
        public chainId: number,
        public alchemyNetwork: Network
    ) {
        this.alchemy = new Alchemy({
            apiKey: process.env.ALCHEMY_API_KEY,
            network: this.alchemyNetwork,
            authToken: process.env.ALCHEMY_NOTIFY_AUTH_TOKEN,
        });

        this.provider = new ethers.AlchemyProvider(this.chainId, process.env.ALCHEMY_API_KEY);
    }

    async watchAddress(address: string) {
        console.log('WEBHOOK_URL', WEBHOOK_URL);
        if (this.addressActivityWebhook) {
            return this.alchemy.notify.updateWebhook(this.addressActivityWebhook.id, {
                addAddresses: [address],
            });
        } else {
            const { webhooks } = await this.alchemy.notify.getAllWebhooks();

            for (const webhook of webhooks) {
                if (webhook.url !== WEBHOOK_URL) {
                    this.alchemy.notify.deleteWebhook(webhook.id);
                    console.log('Deleted Alchemy webhook');
                } else if (webhook.network === this.alchemyNetwork && webhook.type === WebhookType.ADDRESS_ACTIVITY) {
                    this.addressActivityWebhook = webhook;
                    return this.alchemy.notify.updateWebhook(webhook.id, { addAddresses: [address] });
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
    [ENetwork.POLYGON_AMOY]: new EthereumHelper(80002, Network.MATIC_AMOY),
};

export const alchemyNetworkToENetworkMap: { [key in Network]?: ProtocolNetworks[EProtocol.Ethereum][number] } = {
    [Network.MATIC_AMOY]: ENetwork.POLYGON_AMOY,
};
