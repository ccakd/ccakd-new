import { defineMiddleware } from 'astro:middleware';

export const onRequest = defineMiddleware(async (context, next) => {
  const response = await next();

  if (context.url.pathname.startsWith('/keystatic')) {
    const contentType = response.headers.get('content-type') || '';
    if (contentType.includes('text/html')) {
      const html = await response.text();
      const patched = html.replace(
        '</head>',
        '<link rel="icon" href="/keystatic-favicon.ico">\n</head>'
      );
      return new Response(patched, {
        status: response.status,
        headers: response.headers,
      });
    }
  }

  return response;
});
