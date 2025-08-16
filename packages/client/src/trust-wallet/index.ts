import {initWasm, type WalletCore} from "@trustwallet/wallet-core";

const core: WalletCore = await initWasm();

export type HDWallet = InstanceType<WalletCore["HDWallet"]>;
export type CoinType = InstanceType<WalletCore["CoinType"]>;
export type Hash = InstanceType<WalletCore["Hash"]>;
export type CoinTypeExt = InstanceType<WalletCore["CoinTypeExt"]>;
export type PrivateKey = InstanceType<WalletCore["PrivateKey"]>;
export type PublicKey = InstanceType<WalletCore["PublicKey"]>;
export type AnySigner = InstanceType<WalletCore["AnySigner"]>;

export const HDWallet: typeof core.HDWallet = core.HDWallet;
export const CoinType: typeof core.CoinType = core.CoinType;
export const Hash: typeof core.Hash = core.Hash;
export const HexCoding: typeof core.HexCoding = core.HexCoding;
export const CoinTypeExt: typeof core.CoinTypeExt = core.CoinTypeExt;
export const PrivateKey: typeof core.PrivateKey = core.PrivateKey;
export const PublicKey: typeof core.PublicKey = core.PublicKey;
export const AnySigner: typeof core.AnySigner = core.AnySigner;
