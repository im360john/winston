// ============================================================================
// Winston Sidecar API
// Live file management for tenant containers without restarts
// ============================================================================

import chokidar from "chokidar";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

export function setupWinstonSidecar(app, STATE_DIR) {
  const WINSTON_DIR = path.join(STATE_DIR, '.winston');
  const CHANGES_LOG = path.join(WINSTON_DIR, 'changes.jsonl');

  // Ensure Winston directory exists
  fs.mkdirSync(WINSTON_DIR, { recursive: true });

  // Winston authentication middleware
  function winstonAuth(req, res, next) {
    const authHeader = req.headers.authorization || '';
    const [scheme, token] = authHeader.split(' ');

    if (scheme !== 'Bearer' || !token) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    if (!process.env.WINSTON_SIDECAR_TOKEN) {
      console.error('⚠️  WINSTON_SIDECAR_TOKEN not set - API is UNSECURED');
    }

    if (token !== process.env.WINSTON_SIDECAR_TOKEN) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    next();
  }

  // Log file change
  function logChange(filePath, action, source = 'admin') {
    const entry = JSON.stringify({
      timestamp: new Date().toISOString(),
      file: filePath,
      action,
      source
    }) + '\n';

    try {
      fs.appendFileSync(CHANGES_LOG, entry);
    } catch (err) {
      console.error('[Winston] Failed to log change:', err.message);
    }
  }

  // Watch for file changes (agent-initiated)
  const watcher = chokidar.watch([
    path.join(STATE_DIR, '**/*.md'),
    path.join(STATE_DIR, '**/*.json'),
    path.join(STATE_DIR, 'skills/**/*')
  ], {
    ignored: [
      WINSTON_DIR,
      path.join(STATE_DIR, 'node_modules'),
      /[\/\\]\./
    ],
    persistent: true,
    ignoreInitial: true
  });

  watcher.on('change', (filePath) => {
    const relativePath = path.relative(STATE_DIR, filePath);
    logChange(relativePath, 'modified', 'agent');
    console.log(`[Winston] 📝 File changed by agent: ${relativePath}`);
  });

  watcher.on('add', (filePath) => {
    const relativePath = path.relative(STATE_DIR, filePath);
    logChange(relativePath, 'created', 'agent');
    console.log(`[Winston] 📄 File created by agent: ${relativePath}`);
  });

  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('🔧 Winston Sidecar API');
  console.log('📁 State directory:', STATE_DIR);
  console.log('👁️  Watching patterns: **/*.md, **/*.json, skills/**/*');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

  // ============================================================================
  // Winston API Routes
  // ============================================================================

  // Health check (no auth required)
  app.get('/winston/health', (req, res) => {
    res.json({
      status: 'ok',
      service: 'winston-sidecar',
      uptime: process.uptime(),
      tenant_id: process.env.WINSTON_TENANT_ID,
      state_dir: STATE_DIR
    });
  });

  // List files in a directory
  app.get(/^\/winston\/files\/(.*)$/, winstonAuth, (req, res) => {
    const filePath = path.join(STATE_DIR, req.params[0] || '');

    // Security: prevent path traversal
    if (!filePath.startsWith(STATE_DIR)) {
      return res.status(403).json({ error: 'Access denied' });
    }

    // Check if directory
    try {
      const stats = fs.statSync(filePath);

      if (stats.isDirectory()) {
        const entries = fs.readdirSync(filePath);
        const files = entries.map(name => {
          const fullPath = path.join(filePath, name);
          const stat = fs.statSync(fullPath);
          return {
            name,
            type: stat.isDirectory() ? 'directory' : 'file',
            size: stat.size,
            mtime: stat.mtime
          };
        });
        return res.json({ files });
      }

      // Read file
      const content = fs.readFileSync(filePath, 'utf8');
      const hash = crypto.createHash('sha256').update(content).digest('hex');

      res.json({
        content,
        metadata: {
          path: path.relative(STATE_DIR, filePath),
          size: stats.size,
          mtime: stats.mtime,
          hash
        }
      });
    } catch (err) {
      if (err.code === 'ENOENT') {
        return res.status(404).json({ error: 'File not found' });
      }
      res.status(500).json({ error: err.message });
    }
  });

  // Write file
  app.put(/^\/winston\/files\/(.*)$/, winstonAuth, (req, res) => {
    const filePath = path.join(STATE_DIR, req.params[0]);
    const { content } = req.body;

    if (!content) {
      return res.status(400).json({ error: 'Missing content field' });
    }

    // Security: prevent path traversal
    if (!filePath.startsWith(STATE_DIR)) {
      return res.status(403).json({ error: 'Access denied' });
    }

    // Don't allow writing to .winston directory
    if (filePath.startsWith(WINSTON_DIR)) {
      return res.status(403).json({ error: 'Cannot write to Winston internal directory' });
    }

    try {
      // Ensure directory exists
      fs.mkdirSync(path.dirname(filePath), { recursive: true });

      // Parse content if it's JSON string
      let finalContent = content;
      if (typeof content === 'string') {
        try {
          // If it's a JSON string, parse and re-stringify for formatting
          const parsed = JSON.parse(content);
          finalContent = JSON.stringify(parsed, null, 2);
        } catch {
          // Not JSON, use as-is
          finalContent = content;
        }
      }

      fs.writeFileSync(filePath, finalContent, 'utf8');

      const stats = fs.statSync(filePath);
      const hash = crypto.createHash('sha256').update(finalContent).digest('hex');

      logChange(path.relative(STATE_DIR, filePath), 'modified', 'admin');

      res.json({
        success: true,
        path: path.relative(STATE_DIR, filePath),
        size: stats.size,
        hash
      });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // Get change log
  app.get('/winston/changes', winstonAuth, (req, res) => {
    try {
      if (!fs.existsSync(CHANGES_LOG)) {
        return res.json({ changes: [] });
      }

      const content = fs.readFileSync(CHANGES_LOG, 'utf8');
      const changes = content
        .trim()
        .split('\n')
        .filter(line => line)
        .map(line => JSON.parse(line));

      res.json({ changes });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  return watcher;
}
