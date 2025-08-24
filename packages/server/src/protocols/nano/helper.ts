class AccountNotFound extends Error {}

function isValidHex64(str: string) {
    return /^[0-9a-fA-F]{64}$/.test(str);
}

async function rpc<ResponseType, PayloadType extends { action: string }>(payload: PayloadType) {
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

export async function accountInfo(account: string) {
    type PayloadType = {
        action: 'account_info';
        include_confirmed: 'true' | 'false';
        receivable: 'true' | 'false';
        account: string;
    };

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

    const data = await rpc<ResponseType, PayloadType>({
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

export async function accountHistory(account: string) {
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

    type PayloadType = {
        action: 'account_history';
        account: string;
        count: string;
    };

    const data = await rpc<ResponseType, PayloadType>({
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

export async function blocksInfo(hashes: string[]) {
    type PayloadType = {
        action: 'blocks_info';
        json_block: 'true';
        hashes: string[];
    };

    type ResponseType = {
        blocks: {
            [hash: string]: {
                contents: {
                    link: string;
                };
            };
        };
    };

    const data = await rpc<ResponseType, PayloadType>({
        action: 'blocks_info',
        json_block: 'true',
        hashes,
    });

    if ('error' in data) {
        throw new Error(data.error);
    }

    return data;
}

export async function workGenerate(hash: string) {
    const body = JSON.stringify({
        action: 'work_generate',
        hash,
        key: process.env.NANO_RPC_API_KEY,
    });

    const response = await fetch(process.env.NANO_RPC_API_URL!, {
        method: 'POST',
        body,
        headers: { 'Content-Type': 'application/json' },
    });

    const text = await response.text();

    console.log(body);
    console.log(text);

    let data:
        | {
              work: string;
              difficulty: string;
              multiplier: string;
              hash: string;
          }
        | { error: string };

    try {
        data = JSON.parse(text);
    } catch (e) {
        throw new Error(text);
    }
    if ('error' in data) throw new Error(data.error);
    if (!response.ok || !('work' in data)) throw new Error(text);

    return data.work;
}

export async function accountsReceivable(accounts: string[]) {
    const response = await fetch(process.env.NANO_RPC_API_URL!, {
        method: 'POST',
        body: JSON.stringify({
            action: 'accounts_receivable',
            accounts,
            source: 'true',
            key: process.env.NANO_RPC_API_KEY,
        }),
        headers: { 'Content-Type': 'application/json' },
    });

    const text = await response.text();

    let data:
        | {
              blocks:
                  | {
                        [account: string]: {
                            [blockHash: string]: {
                                amount: string;
                                source: string;
                            };
                        };
                    }
                  | string;
          }
        | { error: string };

    try {
        data = JSON.parse(text);
    } catch (e) {
        throw new Error(text);
    }
    if ('error' in data) throw new Error(data.error);
    if (!response.ok || !('blocks' in data)) throw new Error(text);

    if (typeof data.blocks === 'string') {
        data.blocks = {};
    }

    return data.blocks;
}

export async function accountsFrontiers(accounts: string[]) {
    const response = await fetch(process.env.NANO_RPC_API_URL!, {
        method: 'POST',
        body: JSON.stringify({
            action: 'accounts_frontiers',
            accounts,
        }),
        headers: { 'Content-Type': 'application/json' },
    });

    const text = await response.text();

    let data:
        | {
              frontiers: {
                  [account: string]: string;
              };
              errors?: {
                  [account: string]: string;
              };
          }
        | { error: string };

    try {
        data = JSON.parse(text);
    } catch (e) {
        throw new Error(text);
    }
    if ('error' in data) throw new Error(data.error);
    if (!response.ok || !('frontiers' in data)) throw new Error(text);

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

export async function accountsBalances(accounts: string[]) {
    const payload = {
        action: 'accounts_balances',
        accounts,
        key: process.env.NANO_RPC_API_KEY,
    };

    const body = JSON.stringify(payload);

    console.log(body);

    const response = await fetch(process.env.NANO_RPC_API_URL!, {
        method: 'POST',
        body,
        headers: { 'Content-Type': 'application/json' },
    });

    const text = await response.text();

    let data:
        | {
              balances: {
                  [account: string]: {
                      balance: string;
                      receivable: string;
                  };
              };
              errors?: {
                  [account: string]: string;
              };
          }
        | { error: string };

    const balances: {
        [account: string]: {
            balance: bigint;
            receivable: bigint;
        };
    } = {};

    try {
        data = JSON.parse(text);
    } catch (e) {
        throw new Error(text);
    }

    console.log(data);

    if ('error' in data) throw new Error(data.error);
    if (!response.ok || !('balances' in data)) throw new Error(text);

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

export async function processBlock(block: {
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
    const body = JSON.stringify({
        action: 'process',
        json_block: 'true',
        block,
    });

    const response = await fetch(process.env.NANO_RPC_API_URL!, {
        method: 'POST',
        body,
        headers: { 'Content-Type': 'application/json' },
    });

    const text = await response.text();

    console.log(body);
    console.log(text);

    let data: { hash: string } | { error: string };

    try {
        data = JSON.parse(text);
    } catch (e) {
        throw new Error(text);
    }
    if ('error' in data) throw new Error(data.error);
    if (!response.ok || !('hash' in data)) throw new Error(text);

    return data.hash;
}
