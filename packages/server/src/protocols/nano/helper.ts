import { ENetwork, EProtocol, ProtocolNetworks } from '@packages/shared';

class AccountNotFound extends Error {}

function isValidHex64(str: string) {
    return /^[0-9a-fA-F]{64}$/.test(str);
}

class NanoHelper {
    constructor(apiUrl: string, apiKey?: string) {}

    async rpc<ResponseType>(payload: { action: string } & Record<string, unknown>) {
        const response = await fetch(process.env.NANO_RPC_API_URL!, {
            method: 'POST',
            body: JSON.stringify({ ...payload, key: process.env.NANO_RPC_API_KEY }),
            headers: { 'Content-Type': 'application/json' },
        });

        const text = await response.text();

        let data: ResponseType | { error: string };

        try {
            data = JSON.parse(text);
        } catch (e) {
            throw new Error(text);
        }

        if (!response.ok) {
            throw new Error(text);
        }

        return data;
    }

    async accountInfo(account: string) {
        type ResponseType = {
            frontier: string;
            open_block: string;
            representative_block: string;
            balance: string;
            confirmed_balance: string;
            modified_timestamp: string;
            block_count: string;
            account_version: string;
            confirmed_height: string;
            confirmed_frontier: string;
            receivable: string;
            confirmed_receivable: string;
        };

        const data = await this.rpc<ResponseType>({
            action: 'account_info',
            include_confirmed: 'true',
            receivable: 'true',
            account,
        });

        if ('error' in data) {
            if (data.error === 'Account not found') {
                return {
                    frontier: null,
                    balance: 0n,
                    receivable: 0n,
                };
            }
            throw new Error(data.error);
        }

        console.log(data);

        return {
            frontier: data.frontier,
            balance: BigInt(data.balance),
            receivable: BigInt(data.receivable),
        };
    }

    async accountHistory(account: string) {
        type ResponseType = {
            account: string;
            history: [
                {
                    type: 'send' | 'receive';
                    account: string;
                    amount: string;
                    amount_nano: string;
                    local_timestamp: string;
                    height: string;
                    hash: string;
                    confirmed: string;
                    username: string;
                },
            ];
            previous: string;
        };

        const data = await this.rpc<ResponseType>({
            action: 'account_history',
            account,
            count: '-1',
        });

        if ('error' in data) {
            throw new Error(data.error);
        }

        if (data.account !== account) {
            throw new Error(JSON.stringify(data));
        }

        return data;
    }

    async blocksInfo(hashes: string[]) {
        type ResponseType = {
            blocks: {
                [hash: string]: {
                    contents: {
                        link: string;
                    };
                };
            };
        };

        const data = await this.rpc<ResponseType>({
            action: 'blocks_info',
            json_block: 'true',
            hashes,
        });

        if ('error' in data) {
            throw new Error(data.error);
        }

        return data;
    }

    async workGenerate(hash: string) {
        type ResponseType = {
            work: string;
            difficulty: string;
            multiplier: string;
            hash: string;
        };

        const data = await this.rpc<ResponseType>({
            action: 'work_generate',
            hash,
        });

        if ('error' in data) throw new Error(data.error);
        if (!('work' in data)) throw new Error(data);

        return data.work;
    }

    async accountsReceivable(accounts: string[]) {
        type ResponseType = {
            blocks: {
                [account: string]: {
                    [blockHash: string]: {
                        amount: string;
                        source: string;
                    };
                };
            };
        };

        const data = await this.rpc<ResponseType>({
            action: 'accounts_receivable',
            accounts,
            source: 'true',
        });

        if ('error' in data) throw new Error(data.error);
        if (!('blocks' in data)) throw new Error(data);

        if (typeof data.blocks === 'string' || Array.isArray(data.blocks)) {
            data.blocks = {};
        }

        return data.blocks;
    }

    async accountsFrontiers(accounts: string[]) {
        type ResponseType = {
            frontiers: {
                [account: string]: string;
            };
            errors?: {
                [account: string]: string;
            };
        };

        const data = await this.rpc<ResponseType>({
            action: 'accounts_frontiers',
            accounts,
        });

        if ('error' in data) throw new Error(data.error);
        if (!('frontiers' in data)) throw new Error(data);

        for (const hash of Object.values(data.frontiers)) {
            if (!isValidHex64(hash)) {
                throw new Error(hash);
            }
        }

        if (Object.values(data.frontiers).length !== accounts.length) {
            throw new Error();
        }

        return data.frontiers;
    }

    async accountsBalances(accounts: string[]) {
        type ResponseType = {
            balances: {
                [account: string]: {
                    balance: string;
                    receivable: string;
                };
            };
            errors?: {
                [account: string]: string;
            };
        };

        const data = await this.rpc<ResponseType>({
            action: 'accounts_balances',
            accounts,
        });

        console.log(data);

        if ('error' in data) throw new Error(data.error);
        if (!('balances' in data)) throw new Error(data);

        const balances: {
            [account: string]: {
                balance: bigint;
                receivable: bigint;
            };
        } = {};

        for (const [account, balance] of Object.entries(data.balances)) {
            balances[account] = {
                balance: BigInt(balance.balance),
                receivable: BigInt(balance.receivable),
            };
        }

        if (Object.values(data.balances).length !== accounts.length) {
            throw new Error();
        }

        return balances;
    }

    async processBlock(block: {
        type: 'state';
        account: string;
        previous: string;
        representative: string;
        balance: string;
        link: string;
        link_as_account: string;
        signature: string;
        work: string;
    }) {
        const response = await this.rpc<{ hash: string }>({
            action: 'process',
            json_block: 'true',
            block,
        });

        if ('error' in response) throw new Error(response.error);
        if (!('hash' in response)) throw new Error(response);

        return response.hash;
    }

    async version() {
        type ResponseType = {
            rpc_version: '1';
            store_version: string;
            protocol_version: string;
            node_vendor: string;
            store_vendor: string;
            network: 'live';
        };

        const response = await this.rpc<ResponseType>({ action: 'version' });
        if ('error' in response) throw new Error(response.error);

        return response;
    }
}

export const helpers: Record<ProtocolNetworks[EProtocol.Nano][number], NanoHelper> = {
    [ENetwork.NANO_MAINNET]: new NanoHelper(process.env.NANO_RPC_API_URL!, process.env.NANO_RPC_API_KEY!),
    [ENetwork.BANANO_MAINNET]: new NanoHelper('https://api.banano.trade/proxy'),
};
