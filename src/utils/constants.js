/**
 * Nigerian news source configurations
 * Only GistReel and NaijaNews are active sources
 */

const NEWS_SOURCES = [
  {
    name: 'GistReel',
    baseUrl: 'https://www.gistreel.com',
    type: 'gistreel',
    // GistReel category pages to scrape
    pages: [
      'https://www.gistreel.com',
    ],
    isActive: true,
  },
  {
    name: 'NaijaNews',
    baseUrl: 'https://www.naijanews.com',
    type: 'naijanews',
    // NaijaNews category pages to scrape
    pages: [
      'https://www.naijanews.com',
      'https://www.naijanews.com/category/nigeria-news/',
      'https://www.naijanews.com/category/politics/',
      'https://www.naijanews.com/category/entertainment/',
      'https://www.naijanews.com/category/sports/',
      'https://www.naijanews.com/category/technology/',
    ],
    isActive: true,
  },
];

/**
 * Article categories mapping
 */
const CATEGORY_MAP = {
  politics: ['politics', 'government', 'election', 'apc', 'pdp', 'labour', 'senate', 'house of representatives'],
  business: ['business', 'economy', 'finance', 'market', 'stock', 'naira', 'cbn', 'trade', 'investment'],
  sports: ['sports', 'football', 'epl', 'npfl', 'super eagles', 'afcon', 'world cup', 'athletics', 'basketball'],
  entertainment: ['entertainment', 'music', 'nollywood', 'celebrity', 'movie', 'showbiz', 'culture'],
  technology: ['technology', 'tech', 'startup', 'internet', 'software', 'ai', 'digital', 'telecoms'],
  health: ['health', 'covid', 'medicine', 'hospital', 'disease', 'vaccine', 'who'],
  security: ['security', 'crime', 'police', 'army', 'boko haram', 'bandit', 'kidnap', 'terrorism'],
  education: ['education', 'school', 'university', 'student', 'exam', 'waec', 'jamb', 'asu'],
  agriculture: ['agriculture', 'farm', 'farmer', 'crop', 'food', 'fao'],
  international: ['international', 'foreign', 'global', 'un', 'us', 'uk', 'africa', 'ecowas'],
};

/**
 * Infer category from article title and content
 * @param {string} title - Article title
 * @param {string} content - Article content (optional)
 * @returns {string} Category name
 */
function inferCategory(title, content = '') {
  const text = `${title} ${content}`.toLowerCase();

  for (const [category, keywords] of Object.entries(CATEGORY_MAP)) {
    if (keywords.some(keyword => text.includes(keyword))) {
      return category;
    }
  }

  return 'general';
}

/**
 * Status flow for articles
 */
const ARTICLE_STATUS = {
  SCRAPED: 'scraped',
  REWRITING: 'rewriting',
  REWRITTEN: 'rewritten',
  PUBLISHING: 'publishing',
  PUBLISHED: 'published',
  FAILED: 'failed',
  DUPLICATE: 'duplicate',
  ARCHIVED: 'archived',
};

module.exports = {
  NEWS_SOURCES,
  CATEGORY_MAP,
  inferCategory,
  ARTICLE_STATUS,
};
