import { supabase } from '@/lib/supabase';
import { Globe, Plus, Link2, CheckCircle2, XCircle } from 'lucide-react';

export const revalidate = 60;

async function getSources() {
  try {
    const { data } = await supabase
      .from('sources')
      .select('*')
      .order('name');
    return data || [];
  } catch (error) {
    console.error('Failed to fetch sources:', error);
    return [];
  }
}

export default async function SourcesPage() {
  const sources = await getSources();

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">News Sources</h1>
          <p className="text-slate-400 mt-1">Manage target websites for the scraping engine.</p>
        </div>
        
        <button className="flex items-center space-x-2 bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 rounded-lg transition-colors shadow-lg shadow-blue-500/20">
          <Plus size={16} />
          <span>Add Source</span>
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {sources.length === 0 ? (
          <div className="col-span-full text-center py-12 glass-panel border-dashed">
            <Globe className="mx-auto text-slate-500 mb-3" size={40} />
            <p className="text-slate-400">No scraping sources configured yet.</p>
          </div>
        ) : (
          sources.map((source) => (
            <SourceCard key={source.id} source={source} />
          ))
        )}
      </div>
    </div>
  );
}

function SourceCard({ source }) {
  const isActive = source.is_active !== false; // Assuming default true

  return (
    <div className="glass-panel p-6 border border-slate-700/50 hover:border-slate-600 transition-colors group relative overflow-hidden">
      {/* Decorative gradient blob */}
      <div className="absolute -top-10 -right-10 w-24 h-24 bg-blue-500/10 rounded-full blur-2xl group-hover:bg-blue-500/20 transition-colors"></div>
      
      <div className="flex justify-between items-start mb-4 relative z-10">
        <h3 className="text-lg font-semibold text-white group-hover:text-blue-400 transition-colors">
          {source.name}
        </h3>
        <div title={isActive ? 'Active' : 'Inactive'}>
          {isActive ? (
            <CheckCircle2 className="text-green-500" size={20} />
          ) : (
            <XCircle className="text-slate-600" size={20} />
          )}
        </div>
      </div>
      
      <div className="space-y-3 relative z-10">
        <div className="flex items-center text-sm text-slate-400">
          <Link2 size={14} className="mr-2 text-slate-500" />
          <a href={source.url} target="_blank" rel="noreferrer" className="hover:text-blue-400 truncate">
            {source.url}
          </a>
        </div>
        
        <div className="flex items-center text-sm text-slate-400">
          <span className="bg-slate-800 px-2.5 py-1 rounded-md text-xs border border-slate-700 mt-2">
            Selector: <span className="text-blue-300 ml-1 font-mono">{source.article_selector || 'auto'}</span>
          </span>
        </div>
      </div>
    </div>
  );
}
