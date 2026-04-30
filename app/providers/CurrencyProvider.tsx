'use client'

import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from 'react'
import { formatPrice as formatPriceUtil, convertPrice as convertPriceUtil, getCurrencyForCountry } from '../lib/currency'

interface CurrencyContextValue {
  locale: string
  currency: string
  setCurrency: (code: string) => void
  formatPrice: (amount: number, currency?: string) => string
  exchangeRates: Record<string, number>
  convertPrice: (amount: number, fromCurrency: string, toCurrency: string) => number
}

const CurrencyContext = createContext<CurrencyContextValue | null>(null)

export function useCurrency() {
  const ctx = useContext(CurrencyContext)
  if (!ctx) throw new Error('useCurrency must be used within CurrencyProvider')
  return ctx
}

function setCookie(name: string, value: string, days: number) {
  const expires = new Date(Date.now() + days * 864e5).toUTCString()
  document.cookie = `${name}=${value};path=/;expires=${expires};samesite=lax`
}

interface Props {
  children: ReactNode
  initialLocale: string
  initialCurrency: string
}

export function CurrencyProvider({ children, initialLocale, initialCurrency }: Props) {
  const [locale, setLocale] = useState(initialLocale)
  const [currency, setCurrencyState] = useState(initialCurrency)
  const [exchangeRates, setExchangeRates] = useState<Record<string, number>>({})

  useEffect(() => {
    if (!locale || locale === 'XX') {
      try {
        const browserLocale = navigator.language || 'en-US'
        const match = browserLocale.match(/[a-z]{2}-([A-Z]{2})/)
        const country = match ? match[1] : 'US'
        setLocale(country)
        if (!currency || currency === 'USD') {
          const detected = getCurrencyForCountry(country)
          setCurrencyState(detected)
          setCookie('insound_locale', country, 30)
          setCookie('insound_currency', detected, 30)
        }
      } catch {}
    }
  }, [locale, currency])

  useEffect(() => {
    const cached = localStorage.getItem('insound_exchange_rates')
    if (cached) {
      try { setExchangeRates(JSON.parse(cached)) } catch {}
    }
    fetch('/api/exchange-rates')
      .then(r => r.json())
      .then(data => {
        if (data.rates) {
          setExchangeRates(data.rates)
          localStorage.setItem('insound_exchange_rates', JSON.stringify(data.rates))
        }
      })
      .catch(() => {})
  }, [])

  const setCurrency = useCallback((code: string) => {
    setCurrencyState(code)
    setCookie('insound_currency', code, 30)
    fetch('/api/fan-currency', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ display_currency: code, locale }),
    }).catch(() => {})
  }, [locale])

  const formatPrice = useCallback(
    (amount: number, overrideCurrency?: string) =>
      formatPriceUtil(amount, overrideCurrency || currency, undefined),
    [currency],
  )

  const convertPrice = useCallback(
    (amount: number, fromCurrency: string, toCurrency: string) =>
      convertPriceUtil(amount, fromCurrency, toCurrency, exchangeRates),
    [exchangeRates],
  )

  return (
    <CurrencyContext.Provider value={{ locale, currency, setCurrency, formatPrice, exchangeRates, convertPrice }}>
      {children}
    </CurrencyContext.Provider>
  )
}
