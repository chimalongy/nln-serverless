import { supabase } from '@/lib/supabase';
import { ActionButtons } from './ActionButtons';
import { ArticlesChart } from './components/ArticlesChart';
import { Activity, AlertCircle, FileText, CheckCircle2 } from 'lucide-react';
import {
  formatDistanceToNow,
  startOfDay,
  subDays,
  startOfWeek,
  endOfWeek,
  eachDayOfInterval,
  startOfYear,
  endOfYear,
  eachMonthOfInterval,
  format,
  isSameMonth,
  addDays,
} from 'date-fns';

export const revalidate = 60; // Revalidate every 60 seconds

function getDayRange(daysAgo = 0) {
  const dayStart = startOfDay(subDays(new Date(), daysAgo));
  const dayEnd = startOfDay(subDays(new Date(), daysAgo - 1));
  return { start: dayStart.toISOString(), end: dayEnd.toISOString() };
}

async function countArticles({ status, dateField = 'created_at', daysAgo } = {}) {
  let query = supabase.from('articles').select('*', { count: 'exact', head: true });

  if (status) query = query.eq('status', status);

  if (daysAgo !== undefined) {
    const { start, end } = getDayRange(daysAgo);
    query = query.gte(dateField, start).lt(dateField, end);
  }

  const { count, error } = await query;
  if (error) throw error;
  return count || 0;
}

function computeTrendPercent(today, yesterday) {
  if (yesterday === 0) {
    if (today === 0) return { text: 'No change from yesterday', direction: 'neutral' };
    return { text: `+100% from yesterday`, direction: 'up' };
  }

  const change = ((today - yesterday) / yesterday) * 100;
  const rounded = Math.round(change);
  const sign = rounded > 0 ? '+' : '';
  const direction = rounded > 0 ? 'up' : rounded < 0 ? 'down' : 'neutral';

  return { text: `${sign}${rounded}% from yesterday`, direction };
}

function countInRange(date, rangeStart, rangeEnd) {
  return date >= rangeStart && date < rangeEnd;
}

function aggregatePeriodArticles(articles, rangeStart, rangeEnd) {
  let total = 0;
  let published = 0;
  let failed = 0;

  for (const article of articles || []) {
    const created = new Date(article.created_at);
    if (countInRange(created, rangeStart, rangeEnd)) total++;

    if (article.status === 'published' && article.published_at) {
      const publishedAt = new Date(article.published_at);
      if (countInRange(publishedAt, rangeStart, rangeEnd)) published++;
    }

    if (article.status === 'failed' && article.updated_at) {
      const failedAt = new Date(article.updated_at);
      if (countInRange(failedAt, rangeStart, rangeEnd)) failed++;
    }
  }

  return { total, published, failed };
}

async function getChartData() {
  try {
    const now = new Date();
    const yearStart = startOfYear(now);
    const yearEnd = endOfYear(now);

    const { data: articles, error } = await supabase
      .from('articles')
      .select('created_at, published_at, status, updated_at')
      .gte('created_at', yearStart.toISOString())
      .lte('created_at', yearEnd.toISOString());

    if (error) throw error;

    const weekStart = startOfWeek(now, { weekStartsOn: 1 });
    const weekEnd = endOfWeek(now, { weekStartsOn: 1 });
    const weekDays = eachDayOfInterval({ start: weekStart, end: weekEnd });

    const weekData = weekDays.map((day) => {
      const rangeStart = startOfDay(day);
      const rangeEnd = startOfDay(addDays(day, 1));
      const counts = aggregatePeriodArticles(articles, rangeStart, rangeEnd);

      return {
        label: format(day, 'EEE'),
        ...counts,
      };
    });

    const months = eachMonthOfInterval({ start: yearStart, end: yearEnd });
    const monthData = months.map((month) => {
      let total = 0;
      let published = 0;
      let failed = 0;

      for (const article of articles || []) {
        const created = new Date(article.created_at);
        if (isSameMonth(created, month)) total++;

        if (article.status === 'published' && article.published_at) {
          const publishedAt = new Date(article.published_at);
          if (isSameMonth(publishedAt, month)) published++;
        }

        if (article.status === 'failed' && article.updated_at) {
          const failedAt = new Date(article.updated_at);
          if (isSameMonth(failedAt, month)) failed++;
        }
      }

      return {
        label: format(month, 'MMM'),
        total,
        published,
        failed,
      };
    });

    return { weekData, monthData };
  } catch (error) {
    console.error('Failed to fetch chart data:', error);
    const emptyWeek = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((label) => ({
      label,
      total: 0,
      published: 0,
      failed: 0,
    }));
    const emptyMonths = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'].map(
      (label) => ({ label, total: 0, published: 0, failed: 0 })
    );
    return { weekData: emptyWeek, monthData: emptyMonths };
  }
}

