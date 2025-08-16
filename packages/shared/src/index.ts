import Decimal from "decimal.js";

export enum EProtocol {
    Nano = "nano",
    Ethereum = "ethereum",
}

export enum ENetwork {
    POLYGON_AMOY = 'polygon-amoy',
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

export type Asset = {
    network: ENetwork;
    contract?: string | null;
};

export type Transaction = {
    asset: Asset;
    recipient: string;
    amount: Decimal;
    source: string;
    hash: string;
};
