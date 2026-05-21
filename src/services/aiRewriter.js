const axios = require('axios');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const { getAllApiKeys } = require('../db/apiKeys');
const { NaijaNewsPrompt, GistReelPrompt } = require('../utils/prompts');

const OPENROUTER_MODELS = [
  'deepseek/deepseek-v4-flash:free',
  'qwen/qwen3-coder:free',
  'nvidia/nemotron-3-super-120b-a12b:free',
];

const GEMINI_MODEL = 'gemini-2.5-flash';
const MAX_RETRIES = 4;

/**
 * Rewrite a NaijaNews article using AI with key rotation
 * @param {string} blogContent - JSON string with {title, blog_post}
 * @returns {Promise<{success: boolean, answer: string|null}>}
 */
async function NaijaNewsRewrite(blogContent) {
  const API_KEYS = await getAllApiKeys();

  if (!blogContent) {
    console.error('⚠️ No blog content provided.');
    return { success: false, answer: null };
  }

  if (!API_KEYS.length) {
    console.error('🚫 No API keys found in the database.');
    return { success: false, answer: null };
  }

  for (let keyIndex = 0; keyIndex < API_KEYS.length; keyIndex++) {
    const currentKeyObj = API_KEYS[keyIndex];
    const currentKey = currentKeyObj.api_key;
    const source = (currentKeyObj.api_source || 'unknown').toLowerCase();

    if (!currentKey) {
      console.warn(`⚠️ Skipping empty API key entry at index ${keyIndex}`);
      continue;
    }

    console.log(`🔑 Using API Key #${keyIndex + 1} (${source})`);

    if (source === 'open router') {
      for (let modelIndex = 0; modelIndex < OPENROUTER_MODELS.length; modelIndex++) {
        const model = OPENROUTER_MODELS[modelIndex];
        console.log(`🤖 Trying OpenRouter model ${modelIndex + 1}/${OPENROUTER_MODELS.length}: ${model}`);

        for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
          try {
            console.log(`🚀 Attempt ${attempt}/${MAX_RETRIES} with key #${keyIndex + 1}, model: ${model}`);

            const response = await axios.post(
              'https://openrouter.ai/api/v1/chat/completions',
              {
                model,
                messages: [
                  { role: 'system', content: NaijaNewsPrompt },
                  { role: 'user', content: blogContent },
                ],
                temperature: 0.7,
              },
              {
                headers: {
                  Authorization: `Bearer ${currentKey}`,
                  'Content-Type': 'application/json',
                },
                timeout: 60000,
              }
            );

            const answer = response?.data?.choices?.[0]?.message?.content?.trim();

            if (!answer) throw new Error('Empty response from API.');

            console.log(`✅ Successfully received response from OpenRouter (${model}).`);
            return { success: true, answer };
          } catch (err) {
            const errorMessage =
              err.response?.data?.error?.message ||
              err.message ||
              'Unknown API error';

            const statusCode = err.response?.status;
            console.error(`❌ Attempt ${attempt} failed [${model}]: ${errorMessage}`);

            if (statusCode === 429 || /rate.?limit/i.test(errorMessage)) {
              console.warn(`⚠️ Rate limit hit for key #${keyIndex + 1}, model: ${model}. Trying next model...`);
              break;
            }

            if (attempt < MAX_RETRIES) {
              const waitTime = Math.pow(2, attempt - 1) * 1000;
              console.log(`⏳ Retrying in ${waitTime / 1000}s...`);
              await new Promise((resolve) => setTimeout(resolve, waitTime));
            } else {
              console.warn(`⚠️ Max retries reached for model: ${model}. Trying next model...`);
            }
          }
        }
      }

      console.warn(`⚠️ All OpenRouter models exhausted for key #${keyIndex + 1}. Moving to next key...`);
    } else if (source === 'gemini') {
      for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
        try {
          console.log(`🚀 Attempt ${attempt}/${MAX_RETRIES} with key #${keyIndex + 1} (gemini)`);

          const genAI = new GoogleGenerativeAI(currentKey);
          const model = genAI.getGenerativeModel({ model: GEMINI_MODEL });

          const result = await model.generateContent({
            contents: [{ role: 'user', parts: [{ text: `${NaijaNewsPrompt}\n\n${blogContent}` }] }],
          });

          const answer = result?.response?.text()?.trim();

          if (!answer) throw new Error('Empty response from API.');

          console.log(`✅ Successfully received response from Gemini API.`);
          return { success: true, answer };
        } catch (err) {
          const errorMessage =
            err.response?.data?.error?.message ||
            err.message ||
            'Unknown API error';

          const statusCode = err.response?.status;
          console.error(`❌ Attempt ${attempt} failed (gemini): ${errorMessage}`);

          if (statusCode === 429 || /rate.?limit/i.test(errorMessage)) {
            console.warn(`⚠️ Rate limit hit for key #${keyIndex + 1} (gemini).`);
            break;
          }

          if (attempt < MAX_RETRIES) {
            const waitTime = Math.pow(2, attempt - 1) * 1000;
            console.log(`⏳ Retrying in ${waitTime / 1000}s...`);
            await new Promise((resolve) => setTimeout(resolve, waitTime));
          } else {
            console.warn('⚠️ Max retries reached for this key. Moving to next one...');
          }
        }
      }
    } else {
      console.warn(`⚠️ Unknown API source: '${source}'. Skipping this key.`);
    }
  }

  console.error('🚫 All API keys exhausted. No successful response.');
  return { success: false, answer: null };
}

