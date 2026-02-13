'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { getTenants } from '@/lib/api';
import { Tenant } from '@/types';
import { Users, Server, Activity, AlertCircle } from 'lucide-react';
import clsx from 'clsx';

export default function HomePage() {
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadTenants();
  }, []);

  const loadTenants = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await getTenants();
      setTenants(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load tenants');
    } finally {
      setLoading(false);
    }
  };

  const stats = {
    total: tenants.length,
    active: tenants.filter(t => t.status === 'active').length,
    provisioning: tenants.filter(t => t.status === 'provisioning').length,
    error: tenants.filter(t => t.status === 'error').length,
  };

  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
          Winston Admin Dashboard
        </h1>
        <p className="text-gray-600 dark:text-gray-400">
          Manage tenant containers, configurations, and health monitoring
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
        <StatCard
          title="Total Tenants"
          value={stats.total}
          icon={<Users className="w-5 h-5" />}
          color="blue"
        />
        <StatCard
          title="Active"
          value={stats.active}
          icon={<Server className="w-5 h-5" />}
          color="green"
        />
        <StatCard
          title="Provisioning"
          value={stats.provisioning}
          icon={<Activity className="w-5 h-5" />}
          color="yellow"
        />
        <StatCard
          title="Errors"
          value={stats.error}
          icon={<AlertCircle className="w-5 h-5" />}
          color="red"
        />
      </div>

      {/* Tenant List */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow">
        <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
            Tenants
          </h2>
        </div>

        {loading ? (
          <div className="p-8 text-center text-gray-500">Loading tenants...</div>
        ) : error ? (
          <div className="p-8 text-center text-red-600">
            <AlertCircle className="w-8 h-8 mx-auto mb-2" />
            {error}
          </div>
        ) : tenants.length === 0 ? (
          <div className="p-8 text-center text-gray-500">No tenants found</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 dark:bg-gray-700">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                    Name
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                    Email
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                    Tier
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                    Created
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                {tenants.map((tenant) => (
                  <tr key={tenant.id} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-gray-900 dark:text-white">
                        {tenant.name}
                      </div>
                      <div className="text-sm text-gray-500 dark:text-gray-400">
                        {tenant.slug}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                      {tenant.email}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={clsx(
                        'px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full',
                        tenant.tier === 'free' && 'bg-gray-100 text-gray-800',
                        tenant.tier === 'starter' && 'bg-blue-100 text-blue-800',
                        tenant.tier === 'growth' && 'bg-purple-100 text-purple-800',
                      )}>
                        {tenant.tier}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <StatusBadge status={tenant.status} />
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                      {new Date(tenant.created_at).toLocaleDateString()}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm">
                      <Link
                        href={`/tenants/${tenant.id}`}
                        className="text-primary-600 hover:text-primary-900 dark:text-primary-400"
                      >
                        Manage →
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

function StatCard({ title, value, icon, color }: {
  title: string;
  value: number;
  icon: React.ReactNode;
  color: 'blue' | 'green' | 'yellow' | 'red';
}) {
  const colorClasses = {
    blue: 'bg-blue-500',
    green: 'bg-green-500',
    yellow: 'bg-yellow-500',
    red: 'bg-red-500',
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

function StatusBadge({ status }: { status: string }) {
  const statusConfig = {
    active: { label: 'Active', class: 'bg-green-100 text-green-800' },
    provisioning: { label: 'Provisioning', class: 'bg-yellow-100 text-yellow-800' },
    error: { label: 'Error', class: 'bg-red-100 text-red-800' },
    inactive: { label: 'Inactive', class: 'bg-gray-100 text-gray-800' },
  };

  const config = statusConfig[status as keyof typeof statusConfig] || statusConfig.inactive;

  return (
    <span className={clsx(
      'px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full',
      config.class
    )}>
      {config.label}
    </span>
  );
}
