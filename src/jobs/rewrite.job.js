import { schedules } from "@trigger.dev/sdk";
import { config } from "../config/index.js";
import { getSupabase } from "../db/supabase.js";
import { RewriterService } from "../services/rewriter.js";
import { logger } from "../utils/logger.js";
import { ARTICLE_STATUS } from "../utils/constants.js";
import { logJobError } from "../services/errorLogger.js";

/**
 * Rewrite Job
 * Scheduled task that fetches scraped articles and rewrites them using AI
 * Trigger: Cron schedule (default: every 2 hours)
 */
export const rewriteJob = schedules.task({
  id: "rewrite-articles",
  description: "Rewrite scraped Nigerian news articles using AI",
  cron: "0 */2 * * *",
  machine: "small-1x",
  run: async (payload) => {
    const supabase = getSupabase();
    const rewriter = new RewriterService();
    const batchSize = payload?.batchSize || 10;

    logger.info("=== REWRITE JOB STARTED ===", {
      timestamp: new Date().toISOString(),
      batchSize,
    });

    const { data: articles, error } = await supabase
      .from("articles")
      .select("*")
      .eq("status", ARTICLE_STATUS.SCRAPED)
      .lt("rewrite_attempts", config.system.maxRetries)
      .order("created_at", { ascending: true })
      .limit(batchSize);

    if (error) {
      logger.error("Failed to fetch articles for rewriting", { error: error.message });
      await logJobError("rewrite-articles", error, { phase: "fetch-articles", severity: "critical" });
      throw error;
    }

    if (!articles || articles.length === 0) {
      logger.info("No articles to rewrite");
      await supabase.from("job_logs").insert({
        job_name: "rewrite-articles",
        status: "completed",
        result: { processed: 0, message: "No articles to rewrite" },
      });
      return { success: true, processed: 0, failed: 0 };
    }

    let processed = 0;
    let failed = 0;

    for (const article of articles) {
      try {
        await supabase
          .from("articles")
          .update({
            status: ARTICLE_STATUS.REWRITING,
            rewrite_attempts: article.rewrite_attempts + 1,
            updated_at: new Date().toISOString(),
          })
          .eq("id", article.id);

        logger.info("Rewriting article", {
          articleId: article.id,
          title: article.original_title,
          attempt: article.rewrite_attempts + 1,
        });

        const rewritten = await rewriter.rewrite(article);

        const { error: updateError } = await supabase
          .from("articles")
          .update({
            rewritten_title: rewritten.title,
            rewritten_content: rewritten.content,
            rewritten_summary: rewritten.summary,
            status: ARTICLE_STATUS.REWRITTEN,
            updated_at: new Date().toISOString(),
          })
          .eq("id", article.id);

        if (updateError) {
          throw new Error(`Failed to update article: ${updateError.message}`);
        }

        processed++;
        logger.info("Article rewrite successful", { articleId: article.id, newTitle: rewritten.title });
      } catch (error) {
        failed++;
        logger.error("Article rewrite failed", {
          articleId: article.id,
          error: error.message,
          attempt: article.rewrite_attempts + 1,
        });

        await logJobError("rewrite-articles", error, {
          articleId: article.id,
          articleTitle: article.original_title,
          sourceName: article.source_name,
          attempt: article.rewrite_attempts + 1,
          phase: "ai-rewrite",
        });

        const newAttempts = article.rewrite_attempts + 1;
        const newStatus = newAttempts >= config.system.maxRetries ? ARTICLE_STATUS.FAILED : ARTICLE_STATUS.SCRAPED;

        await supabase
          .from("articles")
          .update({
            status: newStatus,
            rewrite_attempts: newAttempts,
            last_error: error.message,
            updated_at: new Date().toISOString(),
          })
          .eq("id", article.id);
      }
    }

    await supabase.from("job_logs").insert({
      job_name: "rewrite-articles",
      status: "completed",
      result: { processed, failed, total: articles.length },
    });

    logger.info("=== REWRITE JOB COMPLETE ===", { processed, failed, total: articles.length });

    return { success: true, processed, failed, total: articles.length };
  },
});
