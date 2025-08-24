import ReconnectingWebSocket from 'reconnecting-websocket';
import { ee } from '../../index';
import { db } from '../../db';
import { eq, or, and } from 'drizzle-orm';
import Decimal from 'decimal.js';
import { _addresses } from '../../db/schema';
import { ENetwork } from '@packages/shared';

export async function listenForConfirmations() {
    const socket = new ReconnectingWebSocket(process.env.NANO_WEBSOCKET_URL!);

    socket.onopen = () => {
        console.log('Nano WebSocket connected');
        const message = {
            action: 'subscribe',
            topic: 'confirmation',
        };
        socket.send(JSON.stringify(message));
    };

    socket.onmessage = async (event) => {
        const file = event.data as File | Blob;
        const text = await file.text();
        const data = JSON.parse(text);

        // console.log("Websocket response", data);

        if (data.topic !== 'confirmation' || data.message.block.subtype !== 'send') {
            return;
        }

        const recipient: string = data.message.block.link_as_account;
        const amount: string = data.message.amount;
        const blockHash: string = data.message.hash;
        const source: string = data.message.account;

        const accounts = await db.query._addresses.findMany({
            where: and(
                or(eq(_addresses.address, recipient), eq(_addresses.address, source)),
                eq(_addresses.network, ENetwork.NANO_MAINNET)
            ),
        });

        for (const account of accounts) {
            console.log("Emitting 'transaction' event");

            const txPayload = {
                asset: { network: ENetwork.NANO_MAINNET },
                recipient,
                amount: Decimal(amount).div(10n ** 30n),
                source,
                hash: blockHash,
                confirmations: 1,
            };

            ee.emit('transaction', txPayload, account.userId);
        }
    };

    socket.onerror = (error) => {
        console.error('WebSocket error:', error);
    };

    socket.onclose = () => {
        console.log('WebSocket connection closed');
    };
}
