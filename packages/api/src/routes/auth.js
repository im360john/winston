/**
 * Authentication endpoints
 */

const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const { Pool } = require('pg');

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
 * POST /api/auth/signup
 * Create new user account
 */
router.post('/signup', async (req, res, next) => {
  try {
    const { email, password, name, tenantId } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        error: 'Email and password are required'
      });
    }

    if (password.length < 8) {
      return res.status(400).json({
        error: 'Password must be at least 8 characters'
      });
    }

    // Check if user already exists
    const existingUser = await pool.query(
      'SELECT id FROM users WHERE email = $1',
      [email]
    );

    if (existingUser.rows.length > 0) {
      return res.status(409).json({
        error: 'User with this email already exists'
      });
    }

    // Hash password
    const passwordHash = await bcrypt.hash(password, 10);

    // Create user
    const result = await pool.query(
      `INSERT INTO users (email, password_hash, name, tenant_id, created_at)
       VALUES ($1, $2, $3, $4, NOW())
       RETURNING id, email, name, tenant_id`,
      [email, passwordHash, name || email.split('@')[0], tenantId]
    );

    const user = result.rows[0];

    console.log(`[Auth] Created user: ${user.id} (${user.email})`);

    res.status(201).json({
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        tenantId: user.tenant_id
      }
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/auth/login
 * Authenticate user
 */
router.post('/login', async (req, res, next) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        error: 'Email and password are required'
      });
    }

    // Find user
    const result = await pool.query(
      'SELECT id, email, name, password_hash, tenant_id FROM users WHERE email = $1',
      [email]
    );

    if (result.rows.length === 0) {
      return res.status(401).json({
        error: 'Invalid email or password'
      });
    }

    const user = result.rows[0];

    // Verify password
    const isValid = await bcrypt.compare(password, user.password_hash);

    if (!isValid) {
      return res.status(401).json({
        error: 'Invalid email or password'
      });
    }

    console.log(`[Auth] User logged in: ${user.id} (${user.email})`);

    res.json({
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        tenantId: user.tenant_id
      }
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/auth/me
 * Get current user (requires auth middleware)
 */
router.get('/me', async (req, res, next) => {
  try {
    // TODO: Add auth middleware to extract user from JWT
    // For now, this is a placeholder
    res.json({ user: null });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
