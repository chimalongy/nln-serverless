const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

/**
 * Database Seed Script
 * Inserts GistReel and NaijaNews sources into the database
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
      name: 'GistReel',
      base_url: 'https://www.gistreel.com',
      rss_feed_url: null,
      scrape_config: {
        type: 'gistreel',
        pages: ['https://www.gistreel.com'],
        grid_selector: '.container-wrapper.post-element.tie-standard',
        list_selector: 'article.post-element',
        title_selector: 'h2.entry-title a, h2.post-title a',
        date_selector: '.post-meta .date, .meta-item.date',
        content_selectors: ['#the-post', '.entry-content', '.single-content', 'article'],
      },
      is_active: true,
    },
    {
      name: 'NaijaNews',
      base_url: 'https://www.naijanews.com',
      rss_feed_url: null,
      scrape_config: {
        type: 'naijanews',
        pages: [
          'https://www.naijanews.com',
          'https://www.naijanews.com/category/nigeria-news/',
          'https://www.naijanews.com/category/politics/',
          'https://www.naijanews.com/category/entertainment/',
          'https://www.naijanews.com/category/sports/',
          'https://www.naijanews.com/category/technology/',
        ],
        article_selector: '.mvp-blog-story-wrap, .mvp-blog-story-out, article',
        content_selector: '#mvp-content-main p, article p',
        date_selector: 'time, .mvp-cd-date, .mvp-blog-story-date',
      },
      is_active: true,
    },
  ];

  console.log('Seeding database with GistReel and NaijaNews sources...');

  // Deactivate old sources
  const { error: deactivateError } = await supabase
    .from('sources')
    .update({ is_active: false })
    .not('name', 'in', '("GistReel","NaijaNews")');

  if (deactivateError) {
    console.warn('Could not deactivate old sources:', deactivateError.message);
  } else {
    console.log('Deactivated old sources');
  }

  // Upsert new sources
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
