import { logger, task } from "@trigger.dev/sdk";
import { publishPost } from "../services/postToSocialMedia.js";
import { saveSocialPosts } from "../services/socialPostsRepository.js";

export const socialMediaPoster = task({
  id: "social-media-poster",
  description: "Post to Facebook and Instagram via PostersHive",
  run: async (payload) => {
    logger.info("Social Media Poster Job Started");

    if (!payload?.article) {
      logger.error("No article found in payload");
      return { success: false, error: "No article found in payload" };
    }

    const { article, articleId } = payload;
    const articleRecord = articleId ? { ...article, id: articleId } : article;

    try {
      const result = await publishPost(article);

      if (result.facebook?.success) {
        logger.info("Posted to Facebook via PostersHive", {
          postId: result.facebook.postId,
          wpPostUrl: article.wp_post_url,
        });
      }

      if (result.instagram?.success) {
        logger.info("Posted to Instagram via PostersHive", {
          postId: result.instagram.postId,
          wpPostUrl: article.wp_post_url,
        });
      }

      if (result.instagram?.skipped) {
        logger.warn("Instagram post skipped", {
          reason: result.instagram.error,
          wpPostUrl: article.wp_post_url,
        });
      }

      for (const entry of result.errors) {
        logger.error(`Failed to post to ${entry.platform}`, {
          error: entry.error,
          wpPostUrl: article.wp_post_url,
        });
      }

      try {
        const social_posts = await saveSocialPosts(articleRecord, result);

        if (social_posts) {
          logger.info("Saved social post results to article", {
            articleId: articleRecord.id,
            platforms: Object.keys(social_posts),
          });
        }
      } catch (saveError) {
        logger.error("Failed to save social post results", {
          error: saveError.message,
          articleId: articleRecord.id,
        });
      }

      return result;
    } catch (error) {
      logger.error("Social media publish failed", {
        error: error.message,
        wpPostUrl: article.wp_post_url,
      });
      throw error;
    }
  },
});
