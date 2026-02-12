/**
 * Tenant management endpoints
 */

const express = require('express');
const router = express.Router();
const { Pool } = require('pg');
const { generateTenantConfig } = require('../services/config-generator');
const { provisionToRailway } = require('../services/railway-provisioner');

// Use DATABASE_URL from environment (Railway) or fallback to localhost
const pool = new Pool(
  process.env.DATABASE_URL
    ? {
        connectionString: process.env.DATABASE_URL,
        ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
      }
    : {
        host: 'localhost',
        database: 'winston',
        user: 'winston',
        password: 'winston',
        port: 5432
      }
);

/**
 * GET /api/tenants
 * List all tenants
 */
router.get('/', async (req, res, next) => {
  try {
    const result = await pool.query(`
      SELECT
        id, name, email, industry, tier, status, selected_model,
        credits_remaining, credits_monthly_allotment,
        created_at, updated_at
      FROM tenants
      ORDER BY created_at DESC
    `);

    res.json({
      tenants: result.rows,
      count: result.rows.length
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/tenants/:id
 * Get tenant details
 */
router.get('/:id', async (req, res, next) => {
  try {
    const { id } = req.params;

    const result = await pool.query(`
      SELECT
        t.*,
        ti.id as instance_id,
        ti.railway_service_id,
        ti.status as instance_status,
        ti.health_status
      FROM tenants t
      LEFT JOIN tenant_instances ti ON t.id = ti.tenant_id
      WHERE t.id = $1
    `, [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Tenant not found' });
    }

    res.json({ tenant: result.rows[0] });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/tenants
 * Create new tenant
 */
router.post('/', async (req, res, next) => {
  try {
    const {
      name,
      email,
      industry = 'cannabis',
      sub_industry = 'dispensary',
      website_url,
      tier = 'free',
      selected_model = 'kimi-k2.5'
    } = req.body;

    // Validation
    if (!name || !email) {
      return res.status(400).json({
        error: 'Missing required fields: name, email'
      });
    }

    // Check if email already exists
    const existingTenant = await pool.query(
      'SELECT id FROM tenants WHERE email = $1',
      [email]
    );

    if (existingTenant.rows.length > 0) {
      return res.status(409).json({
        error: 'Tenant with this email already exists'
      });
    }

    // Set credit allotment based on tier
    const creditAllotments = {
      'free': 50000,
      'starter': 500000,
      'growth': 2000000
    };

    const credits = creditAllotments[tier] || 50000;

    // Create tenant
    const result = await pool.query(`
      INSERT INTO tenants (
        name, email, industry, sub_industry, website_url,
        tier, selected_model, credits_remaining, credits_monthly_allotment,
        status
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'provisioning')
      RETURNING *
    `, [name, email, industry, sub_industry, website_url, tier, selected_model, credits, credits]);

    const tenant = result.rows[0];

    console.log(`[API] Created tenant: ${tenant.id} (${tenant.email})`);

    res.status(201).json({
      tenant,
      message: 'Tenant created successfully. Use POST /api/tenants/:id/provision to deploy to Railway.'
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/tenants/:id/provision
 * Provision tenant to Railway
 */
router.post('/:id/provision', async (req, res, next) => {
  try {
    const { id } = req.params;
    const {
      agentName,
      personality,
      tone = 'casual',
      capabilities = [],
      channels = { telegram: false, slack: false, whatsapp: false, webchat: true },
      telegramBotToken
    } = req.body;

    // Get tenant
    const tenantResult = await pool.query(
      'SELECT * FROM tenants WHERE id = $1',
      [id]
    );

    if (tenantResult.rows.length === 0) {
      return res.status(404).json({ error: 'Tenant not found' });
    }

    const tenant = tenantResult.rows[0];

    console.log(`[API] Provisioning tenant ${id} to Railway...`);

    // Generate configs
    const configs = await generateTenantConfig(tenant, {
      agentName,
      personality,
      tone,
      capabilities,
      channels,
      telegramBotToken
    });

    // Provision to Railway with progress callback
    const provisionResult = await provisionToRailway(tenant, configs, async (progress) => {
      // Save incremental progress to prevent data loss on partial failures
      if (progress.serviceId && progress.step === 'service_created') {
        await pool.query(`
          UPDATE tenants
          SET railway_service_id = $1, updated_at = NOW()
          WHERE id = $2
        `, [progress.serviceId, id]);
        console.log(`[API] Saved Railway service ID: ${progress.serviceId}`);
      }

      if (progress.url && progress.step === 'url_created') {
        await pool.query(`
          UPDATE tenants
          SET railway_url = $1, updated_at = NOW()
          WHERE id = $2
        `, [progress.url, id]);
        console.log(`[API] Saved Railway URL: ${progress.url}`);
      }
    });

    // Update tenant status to active
    await pool.query(`
      UPDATE tenants
      SET status = 'active', updated_at = NOW()
      WHERE id = $1
    `, [id]);

    // Create tenant instance record
    await pool.query(`
      INSERT INTO tenant_instances (
        tenant_id, instance_name, railway_service_id,
        status, config_version
      ) VALUES ($1, $2, $3, 'running', '1.0')
    `, [id, `${tenant.name} Gateway`, provisionResult.serviceId]);

    console.log(`[API] Tenant ${id} provisioned successfully`);

    res.json({
      message: 'Tenant provisioned successfully',
      railwayServiceId: provisionResult.serviceId,
      railwayUrl: provisionResult.url,
      gatewayToken: configs.gatewayToken
    });

  } catch (error) {
    // Log detailed error for debugging
    console.error('[API] Provisioning failed:', {
      tenantId: id,
      error: error.message,
      stack: error.stack,
      response: error.response?.data
    });

    // Update tenant status to error
    try {
      await pool.query(`
        UPDATE tenants
        SET status = 'error', updated_at = NOW()
        WHERE id = $1
      `, [req.params.id]);
    } catch (updateError) {
      console.error('[API] Failed to update tenant status:', updateError);
    }

    next(error);
  }
});

/**
 * PATCH /api/tenants/:id
 * Update tenant
 */
router.patch('/:id', async (req, res, next) => {
  try {
    const { id } = req.params;
    const updates = req.body;

    // Allowed fields to update
    const allowedFields = ['name', 'website_url', 'selected_model', 'tier', 'stripe_customer_id', 'stripe_subscription_id'];
    const updateFields = Object.keys(updates).filter(key => allowedFields.includes(key));

    if (updateFields.length === 0) {
      return res.status(400).json({ error: 'No valid fields to update' });
    }

    const setClause = updateFields.map((field, index) =>
      `${field} = $${index + 2}`
    ).join(', ');

    const values = [id, ...updateFields.map(field => updates[field])];

    const result = await pool.query(`
      UPDATE tenants
      SET ${setClause}, updated_at = NOW()
      WHERE id = $1
      RETURNING *
    `, values);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Tenant not found' });
    }

    console.log(`[API] Updated tenant: ${id}`);

    res.json({ tenant: result.rows[0] });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/tenants/:id/health
 * Get tenant health status
 */
router.get('/:id/health', async (req, res, next) => {
  try {
    const { id } = req.params;

    const result = await pool.query(`
      SELECT
        t.id, t.name, t.status, t.credits_remaining,
        ti.railway_service_id, ti.health_status, ti.last_health_check,
        ch.channel, ch.status as channel_status, ch.error_message
      FROM tenants t
      LEFT JOIN tenant_instances ti ON t.id = ti.tenant_id
      LEFT JOIN channel_health ch ON t.id = ch.tenant_id
      WHERE t.id = $1
    `, [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Tenant not found' });
    }

    res.json({ health: result.rows });
  } catch (error) {
    next(error);
  }
});

/**
 * DELETE /api/tenants/:id
 * Delete a tenant
 */
router.delete('/:id', async (req, res, next) => {
  try {
    const { id } = req.params;

    // Check if tenant exists
    const checkResult = await pool.query(
      'SELECT id FROM tenants WHERE id = $1',
      [id]
    );

    if (checkResult.rows.length === 0) {
      return res.status(404).json({ error: 'Not found' });
    }

    // Delete tenant (cascade will delete related records)
    await pool.query('DELETE FROM tenants WHERE id = $1', [id]);

    console.log(`[API] Deleted tenant ${id}`);

    res.json({ message: 'Tenant deleted successfully' });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
