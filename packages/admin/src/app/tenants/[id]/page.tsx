'use client';

import { useEffect, useState } from 'react';
import { useParams, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import {
  getTenant,
  getSidecarClient,
  getSetupClient,
  SidecarClient,
  SetupClient,
} from '@/lib/api';
import { Tenant, FileEntry, FileContent, HealthStatus } from '@/types';
import { FileEditor } from '@/components/FileEditor';
import {
  ChevronLeft,
  Folder,
  File,
  RefreshCw,
  Server,
  Activity,
  AlertCircle,
  CheckCircle,
  Edit,
} from 'lucide-react';
import clsx from 'clsx';

export default function TenantDetailPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const tenantId = params.id as string;
  const initialFile = searchParams.get('file');

  const [tenant, setTenant] = useState<Tenant | null>(null);
  const [sidecarClient, setSidecarClient] = useState<SidecarClient | null>(null);
  const [setupClient, setSetupClient] = useState<SetupClient | null>(null);
  const [health, setHealth] = useState<HealthStatus | null>(null);
  const [files, setFiles] = useState<FileEntry[]>([]);
  const [currentPath, setCurrentPath] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editingFile, setEditingFile] = useState<{ path: string; content: string } | null>(null);

  useEffect(() => {
    loadTenant();
  }, [tenantId]);

  useEffect(() => {
    if (sidecarClient) {
      loadFiles(currentPath);
      loadHealth();
    }
  }, [sidecarClient, currentPath]);

  useEffect(() => {
    if (!sidecarClient) return;
    if (!initialFile) return;
    // Open a specific file directly (useful from list views).
    // Example: /tenants/:id?file=openclaw.json
    (async () => {
      try {
        const fileContent = await sidecarClient.readFile(initialFile);
        setEditingFile({ path: initialFile, content: fileContent.content });
      } catch (err) {
        console.error('Failed to open initial file:', err);
      }
    })();
    // Only run when sidecarClient is first available; initialFile is stable for the page load.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sidecarClient]);

  const loadTenant = async () => {
    try {
      setLoading(true);
      setError(null);
      const tenantData = await getTenant(tenantId);
      setTenant(tenantData);

      const sidecar = await getSidecarClient(tenantId);
      setSidecarClient(sidecar);

      const setup = await getSetupClient(tenantId);
      setSetupClient(setup);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load tenant');
    } finally {
      setLoading(false);
    }
  };

  const loadFiles = async (path: string) => {
    if (!sidecarClient) return;

    try {
      const fileList = await sidecarClient.listFiles(path);
      setFiles(fileList);
    } catch (err) {
      console.error('Failed to load files:', err);
    }
  };

  const loadHealth = async () => {
    if (!sidecarClient) return;

    try {
      const healthData = await sidecarClient.health();
      setHealth(healthData);
    } catch (err) {
      console.error('Failed to load health:', err);
    }
  };

  const coreFiles = ['openclaw.json', 'SOUL.md', 'AGENTS.md', 'USER.md', 'IDENTITY.md'] as const;

  const openCoreFile = async (path: string) => {
    if (!sidecarClient) return;
    try {
      const fileContent = await sidecarClient.readFile(path);
      setEditingFile({ path, content: fileContent.content });
    } catch (err: any) {
      // If missing, allow creating it.
      const msg = err?.message || 'Failed to read file';
      const shouldCreate = window.confirm(`${msg}\n\nCreate ${path}?`);
      if (!shouldCreate) return;
      setEditingFile({ path, content: '' });
    }
  };

  const handleFileClick = async (file: FileEntry) => {
    if (file.type === 'directory') {
      const newPath = currentPath ? `${currentPath}/${file.name}` : file.name;
      setCurrentPath(newPath);
    } else {
      try {
        const filePath = currentPath ? `${currentPath}/${file.name}` : file.name;
        const fileContent = await sidecarClient!.readFile(filePath);
        setEditingFile({ path: filePath, content: fileContent.content });
      } catch (err) {
        alert(err instanceof Error ? err.message : 'Failed to read file');
      }
    }
  };

  const handleSaveFile = async (content: string) => {
    if (!editingFile || !sidecarClient) return;

    await sidecarClient.writeFile(editingFile.path, content);
    setEditingFile(null);
    loadFiles(currentPath);
  };

  const handleRestartGateway = async () => {
    if (!setupClient) return;

    try {
      await setupClient.restartGateway();
      alert('Gateway restarted successfully');
      setTimeout(loadHealth, 2000);
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to restart gateway');
    }
  };

  const goUp = () => {
    const parts = currentPath.split('/');
    parts.pop();
    setCurrentPath(parts.join('/'));
  };

  if (loading) {
    return (
      <div className="p-8">
        <div className="text-center text-gray-500">Loading tenant...</div>
      </div>
    );
  }

  if (error || !tenant) {
    return (
      <div className="p-8">
        <div className="text-center text-red-600">
          <AlertCircle className="w-8 h-8 mx-auto mb-2" />
          {error || 'Tenant not found'}
        </div>
      </div>
    );
  }

  return (
    <div className="p-8">
      {/* Header */}
      <div className="mb-6">
        <Link
          href="/"
          className="inline-flex items-center text-sm text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white mb-4"
        >
          <ChevronLeft className="w-4 h-4 mr-1" />
          Back to Dashboard
        </Link>

        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
              {tenant.name}
            </h1>
            <p className="text-gray-600 dark:text-gray-400 mt-1">
              {tenant.email} • {tenant.tier}
            </p>
          </div>

          <button
            onClick={loadHealth}
            className="px-4 py-2 bg-gray-200 hover:bg-gray-300 dark:bg-gray-700 dark:hover:bg-gray-600 rounded-lg font-medium transition-colors flex items-center gap-2"
          >
            <RefreshCw className="w-4 h-4" />
            Refresh
          </button>
        </div>
      </div>

      {/* Health Status */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-medium text-gray-600 dark:text-gray-400">
              Status
            </h3>
            {health?.ok ? (
              <CheckCircle className="w-5 h-5 text-green-500" />
            ) : (
              <AlertCircle className="w-5 h-5 text-red-500" />
            )}
          </div>
          <p className="text-2xl font-bold text-gray-900 dark:text-white">
            {health?.ok ? 'Healthy' : 'Unhealthy'}
          </p>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-medium text-gray-600 dark:text-gray-400">
              Uptime
            </h3>
            <Activity className="w-5 h-5 text-blue-500" />
          </div>
          <p className="text-2xl font-bold text-gray-900 dark:text-white">
            {health ? Math.floor(health.uptime / 60) : '—'} min
          </p>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-medium text-gray-600 dark:text-gray-400">
              Gateway
            </h3>
            <Server className="w-5 h-5 text-purple-500" />
          </div>
          <button
            onClick={handleRestartGateway}
            className="text-sm text-primary-600 hover:text-primary-700 font-medium"
          >
            Restart Gateway →
          </button>
        </div>
      </div>

      {/* Core Files */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow mb-8">
        <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
            Core Files
          </h2>
          <div className="text-sm text-gray-500 dark:text-gray-400">
            Open and edit the key MD/JSON files for this tenant.
          </div>
        </div>
        <div className="p-6 flex flex-wrap gap-3">
          {coreFiles.map((f) => (
            <button
              key={f}
              onClick={() => openCoreFile(f)}
              className="px-4 py-2 rounded-lg bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600 text-sm font-medium text-gray-900 dark:text-white"
            >
              {f}
            </button>
          ))}
        </div>
      </div>

      {/* File Browser */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow">
        <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
              Files
            </h2>
            <div className="text-sm text-gray-500 dark:text-gray-400">
              {health?.state_dir}
            </div>
          </div>

          {/* Breadcrumbs */}
          {currentPath && (
            <div className="mt-2 flex items-center gap-2 text-sm">
              <button
                onClick={() => setCurrentPath('')}
                className="text-primary-600 hover:text-primary-700"
              >
                ~
              </button>
              {currentPath.split('/').map((part, i, arr) => (
                <div key={i} className="flex items-center gap-2">
                  <span className="text-gray-400">/</span>
                  <button
                    onClick={() => setCurrentPath(arr.slice(0, i + 1).join('/'))}
                    className="text-primary-600 hover:text-primary-700"
                  >
                    {part}
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="divide-y divide-gray-200 dark:divide-gray-700">
          {currentPath && (
            <button
              onClick={goUp}
              className="w-full px-6 py-3 flex items-center gap-3 hover:bg-gray-50 dark:hover:bg-gray-700 text-left"
            >
              <Folder className="w-5 h-5 text-gray-400" />
              <span className="text-gray-600 dark:text-gray-400">.. (go up)</span>
            </button>
          )}

          {files.length === 0 ? (
            <div className="px-6 py-8 text-center text-gray-500">
              No files found
            </div>
          ) : (
            files.map((file) => (
              <button
                key={file.name}
                onClick={() => handleFileClick(file)}
                className="w-full px-6 py-3 flex items-center justify-between hover:bg-gray-50 dark:hover:bg-gray-700 text-left group"
              >
                <div className="flex items-center gap-3">
                  {file.type === 'directory' ? (
                    <Folder className="w-5 h-5 text-blue-500" />
                  ) : (
                    <File className="w-5 h-5 text-gray-400" />
                  )}
                  <div>
                    <div className="font-medium text-gray-900 dark:text-white">
                      {file.name}
                    </div>
                    <div className="text-sm text-gray-500 dark:text-gray-400">
                      {file.type === 'file' && `${(file.size / 1024).toFixed(2)} KB`}
                    </div>
                  </div>
                </div>

                {file.type === 'file' && (
                  <Edit className="w-4 h-4 text-gray-400 group-hover:text-primary-600 opacity-0 group-hover:opacity-100 transition-opacity" />
                )}
              </button>
            ))
          )}
        </div>
      </div>

      {/* File Editor Modal */}
      {editingFile && (
        <FileEditor
          path={editingFile.path}
          content={editingFile.content}
          onSave={handleSaveFile}
          onClose={() => setEditingFile(null)}
        />
      )}
    </div>
  );
}
