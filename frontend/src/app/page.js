import { supabase } from '@/lib/supabase';
import { ActionButtons } from './ActionButtons';
import { Activity, AlertCircle, FileText, CheckCircle2 } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

export const revalidate = 60; // Revalidate every 60 seconds

async function getStats() {
  try {
    // Status counts
    const { data: statusCounts } = await supabase
      .from('articles')
      .select('status', { count: 'exact' });

    const counts = {
      pending: 0,
      rewritten: 0,
      published: 0,
      failed: 0
    };

    for (const row of statusCounts || []) {
      counts[row.status] = (counts[row.status] || 0) + 1;
    }

    // Fetch schedules paused state from wp_sync_state
    const { data: syncState } = await supabase
      .from('wp_sync_state')
      .select('sync_config')
      .eq('id', '00000000-0000-0000-0000-000000000000')
      .single();

    const schedulesPaused = syncState?.sync_config?.schedules_paused ?? false;

    // Recent logs
    const { data: logs } = await supabase
      .from('job_logs')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(5);

    return { counts, logs: logs || [], schedulesPaused };
  } catch (error) {
    console.error('Failed to fetch stats:', error);
    return { counts: { pending: 0, rewritten: 0, published: 0, failed: 0 }, logs: [], schedulesPaused: false };
  }
}

export default async function DashboardPage() {
  const { counts, logs, schedulesPaused } = await getStats();
  const total = Object.values(counts).reduce((a, b) => a + b, 0);

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="flex flex-col justify-between">
        <div className='mb-4'>
          <h1 className="text-3xl font-bold tracking-tight">Overview</h1>
          <p className="text-slate-400 mt-1">Real-time automation metrics and system controls.</p>
        </div>
        
        {/* Controls */}
        <ActionButtons schedulesPaused={schedulesPaused} />
      </div>

      {/* Metrics Grid */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
        <MetricCard 
          title="Total Articles" 
          value={total} 
          icon={<FileText className="text-blue-400" size={24} />} 
          trend="+12% from yesterday"
        />
        <MetricCard 
          title="Pending / Rewritten" 
          value={`${counts.pending} / ${counts.rewritten}`} 
          icon={<Activity className="text-yellow-400" size={24} />} 
        />
        <MetricCard 
          title="Published" 
          value={counts.published} 
          icon={<CheckCircle2 className="text-green-400" size={24} />} 
        />
        <MetricCard 
          title="Failed Jobs" 
          value={counts.failed} 
          icon={<AlertCircle className="text-red-400" size={24} />} 
        />
      </div>

      {/* Recent Activity */}
      <div className="glass-panel p-6">
        <h2 className="text-xl font-semibold mb-6 flex items-center">
          <Activity className="mr-2 text-blue-400" size={20} />
          Recent Job Activity
        </h2>
        
        <div className="space-y-4">
          {logs.length === 0 ? (
            <p className="text-slate-400 text-center py-4">No recent activity found.</p>
          ) : (
            logs.map((log) => (
              <div key={log.id} className="flex items-start p-4 rounded-lg bg-slate-800/50 border border-slate-700/50">
                <div className={`mt-1 p-1.5 rounded-full mr-4 ${log.level === 'error' ? 'bg-red-500/20 text-red-400' : 'bg-blue-500/20 text-blue-400'}`}>
                  {log.level === 'error' ? <AlertCircle size={14} /> : <Activity size={14} />}
                </div>
                <div className="flex-1">
                  <div className="flex justify-between">
                    <h4 className="font-medium text-slate-200">{log.job_id || 'System Job'}</h4>
                    <span className="text-xs text-slate-400">
                      {log.created_at ? formatDistanceToNow(new Date(log.created_at), { addSuffix: true }) : 'Just now'}
                    </span>
                  </div>
                  <p className="text-sm text-slate-400 mt-1">{log.message}</p>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

function MetricCard({ title, value, icon, trend }) {
  return (
    <div className="glass-panel p-6 hover:border-slate-600 transition-colors group">
      <div className="flex justify-between items-start">
        <div>
          <p className="text-sm font-medium text-slate-400">{title}</p>
          <h3 className="text-3xl font-bold mt-2 text-white group-hover:text-blue-400 transition-colors">{value}</h3>
          {trend && <p className="text-xs text-green-400 mt-2">{trend}</p>}
        </div>
        <div className="p-3 bg-slate-800/80 rounded-xl border border-slate-700/50">
          {icon}
        </div>
      </div>
    </div>
  );
}
