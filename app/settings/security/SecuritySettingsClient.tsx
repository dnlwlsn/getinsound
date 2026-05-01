'use client'

import { SettingsTabs } from '@/components/settings/SettingsTabs'

export function SecuritySettingsClient() {
  return (
    <div className="min-h-screen bg-zinc-950 text-white">
      <div className="max-w-2xl mx-auto px-4 pt-24 pb-12">
        <h1 className="text-2xl font-bold mb-6">Settings</h1>
        <SettingsTabs />

        <h2 className="text-lg font-semibold mb-4">Security</h2>
        <p className="text-sm text-zinc-400">
          More security settings coming soon.
        </p>
      </div>
    </div>
  )
}
