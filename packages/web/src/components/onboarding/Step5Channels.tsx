'use client'

import type { OnboardingData } from '@/app/onboarding/page'

export default function Step5Channels({
  data,
  updateData,
  onNext,
  onBack,
}: {
  data: Partial<OnboardingData>
  updateData: (updates: Partial<OnboardingData>) => void
  onNext: () => void
  onBack: () => void
}) {
  const toggleChannel = (channel: keyof NonNullable<OnboardingData['channels']>) => {
    updateData({
      channels: {
        telegram: data.channels?.telegram || false,
        slack: data.channels?.slack || false,
        whatsapp: data.channels?.whatsapp || false,
        webchat: data.channels?.webchat || false,
        [channel]: !data.channels?.[channel],
      }
    })
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()

    // Validate Telegram token if Telegram is enabled
    if (data.channels?.telegram && !data.telegramBotToken) {
      alert('Please provide a Telegram bot token')
      return
    }

    onNext()
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold mb-2">Where should your agent be available?</h1>
        <p className="text-gray-600">
          Connect your preferred messaging channels
        </p>
      </div>

      {/* Telegram */}
      <div className={`p-6 border-2 rounded-lg transition-colors ${
        data.channels?.telegram ? 'border-winston-600 bg-winston-50' : 'border-gray-200'
      }`}>
        <div className="flex items-start justify-between mb-4">
          <div>
            <h3 className="text-lg font-semibold">Telegram</h3>
            <p className="text-sm text-gray-600">(Recommended — easiest setup)</p>
          </div>
          <label className="relative inline-flex items-center cursor-pointer">
            <input
              type="checkbox"
              checked={data.channels?.telegram || false}
              onChange={() => toggleChannel('telegram')}
              className="sr-only peer"
            />
            <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-winston-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-winston-600"></div>
          </label>
        </div>

        {data.channels?.telegram && (
          <div className="space-y-3">
            <p className="text-sm text-gray-700">Quick setup — takes 90 seconds:</p>
            <ol className="text-sm space-y-1 ml-4 list-decimal">
              <li>Open Telegram, search for @BotFather</li>
              <li>Send: <code className="bg-gray-200 px-1 rounded">/newbot</code></li>
              <li>Follow prompts to name your bot</li>
              <li>Copy the token and paste below</li>
            </ol>
            <div>
              <label htmlFor="telegramToken" className="block text-sm font-medium text-gray-700 mb-1">
                Bot Token
              </label>
              <input
                type="text"
                id="telegramToken"
                value={data.telegramBotToken || ''}
                onChange={(e) => updateData({ telegramBotToken: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-winston-500"
                placeholder="110201543:AAHdqTcvCH1vGWJxfSeofSAs0K5P..."
              />
            </div>
          </div>
        )}
      </div>

      {/* Slack */}
      <div className={`p-6 border-2 rounded-lg transition-colors ${
        data.channels?.slack ? 'border-winston-600 bg-winston-50' : 'border-gray-200'
      }`}>
        <div className="flex items-start justify-between">
          <div>
            <h3 className="text-lg font-semibold">Slack</h3>
            <p className="text-sm text-gray-600">Connect your team workspace</p>
          </div>
          <label className="relative inline-flex items-center cursor-pointer">
            <input
              type="checkbox"
              checked={data.channels?.slack || false}
              onChange={() => toggleChannel('slack')}
              className="sr-only peer"
            />
            <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-winston-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-winston-600"></div>
          </label>
        </div>
        {data.channels?.slack && (
          <div className="mt-3">
            <p className="text-sm text-gray-600">Slack OAuth flow will be completed after launch</p>
          </div>
        )}
      </div>

      {/* WhatsApp */}
      <div className={`p-6 border-2 rounded-lg transition-colors ${
        data.channels?.whatsapp ? 'border-winston-600 bg-winston-50' : 'border-gray-200'
      }`}>
        <div className="flex items-start justify-between">
          <div>
            <h3 className="text-lg font-semibold">WhatsApp</h3>
            <p className="text-sm text-gray-600">⚠ Requires periodic re-authentication</p>
          </div>
          <label className="relative inline-flex items-center cursor-pointer">
            <input
              type="checkbox"
              checked={data.channels?.whatsapp || false}
              onChange={() => toggleChannel('whatsapp')}
              className="sr-only peer"
            />
            <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-winston-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-winston-600"></div>
          </label>
        </div>
        {data.channels?.whatsapp && (
          <div className="mt-3">
            <p className="text-sm text-gray-600">WhatsApp setup will be completed after launch</p>
          </div>
        )}
      </div>

      {/* WebChat */}
      <div className="p-6 border-2 border-winston-600 bg-winston-50 rounded-lg">
        <div className="flex items-start justify-between">
          <div>
            <h3 className="text-lg font-semibold">WebChat</h3>
            <p className="text-sm text-gray-600">Auto-enabled — embed code provided after setup</p>
          </div>
          <div className="w-11 h-6 bg-winston-600 rounded-full flex items-center px-1">
            <div className="w-5 h-5 bg-white rounded-full ml-auto"></div>
          </div>
        </div>
      </div>

      {/* Actions */}
      <div className="flex gap-4">
        <button
          type="button"
          onClick={onBack}
          className="px-6 py-3 border-2 border-gray-300 text-gray-700 rounded-lg font-semibold hover:bg-gray-50 transition-colors"
        >
          ← Back
        </button>
        <button
          type="submit"
          className="flex-1 px-6 py-3 bg-winston-600 text-white rounded-lg font-semibold hover:bg-winston-700 transition-colors"
        >
          Continue →
        </button>
      </div>
    </form>
  )
}
