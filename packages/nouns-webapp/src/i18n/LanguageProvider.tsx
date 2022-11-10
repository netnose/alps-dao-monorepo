/**
 * LanguageProvider.tsx is a modified version of https://github.com/Uniswap/interface/blob/main/src/lib/i18n.tsx
 */
import { SupportedLocale } from './locales';
import { initialLocale, useActiveLocale } from '../hooks/useActivateLocale';
import { dynamicActivate, AlpsI18nProvider } from './AlpsI18nProvider';
import { ReactNode, useCallback } from 'react';

dynamicActivate(initialLocale);

export function LanguageProvider({ children }: { children: ReactNode }) {
  const locale = useActiveLocale();

  const onActivate = useCallback((locale: SupportedLocale) => {
    dynamicActivate(locale);
  }, []);

  return (
    <AlpsI18nProvider locale={locale} forceRenderAfterLocaleChange={true} onActivate={onActivate}>
      {children}
    </AlpsI18nProvider>
  );
}
