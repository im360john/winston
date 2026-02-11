/**
 * Anthropic Provider (Claude models)
 *
 * Handles requests to Anthropic API for Claude Sonnet and Opus
 * API Docs: https://docs.anthropic.com/claude/reference
 */

const axios = require('axios');

const ANTHROPIC_BASE_URL = 'https://api.anthropic.com/v1';
const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
const ANTHROPIC_VERSION = '2023-06-01';

// Model ID mapping (Winston name -> Anthropic ID)
const MODEL_IDS = {
  'claude-sonnet-4-5': 'claude-sonnet-4-5-20250929',
  'claude-opus-4-6': 'claude-opus-4-6-20250514'
};

/**
 * Send request to Anthropic API
 *
 * @param {string} model - Winston model identifier
 * @param {Object} requestBody - Request payload (Anthropic format)
 * @returns {Object} Response with usage
 */
async function sendRequest(model, requestBody) {
  const anthropicModel = MODEL_IDS[model];

  if (!anthropicModel) {
    throw {
      status: 400,
      userMessage: 'Invalid Claude model',
      message: `Model ${model} is not supported`
    };
  }

  try {
    const anthropicRequest = {
      model: anthropicModel,
      messages: requestBody.messages || [],
      max_tokens: requestBody.max_tokens || 4096,
      temperature: requestBody.temperature,
      system: requestBody.system
    };

    console.log(`[Anthropic] Sending request to ${anthropicModel}`);

    const response = await axios.post(
      `${ANTHROPIC_BASE_URL}/messages`,
      anthropicRequest,
      {
        headers: {
          'x-api-key': ANTHROPIC_API_KEY,
          'anthropic-version': ANTHROPIC_VERSION,
          'Content-Type': 'application/json'
        },
        timeout: 60000 // 60 second timeout
      }
    );

    const data = response.data;

    // Normalize response
    const normalized = {
      id: data.id,
      type: 'message',
      role: 'assistant',
      content: data.content,
      model: model, // Return Winston model name
      usage: {
        input_tokens: data.usage?.input_tokens || 0,
        output_tokens: data.usage?.output_tokens || 0
      },
      stop_reason: data.stop_reason
    };

    console.log(`[Anthropic] Success: ${normalized.usage.input_tokens} in, ${normalized.usage.output_tokens} out`);

    return normalized;

  } catch (error) {
    console.error('[Anthropic] API Error:', error.response?.data || error.message);

    if (error.response) {
      const status = error.response.status;
      const data = error.response.data;

      if (status === 401) {
        throw {
          status: 500,
          userMessage: 'LLM provider authentication failed',
          message: 'Anthropic API key is invalid or expired'
        };
      }

      if (status === 429) {
        throw {
          status: 429,
          userMessage: 'Request rate limit reached, please try again shortly',
          message: 'Anthropic API rate limit exceeded'
        };
      }

      throw {
        status: 502,
        userMessage: 'LLM provider error',
        message: data.error?.message || 'Anthropic API returned an error'
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
