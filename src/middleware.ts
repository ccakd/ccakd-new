import { defineMiddleware } from 'astro:middleware';

export const onRequest = defineMiddleware(async (context, next) => {
  const response = await next();

  // Inject auto-refresh script into Keystatic pages
  if (context.url.pathname.startsWith('/keystatic')) {
    const contentType = response.headers.get('content-type') || '';
    if (contentType.includes('text/html')) {
      const html = await response.text();
      const injected = html + '<script src="/keystatic-refresh.js" charset="utf-8"></script>';
      return new Response(injected, {
        status: response.status,
        headers: response.headers,
      });
    }
  }

  return response;
});
