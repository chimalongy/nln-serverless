/**
 * Nigerian news source configurations
 * Defines base URLs, RSS feeds, and CSS selectors for scraping
 */

const NEWS_SOURCES = [
  {
    name: 'Premium Times',
    baseUrl: 'https://www.premiumtimesng.com',
    rssFeed: 'https://www.premiumtimesng.com/feed',
    selectors: {
      articleLinks: '.jeg_post_title a, .entry-title a, h2.post-title a',
      title: 'h1.entry-title, h1.jeg_post_title',
      content: '.entry-content, .jeg_post_content',
      category: '.cat, .jeg_meta_category a, .entry-category',
      image: '.jeg_featured_img img, .entry-content img:first-of-type',
      date: '.entry-date, .jeg_meta_date',
    },
    isActive: true,
  },
  {
    name: 'Vanguard',
    baseUrl: 'https://www.vanguardngr.com',
    rssFeed: 'https://www.vanguardngr.com/feed/',
    selectors: {
      articleLinks: '.entry-title a, .rtp-post-title a, h2 a',
      title: 'h1.entry-title',
      content: '.entry-content',
      category: '.category, .entry-categories a',
      image: '.entry-content img:first-of-type, .featured-image img',
      date: '.entry-date, time',
    },
    isActive: true,
  },
  {
    name: 'The Guardian Nigeria',
    baseUrl: 'https://guardian.ng',
    rssFeed: 'https://guardian.ng/feed/',
    selectors: {
      articleLinks: '.headline a, h2 a, .title a',
      title: 'h1.title, h1.headline',
      content: '.article-content, .content',
      category: '.category, .article-category a',
      image: '.article-content img:first-of-type, .featured-image img',
      date: '.date, time',
    },
    isActive: true,
  },
  {
    name: 'Punch',
    baseUrl: 'https://punchng.com',
    rssFeed: 'https://punchng.com/feed/',
    selectors: {
      articleLinks: '.entry-title a, h2 a, .post-title a',
      title: 'h1.entry-title',
      content: '.entry-content',
      category: '.category, .entry-categories a',
      image: '.entry-content img:first-of-type, .post-thumbnail img',
      date: '.entry-date, time',
    },
    isActive: true,
  },
  {
    name: 'Channels TV',
    baseUrl: 'https://www.channelstv.com',
    rssFeed: 'https://www.channelstv.com/feed/',
    selectors: {
      articleLinks: '.entry-title a, h2 a, .post-title a',
      title: 'h1.entry-title',
      content: '.entry-content',
      category: '.category, .entry-categories a',
      image: '.entry-content img:first-of-type, .featured-image img',
      date: '.entry-date, time',
    },
    isActive: true,
  },
  {
    name: 'Sahara Reporters',
    baseUrl: 'https://saharareporters.com',
    rssFeed: 'https://saharareporters.com/rss.xml',
    selectors: {
      articleLinks: '.field-content a, h2 a, .title a',
      title: 'h1.page-title, h1.title',
      content: '.field-name-body, .content',
      category: '.field-name-field-news-category a, .category',
      image: '.field-name-body img:first-of-type, .content img:first-of-type',
      date: '.date-display-single, time',
    },
    isActive: true,
  },
  {
    name: 'Daily Trust',
    baseUrl: 'https://dailytrust.com',
    rssFeed: 'https://dailytrust.com/feed/',
    selectors: {
      articleLinks: '.entry-title a, h2 a, .post-title a',
      title: 'h1.entry-title',
      content: '.entry-content',
      category: '.category, .entry-categories a',
      image: '.entry-content img:first-of-type, .post-thumbnail img',
      date: '.entry-date, time',
    },
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
  technology: ['technology', 'tech', 'startup', 'internet', 'software', 'ai', 'digital', ' telecoms'],
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
