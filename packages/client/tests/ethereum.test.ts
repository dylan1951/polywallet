import { chainSuite } from './index';
import { ENetwork } from '@packages/shared';
import { test } from 'bun:test';

chainSuite(ENetwork.POLYGON_AMOY, test);
