/**
 * LLM Request Router
 *
 * Routes requests to the correct LLM provider based on tenant's model selection
 * Handles model-specific request/response transformations
 */

const { query } = require('./db');
const moonshot = require('./providers/moonshot');
const anthropic = require('./providers/anthropic');

// Model to provider mapping
const MODEL_PROVIDERS = {
  'kimi-k2.5': 'moonshot',
  'claude-sonnet-4-5': 'anthropic',
  'claude-opus-4-6': 'anthropic',
  'gpt-4o': 'openai'
};

/**
 * Route LLM request to correct provider
 *
 * @param {string} tenantId - Tenant UUID
 * @param {Object} requestBody - LLM request payload
 * @returns {Object} LLM response with usage info
 */
async function routeRequest(tenantId, requestBody) {
  try {
    // Get tenant's selected model
    const result = await query(
      'SELECT selected_model FROM tenants WHERE id = $1',
      [tenantId]
    );

    if (result.rows.length === 0) {
      throw {
        status: 404,
        userMessage: 'Tenant not found',
        message: `Tenant ${tenantId} does not exist`
      };
    }

    const selectedModel = result.rows[0].selected_model;
    const provider = MODEL_PROVIDERS[selectedModel];

    if (!provider) {
      throw {
        status: 400,
        userMessage: 'Invalid model configuration',
        message: `Model ${selectedModel} is not supported`
      };
    }

    console.log(`[Router] Routing to ${provider} for model ${selectedModel}`);

    // Route to appropriate provider
    switch (provider) {
      case 'moonshot':
        return await moonshot.sendRequest(selectedModel, requestBody);

      case 'anthropic':
        return await anthropic.sendRequest(selectedModel, requestBody);

      case 'openai':
        throw {
          status: 501,
          userMessage: 'OpenAI provider not yet implemented',
          message: 'OpenAI integration coming in Phase 1'
        };

      default:
        throw {
          status: 500,
          userMessage: 'Unknown provider',
          message: `Provider ${provider} is not implemented`
        };
    }

  } catch (error) {
    if (error.status) throw error;
    console.error('[Router] Routing error:', error);
    throw {
      status: 500,
      userMessage: 'Error routing request',
      message: error.message
    };
  }
}

module.exports = { routeRequest };
