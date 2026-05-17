const { getSupabase } = require('../db/supabase');
const { logger } = require('../utils/logger');

/**
 * Error Logger Service
 * Saves detailed error logs to the error_logs table in Supabase
 */

/**
 * Save an error log to the database
 * @param {Object} params
 * @param {string} params.jobName - Name of the job that errored (e.g., 'scrape-articles')
 * @param {string} params.severity - 'warning' | 'error' | 'critical'
 * @param {string} params.errorMessage - Human-readable error message
 * @param {string} [params.errorStack] - Full stack trace
 * @param {string} [params.articleId] - UUID of related article (if applicable)
 * @param {Object} [params.context] - Additional context (source name, URL, attempt #, etc.)
 * @returns {Promise<void>}
 */
async function saveErrorLog({
  jobName,
  severity = 'error',
  errorMessage,
  errorStack = null,
  articleId = null,
  context = {},
}) {
  try {
    const supabase = getSupabase();

    const { error } = await supabase.from('error_logs').insert({
      job_name: jobName,
      severity,
      error_message: errorMessage,
      error_stack: errorStack,
      article_id: articleId,
      context,
      resolved: false,
    });

    if (error) {
      // Don't throw — just log to console so we don't create infinite error loops
      logger.error('Failed to save error log to database', {
        dbError: error.message,
        originalError: errorMessage,
        job: jobName,
      });
    }
  } catch (err) {
    // Silently fail — error logging should never crash the job
    logger.error('Error logger crashed', {
      error: err.message,
      originalError: errorMessage,
    });
  }
}

/**
 * Helper to create error log from a caught Error object
 * @param {string} jobName - Job name
 * @param {Error} error - The caught error
 * @param {Object} [extra] - Extra context fields
 * @returns {Promise<void>}
 */
async function logJobError(jobName, error, extra = {}) {
  const severity = extra.severity || 'error';
  const articleId = extra.articleId || null;

  await saveErrorLog({
    jobName,
    severity,
    errorMessage: error.message || String(error),
    errorStack: error.stack || null,
    articleId,
    context: {
      ...extra,
      statusCode: error.response?.status || null,
      apiError: error.response?.data?.error?.message || null,
      timestamp: new Date().toISOString(),
    },
  });
}

module.exports = { saveErrorLog, logJobError };
