import Fastify from 'fastify';
import cors from '@fastify/cors';
import fastifyStatic from '@fastify/static';
import path from 'path';
import fs from 'fs';
import { config } from './config.js';
import { initDatabase } from './db/index.js';
import { ChatHistoryService } from './services/chatHistoryService.js';
import { apiRoutes } from './routes/api.js';

async function bootstrap() {
  // 1. Initialize SQLite database & migrations
  console.log('[Veylora Backend] Initializing SQLite database...');
  initDatabase();

  // 2. Perform 7-day TTL chat sweep on startup
  ChatHistoryService.cleanExpiredConversations();

  // 3. Periodic cleanup interval (runs every 60 minutes)
  const cleanupInterval = setInterval(() => {
    try {
      ChatHistoryService.cleanExpiredConversations();
    } catch (err) {
      console.warn('[Veylora Backend] Error during periodic chat sweep:', err);
    }
  }, 60 * 60 * 1000);
  cleanupInterval.unref();

  // 4. Create Fastify instance
  const server = Fastify({
    logger: {
      level: config.nodeEnv === 'development' ? 'info' : 'warn'
    },
    connectionTimeout: 60000,
    keepAliveTimeout: 30000
  });

  // 5. Restrict CORS to local frontend origins
  await server.register(cors, {
    origin: [
      'http://localhost:5173',
      'http://127.0.0.1:5173',
      'http://localhost:3000',
      'http://127.0.0.1:3000'
    ],
    methods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS']
  });

  // 6. Serve local artifacts (screenshots & reports)
  if (!fs.existsSync(config.artifactsDir)) {
    fs.mkdirSync(config.artifactsDir, { recursive: true });
  }

  await server.register(fastifyStatic, {
    root: config.artifactsDir,
    prefix: '/artifacts/',
    decorateReply: false
  });

  // 7. Register API routes under /api
  await server.register(apiRoutes, { prefix: '/api' });

  // 8. Global error handler: do not expose internal stack traces or secrets to client
  server.setErrorHandler((error, request, reply) => {
    request.log.error(error);
    const statusCode = error.statusCode && error.statusCode >= 400 && error.statusCode < 600 ? error.statusCode : 500;
    const clientMessage = statusCode === 500 ? 'An internal error occurred while processing the request.' : error.message;

    reply.status(statusCode).send({
      error: clientMessage,
      statusCode
    });
  });

  // 9. Start server bound to 127.0.0.1
  try {
    const address = await server.listen({
      host: config.host,
      port: config.port
    });
    console.log(`[Veylora Backend] Server running at ${address} (Bound to ${config.host})`);
  } catch (err) {
    server.log.error(err);
    process.exit(1);
  }

  // Graceful shutdown
  const signals: NodeJS.Signals[] = ['SIGINT', 'SIGTERM'];
  for (const signal of signals) {
    process.on(signal, async () => {
      console.log(`\n[Veylora Backend] Received ${signal}. Shutting down gracefully...`);
      await server.close();
      process.exit(0);
    });
  }
}

bootstrap().catch(err => {
  console.error('[Veylora Backend] Fatal bootstrap error:', err);
  process.exit(1);
});
