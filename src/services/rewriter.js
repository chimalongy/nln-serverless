const axios = require('axios');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const { logger } = require('../utils/logger');
const { getAllApiKeys } = require('../db/apiKeys');
const { sleep } = require('../utils/helpers');

const OPENROUTER_MODEL = 'deepseek/deepseek-r1-0528:free';
const OPENROUTER_API_URL = 'https://openrouter.ai/api/v1/chat/completions';
const GEMINI_MODEL = 'gemini-2.5-flash';
const MAX_RETRIES = 4;

/**
 * AI Rewriting Service
 * Rewrites scraped articles using multiple AI providers (OpenRouter + Gemini)
 * Fetches API keys from the database and rotates through them on failure
 */
class RewriterService {
  constructor() {
    this.temperature = 0.7;
  }

  /**
   * Build the system prompt for article rewriting
   * @returns {string}
   */
  buildSystemPrompt() {
    return `You are a professional Nigerian news editor and journalist. Your task is to rewrite news articles to be:

1. ORIGINAL - Write in your own words. Do not copy sentences verbatim.
2. ENGAGING - Use clear, professional Nigerian English that resonates with local readers.
3. ACCURATE - Preserve all factual information, names, dates, figures, and quotes.
4. STRUCTURED - Use proper formatting with an introduction, body paragraphs, and conclusion.
5. LOCAL CONTEXT - Add relevant Nigerian context where appropriate (local regulations, cultural references, regional impact).
6. SEO-FRIENDLY - Include relevant keywords naturally.
7. COMPLETE - Maintain the full length and detail of the original article. Do not truncate or summarize excessively.

Rules:
- Write a compelling headline that captures the essence of the story
- Start with a strong lead paragraph summarizing the key news
- Include all important details, names, and data points
- Maintain journalistic neutrality
- Do not add fictional information
- Output ONLY the rewritten article in this exact format:

TITLE: [Your rewritten title]

CONTENT:
[Your rewritten article content in full paragraphs]

SUMMARY:
[A 2-3 sentence summary for meta description]`;
  }

  /**
   * Build the user prompt from article data
   * @param {Object} article - Article object with title and content
   * @returns {string}
   */
  buildUserPrompt(article) {
    return `Please rewrite the following Nigerian news article.

Original Title: ${article.original_title}

Category: ${article.category || 'general'}

Original Content:
${article.original_content || article.original_summary || ''}

Source: ${article.source_name}

Rewrite this into a professional, engaging news article suitable for Nigerian readers. Preserve all factual details.`;
  }

  /**
   * Parse the AI response into structured parts
   * @param {string} response - Raw AI response text
   * @returns {Object}
   */
  parseRewriteResponse(response) {
    if (!response) {
      throw new Error('Empty AI response');
    }

    const titleMatch = response.match(/TITLE:\s*(.+?)(?=\n\nCONTENT:|\nCONTENT:|$)/s);
    const contentMatch = response.match(/CONTENT:\s*([\s\S]+?)(?=\n\nSUMMARY:|\nSUMMARY:|$)/);
    const summaryMatch = response.match(/SUMMARY:\s*([\s\S]+)$/);

    const title = titleMatch ? titleMatch[1].trim() : '';
    const content = contentMatch ? contentMatch[1].trim() : response.trim();
    const summary = summaryMatch ? summaryMatch[1].trim() : '';

    if (!title || !content) {
      // Fallback: if parsing fails, use the whole response as content
      return {
        title: title || 'Untitled Article',
        content: content || response,
        summary: summary || content.substring(0, 200) + '...',
      };
    }

    return { title, content, summary };
  }

  /**
   * Call OpenRouter API (DeepSeek or similar models)
   * @param {string} systemPrompt - System prompt
   * @param {string} userPrompt - User prompt
   * @param {string} apiKey - API key
   * @returns {Promise<string>} Raw response text
   */
  async callOpenRouter(systemPrompt, userPrompt, apiKey) {
    const response = await axios.post(
      OPENROUTER_API_URL,
      {
        model: OPENROUTER_MODEL,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        temperature: this.temperature,
      },
      {
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        timeout: 120000,
      }
    );

    const answer = response?.data?.choices?.[0]?.message?.content?.trim();
    if (!answer) {
      throw new Error('Empty response from OpenRouter API');
    }
    return answer;
  }

