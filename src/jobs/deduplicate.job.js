import { schedules } from "@trigger.dev/sdk";
import { getSupabase } from "../db/supabase.js";
import { DeduplicatorService } from "../services/deduplicator.js";
import { logger } from "../utils/logger.js";
import { config } from "../config/index.js";
import { logJobError } from "../services/errorLogger.js";

/**
 * Deduplication Job
 * Scheduled task that:
 * 1. Scans recent articles for duplicates
 * 2. Archives old failed/unpublished articles
 * 3. Cleans up old content hashes
 * Trigger: Cron schedule (default: daily at 2 AM)
 */
export const deduplicateJob = schedules.task({
  id: "deduplicate-articles",
  description: "Deduplicate articles and cleanup old records",
  cron: "0 2 * * *",
  machine: "micro",
  run: async (payload) => {
    const supabase = getSupabase();
    const deduplicator = new DeduplicatorService();

    logger.info("=== DEDUPLICATE JOB STARTED ===", {
      timestamp: new Date().toISOString(),
    });

    let duplicatesMarked = 0;
    let articlesArchived = 0;
    let hashesCleaned = 0;
    let errors = 0;

    try {
      logger.info("Step 1: Running deduplication batch");
      duplicatesMarked = await deduplicator.deduplicateBatch();
    } catch (error) {
      logger.error("Deduplication batch failed", { error: error.message });
      await logJobError("deduplicate-articles", error, { phase: "dedup-batch" });
      errors++;
    }

    try {
      logger.info("Step 2: Archiving old articles");
      articlesArchived = await deduplicator.archiveOldArticles();
    } catch (error) {
      logger.error("Archive old articles failed", { error: error.message });
      await logJobError("deduplicate-articles", error, { phase: "archive-old" });
      errors++;
    }

    try {
      logger.info("Step 3: Cleaning up old hashes");
      hashesCleaned = await deduplicator.cleanupOldHashes(30);
    } catch (error) {
      logger.error("Hash cleanup failed", { error: error.message });
      await logJobError("deduplicate-articles", error, { phase: "hash-cleanup" });
      errors++;
    }

    try {
      const { data: stats, error: statsError } = await supabase
        .from("articles")
        .select("status", { count: "exact" });

      if (!statsError && stats) {
        const statusCounts = {};
        for (const row of stats) {
          statusCounts[row.status] = (statusCounts[row.status] || 0) + 1;
        }
        logger.info("Article status summary", statusCounts);
      }
    } catch (error) {
      logger.error("Stats collection failed", { error: error.message });
    }

    await supabase.from("job_logs").insert({
      job_name: "deduplicate-articles",
      status: "completed",
      result: { duplicatesMarked, articlesArchived, hashesCleaned, errors },
    });

    logger.info("=== DEDUPLICATE JOB COMPLETE ===", { duplicatesMarked, articlesArchived, hashesCleaned, errors });

    return { success: true, duplicatesMarked, articlesArchived, hashesCleaned, errors };
  },
});
