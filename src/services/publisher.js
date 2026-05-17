const axios = require('axios');
const { config } = require('../config');
const { logger } = require('../utils/logger');
const { retryWithBackoff, generateSlug } = require('../utils/helpers');

/**
 * WordPress Publisher Service
 * Publishes rewritten articles to WordPress via REST API
 */
class PublisherService {
  constructor() {
    this.baseUrl = config.wordpress.baseUrl.replace(/\/$/, '');
    this.username = config.wordpress.username;
    this.password = config.wordpress.appPassword;
    this.defaultAuthorId = config.wordpress.defaultAuthorId;
    this.defaultStatus = config.wordpress.defaultStatus;
  }

  /**
   * Get authentication headers for WordPress
   * @returns {Object}
   */
  getAuthHeaders() {
    const credentials = Buffer.from(`${this.username}:${this.password}`).toString('base64');
    return {
      'Authorization': `Basic ${credentials}`,
      'Content-Type': 'application/json',
    };
  }

  /**
   * Create or get a category by name
   * @param {string} categoryName - Category name
   * @returns {Promise<number>} Category ID
   */
  async ensureCategory(categoryName) {
    if (!categoryName) return 1; // Default category

    try {
      // Search for existing category
      const response = await axios.get(`${this.baseUrl}/wp-json/wp/v2/categories`, {
        headers: this.getAuthHeaders(),
        params: { slug: generateSlug(categoryName), per_page: 1 },
        timeout: 15000,
      });

      if (response.data?.length > 0) {
        return response.data[0].id;
      }

      // Create new category
      const createResponse = await axios.post(
        `${this.baseUrl}/wp-json/wp/v2/categories`,
        {
          name: categoryName.charAt(0).toUpperCase() + categoryName.slice(1),
          slug: generateSlug(categoryName),
        },
        { headers: this.getAuthHeaders(), timeout: 15000 }
      );

      return createResponse.data.id;
    } catch (error) {
      logger.error('Category creation failed', {
        category: categoryName,
        error: error.message,
        job: 'publisher',
      });
      return 1; // Return default category on failure
    }
  }

  /**
   * Upload an image to WordPress media library
   * @param {string} imageUrl - URL of the image
   * @returns {Promise<number|null>} Media ID
   */
  async uploadFeaturedImage(imageUrl) {
    if (!imageUrl) return null;

    try {
      // Download image
      const imageResponse = await axios.get(imageUrl, {
        responseType: 'arraybuffer',
        timeout: 20000,
        headers: { 'User-Agent': config.scraping.userAgent },
      });

      const buffer = Buffer.from(imageResponse.data, 'binary');
      const contentType = imageResponse.headers['content-type'] || 'image/jpeg';
      const extension = contentType.split('/')[1] || 'jpg';
      const filename = `featured-${Date.now()}.${extension}`;

      // Upload to WordPress
      const formData = new (require('form-data'))();
      formData.append('file', buffer, { filename, contentType });

      const uploadResponse = await axios.post(
        `${this.baseUrl}/wp-json/wp/v2/media`,
        formData,
        {
          headers: {
            ...this.getAuthHeaders(),
            ...formData.getHeaders(),
          },
          timeout: 30000,
        }
      );

      return uploadResponse.data.id;
    } catch (error) {
      logger.error('Featured image upload failed', {
        imageUrl,
        error: error.message,
        job: 'publisher',
      });
      return null;
    }
  }

  /**
   * Publish an article to WordPress
   * @param {Object} article - Article with rewritten content
   * @returns {Promise<{postId: number, postUrl: string}>}
   */
  async publish(article) {
    const logMeta = {
      articleId: article.id,
      title: article.rewritten_title,
      job: 'publisher',
    };

    logger.info('Starting WordPress publish', logMeta);

    // Ensure category exists
    const categoryId = await this.ensureCategory(article.category);

    // Upload featured image if available
    let featuredMediaId = null;
    if (article.original_image_url) {
      featuredMediaId = await retryWithBackoff(
        () => this.uploadFeaturedImage(article.original_image_url),
        2,
        1000
      );
    }

    // Prepare post content with HTML formatting
    const paragraphs = article.rewritten_content
      .split(/\n\n+/)
      .map(p => `<p>${p.trim()}</p>`)
      .join('\n');

    // Add source attribution
    const attribution = `\n<p><em>Originally sourced from ${article.source_name}. This article has been rewritten for our readers.</em></p>`;

    const postData = {
      title: article.rewritten_title,
      slug: generateSlug(article.rewritten_title),
      content: paragraphs + attribution,
      excerpt: article.rewritten_summary || article.rewritten_content.substring(0, 200) + '...',
      status: this.defaultStatus,
      author: this.defaultAuthorId,
      categories: [categoryId],
      featured_media: featuredMediaId,
      meta: {
        nln_original_url: article.source_url,
        nln_source_name: article.source_name,
        nln_rewritten: true,
        nln_original_title: article.original_title,
      },
    };

    const operation = async () => {
      const response = await axios.post(
        `${this.baseUrl}/wp-json/wp/v2/posts`,
        postData,
        {
          headers: this.getAuthHeaders(),
          timeout: 30000,
        }
      );

      const postId = response.data.id;
      const postUrl = response.data.link;

      logger.info('WordPress publish complete', {
        ...logMeta,
        postId,
        postUrl,
      });

      return { postId, postUrl };
    };

    return await retryWithBackoff(operation, config.system.maxRetries, 2000);
  }

  /**
   * Update an existing WordPress post
   * @param {number} postId - WordPress post ID
   * @param {Object} updates - Fields to update
   * @returns {Promise<Object>}
   */
  async updatePost(postId, updates) {
    const response = await axios.post(
      `${this.baseUrl}/wp-json/wp/v2/posts/${postId}`,
      updates,
      {
        headers: this.getAuthHeaders(),
        timeout: 15000,
      }
    );

    return response.data;
  }

  /**
   * Delete a WordPress post
   * @param {number} postId - WordPress post ID
   * @returns {Promise<void>}
   */
  async deletePost(postId) {
    await axios.delete(
      `${this.baseUrl}/wp-json/wp/v2/posts/${postId}`,
      {
        headers: this.getAuthHeaders(),
        params: { force: true },
        timeout: 15000,
      }
    );
  }

  /**
   * Check if WordPress connection is healthy
   * @returns {Promise<boolean>}
   */
  async healthCheck() {
    try {
      const response = await axios.get(`${this.baseUrl}/wp-json/wp/v2/posts`, {
        headers: this.getAuthHeaders(),
        params: { per_page: 1 },
        timeout: 10000,
      });
      return response.status === 200;
    } catch {
      return false;
    }
  }
}

module.exports = { PublisherService };
