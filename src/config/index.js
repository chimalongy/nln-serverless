const dotenv = require('dotenv');

// Load environment variables
dotenv.config();

/**
 * Application configuration loaded from environment variables
 * All config values are centralized here for consistency
 */
const config = {
  // Environment
  nodeEnv: process.env.NODE_ENV || 'development',
  port: parseInt(process.env.PORT, 10) || 3000,

  // Trigger.dev
  trigger: {
    apiKey: process.env.TRIGGER_API_KEY,
    apiUrl: process.env.TRIGGER_API_URL || 'https://api.trigger.dev',
    projectId: process.env.TRIGGER_PROJECT_ID || 'nln-serverless',
  },

  // Supabase
  supabase: {
    url: process.env.SUPABASE_URL,
    serviceKey: process.env.SUPABASE_SERVICE_KEY,
    anonKey: process.env.SUPABASE_ANON_KEY,
  },

  // WordPress
  wordpress: {
    baseUrl: process.env.WP_BASE_URL,
    username: process.env.WP_USERNAME,
    appPassword: process.env.WP_APP_PASSWORD,
    defaultAuthorId: parseInt(process.env.WP_DEFAULT_AUTHOR_ID, 10) || 1,
    defaultStatus: process.env.WP_DEFAULT_STATUS || 'publish',
  },

  // Scraping
  scraping: {
    maxArticlesPerScrape: parseInt(process.env.MAX_ARTICLES_PER_SCRAPE, 10) || 20,
    concurrency: parseInt(process.env.SCRAPING_CONCURRENCY, 10) || 3,
    requestTimeoutMs: parseInt(process.env.REQUEST_TIMEOUT_MS, 10) || 30000,
    userAgent: process.env.USER_AGENT || 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.0',
  },

  // System
  system: {
    logLevel: process.env.LOG_LEVEL || 'info',
    enableDeduplication: process.env.ENABLE_DEDUPLICATION !== 'false',
    contentSimilarityThreshold: parseFloat(process.env.CONTENT_SIMILARITY_THRESHOLD) || 0.85,
    maxRetries: parseInt(process.env.MAX_RETRIES, 10) || 3,
    failedArticleMaxAgeHours: parseInt(process.env.FAILED_ARTICLE_MAX_AGE_HOURS, 10) || 72,
    deduplicationMaxAgeDays: parseInt(process.env.DEDUPLICATION_MAX_AGE_DAYS, 10) || 7,
  },

  // Scheduling (cron expressions)
  schedules: {
    scrape: process.env.SCRAPE_SCHEDULE || '*/30 * * * *',
    rewrite: process.env.REWRITE_SCHEDULE || '0 */2 * * *',
    publish: process.env.PUBLISH_SCHEDULE || '0 */3 * * *',
    deduplicate: process.env.DEDUPLICATE_SCHEDULE || '0 2 * * *',
  },
};

/**
 * Validate required configuration values
 * @throws {Error} If required config is missing
 */
function validateConfig() {
  const required = [
    ['trigger.apiKey', config.trigger.apiKey],
    ['supabase.url', config.supabase.url],
    ['supabase.serviceKey', config.supabase.serviceKey],
    ['wordpress.baseUrl', config.wordpress.baseUrl],
    ['wordpress.username', config.wordpress.username],
    ['wordpress.appPassword', config.wordpress.appPassword],

  ];

  const missing = required.filter(([name, value]) => !value);

  if (missing.length > 0) {
    const missingNames = missing.map(([name]) => name).join(', ');
    throw new Error(`Missing required environment variables: ${missingNames}`);
  }
}

module.exports = {
  config,
  validateConfig,
};
