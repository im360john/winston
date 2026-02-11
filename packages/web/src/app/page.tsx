import Link from 'next/link'

export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-24">
      <div className="max-w-4xl text-center">
        <h1 className="text-6xl font-bold mb-6 bg-gradient-to-r from-winston-600 to-winston-400 bg-clip-text text-transparent">
          Winston
        </h1>
        <p className="text-2xl mb-4 text-gray-700">
          AI Agents for Your Business
        </p>
        <p className="text-lg mb-8 text-gray-600">
          Deploy personalized AI agents accessible via Telegram, Slack, WhatsApp, and web chat in under 10 minutes.
        </p>

        <div className="flex gap-4 justify-center mb-12">
          <Link
            href="/onboarding"
            className="px-8 py-3 bg-winston-600 text-white rounded-lg font-semibold hover:bg-winston-700 transition-colors"
          >
            Get Started Free
          </Link>
          <Link
            href="/login"
            className="px-8 py-3 border-2 border-winston-600 text-winston-600 rounded-lg font-semibold hover:bg-winston-50 transition-colors"
          >
            Sign In
          </Link>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-16">
          <div className="p-6 border border-gray-200 rounded-lg">
            <h3 className="text-xl font-semibold mb-2">🚀 Quick Setup</h3>
            <p className="text-gray-600">
              Launch your AI agent in under 10 minutes with our guided onboarding flow.
            </p>
          </div>
          <div className="p-6 border border-gray-200 rounded-lg">
            <h3 className="text-xl font-semibold mb-2">💬 Multiple Channels</h3>
            <p className="text-gray-600">
              Connect Telegram, Slack, WhatsApp, and web chat to reach your customers everywhere.
            </p>
          </div>
          <div className="p-6 border border-gray-200 rounded-lg">
            <h3 className="text-xl font-semibold mb-2">🎯 Customizable</h3>
            <p className="text-gray-600">
              Personalize your agent's personality, capabilities, and connect to your business tools.
            </p>
          </div>
        </div>

        <div className="mt-16 p-8 bg-winston-50 rounded-lg">
          <h2 className="text-3xl font-bold mb-4">Pricing</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="p-6 bg-white rounded-lg shadow">
              <h3 className="text-2xl font-bold mb-2">Free</h3>
              <p className="text-4xl font-bold mb-4">$0<span className="text-lg font-normal text-gray-600">/month</span></p>
              <ul className="text-left space-y-2 mb-6">
                <li>✓ 50,000 credits</li>
                <li>✓ ~150-300 conversations</li>
                <li>✓ All channels</li>
                <li>✓ Basic connectors</li>
              </ul>
              <Link href="/onboarding" className="block w-full text-center px-4 py-2 border-2 border-winston-600 text-winston-600 rounded-lg font-semibold hover:bg-winston-50 transition-colors">
                Start Free
              </Link>
            </div>

            <div className="p-6 bg-white rounded-lg shadow border-2 border-winston-600">
              <div className="text-xs font-bold text-winston-600 mb-2">MOST POPULAR</div>
              <h3 className="text-2xl font-bold mb-2">Starter</h3>
              <p className="text-4xl font-bold mb-4">$29<span className="text-lg font-normal text-gray-600">/month</span></p>
              <ul className="text-left space-y-2 mb-6">
                <li>✓ 500,000 credits</li>
                <li>✓ ~1,500-3,000 conversations</li>
                <li>✓ All channels</li>
                <li>✓ All connectors</li>
              </ul>
              <Link href="/onboarding" className="block w-full text-center px-4 py-2 bg-winston-600 text-white rounded-lg font-semibold hover:bg-winston-700 transition-colors">
                Start Trial
              </Link>
            </div>

            <div className="p-6 bg-white rounded-lg shadow">
              <h3 className="text-2xl font-bold mb-2">Growth</h3>
              <p className="text-4xl font-bold mb-4">$99<span className="text-lg font-normal text-gray-600">/month</span></p>
              <ul className="text-left space-y-2 mb-6">
                <li>✓ 2,000,000 credits</li>
                <li>✓ ~6,000-12,000 conversations</li>
                <li>✓ All channels</li>
                <li>✓ All connectors</li>
                <li>✓ Priority support</li>
              </ul>
              <Link href="/onboarding" className="block w-full text-center px-4 py-2 border-2 border-winston-600 text-winston-600 rounded-lg font-semibold hover:bg-winston-50 transition-colors">
                Start Trial
              </Link>
            </div>
          </div>
        </div>
      </div>
    </main>
  )
}
