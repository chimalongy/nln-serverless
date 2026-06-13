-- Supabase Database Schema for NLN Serverless

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Main table: scraped and processed articles
CREATE TABLE IF NOT EXISTS articles (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    source_url TEXT NOT NULL UNIQUE,
    source_name TEXT NOT NULL,
    category TEXT,
    original_title TEXT NOT NULL,
    original_content TEXT,
    original_summary TEXT,
    original_image_url TEXT,
    rewritten_title TEXT,
    rewritten_content TEXT,
    rewritten_summary TEXT,
    status VARCHAR(50) NOT NULL DEFAULT 'scraped' CHECK (status IN ('scraped', 'rewriting', 'rewritten', 'publishing', 'published', 'failed', 'duplicate', 'archived')),
    wp_post_id BIGINT,
    wp_post_url TEXT,
    wp_post_featured_image TEXT,
    rewrite_attempts INTEGER DEFAULT 0,
    publish_attempts INTEGER DEFAULT 0,
    scrape_metadata JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    published_at TIMESTAMPTZ,
    last_error TEXT,
    focus_keyphrase TEXT,
    meta_description TEXT,
    tags TEXT[],
    social_posts JSONB DEFAULT '{}'
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_articles_status ON articles(status);
CREATE INDEX IF NOT EXISTS idx_articles_source_name ON articles(source_name);
CREATE INDEX IF NOT EXISTS idx_articles_category ON articles(category);
CREATE INDEX IF NOT EXISTS idx_articles_created_at ON articles(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_articles_wp_post_id ON articles(wp_post_id) WHERE wp_post_id IS NOT NULL;

-- Deduplication tracking: content hashes
CREATE TABLE IF NOT EXISTS content_hashes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    article_id UUID REFERENCES articles(id) ON DELETE CASCADE,
    hash_type VARCHAR(50) NOT NULL CHECK (hash_type IN ('title', 'content', 'url')),
    hash_value TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(hash_type, hash_value)
);

CREATE INDEX IF NOT EXISTS idx_content_hashes_value ON content_hashes(hash_value);

-- Sources configuration table
CREATE TABLE IF NOT EXISTS sources (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL UNIQUE,
    base_url TEXT NOT NULL,
    rss_feed_url TEXT,
    scrape_config JSONB DEFAULT '{}',
    is_active BOOLEAN DEFAULT true,
    last_scraped_at TIMESTAMPTZ,
    articles_count INTEGER DEFAULT 0,
    fail_count INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_sources_active ON sources(is_active);

-- Job execution logs
CREATE TABLE IF NOT EXISTS job_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    job_name VARCHAR(100) NOT NULL,
    job_id TEXT,
    status VARCHAR(50) NOT NULL CHECK (status IN ('started', 'completed', 'failed')),
    payload JSONB,
    result JSONB,
    error_message TEXT,
    duration_ms INTEGER,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_job_logs_name ON job_logs(job_name);
CREATE INDEX IF NOT EXISTS idx_job_logs_created_at ON job_logs(created_at DESC);

-- WordPress sync state
CREATE TABLE IF NOT EXISTS wp_sync_state (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    last_sync_at TIMESTAMPTZ,
    last_synced_article_id UUID REFERENCES articles(id),
    sync_config JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- API keys for AI rewriting (supports multiple providers: open router, gemini)
CREATE TABLE IF NOT EXISTS api_keys (
    id SERIAL PRIMARY KEY,
    email VARCHAR(255),
    api_key TEXT,
    api_source TEXT DEFAULT 'open router',
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_api_keys_source ON api_keys(api_source);

-- Error logs for detailed error tracking
CREATE TABLE IF NOT EXISTS error_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    job_name VARCHAR(100) NOT NULL,
    severity VARCHAR(20) NOT NULL DEFAULT 'error' CHECK (severity IN ('warning', 'error', 'critical')),
    error_message TEXT NOT NULL,
    error_stack TEXT,
    article_id UUID REFERENCES articles(id) ON DELETE SET NULL,
    context JSONB DEFAULT '{}',
    resolved BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_error_logs_job_name ON error_logs(job_name);
CREATE INDEX IF NOT EXISTS idx_error_logs_severity ON error_logs(severity);
CREATE INDEX IF NOT EXISTS idx_error_logs_created_at ON error_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_error_logs_resolved ON error_logs(resolved);

-- Insert default Nigerian news sources
INSERT INTO sources (name, base_url, rss_feed_url, scrape_config) VALUES
('Premium Times', 'https://www.premiumtimesng.com', 'https://www.premiumtimesng.com/feed', '{"category_selector": ".cat", "title_selector": "h1.entry-title", "content_selector": ".entry-content", "article_list_selector": ".jeg_post_title a"}'),
('Vanguard', 'https://www.vanguardngr.com', 'https://www.vanguardngr.com/feed/', '{"category_selector": ".category", "title_selector": "h1.entry-title", "content_selector": ".entry-content", "article_list_selector": ".entry-title a"}'),
('The Guardian Nigeria', 'https://guardian.ng', 'https://guardian.ng/feed/', '{"category_selector": ".category", "title_selector": "h1.title", "content_selector": ".article-content", "article_list_selector": ".headline a"}'),
('Punch', 'https://punchng.com', 'https://punchng.com/feed/', '{"category_selector": ".category", "title_selector": "h1.entry-title", "content_selector": ".entry-content", "article_list_selector": ".entry-title a"}'),
('Channels TV', 'https://www.channelstv.com', 'https://www.channelstv.com/feed/', '{"category_selector": ".category", "title_selector": "h1.entry-title", "content_selector": ".entry-content", "article_list_selector": ".entry-title a"}'),
('Sahara Reporters', 'https://saharareporters.com', 'https://saharareporters.com/rss.xml', '{"category_selector": ".field-name-field-news-category", "title_selector": "h1.page-title", "content_selector": ".field-name-body", "article_list_selector": ".field-content a"}'),
('Daily Trust', 'https://dailytrust.com', 'https://dailytrust.com/feed/', '{"category_selector": ".category", "title_selector": "h1.entry-title", "content_selector": ".entry-content", "article_list_selector": ".entry-title a"}')
ON CONFLICT (name) DO NOTHING;

-- Update trigger for updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_articles_updated_at BEFORE UPDATE ON articles
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_sources_updated_at BEFORE UPDATE ON sources
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_wp_sync_state_updated_at BEFORE UPDATE ON wp_sync_state
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
