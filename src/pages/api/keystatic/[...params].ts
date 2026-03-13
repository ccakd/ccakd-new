export const prerender = false;

import type { APIRoute } from 'astro';
import { makeHandler } from '@keystatic/astro/api';
import keystaticConfig from '../../../../keystatic.config';

// Cloudflare Worker secrets are runtime-only (not available via import.meta.env).
// Access them from the Cloudflare runtime env on each request.
export const ALL: APIRoute = (context) => {
  const env = (context.locals as any).runtime?.env ?? {};
  const handler = makeHandler({
    config: keystaticConfig,
    clientId: env.KEYSTATIC_GITHUB_CLIENT_ID,
    clientSecret: env.KEYSTATIC_GITHUB_CLIENT_SECRET,
    secret: env.KEYSTATIC_SECRET,
  });
  return handler(context);
};
