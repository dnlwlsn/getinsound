'use client'

import { useEffect } from 'react'
import { registerServiceWorker } from '@/lib/pwa/register'

export function ServiceWorkerRegistration() {
  useEffect(() => {
    registerServiceWorker()
  }, [])

  return null
}
