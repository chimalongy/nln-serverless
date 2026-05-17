const { getSupabase } = require('./supabase');
const { logger } = require('../utils/logger');

/**
 * Fetch all API keys from the api_keys table
 * Returns full objects with id, email, api_key, api_source, created_at
 * @returns {Promise<Array<{id: number, email: string, api_key: string, api_source: string, created_at: string}>>}
 */
async function getAllApiKeys() {
  const supabase = getSupabase();

  try {
    const { data, error } = await supabase
      .from('api_keys')
      .select('id, email, api_key, api_source, created_at')
      .order('id', { ascending: true });

    if (error) {
      logger.error('Failed to fetch API keys', { error: error.message });
      return [];
    }

    const apiKeys = data || [];
    logger.info(`Fetched ${apiKeys.length} API key record(s) from api_keys`);
    return apiKeys;
  } catch (error) {
    logger.error('Error fetching API keys', { error: error.message });
    return [];
  }
}

module.exports = { getAllApiKeys };
