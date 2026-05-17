# NLN Serverless - Nigerian News Automation

A fully serverless, production-ready system that scrapes Nigerian news sites, rewrites articles with AI, and publishes them to WordPress automatically. Built with **Trigger.dev** for reliable background job scheduling.

## Architecture

```
+------------------+      +------------------+      +------------------+
|   Trigger.dev    |      |   Supabase DB    |      |   WordPress      |
|  (Scheduling)    |      |  (Data Store)    |      |  (Publishing)    |
+------------------+      +------------------+      +------------------+
         |                         |                        |
         v                         v                        v
   +-------------------------------------------------------------+
   |                    NLN Serverless Jobs                      |
   |  +------------+  +------------+  +------------+  +---------+  |
   |  |  scrape    |->|  rewrite   |->|  publish   |  | dedup   |  |
   |  | (30 min)   |  | (2 hours)  |  | (3 hours)  |  | (daily) |  |
   |  +------------+  +------------+  +------------+  +---------+  |
   +-------------------------------------------------------------+
```

## Tech Stack

- **Trigger.dev** - Background job scheduling and execution
- **Node.js 18+** (JavaScript, CommonJS)
- **Supabase** - PostgreSQL database
- **Axios + Cheerio** - Web scraping
- **OpenAI-compatible API** - Article rewriting
- **WordPress REST API** - Content publishing

## Prerequisites

