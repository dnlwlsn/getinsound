const VISIT_COUNT_KEY = 'insound-visit-count'
const INSTALL_DISMISSED_KEY = 'insound-install-dismissed'
const NOTIF_DISMISSED_KEY = 'insound-notif-optin-dismissed'

export function incrementVisitCount(): number {
  const count = parseInt(localStorage.getItem(VISIT_COUNT_KEY) ?? '0', 10) + 1
  localStorage.setItem(VISIT_COUNT_KEY, count.toString())
  return count
}

export function getVisitCount(): number {
  return parseInt(localStorage.getItem(VISIT_COUNT_KEY) ?? '0', 10)
}

export function isInstallDismissed(): boolean {
  const dismissed = localStorage.getItem(INSTALL_DISMISSED_KEY)
  if (!dismissed) return false
  return Date.now() - parseInt(dismissed, 10) < 30 * 24 * 60 * 60 * 1000
}

export function dismissInstall(): void {
  localStorage.setItem(INSTALL_DISMISSED_KEY, Date.now().toString())
}

export function isNotifOptInDismissed(): boolean {
  return localStorage.getItem(NOTIF_DISMISSED_KEY) === 'true'
}

export function dismissNotifOptIn(): void {
  localStorage.setItem(NOTIF_DISMISSED_KEY, 'true')
}
