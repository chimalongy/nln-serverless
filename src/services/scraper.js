const axios = require('axios');
const cheerio = require('cheerio');
const { config } = require('../config');
const { logger } = require('../utils/logger');
const { sleep, normalizeUrl } = require('../utils/helpers');
const { NEWS_SOURCES, inferCategory } = require('../utils/constants');

/**
 * Scraper Service
 * Handles all scraping operations for Nigerian news sources
 */
class ScraperService {
  constructor() {
    this.concurrency = config.scraping.concurrency;
    this.timeout = config.scraping.requestTimeoutMs;
    this.userAgent = config.scraping.userAgent;
  }

  /**
   * Create an axios instance with default config
   */
  createAxiosInstance() {
    return axios.create({
      timeout: this.timeout,
      headers: {
        'User-Agent': this.userAgent,
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5',
        'Accept-Encoding': 'gzip, deflate, br',
        'Connection': 'keep-alive',
      },
      maxRedirects: 5,
      validateStatus: (status) => status < 500,
    });
  }

  /**
   * Fetch HTML from a URL
   * @param {string} url - URL to fetch
   * @returns {Promise<string>} HTML content
   */
  async fetchHtml(url) {
    const client = this.createAxiosInstance();
    const response = await client.get(url);
    return response.data;
  }

  /**
   * Parse RSS feed and extract article URLs
   * @param {string} rssUrl - RSS feed URL
   * @returns {Promise<Array<{url: string, title: string, date: string}>>}
   */
  async parseRssFeed(rssUrl) {
    try {
      const html = await this.fetchHtml(rssUrl);
      const $ = cheerio.load(html, { xmlMode: true });
      const items = [];

      $('item').each((_, element) => {
        const $item = $(element);
        const url = $item.find('link').text().trim();
        const title = $item.find('title').text().trim();
        const pubDate = $item.find('pubDate').text().trim();

        if (url && title) {
          items.push({
            url: normalizeUrl(url),
            title,
            date: pubDate ? new Date(pubDate).toISOString() : new Date().toISOString(),
          });
        }
      });

      // Fallback: try atom format
      if (items.length === 0) {
        $('entry').each((_, element) => {
          const $entry = $(element);
          const url = $entry.find('link').attr('href') || $entry.find('id').text().trim();
          const title = $entry.find('title').text().trim();
          const pubDate = $entry.find('updated, published').first().text().trim();

          if (url && title) {
            items.push({
              url: normalizeUrl(url),
              title,
              date: pubDate ? new Date(pubDate).toISOString() : new Date().toISOString(),
            });
          }
        });
      }

      return items;
    } catch (error) {
      logger.error('RSS parse failed', { rssUrl, error: error.message });
      return [];
    }
  }

  /**
   * Scrape article content from a URL
   * @param {string} url - Article URL
   * @param {Object} sourceConfig - Source configuration with selectors
   * @returns {Promise<Object|null>}
   */
  async scrapeArticle(url, sourceConfig) {
    try {
      const html = await this.fetchHtml(url);
      const $ = cheerio.load(html);
      const { selectors } = sourceConfig;

      // Extract title - try configured selector first, then fallbacks
      let title = $(selectors.title).first().text().trim();

      // Fallback: try common title selectors
      if (!title) {
        title = $('h1').first().text().trim();
      }
      // Fallback: try og:title meta tag
      if (!title) {
        title = $('meta[property="og:title"]').attr('content')?.trim() || '';
      }
      // Fallback: try <title> tag (strip site name suffix)
      if (!title) {
        const pageTitle = $('title').text().trim();
        if (pageTitle) {
          // Remove common suffixes like " - Premium Times", " | Vanguard"
          title = pageTitle.replace(/\s*[-|–—]\s*[^-|–—]+$/, '').trim();
        }
      }

      if (!title) {
        logger.warn('No title found for article', { url });
        return null;
      }

      // Extract content - get all paragraphs
      let content = '';
      $(selectors.content).find('p').each((_, el) => {
        const text = $(el).text().trim();
        if (text.length > 20) {
          content += text + '\n\n';
        }
      });

      // If no paragraphs found, try getting raw text
      if (!content) {
        content = $(selectors.content).text().trim();
      }

      // Extract category
      let category = $(selectors.category).first().text().trim();
      if (!category) {
        category = inferCategory(title, content);
      }

      // Extract image
      let imageUrl = $(selectors.image).first().attr('src') || '';
      if (imageUrl && !imageUrl.startsWith('http')) {
        imageUrl = new URL(imageUrl, sourceConfig.baseUrl).href;
      }

      // Extract date
      let publishedDate = $(selectors.date).first().attr('datetime') || $(selectors.date).first().text().trim();
      if (publishedDate) {
        try {
          publishedDate = new Date(publishedDate).toISOString();
        } catch {
          publishedDate = new Date().toISOString();
        }
      } else {
        publishedDate = new Date().toISOString();
      }

      // Generate summary (first 200 chars of content)
      const summary = content.substring(0, 200).trim() + (content.length > 200 ? '...' : '');

      return {
        url: normalizeUrl(url),
        title,
        content: content.trim(),
        category: category.toLowerCase().replace(/\s+/g, '-'),
        imageUrl,
        publishedDate,
        summary,
        sourceName: sourceConfig.name,
      };
    } catch (error) {
      logger.error('Article scrape failed', { url, error: error.message });
      return null;
    }
  }

