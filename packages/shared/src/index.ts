import Decimal from "decimal.js";

export enum ENetwork {
    nano = "nano",
    bitcoin = "bitcoin",
}

export type Token = {
    network: ENetwork;
    contract?: string | null;
};

export type Transaction = {
    token: Token;
    recipient: string;
    amount: Decimal;
    source: string;
    hash: string;
    confirmations: number;
};
