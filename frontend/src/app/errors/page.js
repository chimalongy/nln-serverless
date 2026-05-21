import { supabase } from '@/lib/supabase';
import { AlertTriangle, AlertCircle, AlertOctagon, CheckCircle2, Clock, Server, FileText, Zap } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

export const revalidate = 30; // Revalidate every 30 seconds

async function getErrorLogs() {
  try {
    const { data: errors, error, count } = await supabase
      .from('error_logs')
      .select('*', { count: 'exact' })
      .order('created_at', { ascending: false })
      .limit(50);

    if (error) throw error;

    // Count by severity
    const { data: allErrors } = await supabase
      .from('error_logs')
      .select('severity, resolved');

    const stats = {
      total: 0,
      critical: 0,
      error: 0,
      warning: 0,
      unresolved: 0,
    };

    for (const row of allErrors || []) {
      stats.total++;
      if (row.severity === 'critical') stats.critical++;
      if (row.severity === 'error') stats.error++;
      if (row.severity === 'warning') stats.warning++;
      if (!row.resolved) stats.unresolved++;
    }

    return { errors: errors || [], stats, total: count || 0 };
  } catch (err) {
    console.error('Failed to fetch error logs:', err);
    return { errors: [], stats: { total: 0, critical: 0, error: 0, warning: 0, unresolved: 0 }, total: 0 };
  }
}

const severityConfig = {
  critical: {
    icon: AlertOctagon,
    color: 'text-red-400',
    bg: 'bg-red-500/20',
    border: 'border-red-500/30',
    badge: 'bg-red-500/20 text-red-400',
    label: 'Critical',
  },
  error: {
    icon: AlertCircle,
    color: 'text-orange-400',
    bg: 'bg-orange-500/20',
    border: 'border-orange-500/30',
    badge: 'bg-orange-500/20 text-orange-400',
    label: 'Error',
  },
  warning: {
    icon: AlertTriangle,
    color: 'text-yellow-400',
    bg: 'bg-yellow-500/20',
    border: 'border-yellow-500/30',
    badge: 'bg-yellow-500/20 text-yellow-400',
    label: 'Warning',
  },
};

const jobIcons = {
  'naijanews-action': '📰',
  'gistreel-action': '🎬',
};

export default async function ErrorsPage() {
  const { errors, stats, total } = await getErrorLogs();

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Error Logs</h1>
        <p className="text-slate-400 mt-1">Monitor and track errors across all jobs.</p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <StatCard label="Total Errors" value={stats.total} icon={<Server size={18} />} color="text-slate-300" />
        <StatCard label="Critical" value={stats.critical} icon={<AlertOctagon size={18} />} color="text-red-400" />
        <StatCard label="Errors" value={stats.error} icon={<AlertCircle size={18} />} color="text-orange-400" />
        <StatCard label="Warnings" value={stats.warning} icon={<AlertTriangle size={18} />} color="text-yellow-400" />
        <StatCard label="Unresolved" value={stats.unresolved} icon={<Clock size={18} />} color="text-blue-400" />
      </div>

      {/* Error List */}
      <div className="glass-panel p-6">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-xl font-semibold flex items-center">
            <AlertCircle className="mr-2 text-red-400" size={20} />
            Recent Errors
          </h2>
          <span className="text-sm text-slate-400">
            Showing {errors.length} of {total}
          </span>
        </div>

        <div className="space-y-3">
          {errors.length === 0 ? (
            <div className="text-center py-12">
              <CheckCircle2 className="mx-auto text-green-400 mb-3" size={40} />
              <p className="text-slate-300 font-medium">No errors found</p>
              <p className="text-slate-500 text-sm mt-1">All systems running smoothly</p>
            </div>
          ) : (
            errors.map((log) => {
              const sev = severityConfig[log.severity] || severityConfig.error;
              const SevIcon = sev.icon;
              const jobEmoji = jobIcons[log.job_name] || '⚙️';
              const context = log.context || {};

              return (
                <div
                  key={log.id}
                  className={`p-4 rounded-lg bg-slate-800/50 border ${sev.border} hover:bg-slate-800/70 transition-colors`}
                >
                  {/* Header Row */}
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex items-start gap-3 min-w-0 flex-1">
                      <div className={`mt-0.5 p-1.5 rounded-full ${sev.bg}`}>
                        <SevIcon size={14} className={sev.color} />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className={`text-xs px-2 py-0.5 rounded-full ${sev.badge} font-medium`}>
                            {sev.label}
                          </span>
                          <span className="text-xs px-2 py-0.5 rounded-full bg-slate-700/50 text-slate-300">
                            {jobEmoji} {log.job_name}
                          </span>
                          {context.phase && (
                            <span className="text-xs px-2 py-0.5 rounded-full bg-slate-700/50 text-slate-400">
                              {context.phase}
                            </span>
                          )}
                          {log.resolved && (
                            <span className="text-xs px-2 py-0.5 rounded-full bg-green-500/20 text-green-400">
                              ✓ Resolved
                            </span>
                          )}
                        </div>
                        <p className="text-sm text-slate-200 mt-2 font-mono break-all">
                          {log.error_message}
                        </p>
                      </div>
                    </div>
                    <span className="text-xs text-slate-500 whitespace-nowrap">
                      {log.created_at
                        ? formatDistanceToNow(new Date(log.created_at), { addSuffix: true })
                        : 'Just now'}
                    </span>
                  </div>

                  {/* Context Details */}
                  {Object.keys(context).length > 0 && (
                    <div className="mt-3 ml-9 flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-400">
                      {context.articleId && (
                        <span className="flex items-center gap-1">
                          <FileText size={10} /> Article: <code className="text-slate-300">{context.articleId.substring(0, 8)}...</code>
                        </span>
                      )}
                      {context.articleTitle && (
                        <span className="flex items-center gap-1">
                          <FileText size={10} /> {context.articleTitle.substring(0, 50)}{context.articleTitle.length > 50 ? '...' : ''}
                        </span>
                      )}
                      {context.sourceName && (
                        <span>Source: {context.sourceName}</span>
                      )}
                      {context.attempt && (
                        <span className="flex items-center gap-1">
                          <Zap size={10} /> Attempt #{context.attempt}
                        </span>
                      )}
                      {context.url && (
                        <span className="truncate max-w-xs">URL: {context.url}</span>
                      )}
                      {context.statusCode && (
                        <span>HTTP {context.statusCode}</span>
                      )}
                    </div>
                  )}

                  {/* Stack Trace (collapsed) */}
                  {log.error_stack && (
                    <details className="mt-3 ml-9">
                      <summary className="text-xs text-slate-500 cursor-pointer hover:text-slate-300 transition-colors">
                        Show stack trace
                      </summary>
                      <pre className="mt-2 text-xs text-slate-400 bg-slate-900/50 p-3 rounded-lg overflow-x-auto max-h-40 overflow-y-auto font-mono leading-relaxed">
                        {log.error_stack}
                      </pre>
                    </details>
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}

function StatCard({ label, value, icon, color }) {
  return (
    <div className="glass-panel p-4 hover:border-slate-600 transition-colors">
      <div className="flex items-center justify-between">
        <span className="text-xs text-slate-400">{label}</span>
        <span className={color}>{icon}</span>
      </div>
      <p className={`text-2xl font-bold mt-1 ${color}`}>{value}</p>
    </div>
  );
}
