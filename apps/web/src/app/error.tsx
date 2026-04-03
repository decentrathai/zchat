'use client';

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 dark:bg-slate-950 p-4">
      <div className="w-full max-w-md rounded-lg border border-red-200 dark:border-red-800 bg-white dark:bg-slate-900 p-6 shadow-lg">
        <h2 className="text-lg font-semibold text-red-700 dark:text-red-400 mb-2">
          Something went wrong
        </h2>
        <p className="text-sm text-slate-600 dark:text-slate-400 mb-4">
          {error.message || 'An unexpected error occurred.'}
        </p>
        <button
          onClick={reset}
          className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
        >
          Try again
        </button>
      </div>
    </div>
  );
}
