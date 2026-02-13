'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { getTenants } from '@/lib/api';
import { Tenant } from '@/types';
import { AlertCircle } from 'lucide-react';
import clsx from 'clsx';

type LiveStatus = {
  sidecarOk?: boolean;
  openclawVersion?: string;
  configured?: boolean;
};

export default function TenantsPage() {
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [live, setLive] = useState<Record<string, LiveStatus>>({});

  useEffect(() => {
    loadTenants();
  }, []);

  useEffect(() => {
    if (tenants.length === 0) return;
    let cancelled = false;

    (async () => {
      const next: Record<string, LiveStatus> = {};
      await Promise.allSettled(
        tenants.map(async (t) => {
          try {
            const [sidecarRes, setupRes] = await Promise.allSettled([
              fetch(`/api/tenants/${t.id}/sidecar/health`, { cache: 'no-store' }),
              fetch(`/api/tenants/${t.id}/setup/status`, { cache: 'no-store' }),
            ]);

            if (sidecarRes.status === 'fulfilled') {
              next[t.id] = next[t.id] || {};
              next[t.id].sidecarOk = sidecarRes.value.ok ? true : false;
            }

            if (setupRes.status === 'fulfilled' && setupRes.value.ok) {
              const st = await setupRes.value.json().catch(() => null);
              if (st) {
                next[t.id] = next[t.id] || {};
                next[t.id].openclawVersion = st.openclawVersion;
                next[t.id].configured = st.configured;
              }
            }
          } catch {
            // ignore per-tenant
          }
        })
      );
      if (!cancelled) setLive(next);
    })();

    return () => {
      cancelled = true;
    };
  }, [tenants]);

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

  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
          All Tenants
        </h1>
        <p className="text-gray-600 dark:text-gray-400">
          Manage all tenant instances
        </p>
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-lg shadow">
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
                    Sidecar
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                    Gateway
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
                    <td className="px-6 py-4 whitespace-nowrap text-sm">
                      <SidecarBadge ok={live[tenant.id]?.sidecarOk} />
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                      {live[tenant.id]?.openclawVersion || '—'}
                      {typeof live[tenant.id]?.configured === 'boolean' && (
                        <span className="ml-2 text-xs text-gray-400">
                          {live[tenant.id]?.configured ? '(configured)' : '(not configured)'}
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                      {new Date(tenant.created_at).toLocaleDateString()}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm">
                      <div className="flex items-center gap-3">
                        <Link
                          href={`/tenants/${tenant.id}`}
                          className="text-primary-600 hover:text-primary-900 dark:text-primary-400"
                        >
                          Manage →
                        </Link>
                        <Link
                          href={`/tenants/${tenant.id}?file=openclaw.json`}
                          className="text-gray-600 hover:text-gray-900 dark:text-gray-300"
                        >
                          openclaw.json
                        </Link>
                        <Link
                          href={`/tenants/${tenant.id}?file=SOUL.md`}
                          className="text-gray-600 hover:text-gray-900 dark:text-gray-300"
                        >
                          SOUL.md
                        </Link>
                        <button
                          onClick={async () => {
                            const ok = window.confirm(`Restart gateway for ${tenant.name}?`);
                            if (!ok) return;
                            const res = await fetch(`/api/tenants/${tenant.id}/setup/restart`, { method: 'POST' });
                            if (!res.ok) {
                              const t = await res.text();
                              alert(`Restart failed: ${res.status} ${t}`);
                              return;
                            }
                            alert('Gateway restart requested.');
                          }}
                          className="text-red-600 hover:text-red-700 font-medium"
                        >
                          Restart
                        </button>
                      </div>
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

function SidecarBadge({ ok }: { ok?: boolean }) {
  if (ok === true) {
    return <span className="px-2 py-1 text-xs font-semibold rounded-full bg-green-100 text-green-800">OK</span>;
  }
  if (ok === false) {
    return <span className="px-2 py-1 text-xs font-semibold rounded-full bg-red-100 text-red-800">Down</span>;
  }
  return <span className="px-2 py-1 text-xs font-semibold rounded-full bg-gray-100 text-gray-800">—</span>;
}
