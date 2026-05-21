import { supabase } from '@/lib/supabase';
import { Settings, Globe, Clock, Key, Database, Shield, Cpu, Zap } from 'lucide-react';
import { SettingsForm } from './SettingsForm';

export const revalidate = 60;

async function getSettingsData() {
  try {
    // Fetch API keys count (by provider)
    const { data: apiKeys } = await supabase
      .from('api_keys')
      .select('id, email, api_source, created_at')
      .order('created_at', { ascending: false });

    // Fetch article counts by status for stats
    const { data: articles } = await supabase
      .from('articles')
      .select('status');

    const statusCounts = {};
    for (const row of articles || []) {
      statusCounts[row.status] = (statusCounts[row.status] || 0) + 1;
    }

    // Fetch WP sync state
    const { data: syncState } = await supabase
      .from('wp_sync_state')
      .select('*')
      .limit(1)
      .single();

    return {
      apiKeys: apiKeys || [],
      statusCounts,
      syncState,
    };
  } catch (error) {
    console.error('Failed to fetch settings data:', error);
    return {
      apiKeys: [],
      statusCounts: {},
      syncState: null,
    };
  }
}

export default async function SettingsPage() {
  const { apiKeys, statusCounts, syncState } = await getSettingsData();

  const totalArticles = Object.values(statusCounts).reduce((a, b) => a + b, 0);

  // Group API keys by provider
  const keysByProvider = {};
  for (const key of apiKeys) {
    const provider = key.api_source || 'unknown';
    if (!keysByProvider[provider]) keysByProvider[provider] = [];
    keysByProvider[provider].push(key);
  }

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div>
        <h1 className="text-3xl font-bold tracking-tight flex items-center gap-3">
          <Settings className="text-blue-400" size={28} />
          Settings
        </h1>
        <p className="text-slate-400 mt-1">System configuration, API keys, and pipeline controls.</p>
      </div>

      {/* Quick Stats Row */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <QuickStat icon={<Key size={18} />} label="API Keys" value={apiKeys.length} color="text-amber-400" />
        <QuickStat icon={<Database size={18} />} label="Total Articles" value={totalArticles} color="text-green-400" />
        <QuickStat icon={<Zap size={18} />} label="Published" value={statusCounts.published || 0} color="text-purple-400" />
      </div>

      {/* WordPress Configuration */}
      <section className="glass-panel p-6">
        <div className="flex items-center gap-3 mb-6">
          <div className="p-2.5 rounded-lg bg-blue-500/20">
            <Globe size={20} className="text-blue-400" />
          </div>
          <div>
            <h2 className="text-xl font-semibold">WordPress Configuration</h2>
            <p className="text-sm text-slate-400">Publishing destination and sync status.</p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <ConfigItem label="WordPress URL" value={process.env.WP_BASE_URL || 'Not configured'} masked={false} />
          <ConfigItem label="WP Username" value={process.env.WP_USERNAME || 'Not configured'} masked={false} />
          <ConfigItem label="WP App Password" value={process.env.WP_APP_PASSWORD ? '••••••••••••' : 'Not configured'} masked={true} />
          <ConfigItem label="Default Author ID" value={process.env.WP_DEFAULT_AUTHOR_ID || '1'} masked={false} />
          <ConfigItem label="Default Post Status" value={process.env.WP_DEFAULT_STATUS || 'publish'} masked={false} />
          <ConfigItem
            label="Last WP Sync"
            value={syncState?.last_sync_at ? new Date(syncState.last_sync_at).toLocaleString() : 'Never'}
            masked={false}
          />
        </div>

        <p className="text-xs text-slate-500 mt-4 flex items-center gap-1.5">
          <Shield size={12} />
          WordPress credentials are stored as environment variables. Update them in your <code className="bg-slate-800 px-1.5 py-0.5 rounded text-slate-300">.env</code> file or deployment platform.
        </p>
      </section>

      {/* Scraping Configuration */}
      <section className="glass-panel p-6">
        <div className="flex items-center gap-3 mb-6">
          <div className="p-2.5 rounded-lg bg-emerald-500/20">
            <Cpu size={20} className="text-emerald-400" />
          </div>
          <div>
            <h2 className="text-xl font-semibold">Scraping Configuration</h2>
            <p className="text-sm text-slate-400">Pipeline parameters and rate limiting.</p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <ConfigItem label="Max Articles Per Scrape" value={process.env.MAX_ARTICLES_PER_SCRAPE || '20'} />
          <ConfigItem label="Scraping Concurrency" value={process.env.SCRAPING_CONCURRENCY || '3'} />
          <ConfigItem label="Request Timeout" value={`${(parseInt(process.env.REQUEST_TIMEOUT_MS || '30000') / 1000)}s`} />
          <ConfigItem label="Content Similarity Threshold" value={process.env.CONTENT_SIMILARITY_THRESHOLD || '0.85'} />
          <ConfigItem label="Max Retries" value={process.env.MAX_RETRIES || '3'} />
          <ConfigItem label="Deduplication" value={process.env.ENABLE_DEDUPLICATION === 'true' ? 'Enabled' : 'Disabled'} highlight={process.env.ENABLE_DEDUPLICATION === 'true'} />
        </div>
      </section>

      {/* Schedule Configuration */}
      <section className="glass-panel p-6">
        <div className="flex items-center gap-3 mb-6">
          <div className="p-2.5 rounded-lg bg-purple-500/20">
            <Clock size={20} className="text-purple-400" />
          </div>
          <div>
            <h2 className="text-xl font-semibold">Job Schedules</h2>
            <p className="text-sm text-slate-400">Cron expressions for pipeline stages. Configure in the Trigger.dev dashboard.</p>
          </div>
        </div>

        <div className="space-y-3">
          <ScheduleRow emoji="📰" job="naijanews-action" cron={process.env.NAIJA_NEWS_SCHEDULE || '*/15 * * * *'} description="Scrape, rewrite, and publish NaijaNews articles" />
          <ScheduleRow emoji="🎬" job="gistreel-action" cron={process.env.GISTREEL_SCHEDULE || '*/15 * * * *'} description="Scrape, rewrite, and publish GistReel articles" />
        </div>
      </section>

      {/* API Keys */}
      <section className="glass-panel p-6">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-lg bg-amber-500/20">
              <Key size={20} className="text-amber-400" />
            </div>
            <div>
              <h2 className="text-xl font-semibold">API Keys</h2>
              <p className="text-sm text-slate-400">AI provider keys stored in the database for multi-key rotation.</p>
            </div>
          </div>
        </div>

        {apiKeys.length === 0 ? (
          <div className="text-center py-8 border border-dashed border-slate-700 rounded-lg">
            <Key className="mx-auto text-slate-600 mb-3" size={32} />
            <p className="text-slate-400">No API keys configured yet.</p>
            <p className="text-slate-500 text-sm mt-1">Add keys to the <code className="bg-slate-800 px-1.5 py-0.5 rounded text-slate-300">api_keys</code> table in Supabase.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {Object.entries(keysByProvider).map(([provider, keys]) => (
              <div key={provider}>
                <h3 className="text-sm font-medium text-slate-300 mb-2 flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-amber-400" />
                  {provider}
                  <span className="text-xs text-slate-500">({keys.length} key{keys.length !== 1 ? 's' : ''})</span>
                </h3>
                <div className="space-y-2">
                  {keys.map((key) => (
                    <div key={key.id} className="flex items-center justify-between p-3 bg-slate-800/50 rounded-lg border border-slate-700/50">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-slate-700 flex items-center justify-center text-xs font-bold text-slate-300">
                          {key.email ? key.email[0].toUpperCase() : '#'}
                        </div>
                        <div>
                          <p className="text-sm text-slate-200">{key.email || 'No email'}</p>
                          <p className="text-xs text-slate-500 font-mono">
                            {key.api_key ? `${key.api_key.substring(0, 8)}${'•'.repeat(20)}` : '••••••••'}
                          </p>
                        </div>
                      </div>
                      <span className="text-xs text-slate-500">
                        {key.created_at ? new Date(key.created_at).toLocaleDateString() : '—'}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Environment Info */}
      <section className="glass-panel p-6">
        <div className="flex items-center gap-3 mb-6">
          <div className="p-2.5 rounded-lg bg-slate-500/20">
            <Shield size={20} className="text-slate-400" />
          </div>
          <div>
            <h2 className="text-xl font-semibold">Environment</h2>
            <p className="text-sm text-slate-400">Current runtime information.</p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <ConfigItem label="Node Environment" value={process.env.NODE_ENV || 'development'} highlight={process.env.NODE_ENV === 'production'} />
          <ConfigItem label="Trigger.dev Project" value={process.env.TRIGGER_PROJECT_ID || 'Not set'} />
          <ConfigItem label="Supabase URL" value={process.env.NEXT_PUBLIC_SUPABASE_URL ? new URL(process.env.NEXT_PUBLIC_SUPABASE_URL).hostname : 'Not configured'} />
          <ConfigItem label="Log Level" value={process.env.LOG_LEVEL || 'info'} />
          <ConfigItem label="Failed Article Max Age" value={`${process.env.FAILED_ARTICLE_MAX_AGE_HOURS || '72'}h`} />
          <ConfigItem label="Dedup Max Age" value={`${process.env.DEDUPLICATION_MAX_AGE_DAYS || '7'}d`} />
        </div>
      </section>

      {/* Danger Zone */}
      <section className="glass-panel p-6 border-red-500/20">
        <SettingsForm statusCounts={statusCounts} />
      </section>
    </div>
  );
}

function QuickStat({ icon, label, value, color }) {
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

function ConfigItem({ label, value, masked = false, highlight = false }) {
  return (
    <div className="p-3 bg-slate-800/50 rounded-lg border border-slate-700/50">
      <p className="text-xs text-slate-400 mb-1">{label}</p>
      <p className={`text-sm font-medium ${highlight ? 'text-green-400' : masked ? 'text-slate-500' : 'text-slate-200'}`}>
        {value}
      </p>
    </div>
  );
}

function ScheduleRow({ emoji, job, cron, description }) {
  return (
    <div className="flex items-center justify-between p-3 bg-slate-800/50 rounded-lg border border-slate-700/50 hover:border-slate-600 transition-colors">
      <div className="flex items-center gap-3">
        <span className="text-lg">{emoji}</span>
        <div>
          <p className="text-sm font-medium text-slate-200">{job}</p>
          <p className="text-xs text-slate-500">{description}</p>
        </div>
      </div>
      <code className="text-xs bg-slate-900 px-3 py-1.5 rounded-md text-purple-300 border border-slate-700 font-mono">
        {cron}
      </code>
    </div>
  );
}
