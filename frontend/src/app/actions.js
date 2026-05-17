'use server';

import { revalidatePath } from 'next/cache';
import { tasks, runs, configure } from '@trigger.dev/sdk/v3';

/**
 * Configure Trigger.dev SDK with the API key.
 * The SDK looks for TRIGGER_SECRET_KEY by default,
 * but we also support TRIGGER_API_KEY as a fallback.
 */
function ensureTriggerConfig() {
  const secretKey = process.env.TRIGGER_SECRET_KEY || process.env.TRIGGER_API_KEY;
  if (!secretKey) {
    throw new Error('Missing TRIGGER_SECRET_KEY or TRIGGER_API_KEY environment variable');
  }
  configure({ secretKey });
}

/**
 * Trigger the scrape-articles task manually.
 * Uses the Trigger.dev v4 SDK to trigger the task by its ID.
 */
export async function triggerScrapeJob() {
  try {
    ensureTriggerConfig();

    const handle = await tasks.trigger('scrape-articles', {
      manual: true,
      timestamp: new Date().toISOString(),
    });

    revalidatePath('/');
    return { success: true, runId: handle.id };
  } catch (error) {
    console.error('Error triggering scrape job:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Trigger the rewrite-articles task manually.
 */
export async function triggerRewriteJob() {
  try {
    ensureTriggerConfig();

    const handle = await tasks.trigger('rewrite-articles', {
      manual: true,
      timestamp: new Date().toISOString(),
    });

    revalidatePath('/');
    return { success: true, runId: handle.id };
  } catch (error) {
    console.error('Error triggering rewrite job:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Trigger the publish-articles task manually.
 */
export async function triggerPublishJob() {
  try {
    ensureTriggerConfig();

    const handle = await tasks.trigger('publish-articles', {
      manual: true,
      timestamp: new Date().toISOString(),
    });

    revalidatePath('/');
    return { success: true, runId: handle.id };
  } catch (error) {
    console.error('Error triggering publish job:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Stop all currently running/queued jobs.
 * Lists all active runs and cancels each one.
 */
export async function stopAllJobs() {
  try {
    ensureTriggerConfig();

    let cancelledCount = 0;

    // List all active runs (queued, executing, waiting)
    for await (const run of runs.list({
      filter: {
        status: ['QUEUED', 'DEQUEUED', 'EXECUTING', 'WAITING'],
      },
    })) {
      try {
        await runs.cancel(run.id);
        cancelledCount++;
      } catch (cancelError) {
        console.error(`Failed to cancel run ${run.id}:`, cancelError.message);
      }
    }

    revalidatePath('/');
    return { success: true, cancelled: cancelledCount };
  } catch (error) {
    console.error('Error stopping jobs:', error);
    return { success: false, error: error.message };
  }
}
