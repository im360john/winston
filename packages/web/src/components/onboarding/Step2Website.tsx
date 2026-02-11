'use client'

import { useState } from 'react'
import axios from 'axios'
import type { OnboardingData } from '@/app/onboarding/page'

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'

export default function Step2Website({
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
  const [analyzing, setAnalyzing] = useState(false)
  const [analyzed, setAnalyzed] = useState(false)
  const [error, setError] = useState('')

  const analyzeWebsite = async () => {
    if (!data.websiteUrl) {
      setError('Please enter a website URL')
      return
    }

    setAnalyzing(true)
    setError('')

    try {
      const response = await axios.post(`${API_URL}/api/website/analyze`, {
        url: data.websiteUrl,
      })

      const analysis = response.data.analysis

      updateData({
        businessName: analysis.businessName || '',
        industry: analysis.industry || 'cannabis',
        subIndustry: analysis.subIndustry || 'dispensary',
        location: analysis.location || '',
        hours: analysis.hours || '',
        description: analysis.description || '',
        brandColors: {
          primary: analysis.brandColors?.primary || '#22c55e',
          secondary: analysis.brandColors?.secondary || '#f5f0e8',
          accent: analysis.brandColors?.accent,
        },
        // Store suggested capabilities for Step 4
        capabilities: analysis.suggestedCapabilities || [],
        // Store suggested agent name for Step 3
        agentName: analysis.suggestedAgentName || 'Assistant',
        tone: (analysis.tone || 'casual') as OnboardingData['tone'],
      })

      setAnalyzed(true)
    } catch (err) {
      if (axios.isAxiosError(err)) {
        setError(err.response?.data?.error || 'Failed to analyze website')
      } else {
        setError('An error occurred while analyzing your website')
      }
    } finally {
      setAnalyzing(false)
    }
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()

    if (!analyzed) {
      setError('Please analyze your website first')
      return
    }

    if (!data.businessName) {
      setError('Please provide a business name')
      return
    }

    onNext()
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold mb-2">Let's learn about your business</h1>
        <p className="text-gray-600">
          We'll analyze your website to customize your AI agent
        </p>
      </div>

      {/* Website URL Input */}
      <div>
        <label htmlFor="websiteUrl" className="block text-sm font-medium text-gray-700 mb-1">
          Enter your website URL
        </label>
        <div className="flex gap-2">
          <input
            type="url"
            id="websiteUrl"
            required
            value={data.websiteUrl || ''}
            onChange={(e) => updateData({ websiteUrl: e.target.value })}
            className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-winston-500 focus:border-transparent"
            placeholder="https://www.yourwebsite.com"
            disabled={analyzing}
          />
          <button
            type="button"
            onClick={analyzeWebsite}
            disabled={analyzing || !data.websiteUrl}
            className="px-6 py-2 bg-winston-600 text-white rounded-lg font-semibold hover:bg-winston-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
          >
            {analyzing ? 'Analyzing...' : 'Analyze'}
          </button>
        </div>
      </div>

      {/* Analysis Progress */}
      {analyzing && (
        <div className="p-6 bg-winston-50 border border-winston-200 rounded-lg">
          <div className="space-y-2 text-sm">
            <div className="flex items-center">
              <span className="text-winston-600 mr-2">⟳</span>
              <span>Fetching your website...</span>
            </div>
            <div className="flex items-center">
              <span className="text-winston-600 mr-2">⟳</span>
              <span>Analyzing content...</span>
            </div>
            <div className="flex items-center">
              <span className="text-winston-600 mr-2">⟳</span>
              <span>Extracting business information...</span>
            </div>
          </div>
          <p className="text-xs text-gray-600 mt-3">This usually takes 5-10 seconds...</p>
        </div>
      )}

      {/* Analysis Results */}
      {analyzed && !analyzing && (
        <div className="p-6 bg-green-50 border border-green-200 rounded-lg">
          <div className="space-y-2 text-sm mb-4">
            <div className="flex items-center">
              <span className="text-green-600 mr-2">✓</span>
              <span>Found your site</span>
            </div>
            <div className="flex items-center">
              <span className="text-green-600 mr-2">✓</span>
              <span>Identified: {data.industry || 'Business'}</span>
            </div>
            <div className="flex items-center">
              <span className="text-green-600 mr-2">✓</span>
              <span>Detected brand colors</span>
            </div>
            <div className="flex items-center">
              <span className="text-green-600 mr-2">✓</span>
              <span>Extracted business info</span>
            </div>
          </div>

          <p className="text-sm font-medium text-gray-700 mb-3">
            We detected the following information. Edit any field if we got something wrong:
          </p>

          <div className="space-y-4">
            {/* Business Name */}
            <div>
              <label htmlFor="businessName" className="block text-sm font-medium text-gray-700 mb-1">
                Business Name
              </label>
              <input
                type="text"
                id="businessName"
                value={data.businessName || ''}
                onChange={(e) => updateData({ businessName: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-winston-500"
              />
            </div>

            {/* Industry */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label htmlFor="industry" className="block text-sm font-medium text-gray-700 mb-1">
                  Industry
                </label>
                <input
                  type="text"
                  id="industry"
                  value={data.industry || ''}
                  onChange={(e) => updateData({ industry: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-winston-500"
                />
              </div>
              <div>
                <label htmlFor="subIndustry" className="block text-sm font-medium text-gray-700 mb-1">
                  Type
                </label>
                <input
                  type="text"
                  id="subIndustry"
                  value={data.subIndustry || ''}
                  onChange={(e) => updateData({ subIndustry: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-winston-500"
                />
              </div>
            </div>

            {/* Location & Hours */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label htmlFor="location" className="block text-sm font-medium text-gray-700 mb-1">
                  Location
                </label>
                <input
                  type="text"
                  id="location"
                  value={data.location || ''}
                  onChange={(e) => updateData({ location: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-winston-500"
                  placeholder="City, State"
                />
              </div>
              <div>
                <label htmlFor="hours" className="block text-sm font-medium text-gray-700 mb-1">
                  Hours
                </label>
                <input
                  type="text"
                  id="hours"
                  value={data.hours || ''}
                  onChange={(e) => updateData({ hours: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-winston-500"
                  placeholder="9am-9pm daily"
                />
              </div>
            </div>

            {/* Brand Colors */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Brand Colors
              </label>
              <div className="flex gap-4">
                <div>
                  <label className="block text-xs text-gray-600 mb-1">Primary</label>
                  <div className="flex items-center gap-2">
                    <input
                      type="color"
                      value={data.brandColors?.primary || '#22c55e'}
                      onChange={(e) => updateData({
                        brandColors: { ...data.brandColors, primary: e.target.value } as any
                      })}
                      className="w-12 h-12 rounded border border-gray-300"
                    />
                    <span className="text-sm font-mono">{data.brandColors?.primary || '#22c55e'}</span>
                  </div>
                </div>
                <div>
                  <label className="block text-xs text-gray-600 mb-1">Secondary</label>
                  <div className="flex items-center gap-2">
                    <input
                      type="color"
                      value={data.brandColors?.secondary || '#f5f0e8'}
                      onChange={(e) => updateData({
                        brandColors: { ...data.brandColors, secondary: e.target.value } as any
                      })}
                      className="w-12 h-12 rounded border border-gray-300"
                    />
                    <span className="text-sm font-mono">{data.brandColors?.secondary || '#f5f0e8'}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
          {error}
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
          disabled={!analyzed}
          className="flex-1 px-6 py-3 bg-winston-600 text-white rounded-lg font-semibold hover:bg-winston-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
        >
          Continue →
        </button>
      </div>
    </form>
  )
}
