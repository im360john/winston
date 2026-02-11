/**
 * Moonshot AI Provider (Kimi K2.5)
 *
 * Handles requests to Moonshot API for Kimi K2.5 model
 * API Docs: https://platform.moonshot.cn/docs
 */

const axios = require('axios');

const MOONSHOT_BASE_URL = 'https://api.moonshot.cn/v1';
const MOONSHOT_API_KEY = process.env.MOONSHOT_API_KEY;

// Model ID mapping (Winston name -> Moonshot ID)
const MODEL_IDS = {
  'kimi-k2.5': 'moonshot-v1-128k' // Using their 128K context model
};

/**
 * Send request to Moonshot API
 *
 * @param {string} model - Winston model identifier
 * @param {Object} requestBody - Request payload (Anthropic-compatible format)
 * @returns {Object} Normalized response with usage
 */
async function sendRequest(model, requestBody) {
  const moonshotModel = MODEL_IDS[model] || MODEL_IDS['kimi-k2.5'];

  try {
    // Transform Anthropic-style request to OpenAI format (Moonshot is OpenAI-compatible)
    const moonshotRequest = {
      model: moonshotModel,
      messages: requestBody.messages || [],
      max_tokens: requestBody.max_tokens || 4096,
      temperature: requestBody.temperature || 0.7,
      stream: false
    };

    console.log(`[Moonshot] Sending request to ${moonshotModel}`);

    const response = await axios.post(
      `${MOONSHOT_BASE_URL}/chat/completions`,
      moonshotRequest,
      {
        headers: {
          'Authorization': `Bearer ${MOONSHOT_API_KEY}`,
          'Content-Type': 'application/json'
        },
        timeout: 60000 // 60 second timeout
      }
    );

    const data = response.data;

    // Normalize response to match expected format
    const normalized = {
      id: data.id,
      type: 'message',
      role: 'assistant',
      content: [
        {
          type: 'text',
          text: data.choices[0].message.content
        }
      ],
      model: model, // Return Winston model name, not Moonshot's
      usage: {
        input_tokens: data.usage?.prompt_tokens || 0,
        output_tokens: data.usage?.completion_tokens || 0
      }
    };

    console.log(`[Moonshot] Success: ${normalized.usage.input_tokens} in, ${normalized.usage.output_tokens} out`);

    return normalized;

  } catch (error) {
    console.error('[Moonshot] API Error:', error.response?.data || error.message);

    if (error.response) {
      const status = error.response.status;
      const data = error.response.data;

      if (status === 401) {
        throw {
          status: 500,
          userMessage: 'LLM provider authentication failed',
          message: 'Moonshot API key is invalid or expired'
        };
      }

      if (status === 429) {
        throw {
          status: 429,
          userMessage: 'Request rate limit reached, please try again shortly',
          message: 'Moonshot API rate limit exceeded'
        };
      }

      throw {
        status: 502,
        userMessage: 'LLM provider error',
        message: data.error?.message || 'Moonshot API returned an error'
      };
    }

    throw {
      status: 500,
      userMessage: 'Failed to reach LLM provider',
      message: error.message
    };
  }
}

module.exports = { sendRequest };
