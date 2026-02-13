/**
 * Credit metering and enforcement
 *
 * Handles:
 * - Credit balance checks
 * - Token counting
 * - Credit deduction with model multipliers
 * - Usage logging for audit
 */

const { query } = require('./db');

// Model credit multipliers (relative to Kimi K2.5 baseline)
const MODEL_MULTIPLIERS = {
  'kimi-k2.5': 1.0,
  'gpt-4o': 3.0,
  'claude-sonnet-4-5': 5.0,
  'claude-opus-4-6': 12.0
};

/**
 * Check if tenant has sufficient credits
 * @param {string} tenantId - UUID of tenant
 * @returns {Object} Credit status and tenant info
 */
async function checkCredits(tenantId) {
  try {
    const result = await query(
      `SELECT
        id,
        credits_remaining,
        credits_monthly_allotment,
        selected_model,
        tier,
        status,
        stripe_customer_id,
        stripe_subscription_id
      FROM tenants
      WHERE id = $1`,
      [tenantId]
    );

    if (result.rows.length === 0) {
      throw {
        status: 404,
        userMessage: 'Tenant not found',
        message: `Tenant ${tenantId} does not exist`
      };
    }

    const tenant = result.rows[0];

    if (tenant.status !== 'active') {
      throw {
        status: 403,
        userMessage: 'Account inactive',
        message: `Tenant ${tenantId} is not active (status: ${tenant.status})`
      };
    }

    const multiplier = MODEL_MULTIPLIERS[tenant.selected_model] || 1.0;

    // Billing gating (temporary simple rules)
    // - free/unlimited: always allowed
    // - starter/growth: require an active Stripe subscription id on the tenant record
    // This lets onboarding provision even if billing fails, but blocks paid-tier usage until billing is attached.
    let billingStatus = 'ok';
    const paidTiers = new Set(['starter', 'growth']);
    if (paidTiers.has(String(tenant.tier))) {
      if (!tenant.stripe_subscription_id) billingStatus = 'unpaid';
    }

    return {
      hasCredits: tenant.credits_remaining > 0,
      credits: parseFloat(tenant.credits_remaining),
      monthlyAllotment: parseFloat(tenant.credits_monthly_allotment),
      model: tenant.selected_model,
      multiplier,
      tier: tenant.tier,
      billingStatus
    };

  } catch (error) {
    if (error.status) throw error;
    console.error('[Metering] Credit check error:', error);
    throw {
      status: 500,
      userMessage: 'Error checking credits',
      message: error.message
    };
  }
}

/**
 * Calculate credits used based on token usage
 * Base rate: 1 credit = 1,000 tokens at Kimi K2.5 (1.0x multiplier)
 *
 * @param {number} inputTokens - Input token count
 * @param {number} outputTokens - Output token count
 * @param {number} multiplier - Model-specific multiplier
 * @returns {number} Credits used
 */
function calculateCredits(inputTokens, outputTokens, multiplier = 1.0) {
  const totalTokens = inputTokens + outputTokens;
  const baseCredits = totalTokens / 1000; // 1 credit per 1K tokens
  return baseCredits * multiplier;
}

/**
 * Deduct credits from tenant balance and log usage
 *
 * @param {string} tenantId - UUID of tenant
 * @param {number} inputTokens - Input token count
 * @param {number} outputTokens - Output token count
 * @param {string} model - Model used
 * @param {number} multiplier - Model multiplier
 * @returns {number} Credits deducted
 */
async function deductCredits(tenantId, inputTokens, outputTokens, model, multiplier) {
  const creditsUsed = calculateCredits(inputTokens, outputTokens, multiplier);

  try {
    // Start transaction
    const client = await require('./db').getDb().connect();

    try {
      await client.query('BEGIN');

      // Deduct from tenant balance
      await client.query(
        `UPDATE tenants
         SET credits_remaining = GREATEST(credits_remaining - $1, 0)
         WHERE id = $2`,
        [creditsUsed, tenantId]
      );

      // Log usage
      await client.query(
        `INSERT INTO credit_usage (
          tenant_id,
          tokens_input,
          tokens_output,
          credits_used,
          model,
          credit_multiplier
        ) VALUES ($1, $2, $3, $4, $5, $6)`,
        [tenantId, inputTokens, outputTokens, creditsUsed, model, multiplier]
      );

      await client.query('COMMIT');

      console.log(`[Metering] Deducted ${creditsUsed.toFixed(2)} credits from tenant ${tenantId} (${inputTokens + outputTokens} tokens, ${model})`);

      return creditsUsed;

    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }

  } catch (error) {
    console.error('[Metering] Deduction error:', error);
    // Don't throw - we don't want to fail the LLM response if logging fails
    // But log prominently for investigation
    console.error('[Metering] CRITICAL: Failed to deduct credits for tenant', tenantId);
    return creditsUsed;
  }
}

module.exports = {
  checkCredits,
  calculateCredits,
  deductCredits,
  MODEL_MULTIPLIERS
};
