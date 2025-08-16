import {Network, Alchemy, WebhookType, Webhook} from "alchemy-sdk";
import {ethers} from "ethers";
import {ENetwork, EProtocol, ProtocolNetworks} from "@packages/shared";

class EthereumHelper {
    alchemy: Alchemy;
    provider: ethers.AlchemyProvider;
    addressActivityWebhook?: Webhook;

    constructor(public chainId: number, public alchemyNetwork: Network) {
        this.alchemy = new Alchemy({
            apiKey: process.env.ALCHEMY_API_KEY,
            network: this.alchemyNetwork,
            authToken: process.env.ALCHEMY_NOTIFY_AUTH_TOKEN,
        });

        this.provider = new ethers.AlchemyProvider(this.chainId, process.env.ALCHEMY_API_KEY);
    }

    async watchAddress(address: string) {
        if (this.addressActivityWebhook) {
            return this.alchemy.notify.updateWebhook(this.addressActivityWebhook.id, {
                addAddresses: [address]
            });
        } else {
            const {webhooks} = await this.alchemy.notify.getAllWebhooks();

            for (const webhook of webhooks) {
                if (webhook.network === this.alchemyNetwork && webhook.type === WebhookType.ADDRESS_ACTIVITY) {
                    this.addressActivityWebhook = webhook;
                    return this.alchemy.notify.updateWebhook(webhook.id, {addAddresses: [address]});
                }
            }

            this.addressActivityWebhook = await this.alchemy.notify.createWebhook(
                process.env.ALCHEMY_WEBHOOK_URL!,
                WebhookType.ADDRESS_ACTIVITY, {
                    addresses: [address],
                    network: this.alchemyNetwork,
                }
            );
        }
    }
}

export const helpers: Record<ProtocolNetworks[EProtocol.Ethereum][number], EthereumHelper> = {
    [ENetwork.POLYGON_AMOY]: new EthereumHelper(80002, Network.MATIC_AMOY),
};

export const alchemyNetworkToENetworkMap: { [key in Network]?: ProtocolNetworks[EProtocol.Ethereum][number] } = {
    [Network.MATIC_AMOY]: ENetwork.POLYGON_AMOY,
};
