import { supabase } from '@/lib/supabase';
import { formatDistanceToNow } from 'date-fns';
import { Search, Filter, ExternalLink } from 'lucide-react';

export const revalidate = 60;

async function getArticles() {
  try {
    const { data } = await supabase
      .from('articles')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(50);
    return data || [];
  } catch (error) {
    console.error('Failed to fetch articles:', error);
    return [];
  }
}

export default async function ArticlesPage() {
  const articles = await getArticles();

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex flex-col gap-2 justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Articles Pipeline</h1>
          <p className="text-slate-400 mt-1">Manage and monitor scraped content.</p>
        </div>

        <div className="flex justify-between   space-x-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
            <input
              type="text"
              placeholder="Search articles..."
              className="bg-slate-800/50 border border-slate-700 text-sm rounded-lg pl-9 pr-4 py-2 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all w-64"
            />
          </div>
          <button className="flex items-center space-x-2 bg-slate-800/50 hover:bg-slate-700 text-slate-300 px-4 py-2 rounded-lg transition-colors border border-slate-700">
            <Filter size={16} />
            <span>Filter</span>
          </button>
        </div>
      </div>

      <div className="glass-panel overflow-hidden border border-slate-700/50">
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="text-xs text-slate-400 uppercase bg-slate-800/50 border-b border-slate-700/50">
              <tr>
                <th className="px-6 py-4 font-medium">Title</th>
                <th className="px-6 py-4 font-medium">Source</th>
                <th className="px-6 py-4 font-medium">Status</th>
                <th className="px-6 py-4 font-medium">Added</th>
                <th className="px-6 py-4 font-medium text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-700/50">
              {articles.length === 0 ? (
                <tr>
                  <td colSpan="5" className="px-6 py-8 text-center text-slate-500">
                    No articles found in the database.
                  </td>
                </tr>
              ) : (
                articles.map((article) => (
                  <tr key={article.id} className="hover:bg-slate-800/30 transition-colors">
                    <td className="px-6 py-4">
                      <div className="font-medium text-slate-200 line-clamp-1" title={article.original_title}>
                        {article.original_title}
                      </div>
                    </td>
                    <td className="px-6 py-4 text-slate-400">
                      <span className="bg-slate-800 px-2.5 py-1 rounded-md text-xs border border-slate-700">
                        {article.source_name || 'Unknown'}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <StatusBadge status={article.status} />
                    </td>
                    <td className="px-6 py-4 text-slate-400 whitespace-nowrap">
                      {article.created_at ? formatDistanceToNow(new Date(article.created_at), { addSuffix: true }) : 'N/A'}
                    </td>
                    <td className="px-6 py-4 text-right">
                      {article.original_url && (
                        <a
                          href={article.original_url}
                          target="_blank"
                          rel="noreferrer"
                          className="text-blue-400 hover:text-blue-300 inline-flex items-center text-xs space-x-1"
                        >
                          <span>Original</span>
                          <ExternalLink size={12} />
                        </a>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function StatusBadge({ status }) {
  const styles = {
    pending: 'bg-yellow-500/10 text-yellow-500 border-yellow-500/20',
    rewritten: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
    published: 'bg-green-500/10 text-green-400 border-green-500/20',
    failed: 'bg-red-500/10 text-red-400 border-red-500/20',
  };

  const style = styles[status?.toLowerCase()] || 'bg-slate-500/10 text-slate-400 border-slate-500/20';

  return (
    <span className={`px-2.5 py-1 rounded-full text-xs font-medium border capitalize ${style}`}>
      {status || 'Unknown'}
    </span>
  );
}
