-- Add social_posts column to track successful Facebook / Instagram publishes
ALTER TABLE articles
ADD COLUMN IF NOT EXISTS social_posts JSONB DEFAULT '{}';