  /**
   * Scrape a single news source
   * @param {Object} source - Source configuration
   * @param {number} maxArticles - Maximum articles to scrape
   * @returns {Promise<Array<Object>>}
   */
  async scrapeSource(source, maxArticles = 10) {
    const logMeta = { source: source.name, job: 'scraper' };
    logger.info('Starting source scrape', logMeta);

    try {
      // Try RSS first
      let articleLinks = [];

      if (source.rssFeed) {
        const rssItems = await this.parseRssFeed(source.rssFeed);
        articleLinks = rssItems.map(item => ({
          url: item.url,
          title: item.title,
          date: item.date,
        }));
        logger.info(`RSS feed returned ${articleLinks.length} articles`, logMeta);
      }

      // Fallback: scrape homepage for article links if RSS fails or is empty
      if (articleLinks.length === 0) {
        try {
          const html = await this.fetchHtml(source.baseUrl);
          const $ = cheerio.load(html);

          $(source.selectors.articleLinks).each((_, el) => {
            const href = $(el).attr('href');
            const title = $(el).text().trim();

            if (href && title) {
              let fullUrl = href;
              if (!href.startsWith('http')) {
                fullUrl = new URL(href, source.baseUrl).href;
              }
              articleLinks.push({ url: normalizeUrl(fullUrl), title, date: new Date().toISOString() });
            }
          });

          logger.info(`Homepage scrape returned ${articleLinks.length} articles`, logMeta);
        } catch (error) {
          logger.error('Homepage scrape failed', { ...logMeta, error: error.message });
        }
      }

      // Limit articles
      articleLinks = articleLinks.slice(0, maxArticles);

      // Scrape each article with concurrency control
      const results = [];
      const chunks = [];
      for (let i = 0; i < articleLinks.length; i += this.concurrency) {
        chunks.push(articleLinks.slice(i, i + this.concurrency));
      }

      for (const chunk of chunks) {
        const promises = chunk.map(async (link) => {
          const article = await this.scrapeArticle(link.url, source);
          if (article) {
            // Use RSS date if available
            if (link.date) {
              article.publishedDate = link.date;
            }
            results.push(article);
          }
          // Small delay between requests
          await sleep(500);
        });

        await Promise.all(promises);
      }

      logger.info(`Source scrape complete: ${results.length} articles`, logMeta);
      return results;
    } catch (error) {
      logger.error('Source scrape error', { ...logMeta, error: error.message });
      return [];
    }
  }

  /**
   * Scrape all active sources
   * @param {number} maxArticlesPerSource - Max articles per source
   * @returns {Promise<Array<Object>>}
   */
  async scrapeAllSources(maxArticlesPerSource = 10) {
    const allArticles = [];
    const activeSources = NEWS_SOURCES.filter(s => s.isActive !== false);

    logger.info(`Starting full scrape of ${activeSources.length} sources`, { job: 'scraper' });

    for (const source of activeSources) {
      const articles = await this.scrapeSource(source, maxArticlesPerSource);
      allArticles.push(...articles);
      // Delay between sources to be polite
      await sleep(2000);
    }

    logger.info(`Full scrape complete: ${allArticles.length} total articles`, { job: 'scraper' });
    return allArticles;
  }
}

module.exports = { ScraperService };
