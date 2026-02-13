/**
 * Winston LLM Proxy Server
 *
 * CRITICAL COMPONENT: All tenant LLM traffic routes through this proxy.
 *
 * Responsibilities:
 * - Route requests to correct LLM provider based on tenant's model selection
 * - Hold real API keys (tenants never see them)
 * - Count tokens and deduct credits
 * - Enforce credit limits
 * - Log all LLM interactions for audit
 */

require('dotenv').config({ path: require('path').join(__dirname, '../../../.env') });
const express = require('express');
const cors = require('cors');
const { getDb } = require('./db');
const { routeRequest } = require('./router');
const { checkCredits, deductCredits } = require('./metering');

const app = express();
const PORT = process.env.PORT || process.env.LLM_PROXY_PORT || 3002;

app.use(cors());
app.use(express.json({ limit: '10mb' }));

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'healthy', service: 'winston-llm-proxy' });
});

/**
 * Main LLM proxy endpoint
 * Handles all LLM API requests from tenant containers
 *
 * Expected auth format: Authorization: Bearer winston-{tenant_id}
 */
app.post('/v1/messages', async (req, res) => {
  try {
    // Extract tenant ID from authorization header
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer winston-')) {
      return res.status(401).json({
        error: 'Unauthorized',
        message: 'Invalid authorization format. Expected: Bearer winston-{tenant_id}'
      });
    }

    const tenantId = authHeader.replace('Bearer winston-', '');
    console.log(`[Proxy] Request from tenant: ${tenantId}`);

    // Check credit balance
    const creditCheck = await checkCredits(tenantId);

    // Billing gate (see metering.js)
    if (creditCheck.billingStatus && creditCheck.billingStatus !== 'ok') {
      console.log(`[Proxy] Billing blocked for tenant ${tenantId} (tier=${creditCheck.tier})`);
      res.set({
        'X-Winston-Billing-Status': creditCheck.billingStatus
      });
      return res.status(402).json({
        error: 'winston_billing_required',
        message: 'Billing is required to use this plan. Please add a payment method or downgrade to Free.',
        billing_status: creditCheck.billingStatus,
        tier: creditCheck.tier,
        billing_url: `${process.env.WINSTON_WEB_URL || ''}/dashboard?tab=billing`
      });
    }

    if (!creditCheck.hasCredits) {
      console.log(`[Proxy] Credits exhausted for tenant ${tenantId}`);
      return res.status(402).json({
        error: 'winston_credits_exhausted',
        message: 'Your thinking credits are depleted. Upgrade your plan to continue.',
        credits_remaining: 0,
        upgrade_url: `${process.env.WINSTON_WEB_URL}/dashboard/billing`
      });
    }

    // Get tenant model selection and route the request
    const response = await routeRequest(tenantId, req.body);

    // Extract token usage from response
    const usage = response.usage || { input_tokens: 0, output_tokens: 0 };

    // Deduct credits based on token usage
    const creditsDeducted = await deductCredits(
      tenantId,
      usage.input_tokens,
      usage.output_tokens,
      creditCheck.model,
      creditCheck.multiplier
    );

    // Calculate remaining credits
    const creditsRemaining = creditCheck.credits - creditsDeducted;
    const percentRemaining = (creditsRemaining / creditCheck.monthlyAllotment) * 100;

    // Add credit info to response headers
    res.set({
      'X-Winston-Credits-Used': creditsDeducted.toFixed(2),
      'X-Winston-Credits-Remaining': creditsRemaining.toFixed(2),
      'X-Winston-Credits-Percent': percentRemaining.toFixed(1)
    });

    // Inject warning if below 20%
    if (percentRemaining < 20 && percentRemaining > 0) {
      console.log(`[Proxy] Low credits warning for tenant ${tenantId}: ${percentRemaining.toFixed(1)}%`);
    }

    res.json(response);

  } catch (error) {
    console.error('[Proxy] Error:', error);

    // Don't expose internal errors to tenants
    res.status(error.status || 500).json({
      error: 'proxy_error',
      message: error.userMessage || 'An error occurred processing your request',
      ...(process.env.NODE_ENV === 'development' && { details: error.message })
    });
  }
});

// OpenAI-compatible chat completions endpoint (for compatibility)
app.post('/v1/chat/completions', async (req, res) => {
  // Transform to Anthropic format and forward
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer winston-')) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    // Convert OpenAI format to Anthropic format
    const anthropicRequest = {
      model: req.body.model,
      messages: req.body.messages,
      max_tokens: req.body.max_tokens || 4096,
      temperature: req.body.temperature,
      stream: req.body.stream || false
    };

    req.body = anthropicRequest;

    // Forward to main handler
    return app.handle(Object.assign(req, {
      method: 'POST',
      url: '/v1/messages'
    }), res);

  } catch (error) {
    console.error('[Proxy] Chat completions error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Start server
app.listen(PORT, () => {
  console.log(`[Proxy] Winston LLM Proxy listening on port ${PORT}`);
  console.log(`[Proxy] Providers configured: Moonshot (Kimi), Anthropic (Claude)`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('[Proxy] SIGTERM received, shutting down gracefully');
  process.exit(0);
});
