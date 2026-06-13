import axios from "axios";

const DEFAULT_POSTHIVE_API_URL = "https://postershive.vercel.app/api/publish";
const FACEBOOK_TIMEOUT_MS = 30_000;
const INSTAGRAM_PHOTO_TIMEOUT_MS = 60_000;
const INSTAGRAM_VIDEO_TIMEOUT_MS = 130_000;

function getPosthiveConfig() {
  return {
    apiKey: process.env.POSTHIVE_API_KEY,
    apiUrl: process.env.POSTHIVE_API_URL || DEFAULT_POSTHIVE_API_URL,
  };
}

function buildCaption(article) {
  const summary = article.rewritten_summary?.trim();
  const title = (article.rewritten_title || article.original_title)?.trim();
  const url = article.wp_post_url?.trim();

  let caption = summary || title || "";

  if (url) {
    caption = caption ? `${caption}\n\nRead more: ${url}` : url;
  }

  return caption || "New article published";
}

function resolveMediaUrl(article) {
  const candidates = [article.wp_post_featured_image, article.original_image_url];

  for (const url of candidates) {
    if (typeof url === "string" && /^https?:\/\//i.test(url.trim())) {
      return url.trim();
    }
  }

  return null;
}

function isVideoUrl(url) {
  return /\.(mp4|mov)(\?.*)?$/i.test(url);
}

function getRequestTimeout(platform, mediaUrl) {
  if (platform === "instagram" && mediaUrl && isVideoUrl(mediaUrl)) {
    return INSTAGRAM_VIDEO_TIMEOUT_MS;
  }

  if (platform === "instagram") {
    return INSTAGRAM_PHOTO_TIMEOUT_MS;
  }

  return FACEBOOK_TIMEOUT_MS;
}

function parseApiError(error) {
  return (
    error.response?.data?.error ||
    error.response?.data?.message ||
    (typeof error.response?.data === "string" ? error.response.data : null) ||
    error.message
  );
}

/**
 * Publish to a single platform via PostersHive API.
 *
 * Facebook  — text-only OK: { platform, caption }
 *             photo:         { platform, caption, mediaUrl }
 *
 * Instagram — media required: { platform, caption, mediaUrl }
 *             videos may take up to ~2 minutes (server polls container status)
 */
async function publishToPlatform(platform, caption, mediaUrl) {
  const { apiKey, apiUrl } = getPosthiveConfig();

  if (!apiKey) {
    throw new Error("POSTHIVE_API_KEY is not set in environment variables");
  }

  if (!apiUrl) {
    throw new Error("POSTHIVE_API_URL is not set in environment variables");
  }

  if (platform === "instagram" && !mediaUrl) {
    return {
      success: false,
      skipped: true,
      platform: "instagram",
      postId: null,
      error: "Instagram requires mediaUrl",
    };
  }

  const payload = {
    platform,
    caption,
  };

  if (mediaUrl) {
    payload.mediaUrl = mediaUrl;
  }

  const response = await axios.post(apiUrl, payload, {
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    timeout: getRequestTimeout(platform, mediaUrl),
  });

  const result = response.data;

  if (!result?.success) {
    throw new Error(result?.error || `PostersHive ${platform} publish failed`);
  }

  return {
    success: true,
    skipped: false,
    postId: result.postId ?? null,
    error: result.error ?? null,
    platform: result.platform ?? platform,
  };
}

/**
 * Publish an article to Facebook and Instagram via PostersHive.
 *
 * @returns {Promise<{ success: boolean, facebook: object, instagram: object, errors: object[] }>}
 */
export async function publishPost(article) {
  const caption = buildCaption(article);
  const mediaUrl = resolveMediaUrl(article);
  const errors = [];
  let facebook = null;
  let instagram = null;

  try {
    facebook = await publishToPlatform("facebook", caption, mediaUrl);
    console.log("PostersHive Facebook success:", {
      postId: facebook.postId,
      hasMedia: Boolean(mediaUrl),
    });
  } catch (error) {
    const message = parseApiError(error);
    console.error("PostersHive Facebook error:", error.response?.data || message);
    errors.push({ platform: "facebook", error: message });
  }

  if (!mediaUrl) {
    instagram = {
      success: false,
      skipped: true,
      platform: "instagram",
      postId: null,
      error: "Instagram requires mediaUrl — skipped",
    };
    console.warn("PostersHive Instagram skipped: no mediaUrl available");
  } else {
    try {
      instagram = await publishToPlatform("instagram", caption, mediaUrl);
      console.log("PostersHive Instagram success:", {
        postId: instagram.postId,
        isVideo: isVideoUrl(mediaUrl),
      });
    } catch (error) {
      const message = parseApiError(error);
      console.error("PostersHive Instagram error:", error.response?.data || message);
      errors.push({ platform: "instagram", error: message });
    }
  }

  const facebookOk = facebook?.success === true;
  const instagramOk = instagram?.success === true;
  const instagramSkipped = instagram?.skipped === true;

  if (!facebookOk && !instagramOk && !instagramSkipped) {
    throw new Error(
      errors.map((entry) => `${entry.platform}: ${entry.error}`).join("; ") ||
        "All social posts failed"
    );
  }

  if (!facebookOk && !instagramOk && instagramSkipped) {
    throw new Error(
      errors.map((entry) => `${entry.platform}: ${entry.error}`).join("; ") ||
        "Facebook post failed and Instagram was skipped (no media)"
    );
  }

  return {
    success: facebookOk || instagramOk,
    facebook,
    instagram,
    errors,
  };
}
