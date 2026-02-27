import { createContext, useContext, useState, useCallback } from 'react';
import React from 'react';
import en from './locales/en.json';
import zh from './locales/zh.json';

export type Locale = 'en' | 'zh';

const locales: Record<Locale, Record<string, any>> = { en, zh };

/** Detect locale from navigator.language, mapping to supported locale */
export function detectLocale(): Locale {
  const lang = (navigator.language || 'en').toLowerCase();
  if (lang.startsWith('zh')) return 'zh';
  return 'en';
}

/** Resolve a dot-notation key from a nested object */
function resolve(obj: Record<string, any>, path: string): string {
  const parts = path.split('.');
  let cur: any = obj;
  for (const p of parts) {
    if (cur == null || typeof cur !== 'object') return path;
    cur = cur[p];
  }
  return typeof cur === 'string' ? cur : path;
}

/** Interpolate {param} placeholders */
function interpolate(template: string, params?: Record<string, string | number>): string {
  if (!params) return template;
  return template.replace(/\{(\w+)\}/g, (_, key) => {
    return params[key] != null ? String(params[key]) : `{${key}}`;
  });
}

interface I18nContextValue {
  locale: Locale;
  setLocale: (l: Locale) => void;
  t: (key: string, params?: Record<string, string | number>) => string;
}

const I18nContext = createContext<I18nContextValue>({
  locale: 'en',
  setLocale: () => {},
  t: (key) => key,
});

export function I18nProvider({ initialLocale, children }: { initialLocale?: Locale; children: React.ReactNode }) {
  const [locale, setLocale] = useState<Locale>(initialLocale ?? detectLocale());

  const t = useCallback(
    (key: string, params?: Record<string, string | number>) => {
      const template = resolve(locales[locale], key);
      // Fallback to English if key missing in current locale
      const resolved = template === key ? resolve(locales.en, key) : template;
      return interpolate(resolved, params);
    },
    [locale],
  );

  return React.createElement(I18nContext.Provider, { value: { locale, setLocale, t } }, children);
}

export function useTranslation() {
  return useContext(I18nContext);
}
