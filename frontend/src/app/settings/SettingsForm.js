'use client';

import { useState, useTransition } from 'react';
import { AlertTriangle, Trash2, RefreshCcw, Loader2, Archive } from 'lucide-react';
import { clearFailedArticles, archiveOldArticles, purgeAllData } from './actions';

export function SettingsForm({ statusCounts }) {
  const [isPendingClear, startClear] = useTransition();
  const [isPendingArchive, startArchive] = useTransition();
  const [isPendingPurge, startPurge] = useTransition();
  const [confirmPurge, setConfirmPurge] = useState(false);

  const handleClearFailed = () => {
    startClear(async () => {
      const res = await clearFailedArticles();
      if (res.success) {
        alert(`Cleared ${res.count} failed articles.`);
      } else {
        alert(`Error: ${res.error}`);
      }
    });
  };

  const handleArchive = () => {
    startArchive(async () => {
      const res = await archiveOldArticles();
      if (res.success) {
        alert(`Archived ${res.count} old articles.`);
      } else {
        alert(`Error: ${res.error}`);
      }
    });
  };

  const handlePurge = () => {
    if (!confirmPurge) {
      setConfirmPurge(true);
      return;
    }
    startPurge(async () => {
      const res = await purgeAllData();
      if (res.success) {
        alert('All data has been purged.');
        setConfirmPurge(false);
      } else {
        alert(`Error: ${res.error}`);
      }
    });
  };

  return (
    <div>
      <div className="flex items-center gap-3 mb-6">
        <div className="p-2.5 rounded-lg bg-red-500/20">
          <AlertTriangle size={20} className="text-red-400" />
        </div>
        <div>
          <h2 className="text-xl font-semibold text-red-400">Danger Zone</h2>
          <p className="text-sm text-slate-400">Destructive actions. Use with caution.</p>
        </div>
      </div>

      <div className="space-y-3">
        {/* Clear Failed Articles */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between p-4 bg-slate-800/50 rounded-lg border border-slate-700/50 gap-3">
          <div>
            <p className="text-sm font-medium text-slate-200">Clear Failed Articles</p>
            <p className="text-xs text-slate-500 mt-0.5">
              Remove all articles with &quot;failed&quot; status ({statusCounts.failed || 0} articles).
            </p>
          </div>
          <button
            onClick={handleClearFailed}
            disabled={isPendingClear || !(statusCounts.failed > 0)}
            className="flex items-center gap-2 px-4 py-2 text-sm bg-slate-700 hover:bg-slate-600 text-slate-200 rounded-lg transition-colors border border-slate-600 disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap"
          >
            {isPendingClear ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
            Clear Failed
          </button>
        </div>

        {/* Archive Old Articles */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between p-4 bg-slate-800/50 rounded-lg border border-slate-700/50 gap-3">
          <div>
            <p className="text-sm font-medium text-slate-200">Archive Old Articles</p>
            <p className="text-xs text-slate-500 mt-0.5">
              Archive scraped articles older than 72 hours that were never published.
            </p>
          </div>
          <button
            onClick={handleArchive}
            disabled={isPendingArchive}
            className="flex items-center gap-2 px-4 py-2 text-sm bg-slate-700 hover:bg-slate-600 text-slate-200 rounded-lg transition-colors border border-slate-600 disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap"
          >
            {isPendingArchive ? <Loader2 size={14} className="animate-spin" /> : <Archive size={14} />}
            Archive Old
          </button>
        </div>

        {/* Purge All Data */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between p-4 bg-red-950/30 rounded-lg border border-red-500/20 gap-3">
          <div>
            <p className="text-sm font-medium text-red-300">Purge All Article Data</p>
            <p className="text-xs text-red-400/70 mt-0.5">
              Permanently delete ALL articles, job logs, content hashes, and error logs. This cannot be undone.
            </p>
          </div>
          <button
            onClick={handlePurge}
            disabled={isPendingPurge}
            className={`flex items-center gap-2 px-4 py-2 text-sm rounded-lg transition-colors border disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap ${
              confirmPurge
                ? 'bg-red-600 hover:bg-red-500 text-white border-red-500'
                : 'bg-red-500/20 hover:bg-red-500/30 text-red-300 border-red-500/30'
            }`}
          >
            {isPendingPurge ? (
              <Loader2 size={14} className="animate-spin" />
            ) : (
              <RefreshCcw size={14} />
            )}
            {confirmPurge ? 'Confirm Purge' : 'Purge Everything'}
          </button>
        </div>

        {confirmPurge && (
          <div className="flex items-center justify-end gap-2">
            <button
              onClick={() => setConfirmPurge(false)}
              className="text-xs text-slate-400 hover:text-slate-200 transition-colors px-3 py-1.5"
            >
              Cancel
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
