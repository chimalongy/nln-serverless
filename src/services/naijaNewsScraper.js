const axios = require('axios');
const cheerio = require('cheerio');

/**
 * Scrape links to posts published less than a day ago from NaijaNews
 * @param {string} url - Category page URL
 * @returns {Promise<string[]>} - Array of URLs
 */
async function scrapeRecentPosts(url) {
  try {
    const { data } = await axios.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      }
    });
    const $ = cheerio.load(data);
    const posts = [];
    const now = new Date();

    $('.mvp-blog-story-wrap, .mvp-blog-story-out, article').each((_, el) => {
      const link = $(el).find('a').attr('href');
      const dateText = $(el).find('time, .mvp-cd-date, .mvp-blog-story-date').text().trim();

      if (!link || !dateText) return;

      let postDate;

      // Handle relative dates like "5 hours ago", "12 mins ago"
      if (dateText.includes('hour') || dateText.includes('min')) {
        postDate = new Date(now - 1000 * 60 * 60 * 24 + 1000); // within 1 day
      } else {
        postDate = new Date(dateText);
      }

      const hoursAgo = (now - postDate) / (1000 * 60 * 60);

      if (!isNaN(postDate) && hoursAgo <= 24) {
        if (!posts.includes(link)) {
          posts.push(link);
        }
      }
    });

    return posts;
  } catch (err) {
    console.error('Error scraping posts:', err.message);
    return [];
  }
}

/**
 * Extract post details and cleaned body content from a NaijaNews article page
 * @param {string} url - Article URL
 * @returns {Promise<Object|null>} - Article object or null
 */
async function extractPostContent(url) {
  try {
    const { data: html } = await axios.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      },
      timeout: 15000
    });

    const $ = cheerio.load(html);

    // 🧹 Remove unwanted sections (related posts, ads, footer, etc.)
    $(
      `
      .mvp-related-posts,
      .mvp-post-tags,
      .mvp-post-add-main,
      .mvp-post-gallery-text,
      .mvp-more-posts,
      .mvp-author-info-wrap,
      .mvp-soc-mob-list,
      #mvp-foot-copy,
      footer,
      .footer,
      .site-footer
      `
    ).remove();

    // Extract metadata
    const title =
      $("meta[property='og:title']").attr('content') ||
      $('title').text().trim();

    const author =
      $("meta[name='author']").attr('content') ||
      $("meta[property='article:author']").attr('content');

    const published =
      $("meta[property='article:published_time']").attr('content');

    const image =
      $("meta[property='og:image']").attr('content') ||
      $("meta[name='twitter:image']").attr('content');

    // 📝 Extract article text
    let articleText = $('#mvp-content-main p, article p')
      .map((_, el) => $(el).text().trim())
      .get()
      .filter(
        (text) =>
          text &&
          !/You may like/i.test(text) &&
          !/Naija News/i.test(text) &&
          !/Polance Media/i.test(text) &&
          !/Contact us/i.test(text) &&
          !/^©/i.test(text)
      )
      .join('\n\n');

    // 🔪 Cut off footer safely if it slipped in
    const footerIndex = articleText.search(
      /©.*Naija News.*Polance Media|Contact us|Naija News, a division/i
    );
    if (footerIndex !== -1) {
      articleText = articleText.slice(0, footerIndex).trim();
    }

    return {
      title,
      author,
      published,
      image,
      content: articleText || 'Content not found',
    };
  } catch (err) {
    console.error('Error extracting post content:', err.message);
    return null;
  }
}

module.exports = {
  scrapeRecentPosts,
  extractPostContent,
};
