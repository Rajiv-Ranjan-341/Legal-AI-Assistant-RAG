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
