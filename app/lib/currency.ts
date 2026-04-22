const COUNTRY_TO_CURRENCY: Record<string, string> = {
  GB: 'GBP',
  US: 'USD',
  CA: 'CAD',
  AU: 'AUD',
  JP: 'JPY',
  DE: 'EUR', FR: 'EUR', ES: 'EUR', IT: 'EUR', NL: 'EUR',
  BE: 'EUR', AT: 'EUR', IE: 'EUR', PT: 'EUR', FI: 'EUR',
  GR: 'EUR', LU: 'EUR', MT: 'EUR', SK: 'EUR', SI: 'EUR',
  EE: 'EUR', LV: 'EUR', LT: 'EUR', CY: 'EUR',
}

const COUNTRY_TO_LOCALE: Record<string, string> = {
  GB: 'en-GB', US: 'en-US', CA: 'en-CA', AU: 'en-AU', JP: 'ja-JP',
  DE: 'de-DE', FR: 'fr-FR', ES: 'es-ES', IT: 'it-IT', NL: 'nl-NL',
  BE: 'nl-BE', AT: 'de-AT', IE: 'en-IE', PT: 'pt-PT', FI: 'fi-FI',
  GR: 'el-GR', LU: 'fr-LU', MT: 'en-MT', SK: 'sk-SK', SI: 'sl-SI',
  EE: 'et-EE', LV: 'lv-LV', LT: 'lt-LT', CY: 'el-CY',
}

const ZERO_DECIMAL_CURRENCIES = new Set(['JPY'])

export const SUPPORTED_CURRENCIES = [
  { code: 'GBP', symbol: '£', label: 'GBP (£)' },
  { code: 'USD', symbol: '$', label: 'USD ($)' },
  { code: 'EUR', symbol: '€', label: 'EUR (€)' },
  { code: 'CAD', symbol: 'C$', label: 'CAD (C$)' },
  { code: 'AUD', symbol: 'A$', label: 'AUD (A$)' },
  { code: 'JPY', symbol: '¥', label: 'JPY (¥)' },
]

export function getCurrencyForCountry(countryCode: string): string {
  return COUNTRY_TO_CURRENCY[countryCode] || 'USD'
}

export function getLocaleTag(countryCode: string): string {
  return COUNTRY_TO_LOCALE[countryCode] || 'en-US'
}

export function formatPrice(amount: number, currency: string, locale?: string): string {
  const resolvedLocale = locale || (currency === 'GBP' ? 'en-GB' : currency === 'EUR' ? 'de-DE' : currency === 'JPY' ? 'ja-JP' : 'en-US')
  const decimals = ZERO_DECIMAL_CURRENCIES.has(currency) ? 0 : 2
  return new Intl.NumberFormat(resolvedLocale, {
    style: 'currency',
    currency,
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(amount)
}

export function convertPrice(
  amount: number,
  fromCurrency: string,
  toCurrency: string,
  rates: Record<string, number>,
): number {
  if (fromCurrency === toCurrency) return amount
  const inUsd = amount / rates[fromCurrency]
  const converted = inUsd * rates[toCurrency]
  return ZERO_DECIMAL_CURRENCIES.has(toCurrency)
    ? Math.round(converted)
    : Math.round(converted * 100) / 100
}

export function isEEACountry(countryCode: string): boolean {
  const eea = new Set([
    'DE', 'FR', 'ES', 'IT', 'NL', 'BE', 'AT', 'IE', 'PT', 'FI',
    'GR', 'LU', 'MT', 'SK', 'SI', 'EE', 'LV', 'LT', 'CY',
    'BG', 'HR', 'CZ', 'DK', 'HU', 'PL', 'RO', 'SE',
    'IS', 'LI', 'NO',
  ])
  return eea.has(countryCode)
}

export function getRegion(countryCode: string): 'UK' | 'EEA' | 'US' | 'OTHER' {
  if (countryCode === 'GB') return 'UK'
  if (countryCode === 'US') return 'US'
  if (isEEACountry(countryCode)) return 'EEA'
  return 'OTHER'
}
