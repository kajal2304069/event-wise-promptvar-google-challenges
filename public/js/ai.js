
(function () {
  'use strict';
  var EW = (window.EW = window.EW || {});

  var AI = (EW.AI = {
    available: false,   // true when the server has an API key
    reason: 'pending',  // 'ready' | 'nokey' | 'offline' | 'pending'
    model: null
  });

  AI.init = function () {
    return fetch('api/health', { cache: 'no-store' })
      .then(function (r) { if (!r.ok) throw new Error('health'); return r.json(); })
      .then(function (j) { AI.available = !!j.ai; AI.model = j.model || null; AI.reason = j.ai ? 'ready' : 'nokey'; })
      .catch(function () { AI.available = false; AI.reason = 'offline'; })
      .then(function () { return AI.available; });
  };

  function fail(code, message) { var e = new Error(message || code); e.code = code; return e; }

  AI.post = function (body, signal) {
    return fetch('api/chat', {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body), signal: signal
    }).then(function (r) {
      return r.json().catch(function () { return {}; }).then(function (j) {
        if (!r.ok) throw fail(j.code || (r.status === 429 ? 'rate_limited' : 'upstream_error'), j.error);
        return j;
      });
    }, function (err) {
      if (err && err.name === 'AbortError') throw fail('cancelled');
      throw fail('offline', 'Could not reach the server.');
    });
  };

  AI.chat = function (o) {
    var msgs = o.messages.map(function (m) { return { role: m.role, content: m.content }; });
    var tools = o.tools || [], byName = {};
    tools.forEach(function (t) { byName[t.name] = t; });
    var defs = tools.map(function (t) { return { name: t.name, description: t.description, input_schema: t.inputSchema }; });
    var texts = [];

    function round(n) {
      var body = { system: o.system, messages: msgs, max_tokens: o.maxTokens || 1024 };
      if (defs.length) body.tools = defs;
      return AI.post(body, o.signal).then(function (res) {
        var blocks = res.content || [];
        var t = blocks.filter(function (b) { return b.type === 'text'; }).map(function (b) { return b.text; }).join('');
        if (t.trim()) texts.push(t.trim());
        var uses = blocks.filter(function (b) { return b.type === 'tool_use'; });
        if (res.stop_reason !== 'tool_use' || !uses.length || n >= 4) return;
        msgs.push({ role: 'assistant', content: blocks });
        return Promise.all(uses.map(function (b) {
          return Promise.resolve().then(function () { return byName[b.name].execute(b.input || {}); })
            .then(function (out) { return { type: 'tool_result', tool_use_id: b.id, content: typeof out === 'string' ? out : JSON.stringify(out) }; },
                  function (err) { return { type: 'tool_result', tool_use_id: b.id, content: 'Error: ' + ((err && err.message) || err), is_error: true }; });
        })).then(function (results) { msgs.push({ role: 'user', content: results }); return round(n + 1); });
      });
    }
    return round(0).then(function () {
      var text = texts.join('\n\n');
      if (!text) throw fail('empty_completion');
      return { text: text };
    });
  };

  /* json(prompt): ask for a JSON value and parse it tolerantly (plain, fenced, or surrounded by a sentence) */
  AI.json = function (prompt, o) {
    o = o || {};
    return AI.chat({
      system: o.system || 'You return only valid JSON, with no commentary.',
      messages: [{ role: 'user', content: prompt }], signal: o.signal, maxTokens: o.maxTokens || 1500
    }).then(function (r) {
      var t = r.text.trim(), v;
      try { return JSON.parse(t); } catch (e) { /* try the next form */ }
      var fence = t.match(/```(?:json)?\s*([\s\S]*?)```/i);
      if (fence) { try { return JSON.parse(fence[1]); } catch (e) { /* next */ } }
      var a = t.search(/[\[{]/), b = Math.max(t.lastIndexOf(']'), t.lastIndexOf('}'));
      if (a >= 0 && b > a) { try { return JSON.parse(t.slice(a, b + 1)); } catch (e) { /* fall through */ } }
      throw fail('invalid_json');
    });
  };
})();
