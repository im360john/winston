'use client';

import { useState } from 'react';
import Editor from '@monaco-editor/react';
import { Save, X, RotateCcw } from 'lucide-react';
import clsx from 'clsx';

interface FileEditorProps {
  path: string;
  content: string;
  onSave: (content: string) => Promise<void>;
  onClose: () => void;
}

export function FileEditor({ path, content: initialContent, onSave, onClose }: FileEditorProps) {
  const [content, setContent] = useState(initialContent);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isDirty, setIsDirty] = useState(false);

  const handleSave = async () => {
    try {
      setSaving(true);
      setError(null);
      await onSave(content);
      setIsDirty(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save file');
    } finally {
      setSaving(false);
    }
  };

  const handleChange = (value: string | undefined) => {
    if (value !== undefined) {
      setContent(value);
      setIsDirty(value !== initialContent);
    }
  };

  const handleReset = () => {
    setContent(initialContent);
    setIsDirty(false);
  };

  // Determine language from file extension
  const language = path.endsWith('.json') ? 'json' :
                   path.endsWith('.md') ? 'markdown' :
                   path.endsWith('.js') ? 'javascript' :
                   path.endsWith('.ts') ? 'typescript' :
                   'text';

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-6xl h-[80vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-gray-700">
          <div>
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
              {path}
            </h2>
            {isDirty && (
              <p className="text-sm text-yellow-600 mt-1">Unsaved changes</p>
            )}
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleReset}
              disabled={!isDirty || saving}
              className={clsx(
                'px-4 py-2 rounded-lg font-medium transition-colors flex items-center gap-2',
                isDirty && !saving
                  ? 'bg-gray-200 hover:bg-gray-300 text-gray-900 dark:bg-gray-700 dark:hover:bg-gray-600 dark:text-white'
                  : 'bg-gray-100 text-gray-400 cursor-not-allowed'
              )}
            >
              <RotateCcw className="w-4 h-4" />
              Reset
            </button>
            <button
              onClick={handleSave}
              disabled={!isDirty || saving}
              className={clsx(
                'px-4 py-2 rounded-lg font-medium transition-colors flex items-center gap-2',
                isDirty && !saving
                  ? 'bg-primary-600 hover:bg-primary-700 text-white'
                  : 'bg-gray-100 text-gray-400 cursor-not-allowed'
              )}
            >
              <Save className="w-4 h-4" />
              {saving ? 'Saving...' : 'Save'}
            </button>
            <button
              onClick={onClose}
              className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-600 dark:text-gray-400"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Error Message */}
        {error && (
          <div className="mx-6 mt-4 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
            <p className="text-sm text-red-800 dark:text-red-200">{error}</p>
          </div>
        )}

        {/* Editor */}
        <div className="flex-1 overflow-hidden">
          <Editor
            height="100%"
            language={language}
            value={content}
            onChange={handleChange}
            theme="vs-dark"
            options={{
              minimap: { enabled: true },
              fontSize: 14,
              wordWrap: 'on',
              automaticLayout: true,
              scrollBeyondLastLine: false,
              padding: { top: 16, bottom: 16 },
            }}
          />
        </div>
      </div>
    </div>
  );
}
