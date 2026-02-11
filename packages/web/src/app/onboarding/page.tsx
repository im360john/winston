'use client'

import { useState } from 'react'
import Step1Account from '@/components/onboarding/Step1Account'
import Step2Website from '@/components/onboarding/Step2Website'
import Step3Identity from '@/components/onboarding/Step3Identity'
import Step4Capabilities from '@/components/onboarding/Step4Capabilities'
import Step5Channels from '@/components/onboarding/Step5Channels'
import Step6Connectors from '@/components/onboarding/Step6Connectors'
import Step7Launch from '@/components/onboarding/Step7Launch'

export type OnboardingData = {
  // Step 1: Account & Payment
  email: string
  password: string
  tier: 'free' | 'starter' | 'growth'
  paymentMethodId?: string

  // Step 2: Website Analysis
  websiteUrl: string
  businessName: string
  industry: string
  subIndustry: string
  location: string
  hours: string
  description: string
  brandColors: {
    primary: string
    secondary: string
    accent?: string
  }

  // Step 3: Agent Identity
  agentName: string
  personality: string
  tone: 'casual' | 'professional' | 'formal'

  // Step 4: Capabilities
  capabilities: string[]
  setupSubAgents: boolean

  // Step 5: Channels
  channels: {
    telegram: boolean
    slack: boolean
    whatsapp: boolean
    webchat: boolean
  }
  telegramBotToken?: string
  slackWorkspace?: string

  // Step 6: Connectors
  connectors: Array<{
    type: string
    apiKey: string
    accessLevel: 'read' | 'read-write'
  }>

  // Step 7: Model Selection
  selectedModel: 'kimi-k2.5' | 'claude-sonnet-4-5' | 'claude-opus-4-6' | 'gpt-4o'
}

export default function OnboardingPage() {
  const [currentStep, setCurrentStep] = useState(1)
  const [data, setData] = useState<Partial<OnboardingData>>({
    tier: 'free',
    tone: 'casual',
    channels: {
      telegram: true,
      slack: false,
      whatsapp: false,
      webchat: true,
    },
    capabilities: [],
    connectors: [],
    selectedModel: 'kimi-k2.5',
  })

  const updateData = (updates: Partial<OnboardingData>) => {
    setData((prev) => ({ ...prev, ...updates }))
  }

  const nextStep = () => {
    if (currentStep < 7) {
      setCurrentStep((prev) => prev + 1)
    }
  }

  const prevStep = () => {
    if (currentStep > 1) {
      setCurrentStep((prev) => prev - 1)
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-3xl mx-auto px-4">
        {/* Progress Bar */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-sm font-semibold text-gray-600">
              Step {currentStep} of 7
            </h2>
            <button
              onClick={prevStep}
              disabled={currentStep === 1}
              className="text-sm text-winston-600 hover:text-winston-700 disabled:text-gray-400 disabled:cursor-not-allowed"
            >
              ← Back
            </button>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-2">
            <div
              className="bg-winston-600 h-2 rounded-full transition-all duration-300"
              style={{ width: `${(currentStep / 7) * 100}%` }}
            />
          </div>
        </div>

        {/* Step Content */}
        <div className="bg-white rounded-lg shadow-lg p-8">
          {currentStep === 1 && (
            <Step1Account
              data={data}
              updateData={updateData}
              onNext={nextStep}
            />
          )}
          {currentStep === 2 && (
            <Step2Website
              data={data}
              updateData={updateData}
              onNext={nextStep}
              onBack={prevStep}
            />
          )}
          {currentStep === 3 && (
            <Step3Identity
              data={data}
              updateData={updateData}
              onNext={nextStep}
              onBack={prevStep}
            />
          )}
          {currentStep === 4 && (
            <Step4Capabilities
              data={data}
              updateData={updateData}
              onNext={nextStep}
              onBack={prevStep}
            />
          )}
          {currentStep === 5 && (
            <Step5Channels
              data={data}
              updateData={updateData}
              onNext={nextStep}
              onBack={prevStep}
            />
          )}
          {currentStep === 6 && (
            <Step6Connectors
              data={data}
              updateData={updateData}
              onNext={nextStep}
              onBack={prevStep}
            />
          )}
          {currentStep === 7 && (
            <Step7Launch
              data={data}
              updateData={updateData}
              onBack={prevStep}
            />
          )}
        </div>

        {/* Winston Branding */}
        <div className="mt-8 text-center text-sm text-gray-500">
          Powered by Winston
        </div>
      </div>
    </div>
  )
}
