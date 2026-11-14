/**
 * Hadi Education System Portal — Gemini REST Transport Client
 * Isolated HTTP client for generativelanguage.googleapis.com (v1beta generateContent)
 * or an optional user-configured proxy URL. Never logs or exposes API keys.
 */
(function (window) {
  'use strict';

  const DEFAULT_MODEL = 'gemini-3.8-flash';
  const API_BASE = 'https://generativelanguage.googleapis.com/v1beta/models';
  const REQUEST_TIMEOUT_MS = 45000;
  const MAX_RETRIES = 2;

  function sanitizeKeyLeak(str, apiKey) {
    let text = String(str || '');
    if (apiKey && typeof apiKey === 'string' && apiKey.length >= 6) {
      text = text.split(apiKey).join('[REDACTED]');
    }
    text = text.replace(/AIza[0-9A-Za-z\-_]{10,}/g, '[REDACTED]');
    return text;
  }

  function cloneJson(obj) {
    return obj === undefined ? undefined : JSON.parse(JSON.stringify(obj));
  }

  function makeClientError(code, userMessage, extra = {}) {
    const err = new Error(userMessage);
    err.code = code;
    err.userMessage = userMessage;
    Object.assign(err, extra);
    return err;
  }

  function sleepWithSignal(ms, signal) {
    return new Promise((resolve, reject) => {
      if (signal && signal.aborted) {
        reject(makeClientError('ABORTED', 'Request cancelled by user.'));
        return;
      }
      const timer = setTimeout(() => {
        if (signal) signal.removeEventListener('abort', onAbort);
        resolve();
      }, ms);
      function onAbort() {
        clearTimeout(timer);
        reject(makeClientError('ABORTED', 'Request cancelled by user.'));
      }
      if (signal) signal.addEventListener('abort', onAbort, { once: true });
    });
  }

  function parseRetryAfterMs(headerVal) {
    if (!headerVal) return null;
    const trimmed = String(headerVal).trim();
    const secs = Number(trimmed);
    if (Number.isFinite(secs) && secs >= 0) {
      return Math.min(Math.max(secs * 1000, 400), 15000);
    }
    const ts = Date.parse(trimmed);
    if (!Number.isNaN(ts)) {
      const diff = ts - Date.now();
      if (diff > 0) return Math.min(diff, 15000);
    }
    return null;
  }

  function buildEndpointAndInit({ apiKey, model, proxyUrl, body, signal }) {
    const cleanModel = (model || DEFAULT_MODEL).trim();
    const cleanProxy = (proxyUrl || '').trim();
    const cleanKey = (apiKey || '').trim();

    if (cleanProxy) {
      if (!/^(https?:\/\/|\/)/i.test(cleanProxy)) {
        throw makeClientError('BAD_CONFIG', 'Proxy URL must start with https://, http://, or /.');
      }
      const proxyPayload = cloneJson(body);
      proxyPayload.model = cleanModel;
      return {
        url: cleanProxy,
        headers: { 'Content-Type': 'application/json' },
        payloadStr: JSON.stringify(proxyPayload),
        signal
      };
    }

    if (!cleanKey) {
      throw makeClientError('NO_KEY', 'Gemini API key missing. Open Settings to paste your key.', {
        openSettings: true
      });
    }

    return {
      url: `${API_BASE}/${encodeURIComponent(cleanModel)}:generateContent`,
      headers: {
        'Content-Type': 'application/json',
        'x-goog-api-key': cleanKey
      },
      payloadStr: JSON.stringify(body),
      signal
    };
  }

  async function fetchWithTimeout(url, options, externalSignal, timeoutMs) {
    const ctrl = new AbortController();
    let timedOut = false;

    const onExternalAbort = () => ctrl.abort();
    if (externalSignal) {
      if (externalSignal.aborted) {
        throw makeClientError('ABORTED', 'Request cancelled.');
      }
      externalSignal.addEventListener('abort', onExternalAbort, { once: true });
    }

    const timer = setTimeout(() => {
      timedOut = true;
      ctrl.abort();
    }, timeoutMs);

    try {
      return await window.fetch(url, {
        ...options,
        signal: ctrl.signal
      });
    } catch (err) {
      if (externalSignal && externalSignal.aborted) {
        throw makeClientError('ABORTED', 'Request cancelled.');
      }
      if (timedOut || (err && err.name === 'AbortError')) {
        throw makeClientError('TIMEOUT', 'Request timed out (45s). Check internet and retry.');
      }
      if (typeof navigator !== 'undefined' && navigator.onLine === false) {
        throw makeClientError('OFFLINE', 'Assistant ko internet chahiye; baaqi app offline chal rahi hai.');
      }
      throw makeClientError('NETWORK_ERROR', 'Network ya CORS error aya hai. Internet check karke dobara try karein.');
    } finally {
      clearTimeout(timer);
      if (externalSignal) {
        externalSignal.removeEventListener('abort', onExternalAbort);
      }
    }
  }

  function extractApiErrorDetail(rawText, apiKey) {
    try {
      const parsed = JSON.parse(rawText);
      const msg = parsed && parsed.error && parsed.error.message ? String(parsed.error.message) : rawText;
      return sanitizeKeyLeak(msg, apiKey);
    } catch (e) {
      return sanitizeKeyLeak(rawText, apiKey);
    }
  }

  function buildBody({ contents, systemInstruction, tools, toolConfig, includeThinking }) {
    const body = {
      contents: cloneJson(contents || [])
    };
    if (systemInstruction) {
      body.systemInstruction = typeof systemInstruction === 'string'
        ? { parts: [{ text: systemInstruction }] }
        : cloneJson(systemInstruction);
    }
    if (Array.isArray(tools) && tools.length > 0) {
      body.tools = cloneJson(tools);
      body.toolConfig = cloneJson(toolConfig || { functionCallingConfig: { mode: 'AUTO' } });
    }
    if (includeThinking) {
      body.generationConfig = {
        thinkingConfig: {
          thinkingLevel: 'LOW'
        }
      };
    }
    return body;
  }

  async function generateContent({
    apiKey = '',
    model = DEFAULT_MODEL,
    proxyUrl = '',
    contents = [],
    systemInstruction = '',
    tools = null,
    toolConfig = null,
    useThinking = true,
    signal = null,
    timeoutMs = REQUEST_TIMEOUT_MS
  }) {
    if (typeof navigator !== 'undefined' && navigator.onLine === false && !(proxyUrl && proxyUrl.startsWith('/'))) {
      throw makeClientError('OFFLINE', 'Assistant ko internet chahiye; baaqi app offline chal rahi hai.');
    }

    let includeThinking = !!useThinking;
    let attempt = 0;
    let thinkingFallbackTried = false;

    while (true) {
      const body = buildBody({
        contents,
        systemInstruction,
        tools,
        toolConfig,
        includeThinking
      });

      const req = buildEndpointAndInit({
        apiKey,
        model,
        proxyUrl,
        body,
        signal
      });

      const res = await fetchWithTimeout(
        req.url,
        {
          method: 'POST',
          headers: req.headers,
          body: req.payloadStr
        },
        signal,
        timeoutMs
      );

      if (res.ok) {
        let data;
        try {
          data = await res.json();
        } catch (parseErr) {
          throw makeClientError('BAD_RESPONSE', 'Gemini response could not be parsed cleanly.');
        }

        const promptBlock = data && data.promptFeedback && data.promptFeedback.blockReason
          ? data.promptFeedback.blockReason
          : null;
        const candidate = data && Array.isArray(data.candidates) && data.candidates.length > 0
          ? data.candidates[0]
          : null;

        if (!candidate) {
          return {
            ok: true,
            rawResponse: data,
            rawContent: null,
            text: '',
            functionCalls: [],
            finishReason: promptBlock ? 'BLOCKED' : 'EMPTY',
            blockReason: promptBlock
          };
        }

        const finishReason = candidate.finishReason || 'STOP';
        if (finishReason === 'MISSING_THOUGHT_SIGNATURE') {
          throw makeClientError(
            'MISSING_THOUGHT_SIGNATURE',
            'Conversation reasoning state reset required; retrying cleanly.',
            { status: 400 }
          );
        }

        // Preserve candidate.content verbatim including thought parts, thoughtSignature, and functionCall ids
        const rawContent = candidate.content ? cloneJson(candidate.content) : null;
        const parts = (rawContent && Array.isArray(rawContent.parts)) ? rawContent.parts : [];
        const text = parts
          .filter((p) => p && typeof p.text === 'string' && !p.thought)
          .map((p) => p.text)
          .join('');
        const functionCalls = parts
          .filter((p) => p && p.functionCall && typeof p.functionCall === 'object')
          .map((p) => cloneJson(p.functionCall));

        return {
          ok: true,
          rawResponse: data,
          rawContent,
          text,
          functionCalls,
          finishReason,
          blockReason: promptBlock,
          usageMetadata: data.usageMetadata || null
        };
      }

      // Handle HTTP error responses safely without exposing keys
      let rawErrText = '';
      try {
        rawErrText = await res.text();
      } catch (e) {
        rawErrText = '';
      }
      const cleanDetail = extractApiErrorDetail(rawErrText, apiKey);
      const status = res.status;

      if (status === 401 || status === 403) {
        throw makeClientError(
          'AUTH_ERROR',
          'API key invalid ya blocked hai. Settings mein apni sahi Gemini API key enter karein.',
          { status, openSettings: true }
        );
      }

      if (status === 404) {
        throw makeClientError(
          'MODEL_NOT_FOUND',
          `Model "${(model || DEFAULT_MODEL).trim()}" nahi mila (404). Settings mein model ID check karein (e.g. ${DEFAULT_MODEL}).`,
          { status, openSettings: true }
        );
      }

      if (status === 429) {
        if (attempt < MAX_RETRIES) {
          attempt += 1;
          const retryMs = parseRetryAfterMs(res.headers && res.headers.get ? res.headers.get('Retry-After') : null)
            || (1200 * Math.pow(2, attempt - 1));
          await sleepWithSignal(retryMs, signal);
          continue;
        }
        throw makeClientError(
          'RATE_LIMIT',
          'Gemini rate limit reached (429). Thori der baad dobara try karein.',
          { status }
        );
      }

      if (status === 500 || status === 503 || status === 504) {
        if (attempt < MAX_RETRIES) {
          attempt += 1;
          await sleepWithSignal(1000 * Math.pow(2, attempt - 1), signal);
          continue;
        }
        throw makeClientError(
          'SERVER_ERROR',
          `Gemini server temporary error (${status}). Thori der baad retry karein.`,
          { status }
        );
      }

      if (status === 400) {
        console.error('[GeminiClient] HTTP 400 Bad Request:', cleanDetail);
        if (/thought[_\s-]*signature/i.test(cleanDetail)) {
          throw makeClientError(
            'MISSING_THOUGHT_SIGNATURE',
            'Conversation signature mismatch; resetting turn state.',
            { status: 400 }
          );
        }
        if (includeThinking && !thinkingFallbackTried && /thinking/i.test(cleanDetail)) {
          thinkingFallbackTried = true;
          includeThinking = false;
          continue;
        }
        throw makeClientError(
          'BAD_REQUEST',
          'Request accept nahi hui (400). Message chhota ya mukhtalif tarike se likh kar try karein.',
          { status: 400 }
        );
      }

      console.error(`[GeminiClient] HTTP ${status}:`, cleanDetail);
      throw makeClientError(
        'HTTP_ERROR',
        `Request fail ho gayi (HTTP ${status}). Dobara try karein.`,
        { status }
      );
    }
  }

  async function testConnection({ apiKey = '', model = DEFAULT_MODEL, proxyUrl = '', signal = null } = {}) {
    const res = await generateContent({
      apiKey,
      model,
      proxyUrl,
      contents: [{ role: 'user', parts: [{ text: 'Reply strictly with: OK' }] }],
      useThinking: true,
      signal,
      timeoutMs: 25000
    });
    return {
      ok: true,
      model: (model || DEFAULT_MODEL).trim(),
      replyText: res.text || 'OK'
    };
  }

  window.GeminiClient = {
    DEFAULT_MODEL,
    REQUEST_TIMEOUT_MS,
    generateContent,
    testConnection
  };
})(window);
