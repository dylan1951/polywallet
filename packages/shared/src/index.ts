import Decimal from 'decimal.js';

export enum EProtocol {
    Nano = 'nano',
    Ethereum = 'ethereum',
}

export enum ENetwork {
    POLYGON_AMOY = 'polygon-amoy',
    // ETH_MAINNET = 'polygon-mainnet',
    NANO_MAINNET = 'nano-mainnet',
}

export type ProtocolNetworks = {
    readonly [EProtocol.Nano]: readonly [ENetwork.NANO_MAINNET];
    readonly [EProtocol.Ethereum]: readonly [ENetwork.POLYGON_AMOY];
};

export const ProtocolNetworks: ProtocolNetworks = {
    [EProtocol.Nano]: [ENetwork.NANO_MAINNET] as const,
    [EProtocol.Ethereum]: [ENetwork.POLYGON_AMOY] as const,
} as const;

export const NetworkConfirmationThresholds: {
    readonly [ENetwork.POLYGON_AMOY]: 12;
    readonly [ENetwork.NANO_MAINNET]: 1;
} = {
    [ENetwork.POLYGON_AMOY]: 12 as const,
    [ENetwork.NANO_MAINNET]: 1 as const,
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
