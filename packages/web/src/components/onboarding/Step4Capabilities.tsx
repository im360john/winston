'use client'

import { useState } from 'react'
import type { OnboardingData } from '@/app/onboarding/page'

export default function Step4Capabilities({
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
  const [newCapability, setNewCapability] = useState('')

  const addCapability = () => {
    if (newCapability.trim()) {
      updateData({
        capabilities: [...(data.capabilities || []), newCapability.trim()]
      })
      setNewCapability('')
    }
  }

  const removeCapability = (index: number) => {
    updateData({
      capabilities: (data.capabilities || []).filter((_, i) => i !== index)
    })
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    onNext()
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold mb-2">What should your agent help with?</h1>
        <p className="text-gray-600">
          We've suggested some based on your business. Edit, remove, or add your own.
        </p>
      </div>

      {/* Capabilities List */}
      <div className="space-y-2">
        {(data.capabilities || []).map((capability, index) => (
          <div key={index} className="flex items-center gap-2 p-3 bg-gray-50 rounded-lg">
            <span className="flex-1 text-sm">{index + 1}. {capability}</span>
            <button
              type="button"
              onClick={() => removeCapability(index)}
              className="text-gray-400 hover:text-red-600 text-xl"
            >
              ×
            </button>
          </div>
        ))}

        {/* Add New */}
        <div className="flex gap-2">
          <input
            type="text"
            value={newCapability}
            onChange={(e) => setNewCapability(e.target.value)}
            onKeyPress={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault()
                addCapability()
              }
            }}
            className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-winston-500"
            placeholder="Add another capability..."
          />
          <button
            type="button"
            onClick={addCapability}
            className="px-6 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors"
          >
            + Add
          </button>
        </div>
      </div>

      {/* Sub-Agent Suggestion (if 5+ capabilities) */}
      {(data.capabilities || []).length >= 5 && (
        <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
          <p className="text-sm font-medium text-blue-900 mb-2">💡 Recommendation</p>
          <p className="text-sm text-blue-800 mb-3">
            Based on your capabilities, we recommend setting up TWO agents:
          </p>
          <ul className="text-sm text-blue-800 space-y-1 mb-4">
            <li>• Customer-facing agent (WebChat, read-only)</li>
            <li>• Internal team agent (Telegram/Slack, full access)</li>
          </ul>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => updateData({ setupSubAgents: true })}
              className={`flex-1 px-4 py-2 rounded-lg transition-colors ${
                data.setupSubAgents
                  ? 'bg-blue-600 text-white'
                  : 'bg-white text-blue-600 border border-blue-600'
              }`}
            >
              Yes, set up both
            </button>
            <button
              type="button"
              onClick={() => updateData({ setupSubAgents: false })}
              className={`flex-1 px-4 py-2 rounded-lg transition-colors ${
                !data.setupSubAgents
                  ? 'bg-blue-600 text-white'
                  : 'bg-white text-blue-600 border border-blue-600'
              }`}
            >
              No, just one agent
            </button>
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
          type="submit"
          className="flex-1 px-6 py-3 bg-winston-600 text-white rounded-lg font-semibold hover:bg-winston-700 transition-colors"
        >
          Continue →
        </button>
      </div>
    </form>
  )
}
