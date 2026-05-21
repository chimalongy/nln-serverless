'use server';

import { revalidatePath } from 'next/cache';
import { tasks, runs, configure } from '@trigger.dev/sdk/v3';
import { supabase } from '@/lib/supabase';

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
 * Trigger the news jobs manually.
 * Uses the Trigger.dev SDK to trigger both jobs.
 */
export async function triggerScrapeJob() {
  try {
    ensureTriggerConfig();

    const [naijanews, gistreel] = await Promise.all([
      tasks.trigger('naijanews-action', { manual: true, timestamp: new Date().toISOString() }),
      tasks.trigger('gistreel-action', { manual: true, timestamp: new Date().toISOString() }),
    ]);

    revalidatePath('/');
    return { success: true, runId: `${naijanews.id}, ${gistreel.id}` };
  } catch (error) {
    console.error('Error triggering news jobs:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Trigger the news jobs manually (alias for legacy compatibility).
 */
export async function triggerRewriteJob() {
  return triggerScrapeJob();
}

/**
 * Trigger the news jobs manually (alias for legacy compatibility).
 */
export async function triggerPublishJob() {
  return triggerScrapeJob();
}

/**
 * Trigger all pipeline jobs manually.
 * Also resumes/unpauses all future scheduled runs.
 */
export async function triggerAllJobs() {
  try {
    ensureTriggerConfig();

    // Resume schedules by setting schedules_paused to false
    await supabase
      .from('wp_sync_state')
      .upsert({
        id: '00000000-0000-0000-0000-000000000000',
        sync_config: { schedules_paused: false }
      });

    const timestamp = new Date().toISOString();

    const [naijanews, gistreel] = await Promise.all([
      tasks.trigger('naijanews-action', { manual: true, timestamp }),
      tasks.trigger('gistreel-action', { manual: true, timestamp }),
    ]);

    revalidatePath('/');
    return { 
      success: true, 
      runs: {
        naijanews: naijanews.id,
        gistreel: gistreel.id,
      }
    };
  } catch (error) {
    console.error('Error triggering all jobs:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Stop all currently running/queued jobs.
 * Also pauses all future scheduled runs.
 */
export async function stopAllJobs() {
  try {
    ensureTriggerConfig();

    // Pause schedules by setting schedules_paused to true
    await supabase
      .from('wp_sync_state')
      .upsert({
        id: '00000000-0000-0000-0000-000000000000',
        sync_config: { schedules_paused: true }
      });

    let cancelledCount = 0;
    const activeStatuses = ['QUEUED', 'DEQUEUED', 'EXECUTING', 'WAITING', 'DELAYED', 'PENDING_VERSION'];

    // List all active runs
    for await (const run of runs.list({
      status: activeStatuses,
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
