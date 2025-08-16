import { chainSuite } from './index';
import { ENetwork } from '@packages/shared';
import { test } from 'bun:test';

chainSuite(ENetwork.NANO_MAINNET, test);
