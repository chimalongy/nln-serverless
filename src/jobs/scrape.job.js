import { schedules } from "@trigger.dev/sdk";
import { config } from "../config/index.js";
import { getSupabase } from "../db/supabase.js";
import { ScraperService } from "../services/scraper.js";
import { DeduplicatorService } from "../services/deduplicator.js";
import { logger } from "../utils/logger.js";
import { ARTICLE_STATUS } from "../utils/constants.js";
import { generateHash } from "../utils/helpers.js";
import { logJobError } from "../services/errorLogger.js";

/**
 * Scrape Job
 * Scheduled task that scrapes Nigerian news sources and stores articles in Supabase
 * Trigger: Cron schedule (default: every 30 minutes)
 */
export const scrapeJob = schedules.task({
  id: "scrape-articles",
  description: "Scrape Nigerian news sources and store raw articles",
  cron: "*/30 * * * *",
  machine: "micro",
  run: async (payload) => {
    const supabase = getSupabase();
    const scraper = new ScraperService();
    const deduplicator = new DeduplicatorService();
    const maxArticles = config.scraping.maxArticlesPerScrape;

    logger.info("=== SCRAPE JOB STARTED ===", {
      timestamp: new Date().toISOString(),
      maxArticlesPerSource: maxArticles,
    });

    let totalScraped = 0;
    let totalStored = 0;
    let totalDuplicates = 0;
    let totalErrors = 0;

    const articles = await scraper.scrapeAllSources(maxArticles);

    for (const article of articles) {
      try {
        const { data: existing } = await supabase
          .from("articles")
          .select("id")
          .eq("source_url", article.url)
          .limit(1);

        if (existing && existing.length > 0) {
          totalDuplicates++;
          logger.info("Article already exists, skipping", { url: article.url });
          continue;
        }

        const dupCheck = await deduplicator.checkDuplicate({
          url: article.url,
          title: article.title,
          content: article.content,
        });

        if (dupCheck.isDuplicate) {
          totalDuplicates++;
          const { error: insertError } = await supabase
            .from("articles")
            .insert({
              source_url: article.url,
              source_name: article.sourceName,
              category: article.category,
              original_title: article.title,
              original_content: article.content,
              original_summary: article.summary,
              original_image_url: article.imageUrl,
              status: ARTICLE_STATUS.DUPLICATE,
              last_error: `Duplicate: ${dupCheck.reason}`,
              scrape_metadata: {
                publishedDate: article.publishedDate,
                scrapedAt: new Date().toISOString(),
              },
            })
            .select()
            .single();

          if (insertError) {
            logger.error("Failed to store duplicate article", { error: insertError.message });
            await logJobError("scrape-articles", insertError, {
              url: article.url,
              sourceName: article.sourceName,
              phase: "store-duplicate",
            });
            totalErrors++;
          }
          continue;
        }

        const { data: inserted, error: insertError } = await supabase
          .from("articles")
          .insert({
            source_url: article.url,
            source_name: article.sourceName,
            category: article.category,
            original_title: article.title,
            original_content: article.content,
            original_summary: article.summary,
            original_image_url: article.imageUrl,
            status: ARTICLE_STATUS.SCRAPED,
            scrape_metadata: {
              publishedDate: article.publishedDate,
              scrapedAt: new Date().toISOString(),
            },
          })
          .select()
          .single();

        if (insertError) {
          logger.error("Failed to store article", { url: article.url, error: insertError.message });
          await logJobError("scrape-articles", insertError, {
            url: article.url,
            sourceName: article.sourceName,
            phase: "store-article",
          });
          totalErrors++;
          continue;
        }

        await deduplicator.storeHashes(inserted.id, article.url, article.title, article.content);
        totalStored++;
      } catch (error) {
        logger.error("Article processing error", { url: article.url, error: error.message });
        await logJobError("scrape-articles", error, {
          url: article.url,
          sourceName: article.sourceName,
          phase: "article-processing",
        });
        totalErrors++;
      }
    }

    totalScraped = articles.length;

    await supabase.from("job_logs").insert({
      job_name: "scrape-articles",
      status: "completed",
      result: { totalScraped, totalStored, totalDuplicates, totalErrors },
    });

    logger.info("=== SCRAPE JOB COMPLETE ===", { totalScraped, totalStored, totalDuplicates, totalErrors });

    return { success: true, totalScraped, totalStored, totalDuplicates, totalErrors };
  },
});
