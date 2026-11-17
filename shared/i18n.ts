import { useCallback, useSyncExternalStore } from 'react';
import { messages } from './messages';

export type Language = 'uz' | 'en' | 'ru';
export type Message = keyof typeof messages;
const preferenceKey = 'oxus-library-language';
const languageEvent = 'oxus-library-language-change';

function isLanguage(value: string | null): value is Language {
  return value === 'uz' || value === 'en' || value === 'ru';
}

function readLanguage(): Language | null {
  try {
    const saved = window.localStorage.getItem(preferenceKey);
    return isLanguage(saved) ? saved : null;
  } catch {
    return null;
  }
}

let language: Language = 'uz';

export function initializeLanguage(fallback: Language) {
  language = readLanguage() ?? fallback;
  document.documentElement.lang = language;
}

function subscribe(onChange: () => void) {
  function sync(event: StorageEvent) {
    if (event.key === preferenceKey && isLanguage(event.newValue)) {
      language = event.newValue;
      document.documentElement.lang = language;
      onChange();
    }
  }

  window.addEventListener(languageEvent, onChange);
  window.addEventListener('storage', sync);
  return () => {
    window.removeEventListener(languageEvent, onChange);
    window.removeEventListener('storage', sync);
  };
}

export function setLanguage(value: Language) {
  language = value;
  document.documentElement.lang = value;
  try {
    window.localStorage.setItem(preferenceKey, value);
  } catch {
    // Keep the current preference for this page when storage is unavailable.
  }
  window.dispatchEvent(new Event(languageEvent));
}

export function translate(locale: Language, key: Message, values?: Record<string, string | number>): string {
  const message = messages[key][locale];
  return message.replace(/\{(\w+)\}/g, (match, name: string) => String(values?.[name] ?? match));
}

export function useI18n() {
  const locale = useSyncExternalStore(subscribe, () => language);
  const t = useCallback((key: Message, values?: Record<string, string | number>) => translate(locale, key, values), [locale]);
  return { locale, t };
}
