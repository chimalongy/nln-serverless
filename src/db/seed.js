const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

/**
 * Database Seed Script
 * Inserts default Nigerian news sources into the database
 */
async function seedDatabase() {
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_KEY;

  if (!supabaseUrl || !supabaseKey) {
    console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_KEY');
    process.exit(1);
  }

  const supabase = createClient(supabaseUrl, supabaseKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const sources = [
    {
      name: 'Premium Times',
      base_url: 'https://www.premiumtimesng.com',
      rss_feed_url: 'https://www.premiumtimesng.com/feed',
      scrape_config: {
        category_selector: '.cat',
        title_selector: 'h1.entry-title',
        content_selector: '.entry-content',
        article_list_selector: '.jeg_post_title a',
      },
      is_active: true,
    },
    {
      name: 'Vanguard',
      base_url: 'https://www.vanguardngr.com',
      rss_feed_url: 'https://www.vanguardngr.com/feed/',
      scrape_config: {
        category_selector: '.category',
        title_selector: 'h1.entry-title',
        content_selector: '.entry-content',
        article_list_selector: '.entry-title a',
      },
      is_active: true,
    },
    {
      name: 'The Guardian Nigeria',
      base_url: 'https://guardian.ng',
      rss_feed_url: 'https://guardian.ng/feed/',
      scrape_config: {
        category_selector: '.category',
        title_selector: 'h1.title',
        content_selector: '.article-content',
        article_list_selector: '.headline a',
      },
      is_active: true,
    },
    {
      name: 'Punch',
      base_url: 'https://punchng.com',
      rss_feed_url: 'https://punchng.com/feed/',
      scrape_config: {
        category_selector: '.category',
        title_selector: 'h1.entry-title',
        content_selector: '.entry-content',
        article_list_selector: '.entry-title a',
      },
      is_active: true,
    },
    {
      name: 'Channels TV',
      base_url: 'https://www.channelstv.com',
      rss_feed_url: 'https://www.channelstv.com/feed/',
      scrape_config: {
        category_selector: '.category',
        title_selector: 'h1.entry-title',
        content_selector: '.entry-content',
        article_list_selector: '.entry-title a',
      },
      is_active: true,
    },
    {
      name: 'Sahara Reporters',
      base_url: 'https://saharareporters.com',
      rss_feed_url: 'https://saharareporters.com/rss.xml',
      scrape_config: {
        category_selector: '.field-name-field-news-category',
        title_selector: 'h1.page-title',
        content_selector: '.field-name-body',
        article_list_selector: '.field-content a',
      },
      is_active: true,
    },
    {
      name: 'Daily Trust',
      base_url: 'https://dailytrust.com',
      rss_feed_url: 'https://dailytrust.com/feed/',
      scrape_config: {
        category_selector: '.category',
        title_selector: 'h1.entry-title',
        content_selector: '.entry-content',
        article_list_selector: '.entry-title a',
      },
      is_active: true,
    },
  ];

  console.log('Seeding database with default sources...');

  for (const source of sources) {
    const { error } = await supabase
      .from('sources')
      .upsert(source, { onConflict: 'name' });

    if (error) {
      console.error(`Failed to insert ${source.name}:`, error.message);
    } else {
      console.log(`Inserted/Updated: ${source.name}`);
    }
  }

  console.log('Seed complete!');
}

seedDatabase().catch(console.error);
