'use client'

import type { OnboardingData } from '@/app/onboarding/page'

const CONNECTOR_OPTIONS = [
  { type: 'treez', name: 'Treez', category: 'Cannabis POS' },
  { type: 'dutchie', name: 'Dutchie', category: 'Cannabis POS' },
  { type: 'blaze', name: 'Blaze', category: 'Cannabis POS' },
  { type: 'google-calendar', name: 'Google Calendar', category: 'Productivity' },
  { type: 'gmail', name: 'Gmail', category: 'Productivity' },
  { type: 'notion', name: 'Notion', category: 'Productivity' },
  { type: 'airtable', name: 'Airtable', category: 'Productivity' },
]

export default function Step6Connectors({
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
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    onNext()
  }

  const skip = () => {
    updateData({ connectors: [] })
    onNext()
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold mb-2">Connect your tools</h1>
        <p className="text-gray-600">
          (Optional — you can add these later from your dashboard)
        </p>
      </div>

      <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
        <p className="text-sm text-blue-900">
          Connecting your business tools lets your agent access real data.
          All connections are <strong>READ-ONLY</strong> by default for security.
        </p>
      </div>

      {/* Cannabis POS Systems */}
      <div>
        <h3 className="text-lg font-semibold mb-3">Cannabis POS Systems</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {CONNECTOR_OPTIONS.filter(c => c.category === 'Cannabis POS').map((connector) => (
            <button
              key={connector.type}
              type="button"
              onClick={() => {
                // Placeholder - would open modal for API key input
                alert(`${connector.name} connector setup coming soon!`)
              }}
              className="p-4 border-2 border-gray-200 rounded-lg hover:border-winston-600 transition-colors text-left"
            >
              <div className="font-semibold">{connector.name}</div>
              <div className="text-xs text-winston-600 mt-1">Connect →</div>
            </button>
          ))}
        </div>
      </div>

      {/* Other Tools */}
      <div>
        <h3 className="text-lg font-semibold mb-3">Other Tools</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {CONNECTOR_OPTIONS.filter(c => c.category === 'Productivity').map((connector) => (
            <button
              key={connector.type}
              type="button"
              onClick={() => {
                alert(`${connector.name} connector setup coming soon!`)
              }}
              className="p-4 border-2 border-gray-200 rounded-lg hover:border-winston-600 transition-colors text-center"
            >
              <div className="font-semibold text-sm">{connector.name}</div>
              <div className="text-xs text-winston-600 mt-1">Connect →</div>
            </button>
          ))}
        </div>
      </div>

      {/* Connected Connectors (if any) */}
      {(data.connectors || []).length > 0 && (
        <div>
          <h3 className="text-lg font-semibold mb-3">Connected</h3>
          <div className="space-y-2">
            {data.connectors?.map((connector, index) => (
              <div key={index} className="flex items-center justify-between p-4 bg-green-50 border border-green-200 rounded-lg">
                <div>
                  <div className="font-semibold">{connector.type}</div>
                  <div className="text-xs text-gray-600">{connector.accessLevel === 'read' ? 'Read-only' : 'Read & Write'}</div>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    updateData({
                      connectors: (data.connectors || []).filter((_, i) => i !== index)
                    })
                  }}
                  className="text-red-600 hover:text-red-700"
                >
                  Remove
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

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
          type="button"
          onClick={skip}
          className="px-6 py-3 border-2 border-winston-600 text-winston-600 rounded-lg font-semibold hover:bg-winston-50 transition-colors"
        >
          Skip for now
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