/**
 * Rewrite a GistReel article HTML using AI with key rotation
 * @param {string} blogContent - Raw HTML content of the article
 * @param {string} category - Article category
 * @returns {Promise<{success: boolean, answer: string|null}>}
 */
async function GetGistReelWPConent(blogContent, category) {
  const API_KEYS = await getAllApiKeys();

  if (!blogContent) {
    console.log('⚠️ No blog content provided.');
    return { success: false, answer: null };
  }

  if (!API_KEYS.length) {
    console.error('🚫 No API keys found in the database.');
    return { success: false, answer: null };
  }

  const prompt = GistReelPrompt(category);

  for (let keyIndex = 0; keyIndex < API_KEYS.length; keyIndex++) {
    const keyObj = API_KEYS[keyIndex];
    const currentKey = keyObj.api_key;
    const source = (keyObj.api_source || '').toLowerCase();

    if (!currentKey) {
      console.warn(`⚠️ Skipping empty API key at index ${keyIndex}`);
      continue;
    }

    console.log(`🔑 Using API key #${keyIndex + 1}/${API_KEYS.length} [${source || 'unknown source'}]`);

    if (source === 'open router') {
      for (let modelIndex = 0; modelIndex < OPENROUTER_MODELS.length; modelIndex++) {
        const model = OPENROUTER_MODELS[modelIndex];
        console.log(`🤖 Trying OpenRouter model ${modelIndex + 1}/${OPENROUTER_MODELS.length}: ${model}`);

        for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
          try {
            console.log(`🚀 Attempt ${attempt}/${MAX_RETRIES} with key #${keyIndex + 1}, model: ${model}`);

            const response = await axios.post(
              'https://openrouter.ai/api/v1/chat/completions',
              {
                model,
                messages: [
                  { role: 'system', content: prompt },
                  { role: 'user', content: blogContent },
                ],
                temperature: 0.7,
              },
              {
                headers: {
                  Authorization: `Bearer ${currentKey}`,
                  'Content-Type': 'application/json',
                },
                timeout: 60000,
              }
            );

            const answer = response?.data?.choices?.[0]?.message?.content?.trim();

            if (!answer) throw new Error('Empty response received from model.');

            console.log(`✅ Successful response from OpenRouter (${model})`);
            return { success: true, answer };
          } catch (err) {
            const errorMessage =
              err.response?.data?.error?.message ||
              err.response?.data?.message ||
              err.message ||
              'Unknown error';

            const statusCode = err.response?.status;
            console.error(`❌ Attempt ${attempt} failed [${model}]: ${errorMessage}`);

            if (statusCode === 429 || /rate.?limit/i.test(errorMessage)) {
              console.warn(`⚠️ Rate limit hit for key #${keyIndex + 1}, model: ${model}. Trying next model...`);
              break;
            }

            if (attempt < MAX_RETRIES) {
              const waitTime = Math.pow(2, attempt - 1) * 1000;
              console.log(`⏳ Retrying in ${waitTime / 1000}s...`);
              await new Promise((resolve) => setTimeout(resolve, waitTime));
            } else {
              console.warn(`⚠️ Max retries reached for model: ${model}. Trying next model...`);
            }
          }
        }
      }

      console.warn(`⚠️ All OpenRouter models exhausted for key #${keyIndex + 1}. Moving to next key...`);
    } else if (source === 'gemini') {
      for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
        try {
          console.log(`🚀 Attempt ${attempt}/${MAX_RETRIES} with key #${keyIndex + 1} (gemini)`);

          const genAI = new GoogleGenerativeAI(currentKey);
          const model = genAI.getGenerativeModel({ model: GEMINI_MODEL });

          const result = await model.generateContent({
            contents: [{ role: 'user', parts: [{ text: `${prompt}\n\n${blogContent}` }] }],
          });

          const answer = result?.response?.text()?.trim();

          if (!answer) throw new Error('Empty response received from model.');

          console.log(`✅ Successful response from GEMINI API`);
          return { success: true, answer };
        } catch (err) {
          const errorMessage =
            err.response?.data?.error?.message ||
            err.response?.data?.message ||
            err.message ||
            'Unknown error';

          const statusCode = err.response?.status;
          console.error(`❌ Attempt ${attempt} failed [gemini]: ${errorMessage}`);

          if (statusCode === 429 || /rate.?limit/i.test(errorMessage)) {
            console.warn(`⚠️ Rate limit hit for key #${keyIndex + 1}. Switching to next key...`);
            break;
          }

          if (attempt < MAX_RETRIES) {
            const waitTime = Math.pow(2, attempt - 1) * 1000;
            console.log(`⏳ Retrying in ${waitTime / 1000}s...`);
            await new Promise((resolve) => setTimeout(resolve, waitTime));
          } else {
            console.warn(`⚠️ Max retries reached for key #${keyIndex + 1}. Moving to next...`);
          }
        }
      }
    } else {
      console.warn(`⚠️ Unknown API source '${source}' at index ${keyIndex}, skipping...`);
    }
  }

  console.error('🚫 All API keys exhausted. No successful response.');
  return { success: false, answer: null };
}

module.exports = {
  NaijaNewsRewrite,
  GetGistReelWPConent,
};