import "dotenv/config";
import express from "express";
import { createServer } from "http";
import net from "net";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import { registerOAuthRoutes } from "./oauth";
import { appRouter } from "../routers";
import { createContext } from "./context";
import { serveStatic, setupVite } from "./vite";
import { storageGetContent, isUsingLocalStorage } from "../storage";
import { getDb } from "../db";

// Simple in-memory rate limiter
const rateLimitStore = new Map<string, { count: number; resetTime: number }>();
const RATE_LIMIT_WINDOW_MS = 60 * 1000; // 1 minute
const RATE_LIMIT_MAX_REQUESTS = 100; // 100 requests per minute

function rateLimiter(req: express.Request, res: express.Response, next: express.NextFunction) {
  const ip = req.ip || req.socket.remoteAddress || 'unknown';
  const now = Date.now();
  
  const record = rateLimitStore.get(ip);
  
  if (!record || now > record.resetTime) {
    rateLimitStore.set(ip, { count: 1, resetTime: now + RATE_LIMIT_WINDOW_MS });
    return next();
  }
  
  if (record.count >= RATE_LIMIT_MAX_REQUESTS) {
    res.setHeader('Retry-After', Math.ceil((record.resetTime - now) / 1000));
    return res.status(429).json({ 
      error: 'Too many requests', 
      retryAfter: Math.ceil((record.resetTime - now) / 1000) 
    });
  }
  
  record.count++;
  return next();
}

// Clean up old rate limit entries every 5 minutes
setInterval(() => {
  const now = Date.now();
  const entries = Array.from(rateLimitStore.entries());
  for (const [ip, record] of entries) {
    if (now > record.resetTime) {
      rateLimitStore.delete(ip);
    }
  }
}, 5 * 60 * 1000);

function isPortAvailable(port: number): Promise<boolean> {
  return new Promise(resolve => {
    const server = net.createServer();
    server.listen(port, () => {
      server.close(() => resolve(true));
    });
    server.on("error", () => resolve(false));
  });
}

async function findAvailablePort(startPort: number = 3000): Promise<number> {
  for (let port = startPort; port < startPort + 20; port++) {
    if (await isPortAvailable(port)) {
      return port;
    }
  }
  throw new Error(`No available port found starting from ${startPort}`);
}

