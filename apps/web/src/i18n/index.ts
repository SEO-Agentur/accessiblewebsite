import type { Locale } from '@accessiblewebsite/shared';
import en from './en.json' with { type: 'json' };
import de from './de.json' with { type: 'json' };

const dictionaries = { en, de } as const;

export type Dictionary = typeof en;

export function t(locale: Locale): Dictionary {
  return dictionaries[locale];
}
