const express = require('express');
const { getSupabase } = require('./db/supabase');
const { config, validateConfig } = require('./config');
const { logger } = require('./utils/logger');

/**
 * Local Health Check Server
 * Provides endpoints for monitoring the system during local development
 */

const app = express();
app.use(express.json());

// CORS headers
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept');
  next();
});

/**
 * GET /health
 * Basic health check
 */
app.get('/health', async (req, res) => {
  try {
    validateConfig();
    res.json({
      status: 'healthy',
      timestamp: new Date().toISOString(),
      environment: config.nodeEnv,
      version: require('../package.json').version,
    });
  } catch (error) {
    res.status(503).json({
      status: 'unhealthy',
      error: error.message,
      timestamp: new Date().toISOString(),
    });
  }
});

/**
 * GET /stats
 * Article statistics
 */
app.get('/stats', async (req, res) => {
  try {
    const supabase = getSupabase();

    // Status counts
    const { data: statusCounts, error: statusError } = await supabase
      .from('articles')
      .select('status', { count: 'exact' });

    if (statusError) throw statusError;

    const counts = {};
    for (const row of statusCounts || []) {
      counts[row.status] = (counts[row.status] || 0) + 1;
    }

    // Recent articles
    const { data: recent, error: recentError } = await supabase
      .from('articles')
      .select('id, source_name, status, original_title, created_at')
      .order('created_at', { ascending: false })
      .limit(20);

    if (recentError) throw recentError;

    // Job logs
    const { data: logs, error: logsError } = await supabase
      .from('job_logs')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(10);

    if (logsError) throw logsError;

    res.json({
      timestamp: new Date().toISOString(),
      counts,
      recentArticles: recent || [],
      recentLogs: logs || [],
    });
  } catch (error) {
    logger.error('Stats endpoint error', { error: error.message });
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /articles
 * List articles with optional status filter
 */
app.get('/articles', async (req, res) => {
  try {
    const supabase = getSupabase();
    const { status, limit = 50, offset = 0 } = req.query;

    let query = supabase
      .from('articles')
      .select('*', { count: 'exact' })
      .order('created_at', { ascending: false })
      .limit(parseInt(limit))
      .range(parseInt(offset), parseInt(offset) + parseInt(limit) - 1);

    if (status) {
      query = query.eq('status', status);
    }

    const { data, error, count } = await query;

    if (error) throw error;

    res.json({
      articles: data || [],
      total: count || 0,
      limit: parseInt(limit),
      offset: parseInt(offset),
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

const PORT = config.port || 3000;

if (require.main === module) {
  app.listen(PORT, () => {
    logger.info(`Health check server running on port ${PORT}`);
    logger.info(`Endpoints: http://localhost:${PORT}/health, /stats, /articles`);
  });
}

module.exports = { app };
