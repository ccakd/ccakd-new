import en from './en.json';
import zh from './zh.json';
import zhTw from './zh-tw.json';

const translations = { en, zh, 'zh-tw': zhTw } as const;

export type Locale = keyof typeof translations;

export function getLangFromUrl(url: URL): Locale {
  const segments = url.pathname.split('/').filter(Boolean);
  if (segments.length >= 1 && `${segments[0]}` in translations) {
    return segments[0] as Locale;
  }
  return 'en';
}

export function t(locale: Locale) {
  return translations[locale];
}

export function localePath(locale: Locale, path: string) {
  return `/${locale}${path}`;
}
