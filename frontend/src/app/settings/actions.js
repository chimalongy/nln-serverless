'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@supabase/supabase-js';

function getAdminSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) throw new Error('Missing Supabase credentials');
  return createClient(url, key);
}

export async function clearFailedArticles() {
  try {
    const supabase = getAdminSupabase();

    const { data, error } = await supabase
      .from('articles')
      .delete()
      .eq('status', 'failed')
      .select('id');

    if (error) throw error;

    revalidatePath('/settings');
    revalidatePath('/');
    return { success: true, count: data?.length || 0 };
  } catch (error) {
    console.error('Failed to clear failed articles:', error);
    return { success: false, error: error.message };
  }
}

export async function archiveOldArticles() {
  try {
    const supabase = getAdminSupabase();

    const cutoff = new Date(Date.now() - 72 * 60 * 60 * 1000).toISOString();

    const { data, error } = await supabase
      .from('articles')
      .update({ status: 'archived' })
      .eq('status', 'scraped')
      .lt('created_at', cutoff)
      .select('id');

    if (error) throw error;

    revalidatePath('/settings');
    revalidatePath('/');
    return { success: true, count: data?.length || 0 };
  } catch (error) {
    console.error('Failed to archive old articles:', error);
    return { success: false, error: error.message };
  }
}

export async function purgeAllData() {
  try {
    const supabase = getAdminSupabase();

    // Delete in dependency order
    await supabase.from('content_hashes').delete().neq('id', '00000000-0000-0000-0000-000000000000');
    await supabase.from('error_logs').delete().neq('id', '00000000-0000-0000-0000-000000000000');
    await supabase.from('job_logs').delete().neq('id', '00000000-0000-0000-0000-000000000000');
    await supabase.from('articles').delete().neq('id', '00000000-0000-0000-0000-000000000000');

    revalidatePath('/settings');
    revalidatePath('/');
    revalidatePath('/articles');
    revalidatePath('/errors');
    return { success: true };
  } catch (error) {
    console.error('Failed to purge data:', error);
    return { success: false, error: error.message };
  }
}
