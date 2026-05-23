import { logger, task } from "@trigger.dev/sdk";
import { getSupabase } from "../db/supabase.js";
import { publishPost } from "../services/postToSocialMedia.js";



export const socialMediaPoster = task({
    id: "social-media-poster",
    description: "Post to social media",
    run: async (payload) => {
        const supabase = getSupabase();



        logger.info("Social Media Poster Job Started");

        if (!payload.article) {
            logger.error("No article found in payload");
            return { success: false, error: "No article found in payload" };
        }

        let article = payload.article;

        await publishPost(article)
    }

})
