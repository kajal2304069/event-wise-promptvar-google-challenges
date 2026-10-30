
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

/* ---- provider setup ---- */
const PRESETS = {
  anthropic:  { kind: 'anthropic', model: 'claude-sonnet-5-5', keyEnv: 'ANTHROPIC_API_KEY' },
  mistral:    { kind: 'openai', base: 'https://api.mistral.ai/v1', model: 'mistral-small-latest', keyEnv: 'MISTRAL_API_KEY' },
  groq:       { kind: 'openai', base: 'https://api.groq.com/openai/v1', model: 'llama-3.3-70b-versatile', keyEnv: 'GROQ_API_KEY' },
  gemini:     { kind: 'openai', base: 'https://generativelanguage.googleapis.com/v1beta/openai', model: 'gemini-2.0-flash', keyEnv: 'GEMINI_API_KEY' },
  openai:     { kind: 'openai', base: 'https://api.openai.com/v1', model: 'gpt-4o-mini', keyEnv: 'OPENAI_API_KEY' },
  openrouter: { kind: 'openai', base: 'https://openrouter.ai/api/v1', model: 'meta-llama/llama-3.3-70b-instruct', keyEnv: 'OPENROUTER_API_KEY' },
  ollama:     { kind: 'openai', base: 'http://localhost:11434/v1', model: 'llama3.1', keyEnv: null, keyless: true },
  custom:     { kind: 'openai', base: process.env.AI_BASE_URL || '', model: '', keyEnv: null }
};
const PROVIDER = (process.env.AI_PROVIDER || 'anthropic').toLowerCase();
const PRESET = PRESETS[PROVIDER];
if (!PRESET) {
  console.error('\n  Unknown AI_PROVIDER "' + PROVIDER + '". Use one of: ' + Object.keys(PRESETS).join(', ') + '\n');
  process.exit(1);
}
const RAW_KEY = process.env.AI_API_KEY || (PRESET.keyEnv && process.env[PRESET.keyEnv]) || '';
/* keep only visible ASCII: pasted keys sometimes carry spaces, quotes or hidden characters that break the request */
const API_KEY = RAW_KEY.replace(/[^\x21-\x7E]/g, '').replace(/^["']+|["']+$/g, '');
if (RAW_KEY && RAW_KEY !== API_KEY) console.warn('\n  Note: your API key had extra spaces, quotes or hidden characters. They were removed. Check the key in .env.\n');
const MODEL = process.env.AI_MODEL || (PROVIDER === 'anthropic' && process.env.ANTHROPIC_MODEL) || PRESET.model;
const BASE = (process.env.AI_BASE_URL || (PROVIDER === 'anthropic' && process.env.ANTHROPIC_BASE_URL) || PRESET.base || 'https://api.anthropic.com').replace(/\/+$/, '');
const CONFIGURED = !!MODEL && (PRESET.keyless ? true : !!API_KEY) && (PRESET.kind === 'anthropic' || !!BASE);

const PORT = Number(process.env.PORT) || 3000;
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

/* ---- translate the app's (Anthropic-style) request into the OpenAI-compatible format ---- */
function toOpenAI(input, maxTokens) {
  const msgs = [];
  if (typeof input.system === 'string' && input.system) msgs.push({ role: 'system', content: input.system.slice(0, 20000) });
  for (const m of input.messages) {
    if (typeof m.content === 'string') { msgs.push({ role: m.role, content: m.content }); continue; }
    if (!Array.isArray(m.content)) continue;
    if (m.role === 'assistant') {
      const text = m.content.filter((b) => b.type === 'text').map((b) => b.text).join('');
      const calls = m.content.filter((b) => b.type === 'tool_use').map((b) => ({
        id: b.id, type: 'function', function: { name: b.name, arguments: JSON.stringify(b.input || {}) }
      }));
      const out = { role: 'assistant', content: text || null };
      if (calls.length) out.tool_calls = calls;
      msgs.push(out);
    } else {
      m.content.forEach((b) => {
        if (b.type === 'tool_result') msgs.push({ role: 'tool', tool_call_id: b.tool_use_id, content: String(b.content == null ? '' : b.content) });
        else if (b.type === 'text') msgs.push({ role: 'user', content: b.text });
      });
    }
  }
  const body = { model: MODEL, messages: msgs, max_tokens: maxTokens };
  if (Array.isArray(input.tools) && input.tools.length) {
    body.tools = input.tools.slice(0, 8).map((t) => ({ type: 'function', function: { name: t.name, description: t.description, parameters: t.input_schema || { type: 'object', properties: {} } } }));
  }
  return body;
}
/* ---- and translate the reply back into content blocks the app understands ---- */
function fromOpenAI(data) {
  const choice = (data.choices && data.choices[0]) || {};
  const msg = choice.message || {};
  const content = [];
  let text = msg.content;
  if (Array.isArray(text)) text = text.map((p) => (typeof p === 'string' ? p : p.text || '')).join('');
  if (text && String(text).trim()) content.push({ type: 'text', text: String(text) });
  (msg.tool_calls || []).forEach((c, i) => {
    let args = {};
    try { args = JSON.parse((c.function && c.function.arguments) || '{}'); } catch (_) { args = {}; }
    content.push({ type: 'tool_use', id: c.id || 'call_' + i, name: c.function && c.function.name, input: args });
  });
  const usedTools = content.some((b) => b.type === 'tool_use');
  return { content, stop_reason: usedTools ? 'tool_use' : 'end_turn' };
}

function errorCode(status, msg) {
  const m = String(msg || '').toLowerCase();
  if (/credit|quota|billing|insufficient|balance|payment/.test(m) || status === 402) return 'no_credit';
  if (status === 401 || status === 403) return 'bad_key';
  if (status === 429) return 'rate_limited';
  if (status === 404 && /model/.test(m)) return 'bad_model';
  if (status === 400) return 'bad_request';
  return 'upstream_error';
}

async function handleChat(req, res) {
  if (!CONFIGURED) return send(res, 503, { code: 'no_key', error: 'The AI provider is not configured on the server.' });
  const ip = req.socket.remoteAddress || 'unknown';
  if (limited(ip)) return send(res, 429, { code: 'rate_limited', error: 'Too many requests. Wait a minute and try again.' });

  let input;
  try { input = JSON.parse(await readBody(req)); }
  catch (e) { return send(res, 400, { code: 'bad_request', error: 'Request body must be valid JSON under 1 MB.' }); }
  if (!Array.isArray(input.messages) || !input.messages.length) return send(res, 400, { code: 'bad_request', error: 'messages is required.' });

  const maxTokens = Math.min(Math.max(Number(input.max_tokens) || 1024, 64), 2048);
  let url, headers, payload;
  if (PRESET.kind === 'anthropic') {
    url = BASE + '/v1/messages';
    headers = { 'content-type': 'application/json', 'x-api-key': API_KEY, 'anthropic-version': '2023-06-01' };
    payload = { model: MODEL, max_tokens: maxTokens, system: typeof input.system === 'string' ? input.system.slice(0, 20000) : undefined, messages: input.messages };
    if (Array.isArray(input.tools) && input.tools.length) payload.tools = input.tools.slice(0, 8);
  } else {
    url = BASE + '/chat/completions';
    headers = { 'content-type': 'application/json' };
    if (API_KEY) headers.authorization = 'Bearer ' + API_KEY;
    payload = toOpenAI(input, maxTokens);
  }

  try {
    const r = await fetch(url, { method: 'POST', headers, body: JSON.stringify(payload), signal: AbortSignal.timeout(90000) });
    const data = await r.json().catch(() => ({}));
    if (!r.ok) {
      const e = data && data.error;
      const msg = (e && (e.message || (typeof e === 'string' ? e : ''))) || data.message || data.detail || 'The AI service returned an error.';
      const code = errorCode(r.status, msg);
      console.error(PROVIDER + ' API error', r.status, String(msg).slice(0, 300));
      return send(res, r.status === 401 || r.status === 403 ? 502 : (r.status >= 400 && r.status < 600 ? r.status : 502), { code, error: String(msg).slice(0, 300) });
    }
    if (PRESET.kind === 'anthropic') return send(res, 200, { content: data.content || [], stop_reason: data.stop_reason || 'end_turn' });
    return send(res, 200, fromOpenAI(data));
  } catch (e) {
    const c = e && e.cause;
    console.error(PROVIDER + ' request failed:', e && e.message, c ? '| cause: ' + (c.code || c.name || '') + ' ' + (c.message || '') : '', '| url: ' + url);
    const local = PROVIDER === 'ollama' ? ' Is Ollama running?' : '';
    return send(res, 502, { code: 'upstream_error', error: 'Could not reach the AI service.' + local });
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
  if (req.method === 'GET' && p === '/api/health') return send(res, 200, { ok: true, ai: CONFIGURED, provider: CONFIGURED ? PROVIDER : null, model: CONFIGURED ? MODEL : null });
  if (req.method === 'POST' && p === '/api/chat') return handleChat(req, res);
  if (req.method === 'GET' || req.method === 'HEAD') return serveStatic(req, res);
  return send(res, 405, { error: 'Method not allowed' });
});

server.listen(PORT, () => {
  console.log('\n  Eventwise Planner is running at http://localhost:' + PORT);
  if (CONFIGURED) console.log('  AI assistant: on (' + PROVIDER + ', model ' + MODEL + ')\n');
  else console.log('  AI assistant: off. Set AI_PROVIDER and an API key in the .env file to turn it on (see .env.example).\n');
});
