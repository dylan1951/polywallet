import {Hash, HDWallet, HexCoding} from "./trust-wallet";
import { IProtocol } from './protocols';
import {Nano} from "./protocols/nano";
import {createTRPCClient, createWSClient, type TRPCLink, wsLink} from '@trpc/client';
import {WebSocket as WS} from 'ws';
import {observable} from '@trpc/server/observable';
import superjson, {SuperJSON} from 'superjson';
import Decimal from "decimal.js";
import {ENetwork, Transaction} from "@packages/shared";
import {AppRouter} from "server/src";
import {Ethereum} from "./protocols/ethereum";

SuperJSON.registerCustom<Decimal, string>(
    {
        isApplicable: (v): v is Decimal => Decimal.isDecimal(v),
        serialize: v => v.toJSON(),
        deserialize: v => new Decimal(v),
    },
    'decimal.js'
);

interface Config {
    passphrase?: string;
    apiKey?: string;
    apiUrl?: string;
    testnet?: boolean;
}

export abstract class TransactionPreview {
    abstract hash: string;
    abstract fee: Decimal;
    abstract send(): Promise<void>;
}

export class PolyWallet {
    protected readonly wallet: HDWallet;
    private readonly id;
    private readonly trpc;
    public readonly networks: Record<ENetwork, IProtocol>;
    private socket?: Bun.Socket;

    private enqueue!: (tx: Transaction) => void;

    private transactionStream = new ReadableStream<Transaction>({
        start: (controller) => {
            this.enqueue = controller.enqueue.bind(controller);
        }
    });

    async *transactions(options: { includeMissed?: boolean } = {}): AsyncGenerator<Transaction, void, void> {
        const keepAliveTimeout = setTimeout(() => {}, 2147483647);
        try {
            for await (const tx of this.transactionStream) {
                // TODO: Send ack to server
                console.log(`[PolyWallet] transaction read → ${tx.hash}`);
                yield tx;
            }

        } finally {
            clearTimeout(keepAliveTimeout);
        }
    }

    transfer(opts: {
        from: string;
        to: string;
        amount: Decimal;
        network: ENetwork;
    }): Promise<TransactionPreview> {
        return this.networks[opts.network].transfer(opts);
    }

    balance(opts: {
        address: string;
        network: ENetwork;
    }): Promise<Decimal> {
        return this.networks[opts.network].balance(opts);
    }

    constructor(mnemonic: string, config?: Config) {
        this.wallet = HDWallet.createWithMnemonic(mnemonic, config?.passphrase ?? "");
        this.id = HexCoding.encode(Hash.sha256(this.wallet.seed())).slice(2);

        const ensureProcessLives: TRPCLink<AppRouter> = () => {
            return ({ next, op }) => {
                return observable((observer) => {
                    const keepAliveTimeout = setTimeout(() => {}, op.type !== 'subscription' ? 2147483647 : 0);

                    return next(op).subscribe({
                        next(value) {
                            observer.next(value);
                        },
                        error(err) {
                            observer.error(err);
                            clearTimeout(keepAliveTimeout);
                        },
                        complete() {
                            observer.complete();
                            clearTimeout(keepAliveTimeout);
                        },
                    });
                });
            };
        };

        const wsClient = createWSClient({
            WebSocket: WS as unknown as typeof WebSocket,
            url: config?.apiUrl || process.env.SERVER_URL || `wss://polywallet.dev`,
            onOpen: () => {
                this.socket = wsClient['activeConnection'].ws._socket;
                this.socket?.unref();
            },
            connectionParams: { id: this.id }
        });

        this.trpc = createTRPCClient<AppRouter>({
            links: [
                ensureProcessLives,
                wsLink<AppRouter>({
                    client: wsClient,
                    transformer: superjson
                })
            ],
        });

        this.trpc.onTransaction.subscribe(undefined, {
            onData: (event) => {
                console.log("Received transaction from server: ", event.data);
                this.enqueue(event.data);
            }
        });

        this.networks = {
            [ENetwork.NANO_MAINNET]: new Nano(this.wallet, this.trpc.nano, ENetwork.NANO_MAINNET),
            [ENetwork.POLYGON_AMOY]: new Ethereum(this.wallet, this.trpc.ethereum, ENetwork.POLYGON_AMOY),
        }
    }
}

