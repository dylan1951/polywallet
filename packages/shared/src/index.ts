import Decimal from 'decimal.js';

export enum EProtocol {
    Nano = 'nano',
    Ethereum = 'ethereum',
    Bitcoin = 'bitcoin',
}

export enum ENetwork {
    POLYGON_AMOY = 'polygon-amoy',
    ETH_MAINNET = 'eth-mainnet',
    NANO_MAINNET = 'nano-mainnet',
    BTC_MAINNET = 'btc-mainnet',
    BTC_TESTNET4 = 'btc-testnet4',
    BANANO_MAINNET = 'banano-mainnet',
}

export type ProtocolNetworks = {
    readonly [EProtocol.Nano]: readonly [ENetwork.NANO_MAINNET, ENetwork.BANANO_MAINNET];
    readonly [EProtocol.Ethereum]: readonly [ENetwork.POLYGON_AMOY, ENetwork.ETH_MAINNET];
    readonly [EProtocol.Bitcoin]: readonly [ENetwork.BTC_MAINNET, ENetwork.BTC_TESTNET4];
};

export const ProtocolNetworks: ProtocolNetworks = {
    [EProtocol.Nano]: [ENetwork.NANO_MAINNET, ENetwork.BANANO_MAINNET] as const,
    [EProtocol.Ethereum]: [ENetwork.POLYGON_AMOY, ENetwork.ETH_MAINNET] as const,
    [EProtocol.Bitcoin]: [ENetwork.BTC_MAINNET, ENetwork.BTC_TESTNET4] as const,
} as const;

export const NetworkConfirmationThresholds: {
    readonly [ENetwork.POLYGON_AMOY]: 12;
    readonly [ENetwork.NANO_MAINNET]: 1;
    readonly [ENetwork.BANANO_MAINNET]: 1;
    readonly [ENetwork.ETH_MAINNET]: 12;
    readonly [ENetwork.BTC_MAINNET]: 6;
    readonly [ENetwork.BTC_TESTNET4]: 6;
} = {
    [ENetwork.POLYGON_AMOY]: 12 as const,
    [ENetwork.NANO_MAINNET]: 1 as const,
    [ENetwork.BANANO_MAINNET]: 1 as const,
    [ENetwork.ETH_MAINNET]: 12 as const,
    [ENetwork.BTC_MAINNET]: 6 as const,
    [ENetwork.BTC_TESTNET4]: 6 as const,
};

export type Asset = {
    network: ENetwork;
    contract?: string | null;
};

export type Transfer = {
    id: string;
    amount: Decimal;
    asset: Asset;
    to: string;
    from: string;
    confirmations: number;
};
