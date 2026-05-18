import { schedules } from "@trigger.dev/sdk";
import { config } from "../config/index.js";
import { getSupabase } from "../db/supabase.js";
import { PublisherService } from "../services/publisher.js";
import { logger } from "../utils/logger.js";
import { ARTICLE_STATUS } from "../utils/constants.js";
import { logJobError } from "../services/errorLogger.js";

/**
 * Publish Job
 * Scheduled task that publishes rewritten articles to WordPress
 * Trigger: Cron schedule (default: every 3 hours)
 */
export const publishJob = schedules.task({
  id: "publish-articles",
  description: "Publish rewritten articles to WordPress",
  cron: "0 */3 * * *",
  machine: "small-1x",
  run: async (payload) => {
    const supabase = getSupabase();
    const publisher = new PublisherService();
    const batchSize = payload?.batchSize || 10;

    logger.info("=== PUBLISH JOB STARTED ===", {
      timestamp: new Date().toISOString(),
      batchSize,
    });

    const isHealthy = await publisher.healthCheck();
    if (!isHealthy) {
      logger.error("WordPress connection failed - aborting publish");
      const wpError = new Error("Cannot connect to WordPress");
      await logJobError("publish-articles", wpError, {
        phase: "health-check",
        severity: "critical",
        wpUrl: config.wordpress.baseUrl,
      });
      throw wpError;
    }

    const { data: articles, error } = await supabase
      .from("articles")
      .select("*")
      .eq("status", ARTICLE_STATUS.REWRITTEN)
      .lt("publish_attempts", config.system.maxRetries)
      .order("created_at", { ascending: true })
      .limit(batchSize);

    if (error) {
      logger.error("Failed to fetch articles for publishing", { error: error.message });
      await logJobError("publish-articles", error, { phase: "fetch-articles", severity: "critical" });
      throw error;
    }

    if (!articles || articles.length === 0) {
      logger.info("No articles to publish");
      await supabase.from("job_logs").insert({
        job_name: "publish-articles",
        status: "completed",
        result: { published: 0, failed: 0, message: "No articles to publish" },
      });
      return { success: true, published: 0, failed: 0 };
    }

    let published = 0;
    let failed = 0;

    for (const article of articles) {
      try {
        await supabase
          .from("articles")
          .update({
            status: ARTICLE_STATUS.PUBLISHING,
            publish_attempts: article.publish_attempts + 1,
            updated_at: new Date().toISOString(),
          })
          .eq("id", article.id);

        logger.info("Publishing article", {
          articleId: article.id,
          title: article.rewritten_title,
          attempt: article.publish_attempts + 1,
        });

        const result = await publisher.publish(article);

        const { error: updateError } = await supabase
          .from("articles")
          .update({
            status: ARTICLE_STATUS.PUBLISHED,
            wp_post_id: result.postId,
            wp_post_url: result.postUrl,
            published_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          })
          .eq("id", article.id);

        if (updateError) {
          throw new Error(`Failed to update article after publish: ${updateError.message}`);
        }

        published++;
        logger.info("Article published successfully", {
          articleId: article.id,
          postId: result.postId,
          postUrl: result.postUrl,
        });
      } catch (error) {
        failed++;
        logger.error("Article publish failed", {
          articleId: article.id,
          error: error.message,
          attempt: article.publish_attempts + 1,
        });

        await logJobError("publish-articles", error, {
          articleId: article.id,
          articleTitle: article.rewritten_title,
          sourceName: article.source_name,
          attempt: article.publish_attempts + 1,
          phase: "wordpress-publish",
        });

        const newAttempts = article.publish_attempts + 1;
        const newStatus = newAttempts >= config.system.maxRetries ? ARTICLE_STATUS.FAILED : ARTICLE_STATUS.REWRITTEN;

        await supabase
          .from("articles")
          .update({
            status: newStatus,
            publish_attempts: newAttempts,
            last_error: error.message,
            updated_at: new Date().toISOString(),
          })
          .eq("id", article.id);
      }
    }

    await supabase.from("job_logs").insert({
      job_name: "publish-articles",
      status: "completed",
      result: { published, failed, total: articles.length },
    });

    logger.info("=== PUBLISH JOB COMPLETE ===", { published, failed, total: articles.length });

    return { success: true, published, failed, total: articles.length };
  },
});