1. **Node.js 18+** installed
2. **Trigger.dev account** - Sign up at [trigger.dev](https://trigger.dev)
3. **Supabase project** - Create at [supabase.com](https://supabase.com)
4. **WordPress site** with Application Passwords enabled
5. **OpenAI API key** or compatible AI service

## Quick Start

### 1. Clone and Install

```bash
git clone <your-repo>
cd nln-serverless
npm install
```

### 2. Set Up Environment

```bash
cp .env.example .env
# Edit .env with your credentials
```

Required variables:
- `TRIGGER_API_KEY` - From your Trigger.dev dashboard
- `SUPABASE_URL` and `SUPABASE_SERVICE_KEY` - From Supabase settings
- `WP_BASE_URL`, `WP_USERNAME`, `WP_APP_PASSWORD` - WordPress credentials
- `AI_API_KEY` - Your AI service API key

### 3. Set Up Database

1. Go to your Supabase project dashboard
2. Navigate to SQL Editor
3. Open `src/schemas/database.sql`
4. Run the full SQL script to create tables, indexes, triggers, and default sources

### 4. Seed Sources (Optional)

```bash
npm run db:seed
```

### 5. Configure Trigger.dev

```bash
# Login to Trigger.dev (first time only)
npx trigger.dev login

# Initialize project
npx trigger.dev init

# Deploy tasks
npm run deploy
```

### 6. Set Up Schedules

After deploying, configure schedules in the Trigger.dev dashboard:

| Job | Cron | Purpose |
|-----|------|---------|
| `scrape-articles` | `*/30 * * * *` | Scrape every 30 minutes |
| `rewrite-articles` | `0 */2 * * *` | Rewrite every 2 hours |
| `publish-articles` | `0 */3 * * *` | Publish every 3 hours |
| `deduplicate-articles` | `0 2 * * *` | Daily cleanup at 2 AM |

Or use the Trigger.dev CLI:
```bash
npx trigger.dev schedule create scrape-articles --cron "*/30 * * * *"
npx trigger.dev schedule create rewrite-articles --cron "0 */2 * * *"
npx trigger.dev schedule create publish-articles --cron "0 */3 * * *"
npx trigger.dev schedule create deduplicate-articles --cron "0 2 * * *"
```

### 7. Run Locally (Development)

```bash
# Start the Trigger.dev dev environment
npm run dev
```

This opens a tunnel so Trigger.dev can execute your tasks locally.

### 8. Local Monitoring Server (Optional)

```bash
# Start a local Express server for health checks and stats
npm run server
```

Available endpoints:
- `GET http://localhost:3000/health` - Health check
- `GET http://localhost:3000/stats` - Article statistics and recent logs
- `GET http://localhost:3000/articles?status=scraped&limit=20` - List articles
- `GET http://localhost:3000/sources` - Active news sources

## Project Structure

```
nln-serverless/
├── .env.example              # Environment template
├── package.json              # Dependencies
├── trigger.config.js         # Trigger.dev configuration
├── README.md                 # This file
└── src/
    ├── index.js              # Task exports
    ├── server.js             # Local monitoring server
    ├── config/               # Configuration
    │   └── index.js
    ├── db/                   # Database client
    │   ├── supabase.js
    │   └── seed.js
    ├── schemas/              # Database schema
    │   └── database.sql
    ├── jobs/                 # Trigger.dev tasks
    │   ├── scrape.job.js
    │   ├── rewrite.job.js
    │   ├── publish.job.js
    │   └── deduplicate.job.js
    ├── services/             # Business logic
    │   ├── scraper.js        # Cheerio + Axios scraping
    │   ├── rewriter.js       # AI article rewriting
    │   ├── publisher.js      # WordPress REST API
    │   └── deduplicator.js   # Deduplication logic
    └── utils/                # Utilities
        ├── logger.js         # Winston logging
        ├── helpers.js        # Shared helpers
        └── constants.js      # News sources & categories
```

## Job Details

### Scrape Job (`scrape-articles`)
- Scrapes 7 major Nigerian news sources
- RSS-first approach with homepage fallback
- Checks for duplicates before storing
- Stores content hashes for deduplication
- Respects rate limits (2s delay between sources)

### Rewrite Job (`rewrite-articles`)
- Processes articles in `scraped` status
- Uses AI to create original, engaging content
- Maintains factual accuracy
- Handles retry logic for failed rewrites
- Stores rewritten title, content, and summary

### Publish Job (`publish-articles`)
- Publishes `rewritten` articles to WordPress
- Creates categories dynamically
- Uploads featured images
- Adds source attribution
- Stores WordPress post ID and URL

### Deduplication Job (`deduplicate-articles`)
- Scans for duplicate titles/content
- Archives old failed articles (72h default)
- Cleans up content hashes (30d default)
- Generates system statistics

## Configuration

### Environment Variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `TRIGGER_API_KEY` | Yes | - | Trigger.dev API key |
| `SUPABASE_URL` | Yes | - | Supabase project URL |
| `SUPABASE_SERVICE_KEY` | Yes | - | Supabase service role key |
| `WP_BASE_URL` | Yes | - | WordPress site URL |
| `WP_USERNAME` | Yes | - | WordPress username |
| `WP_APP_PASSWORD` | Yes | - | WordPress app password |
| `AI_API_KEY` | Yes | - | AI service API key |
| `AI_API_URL` | No | OpenAI | AI API endpoint |
| `AI_MODEL` | No | gpt-4o-mini | AI model name |
| `MAX_ARTICLES_PER_SCRAPE` | No | 20 | Articles per source per run |
| `SCRAPE_SCHEDULE` | No | `*/30 * * * *` | Scrape cron |
| `REWRITE_SCHEDULE` | No | `0 */2 * * *` | Rewrite cron |
| `PUBLISH_SCHEDULE` | No | `0 */3 * * *` | Publish cron |
| `DEDUPLICATE_SCHEDULE` | No | `0 2 * * *` | Cleanup cron |

### Customizing News Sources

Edit `src/utils/constants.js` to add/remove sources:

```javascript
const NEWS_SOURCES = [
  {
    name: 'Your Source',
    baseUrl: 'https://example.com',
    rssFeed: 'https://example.com/feed',
    selectors: {
      articleLinks: '.article-link',
      title: 'h1',
      content: '.content',
      category: '.category',
      image: '.featured-image img',
      date: 'time',
    },
    isActive: true,
  },
];
```

## Monitoring

### Logs
- Winston logger writes structured JSON logs
- Check Trigger.dev dashboard for task execution logs
- Supabase `job_logs` table stores job history

### Database Queries

```sql
-- View recent articles
SELECT id, source_name, status, original_title, created_at
FROM articles
ORDER BY created_at DESC
LIMIT 20;

-- Count by status
SELECT status, COUNT(*) as count
FROM articles
GROUP BY status;

-- View job history
SELECT job_name, status, result, created_at
FROM job_logs
ORDER BY created_at DESC
LIMIT 20;
```

## Troubleshooting

### Scrape job returns 0 articles
- Check source URLs are accessible from your region
- Verify CSS selectors in `constants.js` match the sites
- Check logs for HTTP errors
- Some sites may block scraping - try with `curl`

### AI rewriting fails
- Verify `AI_API_KEY` is valid
- Check `AI_API_URL` is correct
- Ensure model name exists in your AI provider
- Review rate limits on your AI plan

### WordPress publish fails
- Enable Application Passwords in WordPress
- Verify `WP_APP_PASSWORD` (not your regular password)
- Check WordPress REST API is enabled
- Ensure user has `publish_posts` capability

### Trigger.dev tasks not running
- Verify `TRIGGER_API_KEY` is correct
- Run `npx trigger.dev dev` to test locally
- Check schedules are created in dashboard
- Ensure tasks are deployed with `npm run deploy`

## Production Checklist

- [ ] Set `NODE_ENV=production`
- [ ] Use production Supabase project
- [ ] Use WordPress production site
- [ ] Set up AI service with adequate rate limits
- [ ] Configure appropriate cron schedules
- [ ] Enable deduplication (`ENABLE_DEDUPLICATION=true`)
- [ ] Review `MAX_ARTICLES_PER_SCRAPE` for your volume
- [ ] Set up monitoring/alerts for failed jobs
- [ ] Configure log aggregation
- [ ] Test full pipeline end-to-end
- [ ] Set up backup for Supabase database

## License

MIT
