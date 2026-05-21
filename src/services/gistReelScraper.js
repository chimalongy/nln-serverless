const axios = require('axios');
const cheerio = require('cheerio');

/**
 * Scrape GistReel grid-style posts published today
 * @param {string} url - Category page URL
 * @returns {Promise<string[]>} - Array of post URLs
 */
async function scrapeGistReelRecentPostsGrid(url) {
  const links = [];

  try {
    const { data: html } = await axios.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
      },
      timeout: 15000,
    });

    const $ = cheerio.load(html);
    const today = new Date();

    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const todayMonth = monthNames[today.getMonth()];
    const todayDay = today.getDate();
    const todayYear = today.getFullYear();
    const formattedDate = `${todayMonth} ${todayDay}, ${todayYear}`;

    console.log(`[GistReel Grid] Targeting posts published on: ${formattedDate}`);

    $('.container-wrapper.post-element.tie-standard').each((_, element) => {
      const $post = $(element);
      const postDateText = $post.find('.post-meta .date').text().trim();

      if (postDateText === formattedDate) {
        const linkElement = $post.find('h2.entry-title a');
        const link = linkElement.attr('href');

        if (link && !links.includes(link)) {
          links.push(link);
          console.log(`[GistReel Grid] Extracted link: ${link}`);
        }
      }
    });

    return links;
  } catch (error) {
    console.error(`Error scraping GistReel Grid ${url}: ${error.message}`);
    return [];
  }
}

/**
 * Scrape GistReel list-style posts published today
 * @param {string} url - Category page URL
 * @returns {Promise<string[]>} - Array of post URLs
 */
async function scrapeGistReelRecentPostsList(url) {
  const links = [];

  try {
    const { data: html } = await axios.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
      },
      timeout: 15000,
    });

    const $ = cheerio.load(html);
    const today = new Date();
    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const formattedDate = `${monthNames[today.getMonth()]} ${today.getDate()}, ${today.getFullYear()}`;

    console.log(`[GistReel List] Targeting posts published on: ${formattedDate}`);

    $('article.post-element').each((_, el) => {
      const postDateText = $(el).find('.meta-item.date').text().trim();
      const link = $(el).find('h2.post-title a').attr('href');

      if (postDateText === formattedDate && link && !links.includes(link)) {
        links.push(link);
        console.log(`[GistReel List] Extracted link: ${link}`);
      }
    });

    return links;
  } catch (error) {
    console.error(`Error scraping GistReel List ${url}: ${error.message}`);
    return [];
  }
}

/**
 * Extract the raw HTML post body for GistReel posts
 * @param {string} url - Post URL
 * @returns {Promise<string>} - Raw outer HTML of post container
 */
async function extractPostContentHtml(url) {
  if (!url) {
    console.error('URL is required.');
    return '';
  }

  try {
    const { data: htmlContent } = await axios.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
      },
      timeout: 15000,
    });

    const $ = cheerio.load(htmlContent);

    const selectors = [
      '#the-post',
      '.entry-content',
      '.single-content',
      'article',
    ];

    let postHtml = '';

    for (const selector of selectors) {
      const $postElement = $(selector);

      if ($postElement.length) {
        postHtml = $.html($postElement.first());
        console.log(`Successfully extracted GistReel HTML using selector: ${selector}`);
        break;
      }
    }

    if (!postHtml) {
      console.error('Could not find GistReel main post section using standard selectors.');
    }

    return postHtml;
  } catch (error) {
    console.error(`Error fetching or parsing GistReel URL (${url}): ${error.message}`);
    return '';
  }
}

module.exports = {
  scrapeGistReelRecentPostsGrid,
  scrapeGistReelRecentPostsList,
  extractPostContentHtml,
};
