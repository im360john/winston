'use client'

import { useState } from 'react'
import { loadStripe } from '@stripe/stripe-js'
import { Elements, CardElement, useStripe, useElements } from '@stripe/react-stripe-js'
import type { OnboardingData } from '@/app/onboarding/page'

const stripePromise = loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY || '')

const TIERS = [
  {
    id: 'free',
    name: 'Free',
    price: '$0',
    priceNum: 0,
    credits: '50,000',
    conversations: '~150-300',
    features: ['50K credits', 'All channels', 'Basic connectors'],
  },
  {
    id: 'starter',
    name: 'Starter',
    price: '$29',
    priceNum: 29,
    credits: '500,000',
    conversations: '~1,500-3,000',
    features: ['500K credits', 'All channels', 'All connectors', 'Priority support'],
    popular: true,
  },
  {
    id: 'growth',
    name: 'Growth',
    price: '$99',
    priceNum: 99,
    credits: '2,000,000',
    conversations: '~6,000-12,000',
    features: ['2M credits', 'All channels', 'All connectors', 'Priority support', 'Dedicated account manager'],
  },
]

function AccountForm({
  data,
  updateData,
  onNext,
}: {
  data: Partial<OnboardingData>
  updateData: (updates: Partial<OnboardingData>) => void
  onNext: () => void
}) {
  const stripe = useStripe()
  const elements = useElements()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const selectedTier = TIERS.find(t => t.id === data.tier) || TIERS[0]

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!data.email || !data.password) {
      setError('Please fill in all required fields')
      return
    }

    if (data.password.length < 8) {
      setError('Password must be at least 8 characters')
      return
    }

    setLoading(true)
    setError('')

    try {
      // Create payment method with Stripe (required for all tiers)
      if (!stripe || !elements) {
        throw new Error('Stripe not loaded')
      }

      const cardElement = elements.getElement(CardElement)
      if (!cardElement) {
        throw new Error('Card element not found')
      }

      const { error: stripeError, paymentMethod } = await stripe.createPaymentMethod({
        type: 'card',
        card: cardElement,
        billing_details: {
          email: data.email,
        },
      })

      if (stripeError) {
        setError(stripeError.message || 'Card validation failed')
        return
      }

      // Save payment method ID
      updateData({ paymentMethodId: paymentMethod.id })
      onNext()

    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred')
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold mb-2">Create Your AI Agent</h1>
        <p className="text-gray-600">Choose your plan and create your account</p>
      </div>

      {/* Email */}
      <div>
        <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">
          Email
        </label>
        <input
          type="email"
          id="email"
          required
          value={data.email || ''}
          onChange={(e) => updateData({ email: e.target.value })}
          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-winston-500 focus:border-transparent"
          placeholder="you@company.com"
        />
      </div>

      {/* Password */}
      <div>
        <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-1">
          Password
        </label>
        <input
          type="password"
          id="password"
          required
          minLength={8}
          value={data.password || ''}
          onChange={(e) => updateData({ password: e.target.value })}
          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-winston-500 focus:border-transparent"
          placeholder="At least 8 characters"
        />
      </div>

      {/* Tier Selection */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-3">
          Choose your plan
        </label>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {TIERS.map((tier) => (
            <div
              key={tier.id}
              onClick={() => updateData({ tier: tier.id as OnboardingData['tier'] })}
              className={`relative cursor-pointer border-2 rounded-lg p-4 transition-all ${
                data.tier === tier.id
                  ? 'border-winston-600 bg-winston-50'
                  : 'border-gray-200 hover:border-gray-300'
              }`}
            >
              {tier.popular && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-1 bg-winston-600 text-white text-xs font-bold rounded-full">
                  POPULAR
                </div>
              )}
              <div className="text-center">
                <h3 className="text-xl font-bold mb-2">{tier.name}</h3>
                <div className="text-3xl font-bold mb-2">
                  {tier.price}
                  <span className="text-sm font-normal text-gray-600">/month</span>
                </div>
                <div className="text-sm text-gray-600 mb-3">
                  {tier.credits} credits<br />
                  {tier.conversations} chats
                </div>
                <ul className="text-left text-sm space-y-1">
                  {tier.features.map((feature, idx) => (
                    <li key={idx} className="flex items-center">
                      <span className="text-winston-600 mr-2">✓</span>
                      {feature}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Card Input (required for all tiers) */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Payment Method
        </label>
        <p className="text-xs text-gray-500 mb-2">
          {selectedTier.priceNum === 0
            ? 'Card required for all plans to prevent abuse. You will not be charged on the free plan.'
            : 'Card required. You won\'t be charged until your free trial ends.'}
        </p>
        <div className="p-4 border border-gray-300 rounded-lg">
          <CardElement
            options={{
              style: {
                base: {
                  fontSize: '16px',
                  color: '#424770',
                  '::placeholder': {
                    color: '#aab7c4',
                  },
                },
                invalid: {
                  color: '#9e2146',
                },
              },
            }}
          />
        </div>
        <p className="text-xs text-gray-500 mt-2">
          Powered by Stripe
        </p>
      </div>

      {/* Error */}
      {error && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
          {error}
        </div>
      )}

      {/* Submit */}
      <button
        type="submit"
        disabled={loading}
        className="w-full px-6 py-3 bg-winston-600 text-white rounded-lg font-semibold hover:bg-winston-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
      >
        {loading ? 'Processing...' : 'Continue →'}
      </button>

      <p className="text-xs text-gray-500 text-center">
        By continuing, you agree to our Terms of Service and Privacy Policy
      </p>
    </form>
  )
}

export default function Step1Account(props: {
  data: Partial<OnboardingData>
  updateData: (updates: Partial<OnboardingData>) => void
  onNext: () => void
}) {
  return (
    <Elements stripe={stripePromise}>
      <AccountForm {...props} />
    </Elements>
  )
}
