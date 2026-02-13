'use client'

import { useState } from 'react'
import axios from 'axios'
import { useRouter } from 'next/navigation'
import { signIn } from 'next-auth/react'
import type { OnboardingData } from '@/app/onboarding/page'

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'

// Stripe Price IDs for each tier (non-secret). Prefer env so prod matches your Stripe account.
// If missing, onboarding will skip subscription creation instead of blocking provisioning.
const PRICE_IDS = {
  free: process.env.NEXT_PUBLIC_STRIPE_PRICE_ID_FREE,
  starter: process.env.NEXT_PUBLIC_STRIPE_PRICE_ID_STARTER,
  growth: process.env.NEXT_PUBLIC_STRIPE_PRICE_ID_GROWTH,
} as const

const MODELS = [
  {
    id: 'kimi-k2.5',
    name: 'Kimi K2.5',
    multiplier: '1.0x',
    description: 'Best value — recommended for most users',
    duration: '~60 days on Free tier',
  },
  {
    id: 'claude-sonnet-4-5',
    name: 'Claude Sonnet 4.5',
    multiplier: '5.0x',
    description: 'Higher quality responses, faster credit usage',
    duration: '~12 days on Free tier',
  },
  {
    id: 'claude-opus-4-6',
    name: 'Claude Opus 4.6',
    multiplier: '12.0x',
    description: 'Highest quality, premium pricing',
    duration: '~5 days on Free tier',
  },
  {
    id: 'gpt-4o',
    name: 'GPT-4o',
    multiplier: '3.0x',
    description: 'OpenAI flagship model',
    duration: '~20 days on Free tier',
  },
]

