'use client';

export default function ActivityPage() {
  return (
    <div className="p-8">
      <div className="mb-4">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
          Activity & Usage
        </h1>
        <p className="text-gray-600 dark:text-gray-400">
          Coming soon: session transcripts and credit usage analytics.
        </p>
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 text-gray-700 dark:text-gray-300">
        This panel is temporarily disabled while we align the schema and the log sync pipeline.
      </div>
    </div>
  );
}

