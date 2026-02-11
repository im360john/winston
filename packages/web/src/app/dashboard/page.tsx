'use client'

import { useSearchParams, useRouter } from 'next/navigation'
import { useState, Suspense, useEffect } from 'react'
import { useSession, signOut } from 'next-auth/react'

function DashboardContent() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const searchParams = useSearchParams()
  const tenantId = searchParams.get('tenant') || (session?.user as any)?.tenantId
  const [activeTab, setActiveTab] = useState<'chat' | 'history' | 'credits' | 'channels' | 'connectors' | 'settings'>('chat')

  // Redirect to login if not authenticated
  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/login')
    }
  }, [status, router])

  if (status === 'loading') {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="text-lg font-semibold text-gray-700">Loading...</div>
        </div>
      </div>
    )
  }

  if (!session) {
    return null
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-winston-600 rounded-full flex items-center justify-center text-white font-bold text-xl">
              A
            </div>
            <div>
              <h1 className="text-xl font-bold">{session.user?.name || 'Your Agent'}</h1>
              <div className="flex items-center gap-4 text-sm">
                <span className="flex items-center gap-1">
                  <span className="w-2 h-2 bg-green-500 rounded-full"></span>
                  Online
                </span>
                <span className="text-gray-600">Credits: 50,000 / 50,000</span>
                <span className="text-gray-600">Plan: Free</span>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <button
              onClick={() => signOut({ callbackUrl: '/login' })}
              className="px-4 py-2 text-sm text-gray-700 hover:text-gray-900"
            >
              Sign Out
            </button>
            <button className="p-2 text-gray-600 hover:text-gray-900">
              ⚙ Settings
            </button>
          </div>
        </div>
      </header>

      {/* Tabs */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4">
          <div className="flex gap-8">
            {(['chat', 'history', 'credits', 'channels', 'connectors', 'settings'] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`py-3 px-1 border-b-2 font-medium capitalize transition-colors ${
                  activeTab === tab
                    ? 'border-winston-600 text-winston-600'
                    : 'border-transparent text-gray-600 hover:text-gray-900'
                }`}
              >
                {tab}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-7xl mx-auto px-4 py-8">
        {activeTab === 'chat' && (
          <div className="bg-white rounded-lg shadow-lg p-8">
            <h2 className="text-2xl font-bold mb-4">Chat with Your Agent</h2>
            <div className="border border-gray-200 rounded-lg p-6 h-96 flex items-center justify-center text-gray-500">
              <div className="text-center">
                <p className="mb-4">WebChat widget will appear here</p>
                <p className="text-sm">Your agent is live at:</p>
                <code className="text-xs bg-gray-100 px-2 py-1 rounded">
                  Tenant ID: {tenantId || 'Loading...'}
                </code>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'history' && (
          <div className="bg-white rounded-lg shadow-lg p-8">
            <h2 className="text-2xl font-bold mb-4">Conversation History</h2>
            <p className="text-gray-600">Searchable conversation log with filters coming soon...</p>
          </div>
        )}

        {activeTab === 'credits' && (
          <div className="bg-white rounded-lg shadow-lg p-8">
            <h2 className="text-2xl font-bold mb-4">Credit Usage</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
              <div className="p-6 bg-winston-50 rounded-lg">
                <div className="text-sm text-gray-600 mb-1">Remaining</div>
                <div className="text-3xl font-bold text-winston-600">50,000</div>
              </div>
              <div className="p-6 bg-gray-50 rounded-lg">
                <div className="text-sm text-gray-600 mb-1">Used this month</div>
                <div className="text-3xl font-bold">0</div>
              </div>
              <div className="p-6 bg-gray-50 rounded-lg">
                <div className="text-sm text-gray-600 mb-1">Refresh date</div>
                <div className="text-xl font-semibold">30 days</div>
              </div>
            </div>
            <p className="text-gray-600">Usage graph and detailed breakdown coming soon...</p>
          </div>
        )}

        {activeTab === 'channels' && (
          <div className="bg-white rounded-lg shadow-lg p-8">
            <h2 className="text-2xl font-bold mb-4">Connected Channels</h2>
            <div className="space-y-4">
              <div className="p-4 border border-gray-200 rounded-lg flex items-center justify-between">
                <div>
                  <div className="font-semibold">Telegram</div>
                  <div className="text-sm text-gray-600">● Connected</div>
                </div>
                <button className="text-winston-600 hover:text-winston-700">Configure</button>
              </div>
              <div className="p-4 border border-gray-200 rounded-lg flex items-center justify-between">
                <div>
                  <div className="font-semibold">WebChat</div>
                  <div className="text-sm text-gray-600">● Active</div>
                </div>
                <button className="text-winston-600 hover:text-winston-700">Get Embed Code</button>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'connectors' && (
          <div className="bg-white rounded-lg shadow-lg p-8">
            <h2 className="text-2xl font-bold mb-4">Connectors</h2>
            <p className="text-gray-600 mb-4">Connect your business tools to give your agent access to real data.</p>
            <button className="px-6 py-3 bg-winston-600 text-white rounded-lg hover:bg-winston-700">
              + Add Connector
            </button>
          </div>
        )}

        {activeTab === 'settings' && (
          <div className="bg-white rounded-lg shadow-lg p-8">
            <h2 className="text-2xl font-bold mb-4">Settings</h2>
            <div className="space-y-6">
              <div>
                <h3 className="font-semibold mb-2">Agent Name</h3>
                <input
                  type="text"
                  defaultValue="Your Agent"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg"
                />
              </div>
              <div>
                <h3 className="font-semibold mb-2">AI Model</h3>
                <select className="w-full px-4 py-2 border border-gray-300 rounded-lg">
                  <option>Kimi K2.5 (1.0x credits)</option>
                  <option>Claude Sonnet 4.5 (5.0x credits)</option>
                  <option>Claude Opus 4.6 (12.0x credits)</option>
                  <option>GPT-4o (3.0x credits)</option>
                </select>
              </div>
              <div>
                <h3 className="font-semibold mb-2">Billing</h3>
                <div className="p-4 bg-gray-50 rounded-lg">
                  <div className="mb-2">Current plan: <strong>Free</strong></div>
                  <button className="px-4 py-2 bg-winston-600 text-white rounded-lg hover:bg-winston-700">
                    Upgrade Plan
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export default function DashboardPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-gray-50 flex items-center justify-center">Loading...</div>}>
      <DashboardContent />
    </Suspense>
  )
}
