/**
 * NLN Serverless - Main Entry Point
 * 
 * Exports all Trigger.dev tasks for the Nigerian News automation system.
 * Each task is a scheduled job that handles a specific stage of the pipeline:
 * 
 * 1. scrapeJob    - Scrapes news from Nigerian sources
 * 2. rewriteJob   - Rewrites articles using AI
 * 3. publishJob   - Publishes to WordPress
 * 4. deduplicateJob - Deduplicates and cleans up
 */

const { scrapeJob } = require('./jobs/scrape.job');
const { rewriteJob } = require('./jobs/rewrite.job');
const { publishJob } = require('./jobs/publish.job');
const { deduplicateJob } = require('./jobs/deduplicate.job');

// Export all tasks
module.exports = {
  scrapeJob,
  rewriteJob,
  publishJob,
  deduplicateJob,
};
