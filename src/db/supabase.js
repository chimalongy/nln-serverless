const { createClient } = require('@supabase/supabase-js');
const { config } = require('../config');

/**
 * Create a Supabase client with the service role key
 * The service role key bypasses RLS and is safe for server-side operations
 */
function createSupabaseClient() {
  if (!config.supabase.url || !config.supabase.serviceKey) {
    throw new Error('Supabase URL and service key are required');
  }

  return createClient(config.supabase.url, config.supabase.serviceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
    db: {
      schema: 'public',
    },
  });
}

// Singleton instance
let supabaseInstance = null;

/**
 * Get the Supabase client instance (singleton)
 * @returns {import('@supabase/supabase-js').SupabaseClient}
 */
function getSupabase() {
  if (!supabaseInstance) {
    supabaseInstance = createSupabaseClient();
  }
  return supabaseInstance;
}

/**
 * Reset the Supabase instance (useful for testing)
 */
function resetSupabase() {
  supabaseInstance = null;
}

module.exports = {
  createSupabaseClient,
  getSupabase,
  resetSupabase,
};
