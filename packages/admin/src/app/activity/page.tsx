'use client';

import { useState, useEffect } from 'react';
import { getSessionTranscripts, getCreditUsage } from '@/lib/api';
import { SessionTranscript, CreditUsageRecord } from '@/types';
import { MessageSquare, DollarSign, TrendingUp, Calendar } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import clsx from 'clsx';

export default function ActivityPage() {
  const [transcripts, setTranscripts] = useState<SessionTranscript[]>([]);
  const [creditUsage, setCreditUsage] = useState<CreditUsageRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedTranscript, setSelectedTranscript] = useState<SessionTranscript | null>(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      const [transcriptsData, creditData] = await Promise.all([
        getSessionTranscripts(),
        getCreditUsage(),
      ]);
      setTranscripts(transcriptsData);
      setCreditUsage(creditData);
    } catch (err) {
      console.error('Failed to load activity data:', err);
    } finally {
      setLoading(false);
    }
  };

  // Aggregate credit usage by day
  const creditChartData = creditUsage.reduce((acc, record) => {
    const date = new Date(record.created_at).toLocaleDateString();
    const existing = acc.find(item => item.date === date);
    if (existing) {
      existing.credits += record.credits_used;
    } else {
      acc.push({ date, credits: record.credits_used });
    }
    return acc;
  }, [] as { date: string; credits: number }[]);

  const totalCreditsUsed = creditUsage.reduce((sum, r) => sum + r.credits_used, 0);
  const totalSessions = transcripts.length;
  const avgCreditsPerSession = totalSessions > 0 ? totalCreditsUsed / totalSessions : 0;

  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
          Activity & Usage
        </h1>
        <p className="text-gray-600 dark:text-gray-400">
          Session transcripts and credit usage analytics
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <StatCard
          title="Total Sessions"
          value={totalSessions.toLocaleString()}
          icon={<MessageSquare className="w-5 h-5" />}
          color="blue"
        />
        <StatCard
          title="Credits Used"
          value={totalCreditsUsed.toLocaleString()}
          icon={<DollarSign className="w-5 h-5" />}
          color="green"
        />
        <StatCard
          title="Avg Per Session"
          value={Math.round(avgCreditsPerSession).toLocaleString()}
          icon={<TrendingUp className="w-5 h-5" />}
          color="purple"
        />
      </div>

      {/* Credit Usage Chart */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 mb-8">
        <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
          <Calendar className="w-5 h-5" />
          Credit Usage Trend
        </h2>
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={creditChartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
              <XAxis dataKey="date" stroke="#9CA3AF" />
              <YAxis stroke="#9CA3AF" />
              <Tooltip
                contentStyle={{
                  backgroundColor: '#1F2937',
                  border: 'none',
                  borderRadius: '8px',
                  color: '#fff',
                }}
              />
              <Legend />
              <Line
                type="monotone"
                dataKey="credits"
                stroke="#0ea5e9"
                strokeWidth={2}
                dot={{ fill: '#0ea5e9' }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Session Transcripts */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow">
        <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
            Recent Sessions
          </h2>
        </div>

        {loading ? (
          <div className="p-8 text-center text-gray-500">Loading...</div>
        ) : transcripts.length === 0 ? (
          <div className="p-8 text-center text-gray-500">No session transcripts found</div>
        ) : (
          <div className="divide-y divide-gray-200 dark:divide-gray-700">
            {transcripts.slice(0, 20).map((transcript) => (
              <button
                key={transcript.id}
                onClick={() => setSelectedTranscript(transcript)}
                className="w-full px-6 py-4 text-left hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
              >
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-1">
                      <span className="font-medium text-gray-900 dark:text-white">
                        {transcript.tenant_name}
                      </span>
                      <span className="text-sm text-gray-500 dark:text-gray-400">
                        {transcript.channel}
                      </span>
                    </div>
                    <div className="text-sm text-gray-600 dark:text-gray-400">
                      {transcript.message_count} messages • {transcript.credits_used} credits
                    </div>
                  </div>
                  <div className="text-sm text-gray-500 dark:text-gray-400">
                    {formatDistanceToNow(new Date(transcript.created_at), { addSuffix: true })}
                  </div>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Transcript Modal */}
      {selectedTranscript && (
        <TranscriptModal
          transcript={selectedTranscript}
          onClose={() => setSelectedTranscript(null)}
        />
      )}
    </div>
  );
}

function StatCard({ title, value, icon, color }: {
  title: string;
  value: string;
  icon: React.ReactNode;
  color: 'blue' | 'green' | 'purple';
}) {
  const colorClasses = {
    blue: 'bg-blue-500',
    green: 'bg-green-500',
    purple: 'bg-purple-500',
  };

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">{title}</p>
          <p className="text-3xl font-bold text-gray-900 dark:text-white">{value}</p>
        </div>
        <div className={clsx('p-3 rounded-lg text-white', colorClasses[color])}>
          {icon}
        </div>
      </div>
    </div>
  );
}

function TranscriptModal({ transcript, onClose }: {
  transcript: SessionTranscript;
  onClose: () => void;
}) {
  const messages = JSON.parse(transcript.messages_json);

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-4xl max-h-[80vh] flex flex-col">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-gray-700">
          <div>
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
              Session Transcript
            </h2>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
              {transcript.tenant_name} • {transcript.channel} • {transcript.credits_used} credits used
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
          >
            ✕
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          {messages.map((msg: any, i: number) => (
            <div key={i} className={clsx(
              'p-4 rounded-lg',
              msg.role === 'user'
                ? 'bg-blue-50 dark:bg-blue-900/20'
                : 'bg-gray-50 dark:bg-gray-700'
            )}>
              <div className="text-xs font-semibold text-gray-500 dark:text-gray-400 mb-2 uppercase">
                {msg.role}
              </div>
              <div className="text-gray-900 dark:text-white whitespace-pre-wrap">
                {msg.content}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
