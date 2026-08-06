// Thin wrapper over the backend. Every call returns parsed JSON or throws an Error
// carrying the API's own `detail` message — so the UI can show the real reason.

async function request(path, { method = 'GET', body, raw = false } = {}) {
  const options = { method, headers: {} }
  if (body !== undefined) {
    options.headers['Content-Type'] = 'application/json'
    options.body = JSON.stringify(body)
  }
  const response = await fetch(path, options)
  if (!response.ok) {
    let detail = `HTTP ${response.status}`
    try {
      const data = await response.json()
      if (data.detail) detail = typeof data.detail === 'string' ? data.detail : JSON.stringify(data.detail)
    } catch { /* non-JSON error body */ }
    const err = new Error(detail)
    err.status = response.status
    throw err
  }
  return raw ? response.blob() : response.json()
}

export const api = {
  health: () => request('/health'),
  config: () => request('/config'),

  chunk: (payload) => request('/chunk', { method: 'POST', body: payload }),
  ingest: (payload) => request('/ingest', { method: 'POST', body: payload }),
  collection: () => request('/collection'),
  resetCollection: () => request('/collection', { method: 'DELETE' }),

  search: (payload) => request('/search', { method: 'POST', body: payload }),
  ask: (payload) => request('/ask', { method: 'POST', body: payload }),

  agents: () => request('/agents'),
  agent: (name) => request(`/agents/${encodeURIComponent(name)}`),
  deployAgent: (name, owner) => request(`/agents/${encodeURIComponent(name)}/deploy${owner ? `?owner=${encodeURIComponent(owner)}` : ''}`, { method: 'POST' }),
  hostedAgents: (owner) => request(owner ? `/agents/hosted?owner=${encodeURIComponent(owner)}` : '/agents/hosted'),
  deleteHostedAgent: (id, owner) => request(`/agents/hosted/${encodeURIComponent(id)}${owner ? `?owner=${encodeURIComponent(owner)}` : ''}`, { method: 'DELETE' }),

  azure: () => request('/azure'),

  analyticsUsage: () => request('/analytics/usage'),

  sessions: {
    list: (owner) => request(owner ? `/sessions?owner=${encodeURIComponent(owner)}` : '/sessions'),
    get: (id, owner) => request(`/sessions/${encodeURIComponent(id)}${owner ? `?owner=${encodeURIComponent(owner)}` : ''}`),
    save: (payload) => request('/sessions', { method: 'POST', body: payload }),
    remove: (id, owner) => request(`/sessions/${encodeURIComponent(id)}${owner ? `?owner=${encodeURIComponent(owner)}` : ''}`, { method: 'DELETE' }),
    exportMarkdown: (id, owner) => request(`/sessions/${encodeURIComponent(id)}/export${owner ? `?owner=${encodeURIComponent(owner)}` : ''}`, { raw: true }),
  },

  webFetch: (payload) => request('/tools/web-fetch', { method: 'POST', body: payload }),
  speak: (payload) => request('/tools/speak', { method: 'POST', body: payload, raw: true }),
  transcribe: async (file, language) => {
    const form = new FormData()
    form.append('file', file)
    if (language) form.append('language', language)
    const response = await fetch('/tools/transcribe', { method: 'POST', body: form })
    if (!response.ok) {
      const data = await response.json().catch(() => ({}))
      throw new Error(data.detail || `HTTP ${response.status}`)
    }
    return response.json()
  },
  extractDocument: async (file) => {
    const form = new FormData()
    form.append('file', file)
    const response = await fetch('/tools/extract-document', { method: 'POST', body: form })
    if (!response.ok) {
      const data = await response.json().catch(() => ({}))
      const err = new Error(data.detail || `HTTP ${response.status}`)
      err.status = response.status
      throw err
    }
    return response.json()
  },
}