async function startServer() {
  const app = express();
  const server = createServer(app);
  
  // Trust proxy for accurate IP detection behind load balancers
  app.set('trust proxy', 1);
  
  // Configure body parser with larger size limit for file uploads
  app.use(express.json({ limit: "50mb" }));
  app.use(express.urlencoded({ limit: "50mb", extended: true }));
  
  // Health check endpoint (no rate limiting)
  app.get('/api/health', async (req, res) => {
    const startTime = Date.now();
    let dbStatus = 'unknown';
    let dbLatency = 0;
    
    try {
      const dbStart = Date.now();
      const db = await getDb();
      if (db) {
        // Simple query to check database connectivity
        await db.execute('SELECT 1');
        dbStatus = 'healthy';
      } else {
        dbStatus = 'unavailable';
      }
      dbLatency = Date.now() - dbStart;
    } catch (error) {
      dbStatus = 'error';
      console.error('Health check DB error:', error);
    }
    
    const health = {
      status: dbStatus === 'healthy' ? 'ok' : 'degraded',
      timestamp: new Date().toISOString(),
      version: '1.0.0',
      uptime: process.uptime(),
      checks: {
        database: {
          status: dbStatus,
          latencyMs: dbLatency,
        },
        memory: {
          heapUsedMB: Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
          heapTotalMB: Math.round(process.memoryUsage().heapTotal / 1024 / 1024),
        },
      },
      responseTimeMs: Date.now() - startTime,
    };
    
    const statusCode = health.status === 'ok' ? 200 : 503;
    return res.status(statusCode).json(health);
  });
  
  // Readiness probe (for Kubernetes-style deployments)
  app.get('/api/ready', async (req, res) => {
    try {
      const db = await getDb();
      if (db) {
        await db.execute('SELECT 1');
        return res.status(200).json({ ready: true });
      }
      return res.status(503).json({ ready: false, reason: 'database_unavailable' });
    } catch (error) {
      return res.status(503).json({ ready: false, reason: 'database_error' });
    }
  });
  
  // Liveness probe
  app.get('/api/live', (req, res) => {
    return res.status(200).json({ live: true });
  });
  
  // Apply rate limiting to API routes
  app.use('/api', rateLimiter);
  
  // WhatsApp webhook routes with raw body capture for signature verification
  // CRITICAL: Must be BEFORE express.json() middleware would process the body
  app.post('/api/webhooks/whatsapp/:configId', express.raw({ type: 'application/json' }), async (req, res) => {
    const configId = req.params.configId;
    const rawBody = req.body as Buffer;
    const signature = req.headers['x-hub-signature-256'] as string;
    
    // Return 200 immediately to acknowledge receipt (Meta requires fast response)
    res.status(200).send('EVENT_RECEIVED');
    
    // Process asynchronously
    setImmediate(async () => {
      try {
        // Parse the JSON payload
        const payload = JSON.parse(rawBody.toString());
        
        // Extract message details from WhatsApp webhook payload
        const entry = payload.entry?.[0];
        const changes = entry?.changes?.[0];
        const message = changes?.value?.messages?.[0];
        
        if (message) {
          const { processInboundMessage } = await import('../services/conversationalAgent');
          await processInboundMessage({
            channel: 'whatsapp',
            senderIdentifier: message.from,
            senderDisplayName: changes?.value?.contacts?.[0]?.profile?.name,
            messageType: message.type || 'text',
            textContent: message.text?.body || message.caption,
            rawPayload: payload,
          });
        }
      } catch (error) {
        console.error('WhatsApp webhook processing error:', error);
      }
    });
  });
  
  // WhatsApp webhook verification (GET request from Meta)
  app.get('/api/webhooks/whatsapp/:configId', (req, res) => {
    const mode = req.query['hub.mode'];
    const token = req.query['hub.verify_token'];
    const challenge = req.query['hub.challenge'];
    
    // Meta sends these params for webhook verification
    if (mode === 'subscribe' && token === req.params.configId) {
      console.log('WhatsApp webhook verified for config:', req.params.configId);
      return res.status(200).send(challenge);
    }
    
    return res.status(403).send('Forbidden');
  });
  
  // OAuth callback under /api/oauth/callback
  registerOAuthRoutes(app);
  
  // File download endpoint for local storage
  app.get('/api/download/:fileKey(*)', async (req, res) => {
    try {
      const fileKey = decodeURIComponent(req.params.fileKey);
      const file = await storageGetContent(fileKey);
      
      if (!file) {
        return res.status(404).json({ error: 'File not found' });
      }
      
      // Set appropriate headers
      res.setHeader('Content-Type', file.contentType);
      res.setHeader('Content-Length', file.size);
      res.setHeader('Content-Disposition', `inline; filename="${fileKey.split('/').pop()}"`); 
      res.setHeader('Cache-Control', 'public, max-age=31536000');
      
      return res.send(file.content);
    } catch (error) {
      console.error('Download error:', error);
      return res.status(500).json({ error: 'Failed to download file' });
    }
  });
  // tRPC API
  app.use(
    "/api/trpc",
    createExpressMiddleware({
      router: appRouter,
      createContext,
    })
  );
  // development mode uses Vite, production mode uses static files
  if (process.env.NODE_ENV === "development") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }

  const preferredPort = parseInt(process.env.PORT || "3000");
  const port = await findAvailablePort(preferredPort);

  if (port !== preferredPort) {
    console.log(`Port ${preferredPort} is busy, using port ${port} instead`);
  }

  server.listen(port, () => {
    console.log(`Server running on http://localhost:${port}/`);
  });
}

startServer().catch(console.error);
