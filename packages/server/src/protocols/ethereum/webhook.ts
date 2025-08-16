import express from 'express';
import { Network } from 'alchemy-sdk';
import Decimal from 'decimal.js';
import { eq, and } from 'drizzle-orm';
import { getAddress } from 'ethers';
import { alchemyNetworkToENetworkMap } from './helper';
import { _addresses } from '../../db/schema';
import { ee } from '../../index';
import { db } from '../../db';

const router = express.Router();
router.use(express.json());

type AlchemyWebhookNotification = {
    webhookId: string;
    id: string;
    createdAt: string;
    type: 'ADDRESS_ACTIVITY';
    event: {
        network: keyof typeof Network;
        activity: {
            fromAddress: `0x${string}`;
            toAddress: `0x${string}`;
            blockNum: `0x${string}`;
            hash: `0x${string}`;
            value: number;
            asset: string;
            category: 'external';
            rawContract: {
                rawValue: `0x${string}`;
                decimals: number;
            };
        }[];
        source: string;
    };
};

router.post('/alchemy', async (req, res) => {
    console.log('Received Alchemy webhook', JSON.stringify(req.body, null, 2));

    const notification = req.body as AlchemyWebhookNotification;

    const network = alchemyNetworkToENetworkMap[Network[notification.event.network]];

    if (network === undefined) {
        console.error('Unknown network', notification.event.network);
        return res.status(200).send();
    }

    const activity = notification.event.activity[0];

    if (activity === undefined) {
        console.error('No activity');
        return res.status(200).send();
    }

    const accounts = await db.query._addresses.findMany({
        where: and(eq(_addresses.address, getAddress(activity.toAddress)), eq(_addresses.network, network)),
    });

    for (const account of accounts) {
        const txPayload = {
            asset: { network },
            recipient: getAddress(activity.toAddress),
            amount: Decimal(activity.rawContract.rawValue).div(Decimal(10).pow(activity.rawContract.decimals)),
            source: getAddress(activity.fromAddress),
            hash: activity.hash,
        };

        ee.emit('transaction', txPayload, account.userId);
    }

    res.status(200).send();
});

export default router;
