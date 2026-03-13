export const prerender = false;

import type { APIRoute } from 'astro';

interface TranslateRequest {
  text: string;
  sourceLocale: 'en' | 'zh' | 'zh-tw';
  format: 'plain' | 'rich';
}

interface TranslateResponse {
  translations: {
    en?: string;
    zh?: string;
    'zh-tw'?: string;
  };
}

// Simple in-memory rate limiter (resets on worker restart)
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();
const RATE_LIMIT = 20;
const RATE_WINDOW = 60 * 60 * 1000;

function checkRateLimit(ip: string): boolean {
  const now = Date.now();
  const entry = rateLimitMap.get(ip);
  if (!entry || now > entry.resetAt) {
    rateLimitMap.set(ip, { count: 1, resetAt: now + RATE_WINDOW });
    return true;
  }
  if (entry.count >= RATE_LIMIT) return false;
  entry.count++;
  return true;
}

export const POST: APIRoute = async ({ request, locals }) => {
  // In production (GitHub mode), require Keystatic auth cookie. In local dev, skip auth.
  if (!import.meta.env.DEV) {
    const cookie = request.headers.get('Cookie') || '';
    const hasKeystatic = cookie.includes('keystatic-gh-access-token');
    if (!hasKeystatic) {
      return new Response(JSON.stringify({ error: 'Unauthorized — Keystatic login required' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      });
    }
  }

  const ip = request.headers.get('CF-Connecting-IP') || request.headers.get('X-Forwarded-For') || 'unknown';
  if (!checkRateLimit(ip)) {
    return new Response(JSON.stringify({ error: 'Rate limit exceeded — max 20 translations per hour' }), {
      status: 429,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  let body: TranslateRequest;
  try {
    body = await request.json();
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid JSON body' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const { text, sourceLocale, format } = body;
  if (!text || !sourceLocale) {
    return new Response(JSON.stringify({ error: 'Missing text or sourceLocale' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }
  if (!['en', 'zh', 'zh-tw'].includes(sourceLocale)) {
    return new Response(JSON.stringify({ error: 'Invalid sourceLocale' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const targetLocales = (['en', 'zh', 'zh-tw'] as const).filter((l) => l !== sourceLocale);
  const localeNames: Record<string, string> = {
    en: 'English',
    zh: 'Simplified Chinese',
    'zh-tw': 'Traditional Chinese',
  };

  const prompt = `Translate the following ${format === 'rich' ? 'rich text content' : 'text'} from ${localeNames[sourceLocale]} to ${targetLocales.map((l) => localeNames[l]).join(' and ')}.

This is content for a Chinese Canadian community association website. Keep the tone warm, welcoming, and appropriate for a community non-profit.

${format === 'rich' ? 'Preserve all formatting (bold, italic, headings, links, lists).' : ''}

Return ONLY a JSON object with keys "${targetLocales.join('", "')}" containing the translations. No other text.

Text to translate:
${text}`;

  try {
    // CF Workers: runtime env from locals
    const env = (locals as any).runtime?.env ?? {};
    // AZURE_AI_ENDPOINT is the full Target URI from Azure AI Foundry
    // e.g. https://xxx.services.ai.azure.com/models/chat/completions?api-version=2024-05-01-preview
    const aiEndpoint = env.AZURE_AI_ENDPOINT || import.meta.env.AZURE_AI_ENDPOINT;
    const apiKey = env.AZURE_AI_API_KEY || import.meta.env.AZURE_AI_API_KEY;

    if (!aiEndpoint || !apiKey) {
      return new Response(JSON.stringify({ error: 'Translation service not configured' }), {
        status: 503,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const res = await fetch(aiEndpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'api-key': apiKey,
      },
      body: JSON.stringify({
        model: env.AZURE_AI_MODEL || import.meta.env.AZURE_AI_MODEL || 'DeepSeek-V3.2',
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.3,
      }),
    });

    if (!res.ok) {
      const errBody = await res.text().catch(() => '');
      console.error(`Azure AI error: ${res.status} ${errBody.slice(0, 500)}`);
      throw new Error(`Azure AI returned ${res.status}: ${errBody.slice(0, 200)}`);
    }
    const data = await res.json() as any;
    let content = data.choices?.[0]?.message?.content;
    if (!content) {
      console.error('Azure AI unexpected response:', JSON.stringify(data).slice(0, 500));
      throw new Error('No content in Azure AI response');
    }
    // Strip markdown code fences that some models wrap around JSON
    content = content.replace(/^```(?:json)?\s*\n?/i, '').replace(/\n?```\s*$/i, '').trim();
    const translations = JSON.parse(content);

    return new Response(JSON.stringify({ translations } satisfies TranslateResponse), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Translation error:', error);
    return new Response(JSON.stringify({ error: 'Translation failed' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};
