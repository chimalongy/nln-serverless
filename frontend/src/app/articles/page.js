import { supabase } from '@/lib/supabase';
import { formatDistanceToNow } from 'date-fns';
import { Search, Filter, ExternalLink } from 'lucide-react';
import { ArticleThumbnail } from '@/app/components/ArticleThumbnail';

export const revalidate = 60;

async function getArticles() {
  try {
    const { data } = await supabase
      .from('articles')
      .select(
        'id, original_title, rewritten_title, source_name, source_url, wp_post_url, original_image_url, wp_post_featured_image, status, created_at'
      )
      .order('created_at', { ascending: false })
      .limit(50);
    return data || [];
  } catch (error) {
    console.error('Failed to fetch articles:', error);
    return [];
  }
}

function getArticleTitle(article) {
  return article.rewritten_title || article.original_title || 'Untitled';
}

function getFeaturedImage(article) {
  return article.wp_post_featured_image || article.original_image_url || null;
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

        <div className="flex flex-col gap-3 sm:flex-row sm:justify-between sm:space-x-3">
          <div className="relative w-full sm:w-auto">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
            <input
              type="text"
              placeholder="Search articles..."
              className="bg-slate-800/50 border border-slate-700 text-sm rounded-lg pl-9 pr-4 py-2 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all w-full sm:w-64"
            />
          </div>
          <button className="flex items-center justify-center space-x-2 bg-slate-800/50 hover:bg-slate-700 text-slate-300 px-4 py-2 rounded-lg transition-colors border border-slate-700 w-full sm:w-auto">
            <Filter size={16} />
            <span>Filter</span>
          </button>
        </div>
      </div>

      <div className="glass-panel overflow-hidden border border-slate-700/50">
        {articles.length === 0 ? (
          <p className="px-6 py-12 text-center text-slate-500">No articles found in the database.</p>
        ) : (
          <ul className="divide-y divide-slate-700/50">
            {articles.map((article) => {
              const title = getArticleTitle(article);
              const imageUrl = getFeaturedImage(article);

              return (
                <li key={article.id}>
                  <article className="flex flex-col gap-3 p-4 sm:flex-row sm:gap-4 sm:p-5 hover:bg-slate-800/30 transition-colors">
                    <div className="flex gap-3 sm:flex-1 sm:min-w-0">
                      <ArticleThumbnail src={imageUrl} alt={title} />

                      <div className="flex-1 min-w-0">
                        <h2 className="font-semibold text-slate-100 leading-snug md:line-clamp-2">
                          {title}
                        </h2>

                        <div className="flex flex-wrap items-center gap-2 mt-2">
                          <span className="bg-slate-800 px-2.5 py-0.5 rounded-md text-xs text-slate-300 border border-slate-700">
                            {article.source_name || 'Unknown source'}
                          </span>
                          <StatusBadge status={article.status} />
                          <span className="text-xs text-slate-500">
                            {article.created_at
                              ? formatDistanceToNow(new Date(article.created_at), { addSuffix: true })
                              : 'N/A'}
                          </span>
                        </div>

                        {article.rewritten_title &&
                          article.original_title &&
                          article.rewritten_title !== article.original_title && (
                            <p className="text-xs text-slate-500 mt-2 md:line-clamp-1">
                              Original: {article.original_title}
                            </p>
                          )}

                        <div className="flex flex-wrap gap-3 mt-3 sm:hidden">
                          {article.wp_post_url && (
                            <a
                              href={article.wp_post_url}
                              target="_blank"
                              rel="noreferrer"
                              className="text-green-400 hover:text-green-300 inline-flex items-center text-xs space-x-1"
                            >
                              <span>Published</span>
                              <ExternalLink size={12} />
                            </a>
                          )}
                          {article.source_url && (
                            <a
                              href={article.source_url}
                              target="_blank"
                              rel="noreferrer"
                              className="text-blue-400 hover:text-blue-300 inline-flex items-center text-xs space-x-1"
                            >
                              <span>Source</span>
                              <ExternalLink size={12} />
                            </a>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="hidden sm:flex shrink-0 flex-col items-end justify-center gap-2">
                      {article.wp_post_url && (
                        <a
                          href={article.wp_post_url}
                          target="_blank"
                          rel="noreferrer"
                          className="text-green-400 hover:text-green-300 inline-flex items-center text-xs space-x-1"
                        >
                          <span>Published</span>
                          <ExternalLink size={12} />
                        </a>
                      )}
                      {article.source_url && (
                        <a
                          href={article.source_url}
                          target="_blank"
                          rel="noreferrer"
                          className="text-blue-400 hover:text-blue-300 inline-flex items-center text-xs space-x-1"
                        >
                          <span>Source</span>
                          <ExternalLink size={12} />
                        </a>
                      )}
                    </div>
                  </article>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}

function StatusBadge({ status }) {
  const styles = {
    scraped: 'bg-slate-500/10 text-slate-400 border-slate-500/20',
    rewriting: 'bg-yellow-500/10 text-yellow-500 border-yellow-500/20',
    rewritten: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
    publishing: 'bg-purple-500/10 text-purple-400 border-purple-500/20',
    published: 'bg-green-500/10 text-green-400 border-green-500/20',
    failed: 'bg-red-500/10 text-red-400 border-red-500/20',
    duplicate: 'bg-orange-500/10 text-orange-400 border-orange-500/20',
    archived: 'bg-slate-500/10 text-slate-500 border-slate-500/20',
    pending: 'bg-yellow-500/10 text-yellow-500 border-yellow-500/20',
  };

  const style = styles[status?.toLowerCase()] || 'bg-slate-500/10 text-slate-400 border-slate-500/20';

  return (
    <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium border capitalize ${style}`}>
      {status || 'Unknown'}
    </span>
  );
}
