import { getSupabase } from "../db/supabase.js";

function buildSocialPostsUpdate(result) {
  const postedAt = new Date().toISOString();
  const updates = {};

  if (result.facebook?.success) {
    updates.facebook = {
      success: true,
      postId: result.facebook.postId,
      postedAt,
    };
  }

  if (result.instagram?.success) {
    updates.instagram = {
      success: true,
      postId: result.instagram.postId,
      postedAt,
    };
  }

  return updates;
}

export async function saveSocialPosts(article, result) {
  const updates = buildSocialPostsUpdate(result);

  if (Object.keys(updates).length === 0) {
    return null;
  }

  const supabase = getSupabase();
  let existingPosts = {};

  if (article.id) {
    const { data } = await supabase
      .from("articles")
      .select("social_posts")
      .eq("id", article.id)
      .single();

    existingPosts = data?.social_posts || {};
  } else if (article.source_url) {
    const { data } = await supabase
      .from("articles")
      .select("social_posts")
      .eq("source_url", article.source_url)
      .single();

    existingPosts = data?.social_posts || {};
  }

  const social_posts = { ...existingPosts, ...updates };

  let query = supabase.from("articles").update({ social_posts });

  if (article.id) {
    query = query.eq("id", article.id);
  } else if (article.source_url) {
    query = query.eq("source_url", article.source_url);
  } else {
    return null;
  }

  const { error } = await query;

  if (error) {
    throw new Error(`Failed to save social posts: ${error.message}`);
  }

  return social_posts;
}
