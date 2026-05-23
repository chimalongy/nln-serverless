import { schedules } from "@trigger.dev/sdk";
import { getSupabase } from "../db/supabase.js";
import { scrapeRecentPosts, extractPostContent } from "../services/naijaNewsScraper.js";
import { NaijaNewsRewrite } from "../services/aiRewriter.js";
import { POSTTOWORDPRESS } from "../services/wpPublisher.js";
import { safeParseYAML } from "../utils/yaml.js";

/**
 * NaijaNews Job
 * Scheduled Trigger.dev task replicating NaijaNewsAction from the reference server.
 * Pipeline: Scrape → Filter new links → Extract content → AI Rewrite → Post to WordPress → Save to Supabase
 */
export const naijaNewsJob = schedules.task({
  id: "naijanews-action",
  description: "Scrape NaijaNews, rewrite with AI, and publish to WordPress",
  cron: process.env.NAIJA_NEWS_SCHEDULE || "*/15 * * * *",
  machine: "small-1x",
  run: async (payload) => {
    const supabase = getSupabase();

    // Check if schedules are paused in Supabase
    const { data: syncState } = await supabase
      .from("wp_sync_state")
      .select("sync_config")
      .limit(1)
      .single();

    if (syncState?.sync_config?.schedules_paused) {
      console.log("⏸️ Schedules are paused in wp_sync_state. Skipping run.");
      return { success: true, skipped: true, reason: "schedules_paused" };
    }

    const categories = ["politics", "entertainment", "sports", "business"];

    console.log("📰 === NaijaNews Job Started ===");
    console.log(`🕐 Timestamp: ${new Date().toISOString()}`);

    let totalProcessed = 0;
    let totalPublished = 0;
    let totalErrors = 0;

    for (const category of categories) {
      try {
        console.log(`\n📰 Fetching latest posts for category: ${category}`);

        const newsnaija_link = `https://www.naijanews.com/${category}/`;
        const content_links = await scrapeRecentPosts(newsnaija_link);

        if (!content_links || content_links.length === 0) {
          console.log(`⚠️ No links found for category: ${category}`);
          continue;
        }

        console.log(`🔎 Found ${content_links.length} raw links for ${category}`);

        // Filter out links already in the database
        const { data: existing } = await supabase
          .from("articles")
          .select("source_url")
          .in("source_url", content_links);

        const existingUrls = new Set((existing || []).map((r) => r.source_url));
        const newLinks = content_links.filter((link) => !existingUrls.has(link));

        if (newLinks.length === 0) {
          console.log(`✅ No new links to process for ${category}`);
          continue;
        }

        console.log(`🆕 ${newLinks.length} new link(s) to process for ${category}`);

        for (const current_link of newLinks) {
          try {
            totalProcessed++;
            console.log(`\n🔗 Scraping post: ${current_link}`);

            const blog_content = await extractPostContent(current_link);
            if (!blog_content?.content || blog_content.content === "Content not found") {
              console.warn(`⚠️ No content extracted from: ${current_link}`);
              continue;
            }

            const agent_data = {
              title: blog_content.title,
              blog_post: blog_content.content,
            };

            // AI Rewrite
            const rewritten = await NaijaNewsRewrite(JSON.stringify(agent_data));
            if (!rewritten?.answer) {
              console.warn(`⚠️ No rewrite data returned for: ${current_link}`);
              continue;
            }

            const parsed = safeParseYAML(rewritten.answer);
            if (!parsed) {
              console.error(`❌ Failed to parse YAML for: ${current_link}`);
              continue;
            }

            parsed.category = category;
            parsed.featured_image = blog_content.image;

            // Post to WordPress
            const post_result = await POSTTOWORDPRESS(parsed);

            if (post_result?.success) {
              totalPublished++;

              // Save article to Supabase
              const article = {
                source_url: current_link,
                source_name: "NaijaNews",
                category,
                original_title: blog_content.title,
                original_content: blog_content.content,
                original_summary: parsed.summary || null,
                original_image_url: blog_content.image || null,
                rewritten_title: parsed.title,
                rewritten_content: parsed.content,
                rewritten_summary: parsed.summary || null,
                focus_keyphrase: parsed.focus_keyphrase || null,
                meta_description: parsed.meta_description || null,
                tags: Array.isArray(parsed.tags) ? parsed.tags : [],
                status: "published",
                wp_post_id: post_result.data?.id || null,
                wp_post_url: post_result.data?.link || null,
                wp_post_featured_image: post_result.featured_image_url || null,
                published_at: new Date().toISOString(),
                scrape_metadata: {
                  keywords: parsed.keywords || [],
                  scrapedAt: new Date().toISOString(),
                },
              };

              const { error: insertError } = await supabase
                .from("articles")
                .insert(article);

              if (insertError) {
                console.error(`❌ Failed to save article to Supabase: ${insertError.message}`);
              } else {
                console.log(`✅ NEW ARTICLE SAVED at ${new Date().toTimeString()}`);
              }
            } else {
              console.error(`❌ Failed to publish to WordPress: ${current_link}`);
              totalErrors++;

              // Save failed article for tracking
              await supabase.from("articles").insert({
                source_url: current_link,
                source_name: "NaijaNews",
                category,
                original_title: blog_content.title,
                original_content: blog_content.content,
                original_image_url: blog_content.image || null,
                status: "failed",
                last_error: "WordPress publish failed",
                scrape_metadata: { scrapedAt: new Date().toISOString() },
              });
            }
          } catch (innerErr) {
            totalErrors++;
            console.error(`❌ Error processing article ${current_link}:`, innerErr.message);
          }
        }
      } catch (err) {
        totalErrors++;
        console.error(`❌ Error processing category ${category}:`, err.message);
      }
    }

    // Log job completion
    await supabase.from("job_logs").insert({
      job_name: "naijanews-action",
      status: "completed",
      result: { totalProcessed, totalPublished, totalErrors },
    });

    console.log(`\n🎯 === NaijaNews Job Complete ===`);
    console.log(`   Processed: ${totalProcessed} | Published: ${totalPublished} | Errors: ${totalErrors}`);

    return { success: true, totalProcessed, totalPublished, totalErrors };
  },
});
