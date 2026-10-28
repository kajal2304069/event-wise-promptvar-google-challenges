
const http = require('http');
const fs = require('fs');
const path = require('path');

/* ---- load .env (no dotenv needed) ---- */
try {
  fs.readFileSync(path.join(__dirname, '.env'), 'utf8').split(/\r?\n/).forEach((line) => {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);
    if (m && !line.trim().startsWith('#') && process.env[m[1]] === undefined) {
      process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
    }
  });
} catch (_) { /* no .env file, that is fine */ }

const PORT = Number(process.env.PORT) || 3000;
const API_KEY = process.env.ANTHROPIC_API_KEY || '';
const MODEL = process.env.ANTHROPIC_MODEL || 'claude-sonnet-5-5';
const API_URL = (process.env.ANTHROPIC_BASE_URL || 'https://api.anthropic.com').replace(/\/+$/, '') + '/v1/messages';
const PUBLIC_DIR = path.join(__dirname, 'public');
const MAX_BODY = 1024 * 1024; // 1 MB

const MIME = {
  '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg',
  '.ico': 'image/x-icon', '.webmanifest': 'application/manifest+json', '.txt': 'text/plain; charset=utf-8'
};

/* ---- very small per-IP rate limit: 30 AI calls per minute ---- */
const hits = new Map();
function limited(ip) {
  const now = Date.now();
  const list = (hits.get(ip) || []).filter((t) => now - t < 60000);
  list.push(now);
  hits.set(ip, list);
  return list.length > 30;
}

function send(res, status, body, headers) {
  const isObj = typeof body === 'object' && !Buffer.isBuffer(body);
  res.writeHead(status, Object.assign({ 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' }, headers || {}));
  res.end(isObj ? JSON.stringify(body) : body);
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks = [];
    req.on('data', (c) => {
      size += c.length;
      if (size > MAX_BODY) { reject(new Error('too_large')); req.destroy(); return; }
      chunks.push(c);
    });
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    req.on('error', reject);
  });
}

async function handleChat(req, res) {
  if (!API_KEY) return send(res, 503, { code: 'no_key', error: 'ANTHROPIC_API_KEY is not set on the server.' });
  const ip = req.socket.remoteAddress || 'unknown';
  if (limited(ip)) return send(res, 429, { code: 'rate_limited', error: 'Too many requests. Wait a minute and try again.' });

  let input;
  try { input = JSON.parse(await readBody(req)); }
  catch (e) { return send(res, 400, { code: 'bad_request', error: 'Request body must be valid JSON under 1 MB.' }); }

  if (!Array.isArray(input.messages) || !input.messages.length) return send(res, 400, { code: 'bad_request', error: 'messages is required.' });

  const payload = {
    model: MODEL,
    max_tokens: Math.min(Math.max(Number(input.max_tokens) || 1024, 64), 2048),
    system: typeof input.system === 'string' ? input.system.slice(0, 20000) : undefined,
    messages: input.messages
  };
  if (Array.isArray(input.tools) && input.tools.length) payload.tools = input.tools.slice(0, 8);

  try {
    const r = await fetch(API_URL, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-api-key': API_KEY, 'anthropic-version': '2023-06-01' },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(90000)
    });
    const data = await r.json().catch(() => ({}));
    if (!r.ok) {
      const msg = (data && data.error && data.error.message) || 'The AI service returned an error.';
      const code = r.status === 401 || r.status === 403 ? 'bad_key' : r.status === 429 ? 'rate_limited' : r.status === 400 ? 'bad_request' : 'upstream_error';
      console.error('Anthropic API error', r.status, msg);
      return send(res, r.status === 401 || r.status === 403 ? 502 : r.status, { code, error: msg });
    }
    return send(res, 200, { content: data.content || [], stop_reason: data.stop_reason || 'end_turn' });
  } catch (e) {
    console.error('Anthropic request failed:', e && e.message);
    return send(res, 502, { code: 'upstream_error', error: 'Could not reach the AI service.' });
  }
}

function serveStatic(req, res) {
  let urlPath;
  try { urlPath = decodeURIComponent(new URL(req.url, 'http://x').pathname); }
  catch (_) { return send(res, 400, 'Bad request', { 'Content-Type': 'text/plain' }); }
  if (urlPath === '/') urlPath = '/index.html';
  const file = path.normalize(path.join(PUBLIC_DIR, urlPath));
  if (!file.startsWith(PUBLIC_DIR + path.sep)) return send(res, 403, 'Forbidden', { 'Content-Type': 'text/plain' });
  fs.readFile(file, (err, buf) => {
    if (err) return send(res, 404, 'Not found', { 'Content-Type': 'text/plain' });
    const type = MIME[path.extname(file).toLowerCase()] || 'application/octet-stream';
    res.writeHead(200, { 'Content-Type': type, 'Cache-Control': 'no-cache', 'X-Content-Type-Options': 'nosniff' });
    res.end(buf);
  });
}

const server = http.createServer((req, res) => {
  const p = (req.url || '').split('?')[0];
  if (req.method === 'GET' && p === '/api/health') return send(res, 200, { ok: true, ai: !!API_KEY, model: API_KEY ? MODEL : null });
  if (req.method === 'POST' && p === '/api/chat') return handleChat(req, res);
  if (req.method === 'GET' || req.method === 'HEAD') return serveStatic(req, res);
  return send(res, 405, { error: 'Method not allowed' });
});

server.listen(PORT, () => {
  console.log('\n  Eventwise Planner is running at http://localhost:' + PORT);
  console.log(API_KEY ? '  AI assistant: on (model ' + MODEL + ')\n' : '  AI assistant: off. Add ANTHROPIC_API_KEY to a .env file to turn it on.\n');
});
