import axios from 'axios';

const api = axios.create({
  baseURL: '/api',
  timeout: 120000,
});

export async function queryLegal(question, mode = 'direct') {
  const start = Date.now();
  const res = await api.post('/query', { question, mode });
  return { ...res.data, responseTime: ((Date.now() - start) / 1000).toFixed(1) };
}

export async function queryLegalStream(question, mode = 'direct', callbacks = {}) {
  const start = Date.now();
  const { onToken, onStatus, onSources, onDone, onError, onClear } = callbacks;

  const response = await fetch('/api/query/stream', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ question, mode }),
  });

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const parts = buffer.split('\n\n');
    buffer = parts.pop();

    for (const part of parts) {
      if (!part.trim()) continue;

      let eventType = '';
      let data = '';

      for (const line of part.split('\n')) {
        if (line.startsWith('event: ')) eventType = line.slice(7);
        else if (line.startsWith('data: ')) data = line.slice(6);
      }

      if (!eventType || !data) continue;

      try {
        const parsed = JSON.parse(data);
        switch (eventType) {
          case 'token': onToken?.(parsed.token); break;
          case 'status': onStatus?.(parsed.message); break;
          case 'sources': onSources?.(parsed.sources); break;
          case 'done': onDone?.({ ...parsed, responseTime: ((Date.now() - start) / 1000).toFixed(1) }); break;
          case 'error': onError?.(parsed.message); break;
          case 'clear': onClear?.(); break;
        }
      } catch (_) {}
    }
  }
}

export async function getDocuments() {
  const res = await api.get('/documents');
  return res.data;
}

export async function getDocumentChunks(filename, page = 1, search = '') {
  const res = await api.get('/documents/' + encodeURIComponent(filename) + '/chunks', {
    params: { page, search },
  });
  return res.data;
}

export async function getAnalytics() {
  const res = await api.get('/analytics');
  return res.data;
}

export async function healthCheck() {
  const res = await api.get('/health');
  return res.data;
}