async function getStats() {
  try {
    const [
      todayTotal,
      yesterdayTotal,
      publishedToday,
      publishedYesterday,
      publishedOverall,
      failedToday,
      failedYesterday,
      failedOverall,
      pendingCount,
      rewrittenCount,
    ] = await Promise.all([
      countArticles({ daysAgo: 0 }),
      countArticles({ daysAgo: 1 }),
      countArticles({ status: 'published', dateField: 'published_at', daysAgo: 0 }),
      countArticles({ status: 'published', dateField: 'published_at', daysAgo: 1 }),
      countArticles({ status: 'published' }),
      countArticles({ status: 'failed', dateField: 'updated_at', daysAgo: 0 }),
      countArticles({ status: 'failed', dateField: 'updated_at', daysAgo: 1 }),
      countArticles({ status: 'failed' }),
      countArticles({ status: 'scraped' }),
      countArticles({ status: 'rewritten' }),
    ]);

    const counts = {
      pending: pendingCount,
      rewritten: rewrittenCount,
      published: publishedOverall,
      failed: failedOverall,
    };

    const daily = {
      total: { today: todayTotal, yesterday: yesterdayTotal },
      published: { today: publishedToday, yesterday: publishedYesterday, overall: publishedOverall },
      failed: { today: failedToday, yesterday: failedYesterday, overall: failedOverall },
    };

    const totalTrend = computeTrendPercent(todayTotal, yesterdayTotal);

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

    return { counts, daily, totalTrend, logs: logs || [], schedulesPaused };
  } catch (error) {
    console.error('Failed to fetch stats:', error);
    return {
      counts: { pending: 0, rewritten: 0, published: 0, failed: 0 },
      daily: {
        total: { today: 0, yesterday: 0 },
        published: { today: 0, yesterday: 0, overall: 0 },
        failed: { today: 0, yesterday: 0, overall: 0 },
      },
      totalTrend: { text: 'No change from yesterday', direction: 'neutral' },
      logs: [],
      schedulesPaused: false,
    };
  }
}

export default async function DashboardPage() {
  const [{ counts, daily, totalTrend, logs, schedulesPaused }, chartData] = await Promise.all([
    getStats(),
    getChartData(),
  ]);

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
          title="Total Articles (Today)" 
          value={daily.total.today} 
          icon={<FileText className="text-blue-400" size={24} />} 
          trend={totalTrend.text}
          trendDirection={totalTrend.direction}
        />
        <MetricCard 
          title="Pending / Rewritten" 
          value={`${counts.pending} / ${counts.rewritten}`} 
          icon={<Activity className="text-yellow-400" size={24} />} 
        />
        <MetricCard 
          title="Published (Today)" 
          value={daily.published.today} 
          icon={<CheckCircle2 className="text-green-400" size={24} />} 
          breakdown={`Yesterday: ${daily.published.yesterday} · Overall: ${daily.published.overall}`}
        />
        <MetricCard 
          title="Failed Jobs (Today)" 
          value={daily.failed.today} 
          icon={<AlertCircle className="text-red-400" size={24} />} 
          breakdown={`Yesterday: ${daily.failed.yesterday} · Overall: ${daily.failed.overall}`}
        />
      </div>

      <ArticlesChart weekData={chartData.weekData} monthData={chartData.monthData} />

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

const trendColors = {
  up: 'text-green-400',
  down: 'text-red-400',
  neutral: 'text-slate-400',
};

function MetricCard({ title, value, icon, trend, trendDirection = 'up', breakdown }) {
  return (
    <div className="glass-panel p-6 hover:border-slate-600 transition-colors group">
      <div className="flex justify-between items-start">
        <div>
          <p className="text-sm font-medium text-slate-400">{title}</p>
          <h3 className="text-3xl font-bold mt-2 text-white group-hover:text-blue-400 transition-colors">{value}</h3>
          {trend && <p className={`text-xs mt-2 ${trendColors[trendDirection]}`}>{trend}</p>}
          {breakdown && <p className="text-xs text-slate-400 mt-2">{breakdown}</p>}
        </div>
        <div className="p-3 bg-slate-800/80 rounded-xl border border-slate-700/50">
          {icon}
        </div>
      </div>
    </div>
  );
}
