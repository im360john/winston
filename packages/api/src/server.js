/**
 * Winston API Server
 *
 * Core API for tenant provisioning, management, and operations
 *
 * Endpoints:
 * - POST   /api/tenants          Create new tenant
 * - GET    /api/tenants          List all tenants
 * - GET    /api/tenants/:id      Get tenant details
 * - PATCH  /api/tenants/:id      Update tenant
 * - DELETE /api/tenants/:id      Delete tenant
 * - GET    /api/tenants/:id/health  Get tenant health status
 * - POST   /api/tenants/:id/provision  Provision tenant to Railway
 */

require('dotenv').config({ path: require('path').join(__dirname, '../../../.env') });
const express = require('express');
const cors = require('cors');
const tenantsRouter = require('./routes/tenants');
const healthRouter = require('./routes/health');
const websiteRouter = require('./routes/website');

const app = express();
const PORT = process.env.PORT || process.env.WINSTON_API_PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json());

// Request logging
app.use((req, res, next) => {
  console.log(`[API] ${req.method} ${req.path}`);
  next();
});

// Routes
app.use('/api/health', healthRouter);
app.use('/api/tenants', tenantsRouter);
app.use('/api/website', websiteRouter);

// Error handling
app.use((err, req, res, next) => {
  console.error('[API] Error:', err);
  res.status(err.status || 500).json({
    error: err.message || 'Internal server error',
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: 'Not found' });
});

// Start server
app.listen(PORT, () => {
  console.log(`[API] Winston API listening on port ${PORT}`);
  console.log(`[API] Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`[API] Database: ${process.env.DATABASE_URL ? 'Connected' : 'NOT CONFIGURED'}`);
  console.log(`[API] Railway token: ${process.env.RAILWAY_API_TOKEN ? 'Set' : 'NOT SET'}`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('[API] SIGTERM received, shutting down gracefully');
  process.exit(0);
});

module.exports = app;