export default function Step7Launch({
  data,
  updateData,
  onBack,
}: {
  data: Partial<OnboardingData>
  updateData: (updates: Partial<OnboardingData>) => void
  onBack: () => void
}) {
  const router = useRouter()
  const [launching, setLaunching] = useState(false)
  const [progress, setProgress] = useState<string[]>([])
  const [error, setError] = useState('')

  const selectedModel = MODELS.find(m => m.id === data.selectedModel) || MODELS[0]

  const launch = async () => {
    setLaunching(true)
    setError('')
    setProgress([])

    try {
      if (!data.email || !data.password) {
        throw new Error('Missing email/password from Step 1')
      }
      if (!data.businessName) {
        throw new Error('Missing business name from Step 2')
      }
      if (!data.agentName || !data.personality || !data.tone) {
        throw new Error('Missing agent identity from Step 3')
      }
      if (!data.tier) {
        throw new Error('Missing tier selection')
      }

      // Step 1: Create tenant
      setProgress(['Creating your agent...'])
      const tenantResponse = await axios.post(`${API_URL}/api/tenants`, {
        name: data.businessName,
        email: data.email,
        industry: data.industry,
        sub_industry: data.subIndustry,
        website_url: data.websiteUrl,
        tier: data.tier,
        selected_model: data.selectedModel,
      })

      const tenantId = tenantResponse.data.tenant.id

      // Step 2: Optional Stripe billing
      // Keep provisioning unblocked even if billing isn't configured yet.
      let customerId: string | undefined
      let subscriptionId: string | undefined
      try {
        const isFree = data.tier === 'free'
        const priceId = PRICE_IDS[data.tier as keyof typeof PRICE_IDS]

        if (data.paymentMethodId) {
          setProgress(prev => [...prev, 'Setting up payment...'])
          const customerResponse = await axios.post(`${API_URL}/api/stripe/create-customer`, {
            email: data.email,
            paymentMethodId: data.paymentMethodId,
            name: data.businessName,
          })
          customerId = customerResponse.data.customerId

          if (!isFree && priceId) {
            const subscriptionResponse = await axios.post(`${API_URL}/api/stripe/create-subscription`, {
              customerId,
              priceId,
              tenantId,
            })
            subscriptionId = subscriptionResponse.data.subscriptionId
          }

          if (customerId || subscriptionId) {
            await axios.patch(`${API_URL}/api/tenants/${tenantId}`, {
              ...(customerId ? { stripe_customer_id: customerId } : null),
              ...(subscriptionId ? { stripe_subscription_id: subscriptionId } : null),
            })
          }
        } else {
          setProgress(prev => [...prev, 'Payment method skipped (you can add billing later)...'])
        }
      } catch (billingErr) {
        console.warn('[Onboarding] Billing setup failed, continuing:', billingErr)
        setProgress(prev => [...prev, 'Payment setup failed (continuing without billing)...'])
      }

      // Step 3: Create user account
      setProgress(prev => [...prev, 'Creating your account...'])
      await axios.post(`${API_URL}/api/auth/signup`, {
        email: data.email,
        password: data.password,
        name: data.businessName,
        tenantId: tenantId,
      })

      // Step 4: Provision to Railway
      setProgress(prev => [...prev, 'Generating configs...'])
      await new Promise(resolve => setTimeout(resolve, 1000))

      setProgress(prev => [...prev, 'Deploying to Railway (this takes 3-4 minutes)...'])
      const provisionResponse = await axios.post(
        `${API_URL}/api/tenants/${tenantId}/provision`,
        {
          agentName: data.agentName,
          personality: data.personality,
          tone: data.tone,
          capabilities: data.capabilities,
          channels: {
            telegram: data.channels?.telegram ?? false,
            slack: data.channels?.slack ?? false,
            whatsapp: data.channels?.whatsapp ?? false,
            webchat: data.channels?.webchat ?? true,
          },
          telegramBotToken: data.telegramBotToken,
        },
        {
          timeout: 360000, // 6 minutes timeout (provisioning takes 3-4 min)
        }
      )

      console.log('[Onboarding] Provision complete:', provisionResponse.data)

      // Step 5: Sign in the user (after provisioning completes)
      setProgress(prev => [...prev, 'Signing you in...'])
      const signInResult = await signIn('credentials', {
        email: data.email,
        password: data.password,
        redirect: false,
      })
      if (signInResult?.error) {
        console.warn('[Onboarding] Sign-in failed after provisioning:', signInResult.error)
        setProgress(prev => [...prev, 'Sign-in failed (redirecting to login)...'])
        router.push(`/login?tenant=${tenantId}`)
        return
      }

      // Step 6: Connect channels (placeholder)
      setProgress(prev => [...prev, 'Connecting channels...'])
      await new Promise(resolve => setTimeout(resolve, 1000))

      // Step 7: Done!
      setProgress(prev => [...prev, `${data.agentName} is live! 🎉`])
      await new Promise(resolve => setTimeout(resolve, 1500))

      // Redirect to dashboard (user is now authenticated)
      router.push(`/dashboard?tenant=${tenantId}`)

    } catch (err) {
      console.error('[Onboarding] Launch error:', err)

      if (axios.isAxiosError(err)) {
        if (err.code === 'ECONNABORTED') {
          setError('Deployment timeout - this may still complete. Check your dashboard in a few minutes or contact support.')
        } else if (err.response?.status === 500) {
          setError(`Server error: ${err.response?.data?.error || 'Please try again or contact support'}`)
        } else {
          setError(err.response?.data?.error || err.message || 'Failed to launch agent')
        }
      } else {
        setError('An unexpected error occurred while launching your agent')
      }
      setLaunching(false)
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold mb-2">Review & Launch</h1>
        <p className="text-gray-600">
          Almost there! Review your settings and launch your agent.
        </p>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="p-4 bg-gray-50 rounded-lg">
          <h3 className="font-semibold mb-2">Agent</h3>
          <p className="text-sm"><strong>Name:</strong> {data.agentName}</p>
          <p className="text-sm"><strong>Business:</strong> {data.businessName}</p>
          <p className="text-sm"><strong>Tone:</strong> {data.tone}</p>
        </div>

        <div className="p-4 bg-gray-50 rounded-lg">
          <h3 className="font-semibold mb-2">Plan</h3>
          <p className="text-sm"><strong>Tier:</strong> {data.tier}</p>
          <p className="text-sm"><strong>Credits:</strong> {data.tier === 'free' ? '50,000' : data.tier === 'starter' ? '500,000' : '2,000,000'} / month</p>
        </div>

        <div className="p-4 bg-gray-50 rounded-lg">
          <h3 className="font-semibold mb-2">Channels</h3>
          <div className="text-sm space-y-1">
            {data.channels?.telegram && <p>✓ Telegram</p>}
            {data.channels?.slack && <p>✓ Slack</p>}
            {data.channels?.whatsapp && <p>✓ WhatsApp</p>}
            {data.channels?.webchat && <p>✓ WebChat</p>}
          </div>
        </div>

        <div className="p-4 bg-gray-50 rounded-lg">
          <h3 className="font-semibold mb-2">Capabilities</h3>
          <p className="text-sm">{(data.capabilities || []).length} configured</p>
          <p className="text-sm"><strong>Connectors:</strong> {(data.connectors || []).length}</p>
        </div>
      </div>

      {/* Model Selection */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          AI Model
        </label>
        <select
          value={data.selectedModel}
          onChange={(e) => updateData({ selectedModel: e.target.value as OnboardingData['selectedModel'] })}
          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-winston-500"
          disabled={launching}
        >
          {MODELS.map((model) => (
            <option key={model.id} value={model.id}>
              {model.name} — {model.multiplier} credits ({model.description})
            </option>
          ))}
        </select>
        <p className="text-xs text-gray-600 mt-2">
          <strong>{selectedModel.name}</strong> uses credits {selectedModel.multiplier} faster than Kimi K2.5.
          {' '}{selectedModel.duration} of typical usage.
        </p>
      </div>

      {/* Launch Progress */}
      {launching && (
        <div className="p-6 bg-winston-50 border border-winston-200 rounded-lg">
          <div className="space-y-2 text-sm">
            {progress.map((step, index) => (
              <div key={index} className="flex items-center">
                {index === progress.length - 1 ? (
                  <span className="text-winston-600 mr-2 animate-spin">⟳</span>
                ) : (
                  <span className="text-green-600 mr-2">✓</span>
                )}
                <span className={index === progress.length - 1 ? 'font-semibold' : ''}>
                  {step}
                </span>
              </div>
            ))}
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
          disabled={launching}
          className="px-6 py-3 border-2 border-gray-300 text-gray-700 rounded-lg font-semibold hover:bg-gray-50 disabled:bg-gray-100 disabled:cursor-not-allowed transition-colors"
        >
          ← Back
        </button>
        <button
          type="button"
          onClick={launch}
          disabled={launching}
          className="flex-1 px-8 py-4 bg-winston-600 text-white rounded-lg font-bold text-lg hover:bg-winston-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
        >
          {launching ? 'Launching...' : `🚀 Launch ${data.agentName}`}
        </button>
      </div>
    </div>
  )
}
