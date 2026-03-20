/**
 * Winston Express application factory.
 *
 * Call createApp() to get a configured app instance (useful for testing).
 * Call startServer() to bind to a port and start serving.
 */

import express, { Request, Response } from 'express';
import { apiRouter } from './api/router';

export function createApp(): express.Application {
  const app = express();

  // Parse JSON bodies (max 100kb — questions are text, not file uploads)
  app.use(express.json({ limit: '100kb' }));

  // Mount versioned API router
  app.use('/api/v1', apiRouter);

  // Health check — no auth required
  app.get('/health', (_req: Request, res: Response) => {
    res.json({ status: 'ok', service: 'winston' });
  });

  // 404 for unknown routes
  app.use((_req: Request, res: Response) => {
    res.status(404).json({ error: 'Not found' });
  });

  return app;
}

export async function startServer(port = 3000): Promise<void> {
  const app = createApp();
  app.listen(port, () => {
    console.log(`Winston API listening on port ${port}`);
  });
}

// Direct execution: node dist/server.js
if (require.main === module) {
  const port = parseInt(process.env.PORT ?? '3000', 10);
  startServer(port).catch((err) => {
    console.error('Failed to start server:', err);
    process.exit(1);
  });
}
