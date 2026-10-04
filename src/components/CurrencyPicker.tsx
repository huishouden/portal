import { useId } from 'react';
import { capitalize } from '@huishouden/pwa-kit/i18n';
import { formatCents, isCurrencyCode } from '@huishouden/pwa-kit/money';
import { selectClass } from '@huishouden/pwa-kit/react/ui';
import { useLocale, useT } from '../i18n';

/** The currencies offered first: the suite's languages' usual ones, then other common ones. */
export const CURRENCIES = ['USD', 'EUR', 'MXN', 'CAD', 'GBP', 'COP', 'ARS', 'CLP', 'PEN', 'AUD'] as const;

/** The codes to offer: the usual list, plus the household's own when it is another one. */
export function currencyChoices(current: string | undefined): string[] {
  return isCurrencyCode(current) && !(CURRENCIES as readonly string[]).includes(current) ? [...CURRENCIES, current] : [...CURRENCIES];
}

/** "US dollar" / "Dólar estadounidense" / "Amerikaanse dollar"; the code itself where Intl has no name. */
export function currencyName(code: string, locale: string): string {
  try {
    return capitalize(new Intl.DisplayNames(locale, { type: 'currency' }).of(code) ?? code, locale);
  } catch {
    return code;
  }
}

/**
 * The household's currency, which every app shows amounts in (`households/{id}.currency`, US
 * dollars when unset). Admins and members change it; helpers and kids see it.
 */
export function CurrencyPicker({ value, canChange, onChange }: { value?: string; canChange: boolean; onChange: (code: string) => void }) {
  const t = useT();
  const locale = useLocale();
  const id = useId();
  const current = isCurrencyCode(value) ? value : 'USD';
  const example = formatCents(123450, { currency: current, locale });
  return (
    <div className="mt-5 border-t border-line pt-4">
      <label htmlFor={id} className="mb-1.5 block font-medium">
        {t('currency.label')}
      </label>
      {canChange ? (
        <select id={id} className={`${selectClass} max-w-sm`} value={current} onChange={(e) => onChange(e.target.value)}>
          {currencyChoices(value).map((code) => (
            <option key={code} value={code}>
              {t('currency.option', { name: currencyName(code, locale), code })}
            </option>
          ))}
        </select>
      ) : (
        <p id={id}>{t('currency.option', { name: currencyName(current, locale), code: current })}</p>
      )}
      <p className="mt-1.5 text-sm text-muted">{t('currency.hint', { example })}</p>
    </div>
  );
}
