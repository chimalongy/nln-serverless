const { getSupabase } = require('../db/supabase');
const { logger } = require('../utils/logger');
const { calculateSimilarity, generateHash } = require('../utils/helpers');
const { config } = require('../config');

/**
 * Deduplication Service
 * Handles deduplication of articles by URL, title, and content similarity
 */
class DeduplicatorService {
  constructor() {
    this.similarityThreshold = config.system.contentSimilarityThreshold;
    this.maxAgeDays = config.system.deduplicationMaxAgeDays;
  }

  /**
   * Check if an article URL already exists
   * @param {string} url - Article URL
   * @returns {Promise<boolean>}
   */
  async isUrlDuplicate(url) {
    const supabase = getSupabase();
    const urlHash = generateHash(url);

    const { data, error } = await supabase
      .from('content_hashes')
      .select('id')
      .eq('hash_type', 'url')
      .eq('hash_value', urlHash)
      .limit(1);

    if (error) {
      logger.error('URL dedup check failed', { error: error.message });
      return false;
    }

    return data && data.length > 0;
  }

  /**
   * Check if a similar title already exists
   * @param {string} title - Article title
   * @returns {Promise<{isDuplicate: boolean, similarArticle: Object|null}>}
   */
  async isTitleDuplicate(title) {
    const supabase = getSupabase();

    // Get recent articles for comparison
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - this.maxAgeDays);

    const { data, error } = await supabase
      .from('articles')
      .select('id, original_title, rewritten_title, source_url, created_at')
      .gte('created_at', cutoffDate.toISOString())
      .in('status', ['scraped', 'rewriting', 'rewritten', 'publishing', 'published'])
      .order('created_at', { ascending: false })
      .limit(100);

    if (error || !data || data.length === 0) {
      return { isDuplicate: false, similarArticle: null };
    }

    for (const article of data) {
      const compareTitle = article.rewritten_title || article.original_title;
      const similarity = calculateSimilarity(title, compareTitle);

      if (similarity >= this.similarityThreshold) {
        return { isDuplicate: true, similarArticle: article };
      }
    }

