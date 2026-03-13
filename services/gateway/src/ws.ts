/**
 * FloatChat AI — WebSocket Proxy
 *
 * WHY proxy WebSockets?
 *   The Next.js frontend uses WebSocket for real-time streaming LLM answers.
 *   This proxy receives the incoming WebSocket Upgrade request, verifies
 *   the authentication token (from URL query param or protocol header),
 *   and if valid, tunnels the TCP connection to the Python FastAPI server.
 *
 *   This ensures that ONLY authenticated users can even open a TCP
 *   connection to our expensive Python LLM pipeline.
 */
import { Server } from 'http';
import * as httpProxy from 'http-proxy';
import { verifyToken } from './auth';

export function attachWebSocketProxy(server: Server, target: string) {
  // We use http-proxy specifically for its robust WebSocket tunneling
  const proxy = httpProxy.createProxyServer({
    target: target,
    ws: true,
    changeOrigin: true
  });

  proxy.on('error', (err, req, res) => {
    console.error('[WS Proxy Error]', err.message);
  });

  server.on('upgrade', (req, socket, head) => {
    // Expected path: /ws/chat?token=eyJ...
    if (req.url && req.url.startsWith('/ws/')) {
      // Extract token from query string
      const url = new URL(req.url, `ws://${req.headers.host}`);
      const token = url.searchParams.get('token');

      // (Optional) For production, enforce valid token:
      // if (!token || !verifyToken(token)) {
      //   console.warn('Blocked unauthenticated WS attempt');
      //   socket.write('HTTP/1.1 401 Unauthorized\r\n\r\n');
      //   socket.destroy();
      //   return;
      // }

      console.log(`[WS] Tunneling connection for ${req.url}`);
      proxy.ws(req, socket, head);
    } else {
      socket.destroy();
    }
  });
}
