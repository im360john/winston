'use client'

import type { OnboardingData } from '@/app/onboarding/page'

export default function Step3Identity({
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
    if (!data.agentName || !data.personality) {
      return
    }
    onNext()
  }

  const toneLabels = {
    casual: 'Casual',
    professional: 'Professional',
    formal: 'Formal',
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold mb-2">Name & personalize your agent</h1>
        <p className="text-gray-600">
          Customize how your agent identifies itself and interacts
        </p>
      </div>

      {/* Agent Name */}
      <div>
        <label htmlFor="agentName" className="block text-sm font-medium text-gray-700 mb-1">
          Agent Name
        </label>
        <input
          type="text"
          id="agentName"
          required
          value={data.agentName || ''}
          onChange={(e) => updateData({ agentName: e.target.value })}
          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-winston-500 focus:border-transparent"
          placeholder="Bud"
        />
        <p className="text-xs text-gray-500 mt-1">
          This is what your customers and team will call your agent.
        </p>
      </div>

      {/* Personality */}
      <div>
        <label htmlFor="personality" className="block text-sm font-medium text-gray-700 mb-1">
          Agent Personality
        </label>
        <textarea
          id="personality"
          required
          rows={6}
          value={data.personality || `You are ${data.agentName || 'an AI assistant'}, a friendly and knowledgeable assistant for ${data.businessName || 'this business'}. You help customers and staff with questions and tasks. You communicate in a warm, approachable tone that reflects the brand.`}
          onChange={(e) => updateData({ personality: e.target.value })}
          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-winston-500 focus:border-transparent"
        />
        <p className="text-xs text-gray-500 mt-1">
          ↑ Auto-generated from your website. Edit freely to match your brand voice.
        </p>
      </div>

      {/* Tone Slider */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Tone
        </label>
        <div className="flex items-center gap-4">
          <span className="text-sm text-gray-600 w-24">Casual</span>
          <input
            type="range"
            min="0"
            max="2"
            step="1"
            value={data.tone === 'casual' ? 0 : data.tone === 'professional' ? 1 : 2}
            onChange={(e) => {
              const value = parseInt(e.target.value)
              updateData({
                tone: value === 0 ? 'casual' : value === 1 ? 'professional' : 'formal'
              })
            }}
            className="flex-1"
          />
          <span className="text-sm text-gray-600 w-24 text-right">Formal</span>
        </div>
        <p className="text-sm text-center mt-2 font-medium text-winston-600">
          {toneLabels[data.tone || 'casual']}
        </p>
      </div>

      {/* Preview */}
      <div className="p-4 bg-gray-50 border border-gray-200 rounded-lg">
        <p className="text-sm font-medium text-gray-700 mb-2">Preview greeting:</p>
        <div className="p-3 bg-white rounded-lg border border-gray-200">
          <p className="text-sm">
            Hey! I'm {data.agentName || 'your AI assistant'}, your assistant for {data.businessName || 'your business'}. What can I help you with today?
          </p>
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
