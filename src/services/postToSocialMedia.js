import axios from "axios";
let posthive_api_key = "ph_live_708765b12051b0f0e6b8172dd9fe55e475e427e36b4297a8"




export async function publishPost(article) {

    let caption = `${article.rewritten_summary}...\n\n Read more ${article.wp_post_url}`
    try {
        const response = await axios.post('https://postershive.vercel.app/api/publish', {
            "platform": "facebook",
            "caption": caption,
            "mediaUrl": article.wp_post_featured_image
        }, {
            headers: {
                'Authorization': `Bearer ${posthive_api_key}`,
                'Content-Type': 'application/json'
            }
        });

        console.log('Success:', response.data);
    } catch (error) {
        console.error('Error:', error.response?.data || error.message);
    }
}

publishPost();