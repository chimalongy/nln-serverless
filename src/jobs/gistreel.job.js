import { schedules, tasks } from "@trigger.dev/sdk";
import { getSupabase } from "../db/supabase.js";
import {
  scrapeGistReelRecentPostsGrid,
  scrapeGistReelRecentPostsList,
  extractPostContentHtml,
} from "../services/gistReelScraper.js";
import { GetGistReelWPConent } from "../services/aiRewriter.js";
import { POSTGISTREELTOWORDPRESS } from "../services/wpPublisher.js";
import { safeParseYAML } from "../utils/yaml.js";

/**
 * GistReel Job
 * Scheduled Trigger.dev task replicating GistReelAction from the reference server.
 * Pipeline: Scrape → Filter new links → Extract HTML → AI Rewrite → Post to WordPress (with inline image rehosting) → Save to Supabase
 */
export const gistReelJob = schedules.task({
  id: "gistreel-action",
  description: "Scrape GistReel, rewrite with AI, and publish to WordPress",
  cron: process.env.GISTREEL_SCHEDULE || "*/15 * * * *",
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

    const gistreel_categories = [
      { category_name: "viral-news", category_type: "grid" },
      { category_name: "politics", category_type: "list" },
      { category_name: "entertainment-news", category_type: "list" },
    ];

    console.log("🎬 === GistReel Job Started ===");
    console.log(`🕐 Timestamp: ${new Date().toISOString()}`);

    let totalProcessed = 0;
    let totalPublished = 0;
    let totalErrors = 0;

    for (const gistreel_category of gistreel_categories) {
      try {
        // Normalize category name
        let category = "general";
        switch (gistreel_category.category_name) {
          case "viral-news":
            category = "viral";
            break;
          case "politics":
            category = "politics";
            break;
          case "entertainment-news":
            category = "entertainment";
            break;
        }

        const category_link = `https://www.gistreel.com/${gistreel_category.category_name}/`;
        console.log(`\n🔍 Scraping category: ${category} (${category_link})`);

        // Scrape based on layout type
        let links =
          gistreel_category.category_type === "list"
            ? await scrapeGistReelRecentPostsList(category_link)
            : await scrapeGistReelRecentPostsGrid(category_link);

        if (!Array.isArray(links) || links.length === 0) {
          console.warn(`⚠️ No links found for ${category}`);
          continue;
        }

        console.log(`🔎 Found ${links.length} raw links for ${category}`);

        // Filter out links already in the database
        const { data: existing } = await supabase
          .from("articles")
          .select("source_url")
          .in("source_url", links);

        const existingUrls = new Set((existing || []).map((r) => r.source_url));
        const newLinks = links.filter((link) => !existingUrls.has(link));

        if (newLinks.length === 0) {
          console.log(`✅ No new links to process for ${category}`);
          continue;
        }

        console.log(`🆕 ${newLinks.length} new link(s) to process for ${category}`);

        for (const current_link of newLinks) {
          try {
            totalProcessed++;
            console.log(`\n➡️ Processing: ${current_link}`);

            // Extract raw HTML from the post
            const html = await extractPostContentHtml(current_link);
            if (!html) {
              console.warn(`⚠️ Failed to extract HTML for: ${current_link}`);
              continue;
            }

            // AI Rewrite
            const wordpressdata = await GetGistReelWPConent(html, category);
            if (!wordpressdata?.answer) {
              console.warn(`⚠️ No rewrite data returned for: ${current_link}`);
              continue;
            }

            const parsedresult = safeParseYAML(wordpressdata.answer);
            if (!parsedresult) {
              console.error(`❌ Failed to parse YAML for: ${current_link}`);
              continue;
            }

            // Post to WordPress (includes inline image reuploading)
            const wordpressresult = await POSTGISTREELTOWORDPRESS(parsedresult);
            if (!wordpressresult?.data) {
              console.error(`❌ Failed to publish to WordPress for: ${current_link}`);
              totalErrors++;

              // Save failed article for tracking
              await supabase.from("articles").insert({
                source_url: current_link,
                source_name: "GistReel",
                category,
                original_title: parsedresult.original_title || "",
                original_content: html,
                status: "failed",
                last_error: "WordPress publish failed",
                scrape_metadata: { scrapedAt: new Date().toISOString() },
              });
              continue;
            }

            totalPublished++;

            // Save article to Supabase
            const article = {
              source_url: current_link,
              source_name: "GistReel",
              category,
              original_title: parsedresult.original_title || "",
              original_content: html,
              original_image_url: parsedresult.featured_image || "",
              rewritten_title: parsedresult.title || "",
              rewritten_content: parsedresult.content || "",
              rewritten_summary: parsedresult.summary || null,
              focus_keyphrase: parsedresult.focus_keyphrase || null,
              meta_description: parsedresult.meta_description || null,
              tags: Array.isArray(parsedresult.tags) ? parsedresult.tags : [],
              status: "published",
              wp_post_id: wordpressresult.data?.id || null,
              wp_post_url: wordpressresult.data?.link || null,
              wp_post_featured_image: wordpressresult.featured_image_url || null,
              published_at: new Date().toISOString(),
              scrape_metadata: {
                keywords: parsedresult.keywords || [],
                scrapedAt: new Date().toISOString(),
              },
            };

            const { data: savedArticle, error: insertError } = await supabase
              .from("articles")
              .insert(article)
              .select("id")
              .single();

            if (insertError) {
              console.error(`❌ Failed to save article to Supabase: ${insertError.message}`);
            } else {
              console.log(`✅ NEW ARTICLE SAVED at ${new Date().toLocaleTimeString()}`);
              try {
                await tasks.trigger("social-media-poster", {
                  article,
                  articleId: savedArticle.id,
                });
                console.log("📢 Triggered social-media-poster task successfully");
              } catch (triggerErr) {
                console.error("❌ Failed to trigger social-media-poster task:", triggerErr.message);
              }
            }
          } catch (innerErr) {
            totalErrors++;
            console.error(`❌ Error processing article ${current_link}:`, innerErr.message);
          }
        }

        console.log(`✅ Finished processing ${category} (${newLinks.length} new post(s))`);
      } catch (err) {
        totalErrors++;
        console.error(`❌ Error processing category ${gistreel_category.category_name}:`, err.message);
      }
    }

    // Log job completion
    await supabase.from("job_logs").insert({
      job_name: "gistreel-action",
      status: "completed",
      result: { totalProcessed, totalPublished, totalErrors },
    });

    console.log(`\n🎯 === GistReel Job Complete ===`);
    console.log(`   Processed: ${totalProcessed} | Published: ${totalPublished} | Errors: ${totalErrors}`);

    return { success: true, totalProcessed, totalPublished, totalErrors };
  },
});
