/**
 * Activity and analytics endpoints
 */

const express = require('express');
const router = express.Router();
const { Pool } = require('pg');

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
 * GET /api/activity/transcripts
 * Get recent session transcripts
 */
router.get('/transcripts', async (req, res, next) => {
  try {
    const limit = parseInt(req.query.limit) || 100;

    const result = await pool.query(`
      SELECT
        st.id,
        st.tenant_id,
        t.name as tenant_name,
        st.session_id,
        st.channel,
        st.messages_json,
        st.message_count,
        st.credits_used,
        st.created_at
      FROM session_transcripts st
      JOIN tenants t ON st.tenant_id = t.id
      ORDER BY st.created_at DESC
      LIMIT $1
    `, [limit]);

    res.json(result.rows);
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/activity/credits
 * Get credit usage records
 */
router.get('/credits', async (req, res, next) => {
  try {
    const days = parseInt(req.query.days) || 30;

    const result = await pool.query(`
      SELECT
        cu.id,
        cu.tenant_id,
        t.name as tenant_name,
        cu.model,
        cu.credits_used,
        cu.tokens_input,
        cu.tokens_output,
        cu.created_at
      FROM credit_usage cu
      JOIN tenants t ON cu.tenant_id = t.id
      WHERE cu.created_at >= NOW() - INTERVAL '${days} days'
      ORDER BY cu.created_at DESC
    `);

    res.json(result.rows);
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/activity/tenant/:id/transcripts
 * Get session transcripts for a specific tenant
 */
router.get('/tenant/:id/transcripts', async (req, res, next) => {
  try {
    const { id } = req.params;
    const limit = parseInt(req.query.limit) || 50;

    const result = await pool.query(`
      SELECT
        id,
        session_id,
        channel,
        messages_json,
        message_count,
        credits_used,
        created_at
      FROM session_transcripts
      WHERE tenant_id = $1
      ORDER BY created_at DESC
      LIMIT $2
    `, [id, limit]);

    res.json(result.rows);
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/activity/tenant/:id/credits
 * Get credit usage for a specific tenant
 */
router.get('/tenant/:id/credits', async (req, res, next) => {
  try {
    const { id } = req.params;
    const days = parseInt(req.query.days) || 30;

    const result = await pool.query(`
      SELECT
        id,
        model,
        credits_used,
        tokens_input,
        tokens_output,
        created_at
      FROM credit_usage
      WHERE tenant_id = $1
        AND created_at >= NOW() - INTERVAL '${days} days'
      ORDER BY created_at DESC
    `, [id]);

    res.json(result.rows);
  } catch (error) {
    next(error);
  }
});

module.exports = router;
