import ReconnectingWebSocket from 'reconnecting-websocket';
import {ee} from "../../index";
import {db} from "../../db";
import {eq, or} from "drizzle-orm";
import {nanoAccount} from "./model";
import Decimal from "decimal.js";
import * as nano from "./helper"
import {ENetwork} from "@packages/shared";

export async function listenForConfirmations() {
    const socket = new ReconnectingWebSocket(process.env.NANO_WEBSOCKET_URL!);

    socket.onopen = () => {
        console.log("WebSocket connected");
        const message = {
            action: "subscribe",
            topic: "confirmation"
        };
        socket.send(JSON.stringify(message));
    }

    socket.onmessage = async (event) => {
        const file = event.data as File | Blob;
        const text = await file.text();
        const data = JSON.parse(text);

        console.log("Websocket response", data);

        if (data.topic !== 'confirmation' || data.message.block.subtype !== 'send') {
            return;
        }

        const recipient: string = data.message.block.link_as_account;
        const amount: string = data.message.amount;
        const blockHash: string = data.message.hash;
        const source: string = data.message.account;

        const accounts = await db.query.nanoAccount.findMany({ where: or(eq(nanoAccount.address, recipient), eq(nanoAccount.address, source)) });

        for (const account of accounts) {
            console.log("Emitting 'transaction' event");

            ee.emit('transaction', {
                token: { network: ENetwork.nano },
                recipient,
                amount: Decimal(amount).div(10n ** 30n),
                source,
                hash: blockHash,
                // balance: await nano.accountsBalances([recipient]).then(r => Decimal(r[recipient].balance + r[recipient].receivable).div(10n ** 30n)),
                confirmations: 1,
            }, account.userId);
        }
    };

    socket.onerror = (error) => {
        console.error("WebSocket error:", error);
    };

    socket.onclose = () => {
        console.log("WebSocket connection closed");
    };
}

