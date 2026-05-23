const fs = require('fs');
const path = require('path');
const axios = require('axios');
const FormData = require('form-data');

const WP_USERNAME = process.env.WP_USERNAME || 'chimalongy';
const WP_APP_PASSWORD = process.env.WP_APP_PASSWORD;
const BLOG_URL = process.env.WP_BASE_URL;

function getAuthHeader() {
  return 'Basic ' + Buffer.from(`${WP_USERNAME}:${WP_APP_PASSWORD}`).toString('base64');
}

/**
 * Upload an image from a URL to WordPress media library
 * Matches reference: uploadImageToWordPress in gistreelwordpressposter.js
 * @param {string} imageUrl
 * @param {string} altText
 * @returns {Promise<{id: number|null, url: string}>}
 */
async function uploadImageToWordPress(imageUrl, altText = '') {
  try {
    console.log(`🖼️ Downloading image: ${imageUrl}`);
    const response = await axios.get(imageUrl, {
      responseType: 'arraybuffer',
      timeout: 20000,
    });

    const fileName = path.basename(imageUrl.split('?')[0]) || 'image.jpg';
    const tempPath = path.join(process.cwd(), `tmp_${Date.now()}_${fileName}`);
    fs.writeFileSync(tempPath, response.data);

    const formData = new FormData();
    formData.append('file', fs.createReadStream(tempPath));
    if (altText) formData.append('alt_text', altText);

    const uploadRes = await axios.post(`${BLOG_URL}/wp-json/wp/v2/media`, formData, {
      headers: { Authorization: getAuthHeader(), ...formData.getHeaders() },
      maxContentLength: Infinity,
      maxBodyLength: Infinity,
      timeout: 30000,
    });

    fs.unlinkSync(tempPath);
    const newUrl = uploadRes.data.source_url;
    console.log(`✅ Uploaded to WordPress: ${newUrl}`);
    return { id: uploadRes.data.id, url: newUrl };
  } catch (err) {
    console.error(`❌ Failed uploading image: ${imageUrl}`, err.message);
    return { id: null, url: imageUrl };
  }
}

/**
 * Create or find a category by name on WordPress
 * @param {string} categoryName
 * @returns {Promise<number|null>}
 */
async function ensureCategory(categoryName) {
  if (!categoryName) return null;
  try {
    const catRes = await axios.get(
      `${BLOG_URL}/wp-json/wp/v2/categories?search=${encodeURIComponent(categoryName)}`,
      { headers: { Authorization: getAuthHeader() }, timeout: 15000 }
    );
    if (catRes.data.length > 0) return catRes.data[0].id;

    const newCat = await axios.post(
      `${BLOG_URL}/wp-json/wp/v2/categories`,
      { name: categoryName },
      { headers: { Authorization: getAuthHeader(), 'Content-Type': 'application/json' }, timeout: 15000 }
    );
    return newCat.data.id;
  } catch (err) {
    console.error(`❌ Category error for "${categoryName}":`, err.message);
    return null;
  }
}

/**
 * Create or find tags by name on WordPress
 * @param {string[]} tagNames
 * @returns {Promise<number[]>}
 */
async function ensureTags(tagNames) {
  if (!Array.isArray(tagNames) || tagNames.length === 0) return [];
  const tagIds = [];

  for (const tagName of tagNames) {
    try {
      const tagRes = await axios.get(
        `${BLOG_URL}/wp-json/wp/v2/tags?search=${encodeURIComponent(tagName)}`,
        { headers: { Authorization: getAuthHeader() }, timeout: 15000 }
      );
      if (tagRes.data.length > 0) {
        tagIds.push(tagRes.data[0].id);
      } else {
        const newTag = await axios.post(
          `${BLOG_URL}/wp-json/wp/v2/tags`,
          { name: tagName },
          { headers: { Authorization: getAuthHeader(), 'Content-Type': 'application/json' }, timeout: 15000 }
        );
        tagIds.push(newTag.data.id);
      }
    } catch (err) {
      console.warn(`⚠️ Tag error for "${tagName}":`, err.message);
    }
  }
  return tagIds;
}

/**
 * Post a NaijaNews rewritten article to WordPress.
 * Matches reference: WORPRESSPOSTER/wordpressposter.js -> POSTTOWORDPRESS
 * @param {Object} data - Parsed YAML result from NaijaNewsRewrite
 * @returns {Promise<{success: boolean, data: Object|null}>}
 */
