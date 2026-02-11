/**
 * Health check endpoint
 */

const express = require('express');
const router = express.Router();
const { Pool } = require('pg');

const pool = new Pool({
  host: 'localhost',
  database: 'winston',
  user: 'winston',
  password: 'winston',
  port: 5432
});

router.get('/', async (req, res) => {
  try {
    // Test database connection
    await pool.query('SELECT 1');

    res.json({
      status: 'healthy',
      service: 'winston-api',
      timestamp: new Date().toISOString(),
      database: 'connected',
      version: '0.1.0'
    });
  } catch (error) {
    res.status(503).json({
      status: 'unhealthy',
      service: 'winston-api',
      timestamp: new Date().toISOString(),
      database: 'disconnected',
      error: error.message
    });
  }
});

module.exports = router;
