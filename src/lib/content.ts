import type { Locale } from '../i18n/utils';

/**
 * Get a localized field value from a Keystatic entry.
 * Looks up field_{locale} with fallback to field_en.
 * For locale 'zh-tw', looks up field_zhtw.
 */
export function localized<T>(entry: Record<string, T>, field: string, locale: Locale): T {
  const suffix = locale === 'zh-tw' ? 'zhtw' : locale;
  const key = `${field}_${suffix}`;
  const fallbackKey = `${field}_en`;
  return (entry[key] ?? entry[fallbackKey]) as T;
}