async function POSTTOWORDPRESS(data) {
  console.log('📤 Posting NaijaNews article to WordPress...');

  try {
    // 1️⃣ Download and upload featured image
    console.log('🖼️ Downloading featured image...');
    const imageResult = await uploadImageToWordPress(data.featured_image, data.title);
    const featuredMediaId = imageResult.id;

    // 2️⃣ Handle category
    const categoryId = await ensureCategory(data.category);

    // 3️⃣ Handle tags
    const tagIds = await ensureTags(Array.isArray(data.tags) ? data.tags : []);

    // 4️⃣ Build SEO fields
    const focusKeyword = Array.isArray(data.keywords) ? data.keywords[0] : data.keywords || '';
    const seoDescription = data.summary || '';
    const seoTitle = data.seo_title || data.title || '';

    // 5️⃣ Create post
    console.log('📝 Creating post...');
    const postPayload = {
      title: data.title,
      content: data.content,
      status: 'publish',
      featured_media: featuredMediaId,
      categories: categoryId ? [categoryId] : [],
      tags: tagIds,
      meta: {
        // Rank Math
        _rank_math_focus_keyword: data.focus_keyphrase,
        _rank_math_description: data.meta_description,
        _rank_math_title: seoTitle,
        // Yoast SEO
        _yoast_wpseo_focuskw: data.focus_keyphrase,
        _yoast_wpseo_metadesc: data.meta_description,
        _yoast_wpseo_title: seoTitle,
      },
    };

    const postResponse = await axios.post(
      `${BLOG_URL}/wp-json/wp/v2/posts`,
      postPayload,
      {
        headers: {
          Authorization: getAuthHeader(),
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        timeout: 30000,
      }
    );

    console.log('✅ Post published successfully:', postResponse.data.link);
    return { success: true, data: postResponse.data, featured_image_url: imageResult.url || null };
  } catch (error) {
    if (error.response) {
      console.error('❌ WordPress API error:', error.response.data);
    } else {
      console.error('❌ Error from WordPress poster:', error.message);
    }
    return { success: false, data: null };
  }
}

/**
 * Post a GistReel article (with inline image rehosting) to WordPress.
 * Matches reference: WORPRESSPOSTER/gistreelwordpressposter.js -> POSTGISTREELTOWORDPRESS
 * @param {Object} data - Parsed YAML result from GetGistReelWPConent
 * @returns {Promise<{success: boolean, data: Object|null}>}
 */
async function POSTGISTREELTOWORDPRESS(data) {
  console.log('📤 Posting GistReel article to WordPress...');

  try {
    // 1️⃣ Upload featured image
    let featuredMediaId = null;
    if (data.featured_image) {
      const uploaded = await uploadImageToWordPress(data.featured_image, data.title);
      featuredMediaId = uploaded.id;
      data.featured_image = uploaded.url;
    }

    // 2️⃣ Upload inline images and replace URLs in content
    let content = data.content;
    const imageUrls = [...content.matchAll(/<img[^>]*src="([^"]+)"/g)].map((m) => m[1]);

    if (imageUrls.length > 0) {
      console.log(`🧩 Found ${imageUrls.length} inline images`);
      for (const oldUrl of imageUrls) {
        const uploaded = await uploadImageToWordPress(oldUrl, data.title);
        content = content.replaceAll(oldUrl, uploaded.url);
      }
    }

    // 3️⃣ Create / find category
    const categoryId = await ensureCategory(data.category);

    // 4️⃣ Tags
    const tagIds = await ensureTags(Array.isArray(data.tags) ? data.tags : []);

    // 5️⃣ Publish Post
    const payload = {
      title: data.title,
      content,
      status: 'publish',
      featured_media: featuredMediaId,
      categories: categoryId ? [categoryId] : [],
      tags: tagIds,
      meta: {
        _rank_math_focus_keyword: data.focus_keyphrase,
        _rank_math_description: data.meta_description,
        _rank_math_title: data.title || '',
        _yoast_wpseo_focuskw: data.focus_keyphrase,
        _yoast_wpseo_metadesc: data.meta_description,
        _yoast_wpseo_title: data.title,
      },
    };

    const postRes = await axios.post(`${BLOG_URL}/wp-json/wp/v2/posts`, payload, {
      headers: {
        Authorization: getAuthHeader(),
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      timeout: 30000,
    });

    console.log(`✅ Published: ${postRes.data.link}`);
    return { success: true, data: postRes.data, featured_image_url: data.featured_image || null };
  } catch (err) {
    if (err.response) {
      console.error('❌ WordPress API error:', err.response.data);
    } else {
      console.error('❌ Post error:', err.message);
    }
    return { success: false, data: null };
  }
}

module.exports = {
  POSTTOWORDPRESS,
  POSTGISTREELTOWORDPRESS,
};