    return { isDuplicate: false, similarArticle: null };
  }

  /**
   * Check if content is similar to existing articles
   * @param {string} content - Article content
   * @returns {Promise<{isDuplicate: boolean, similarArticle: Object|null}>}
   */
  async isContentDuplicate(content) {
    if (!content || content.length < 100) {
      return { isDuplicate: false, similarArticle: null };
    }

    const supabase = getSupabase();
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - this.maxAgeDays);

    // Get first 300 chars as fingerprint
    const contentFingerprint = content.substring(0, 300);

    const { data, error } = await supabase
      .from('articles')
      .select('id, original_content, rewritten_content, source_url, created_at')
      .gte('created_at', cutoffDate.toISOString())
      .in('status', ['scraped', 'rewriting', 'rewritten', 'publishing', 'published'])
      .not('original_content', 'is', null)
      .order('created_at', { ascending: false })
      .limit(50);

    if (error || !data || data.length === 0) {
      return { isDuplicate: false, similarArticle: null };
    }

    for (const article of data) {
      const compareContent = article.rewritten_content || article.original_content || '';
      if (compareContent.length < 100) continue;

      const similarity = calculateSimilarity(content, compareContent);

      if (similarity >= this.similarityThreshold) {
        return { isDuplicate: true, similarArticle: article };
      }
    }

    return { isDuplicate: false, similarArticle: null };
  }

  /**
   * Full deduplication check for an article
   * @param {Object} article - Article with url, title, content
   * @returns {Promise<{isDuplicate: boolean, reason: string, similarArticle: Object|null}>}
   */
  async checkDuplicate(article) {
    // 1. Check URL
    const urlDup = await this.isUrlDuplicate(article.url);
    if (urlDup) {
      return { isDuplicate: true, reason: 'url', similarArticle: null };
    }

    // 2. Check title similarity
    const titleDup = await this.isTitleDuplicate(article.title);
    if (titleDup.isDuplicate) {
      return { isDuplicate: true, reason: 'title', similarArticle: titleDup.similarArticle };
    }

    // 3. Check content similarity
    const contentDup = await this.isContentDuplicate(article.content);
    if (contentDup.isDuplicate) {
      return { isDuplicate: true, reason: 'content', similarArticle: contentDup.similarArticle };
    }

    return { isDuplicate: false, reason: null, similarArticle: null };
  }

  /**
   * Store content hash for an article
   * @param {string} articleId - Article UUID
   * @param {string} url - Article URL
   * @param {string} title - Article title
   * @param {string} content - Article content
   */
  async storeHashes(articleId, url, title, content) {
    const supabase = getSupabase();
    const hashes = [];

    // URL hash
    hashes.push({
      article_id: articleId,
      hash_type: 'url',
      hash_value: generateHash(url),
    });

    // Title hash
    if (title) {
      hashes.push({
        article_id: articleId,
        hash_type: 'title',
        hash_value: generateHash(title.toLowerCase().trim()),
      });
    }

    // Content hash (first 1000 chars)
    if (content) {
      hashes.push({
        article_id: articleId,
        hash_type: 'content',
        hash_value: generateHash(content.substring(0, 1000)),
      });
    }

    const { error } = await supabase.from('content_hashes').insert(hashes);

    if (error) {
      logger.error('Failed to store content hashes', { articleId, error: error.message });
    }
  }

  /**
   * Clean up old content hashes
   * @param {number} olderThanDays - Delete hashes older than N days
   */
  async cleanupOldHashes(olderThanDays = 30) {
    const supabase = getSupabase();
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - olderThanDays);

    const { error, count } = await supabase
      .from('content_hashes')
      .delete()
      .lt('created_at', cutoffDate.toISOString());

    if (error) {
      logger.error('Hash cleanup failed', { error: error.message });
      return 0;
    }

    logger.info('Content hashes cleanup complete', { deletedCount: count || 0 });
    return count || 0;
  }

  /**
   * Find and mark duplicate articles in database
   * Scans articles and marks duplicates based on title/content similarity
   * @returns {Promise<number>} Number of duplicates found
   */
  async deduplicateBatch() {
    const supabase = getSupabase();
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - this.maxAgeDays);

    // Get unprocessed scraped articles
    const { data: articles, error } = await supabase
      .from('articles')
      .select('id, source_url, original_title, original_content, created_at')
      .eq('status', 'scraped')
      .gte('created_at', cutoffDate.toISOString())
      .order('created_at', { ascending: true })
      .limit(50);

    if (error || !articles || articles.length === 0) {
      return 0;
    }

    let duplicatesFound = 0;

    for (const article of articles) {
      const result = await this.checkDuplicate({
        url: article.source_url,
        title: article.original_title,
        content: article.original_content,
      });

      if (result.isDuplicate) {
        await supabase
          .from('articles')
          .update({
            status: 'duplicate',
            updated_at: new Date().toISOString(),
            last_error: `Duplicate detected: ${result.reason}`,
          })
          .eq('id', article.id);

        duplicatesFound++;
        logger.info('Duplicate article marked', {
          articleId: article.id,
          reason: result.reason,
        });
      } else {
        // Store hashes for future deduplication
        await this.storeHashes(
          article.id,
          article.source_url,
          article.original_title,
          article.original_content
        );
      }
    }

    return duplicatesFound;
  }

  /**
   * Archive old failed/unpublished articles
   * @returns {Promise<number>} Number of archived articles
   */
  async archiveOldArticles() {
    const supabase = getSupabase();
    const maxAgeHours = config.system.failedArticleMaxAgeHours;
    const cutoffDate = new Date();
    cutoffDate.setHours(cutoffDate.getHours() - maxAgeHours);

    const { data, error } = await supabase
      .from('articles')
      .update({ status: 'archived', updated_at: new Date().toISOString() })
      .in('status', ['failed', 'scraped'])
      .lt('created_at', cutoffDate.toISOString())
      .select();

    if (error) {
      logger.error('Archive old articles failed', { error: error.message });
      return 0;
    }

    const count = data ? data.length : 0;
    logger.info('Old articles archived', { count });
    return count;
  }
}

module.exports = { DeduplicatorService };