  /**
   * Call Gemini API
   * @param {string} systemPrompt - System prompt
   * @param {string} userPrompt - User prompt
   * @param {string} apiKey - API key
   * @returns {Promise<string>} Raw response text
   */
  async callGemini(systemPrompt, userPrompt, apiKey) {
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: GEMINI_MODEL });

    const result = await model.generateContent({
      contents: [
        {
          role: 'user',
          parts: [{ text: `${systemPrompt}\n\n${userPrompt}` }],
        },
      ],
    });

    const answer = result?.response?.text()?.trim();
    if (!answer) {
      throw new Error('Empty response from Gemini API');
    }
    return answer;
  }

  /**
   * Send article to AI for rewriting using multi-key rotation
   * Iterates through all API keys from the database, trying each with retries.
   * Supports OpenRouter and Gemini providers.
   *
   * @param {Object} article - Article with original_title, original_content, category, source_name
   * @returns {Promise<{title: string, content: string, summary: string}>}
   */
  async rewrite(article) {
    const logMeta = {
      articleId: article.id,
      source: article.source_name,
      job: 'rewriter',
    };

    logger.info('Starting article rewrite', logMeta);

    if (!article.original_content && !article.original_summary) {
      throw new Error('Article has no content to rewrite');
    }

    // Fetch all API keys from the database
    const apiKeys = await getAllApiKeys();

    if (!apiKeys || apiKeys.length === 0) {
      throw new Error('No API keys found in the database. Add keys to the api_keys table.');
    }

    const systemPrompt = this.buildSystemPrompt();
    const userPrompt = this.buildUserPrompt(article);

    // Iterate through available keys
    for (let keyIndex = 0; keyIndex < apiKeys.length; keyIndex++) {
      const currentKeyObj = apiKeys[keyIndex];
      const currentKey = currentKeyObj.api_key;
      const source = (currentKeyObj.api_source || 'unknown').toLowerCase();

      if (!currentKey) {
        logger.warn('Skipping empty API key entry', { keyIndex, ...logMeta });
        continue;
      }

      logger.info(`Using API Key #${keyIndex + 1} (${source})`, logMeta);

      for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
        try {
          logger.info(`Attempt ${attempt}/${MAX_RETRIES} with key #${keyIndex + 1}`, logMeta);

          let rawResponse = '';

          if (source === 'open router') {
            rawResponse = await this.callOpenRouter(systemPrompt, userPrompt, currentKey);
          } else if (source === 'gemini') {
            rawResponse = await this.callGemini(systemPrompt, userPrompt, currentKey);
          } else {
            logger.warn(`Unknown API source: '${source}'. Skipping this key.`, logMeta);
            break; // Skip to next key
          }

          const parsed = this.parseRewriteResponse(rawResponse);

          logger.info('Article rewrite complete', {
            ...logMeta,
            provider: source,
            keyIndex: keyIndex + 1,
            titleLength: parsed.title.length,
            contentLength: parsed.content.length,
          });

          return parsed;
        } catch (err) {
          const errorMessage =
            err.response?.data?.error?.message ||
            err.message ||
            'Unknown API error';

          const statusCode = err.response?.status;
          logger.error(`Attempt ${attempt} failed: ${errorMessage}`, {
            ...logMeta,
            provider: source,
            keyIndex: keyIndex + 1,
            statusCode,
          });

          // Handle rate limits — immediately switch to next key
          if (statusCode === 429 || /rate.?limit/i.test(errorMessage)) {
            logger.warn(`Rate limit hit for key #${keyIndex + 1} (${source}). Switching to next key.`, logMeta);
            break;
          }

          if (attempt < MAX_RETRIES) {
            const waitTime = Math.pow(2, attempt - 1) * 1000;
            logger.info(`Retrying in ${waitTime / 1000}s...`, logMeta);
            await sleep(waitTime);
          } else {
            logger.warn('Max retries reached for this key. Moving to next one...', logMeta);
          }
        }
      }
    }

    // All keys exhausted
    throw new Error('All API keys exhausted. No successful rewrite response.');
  }

  /**
   * Rewrite multiple articles in batch
   * @param {Array<Object>} articles - Array of articles
   * @returns {Promise<Array<{article: Object, result: Object}|{article: Object, error: Error}>>}
   */
  async rewriteBatch(articles) {
    const results = [];

    for (const article of articles) {
      try {
        const result = await this.rewrite(article);
        results.push({ article, result, success: true });
      } catch (error) {
        logger.error('Batch rewrite failed for article', {
          articleId: article.id,
          error: error.message,
          job: 'rewriter',
        });
        results.push({ article, error, success: false });
      }
    }

    return results;
  }
}

module.exports = { RewriterService };
