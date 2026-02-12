/**
 * Winston Sidecar API
 *
 * Provides live file access to tenant container without requiring restarts.
 * Runs alongside OpenClaw (which remains vanilla and unmodified).
 *
 * Features:
 * - Read/write any file in /data/
 * - Track file changes (agent vs admin modifications)
 * - Local change log for audit trail
 * - No OpenClaw code modifications required
 */

const express = require('express')
const fs = require('fs').promises
const path = require('path')
const crypto = require('crypto')
const chokidar = require('chokidar')

const app = express()
app.use(express.json({ limit: '10mb' }))

const DATA_DIR = '/data'
const WINSTON_DIR = '/data/.winston'
const CHANGES_LOG = path.join(WINSTON_DIR, 'changes.jsonl')
const WATCH_PATTERNS = ['**/*.md', '**/*.json', 'skills/**/*']

// Ensure Winston directory exists
fs.mkdir(WINSTON_DIR, { recursive: true }).catch(console.error)

// ============================================================================
// Authentication Middleware
// ============================================================================

function authenticate(req, res, next) {
  const token = req.headers.authorization?.replace('Bearer ', '')

  if (!process.env.WINSTON_SIDECAR_TOKEN) {
    console.error('⚠️  WINSTON_SIDECAR_TOKEN not set - API is UNSECURED')
  }

  if (token !== process.env.WINSTON_SIDECAR_TOKEN) {
    return res.status(401).json({ error: 'Unauthorized' })
  }

  next()
}

// ============================================================================
// File Operations
// ============================================================================

// Read any file
app.get('/files/*', authenticate, async (req, res) => {
  const filePath = path.join(DATA_DIR, req.params[0])

  // Security: prevent path traversal
  if (!filePath.startsWith(DATA_DIR)) {
    return res.status(403).json({ error: 'Access denied' })
  }

  try {
    const content = await fs.readFile(filePath, 'utf-8')
    const stats = await fs.stat(filePath)
    const hash = crypto.createHash('sha256').update(content).digest('hex')

    res.json({
      path: req.params[0],
      content,
      size: stats.size,
      modified: stats.mtime,
      hash
    })
  } catch (err) {
    if (err.code === 'ENOENT') {
      res.status(404).json({ error: 'File not found', path: req.params[0] })
    } else {
      res.status(500).json({ error: err.message })
    }
  }
})

// Write any file
app.put('/files/*', authenticate, async (req, res) => {
  const filePath = path.join(DATA_DIR, req.params[0])
  const { content } = req.body

  // Security: prevent path traversal
  if (!filePath.startsWith(DATA_DIR)) {
    return res.status(403).json({ error: 'Access denied' })
  }

  // Don't allow writing to .winston directory
  if (filePath.startsWith(WINSTON_DIR)) {
    return res.status(403).json({ error: 'Cannot modify .winston directory' })
  }

  if (!content && content !== '') {
    return res.status(400).json({ error: 'Missing content field' })
  }

  try {
    // Create directory if needed
    await fs.mkdir(path.dirname(filePath), { recursive: true })

    // Check if file exists (for change log)
    const existed = await fs.access(filePath).then(() => true).catch(() => false)

    // Write file
    await fs.writeFile(filePath, content, 'utf-8')

    // Log change
    await logChange(req.params[0], 'admin', existed ? 'update' : 'create')

    const stats = await fs.stat(filePath)
    const hash = crypto.createHash('sha256').update(content).digest('hex')

    res.json({
      success: true,
      path: req.params[0],
      size: stats.size,
      hash
    })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// List directory contents
app.get('/files', authenticate, async (req, res) => {
  const relativePath = req.query.path || ''
  const dirPath = path.join(DATA_DIR, relativePath)

  // Security: prevent path traversal
  if (!dirPath.startsWith(DATA_DIR)) {
    return res.status(403).json({ error: 'Access denied' })
  }

  try {
    const entries = await fs.readdir(dirPath, { withFileTypes: true })

    const items = await Promise.all(entries.map(async (entry) => {
      const fullPath = path.join(dirPath, entry.name)
      const stats = await fs.stat(fullPath)

      return {
        name: entry.name,
        type: entry.isDirectory() ? 'directory' : 'file',
        size: entry.isFile() ? stats.size : null,
        modified: stats.mtime
      }
    }))

    // Filter out .winston directory from listings
    const filtered = items.filter(item => item.name !== '.winston')

    res.json({ path: relativePath, items: filtered })
  } catch (err) {
    if (err.code === 'ENOENT') {
      res.status(404).json({ error: 'Directory not found' })
    } else {
      res.status(500).json({ error: err.message })
    }
  }
})

// Get recent changes (from local log)
app.get('/changes', authenticate, async (req, res) => {
  try {
    const logContent = await fs.readFile(CHANGES_LOG, 'utf-8')
    const changes = logContent
      .trim()
      .split('\n')
      .filter(line => line.trim())
      .map(line => JSON.parse(line))
      .reverse() // Most recent first

    const limit = parseInt(req.query.limit) || 100
    res.json({ changes: changes.slice(0, limit) })
  } catch (err) {
    if (err.code === 'ENOENT') {
      res.json({ changes: [] })
    } else {
      res.status(500).json({ error: err.message })
    }
  }
})

// Health check
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    service: 'winston-sidecar',
    uptime: process.uptime(),
    tenant_id: process.env.TENANT_ID
  })
})

// ============================================================================
// Change Tracking
// ============================================================================

async function logChange(filePath, source, action) {
  const logEntry = {
    timestamp: new Date().toISOString(),
    path: filePath,
    source,  // 'agent', 'admin', 'system'
    action   // 'create', 'update', 'delete'
  }

  try {
    await fs.appendFile(CHANGES_LOG, JSON.stringify(logEntry) + '\n')
  } catch (err) {
    console.error('Failed to log change:', err)
  }
}

// Watch for agent-initiated file changes
const watcher = chokidar.watch(WATCH_PATTERNS, {
  cwd: DATA_DIR,
  ignored: [
    /\.winston/,
    /node_modules/,
    /\.git/
  ],
  persistent: true,
  ignoreInitial: true // Don't log existing files on startup
})

watcher.on('change', async (filePath) => {
  console.log(`📝 File changed: ${filePath}`)
  await logChange(filePath, 'agent', 'update')
})

watcher.on('add', async (filePath) => {
  console.log(`📄 File created: ${filePath}`)
  await logChange(filePath, 'agent', 'create')
})

watcher.on('unlink', async (filePath) => {
  console.log(`🗑️  File deleted: ${filePath}`)
  await logChange(filePath, 'agent', 'delete')
})

// ============================================================================
// Server Startup
// ============================================================================

// Use PORT env var for Railway public access, fallback to 18790 for local/internal
const PORT = process.env.PORT || 18790
const HOST = '0.0.0.0'

app.listen(PORT, HOST, () => {
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
  console.log('🔧 Winston Sidecar API')
  console.log(`📡 Listening on ${HOST}:${PORT}`)
  console.log(`🗂️  Data directory: ${DATA_DIR}`)
  console.log(`👁️  Watching patterns: ${WATCH_PATTERNS.join(', ')}`)
  console.log(`🆔 Tenant ID: ${process.env.TENANT_ID || 'NOT SET'}`)
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
})

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('🛑 Received SIGTERM, closing watcher...')
  watcher.close()
  process.exit(0)
})
