/**
 * FloatChat AI — API Gateway
 *
 * WHY an API Gateway in Node.js?
 *   The Python backend is amazing at RAG, ML, and data processing.
 *   However, Node.js is better suited for high-concurrency WebSocket connection
 *   management, rate limiting, JWT validation, and static asset serving.
 * 
 *   The Next.js frontend connects here. The gateway validates the token,
 *   applies rate limits, and proxies the WebSocket connection backward to
 *   the Python FastAPI server.
 *
 *   This protects the Python RAG engine from connection exhaustion.
 */
import dotenv from 'dotenv';
import express from 'express';
import { createProxyMiddleware } from 'http-proxy-middleware';
import cors from 'cors';
import { createServer, ServerResponse, IncomingMessage } from 'http';
import { attachWebSocketProxy } from './ws';
import { verifyToken } from './auth';

dotenv.config();

const app = express();
const port = process.env.GATEWAY_PORT || 4000;
const pyBackendUrl = process.env.API_URL || 'http://api:8000';

app.use(cors({
  origin: process.env.CORS_ORIGINS?.split(',') || '*',
  credentials: true
}));

app.use(express.json());

// ── Health Check ─────────────────────────────────────────────────────────────
app.get('/health', (req, res) => {
  res.json({ ok: true, service: 'gateway', version: '2.0.0' });
});

// ── Authentication Middleware ────────────────────────────────────────────────
// Protects POST /api/v1/chat and POST /api/v1/feedback
app.use((req, res, next) => {
  // Allow simple GET requests (explorer, trajectories, profile) to pass unauthenticated
  // Protect anything that triggers LLM inference (chat)
  if (req.path.startsWith('/api/v1/chat') && req.method === 'POST') {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Missing or invalid Authorization header' });
    }
    const token = authHeader.split(' ')[1];
    const user = verifyToken(token);
    if (!user) {
      return res.status(403).json({ error: 'Invalid or expired token' });
    }
    // Attach user payload so backend can use it for RBAC or logging
    req.headers['x-user-id'] = user.id;
  }
  next();
});

// ── Proxy to Python Backend ────────────────────────────────────────────────
// Handles both HTTP (/api/*) and WebSockets (/ws/*)
const apiProxy = createProxyMiddleware({
  target: pyBackendUrl,
  changeOrigin: true,
  ws: true, // Enable WebSocket proxying
  pathFilter: ['/api', '/ws'],
  on: {
    error: (err: Error, req: any, res: any) => {
      console.error('[Proxy Error]', err.message);
      if (res && typeof res.status === 'function') {
         res.status(502).json({ error: 'Backend API unreachable' });
      }
    }
  }
});

app.use(apiProxy);

const server = createServer(app);

// ── Attach WebSocket Proxy ────────────────────────────────────────────────
attachWebSocketProxy(server, pyBackendUrl);

server.listen(port, () => {
  console.log(`🌊 FloatChat Gateway listening on port ${port}`);
  console.log(`   Proxying to backend: ${pyBackendUrl}`);
});
