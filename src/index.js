/**
 * NLN Serverless - Main Entry Point
 *
 * Exports all Trigger.dev tasks for the Nigerian News automation system.
 * Trigger.dev discovers jobs automatically from the ./src/jobs directory
 * as configured in trigger.config.mjs (dirs: ["./src/jobs"]).
 *
 * Active Jobs (matching NigerianLatestNewsServer reference pipeline):
 *
 * 1. naijaNewsJob  - Scrapes NaijaNews.com by category, rewrites with AI,
 *                    publishes to WordPress, and saves record to Supabase.
 *                    Matches: NaijaNewsAction.js in reference server.
 *
 * 2. gistReelJob   - Scrapes GistReel.com (grid + list layouts), extracts full
 *                    HTML, rewrites with AI (including Gutenberg blocks),
 *                    uploads inline images to WordPress, publishes post,
 *                    and saves record to Supabase.
 *                    Matches: GistReelAction.js in reference server.
 *
 * Both jobs:
 *   - Use API key rotation (OpenRouter + Gemini) from the api_keys table
 *   - Output valid WordPress Gutenberg block content
 *   - Set Rank Math AND Yoast SEO meta fields (focus_keyphrase, meta_description, title)
 *   - Deduplicate by checking source_url against existing articles in Supabase
 */

// No require() needed — Trigger.dev reads from dirs: ["./src/jobs"] in trigger.config.mjs
