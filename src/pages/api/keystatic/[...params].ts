export const prerender = false;

import { makeHandler } from '@keystatic/astro/api';
import keystaticConfig from '../../../../keystatic.config';

export const ALL = makeHandler({ config: keystaticConfig });
