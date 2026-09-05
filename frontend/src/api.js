const BASE = 'http://127.0.0.1:8000'

const req = (path, opts = {}) =>
  fetch(`${BASE}${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...opts,
  }).then(async r => {
    if (!r.ok) {
      const err = await r.json().catch(() => ({ detail: r.statusText }))
      throw new Error(err.detail || r.statusText)
    }
    return r.json()
  })

export const api = {
  getProjects:     ()             => req('/projects'),
  getUsers:        ()             => req('/users'),

  // Updates
  submitUpdate:    (body)         => req('/updates/', { method: 'POST', body: JSON.stringify(body) }),

  // Blockers
  getBlockers:     (projectId, status) => {
    let url = `/blockers/?project_id=${projectId}`
    if (status) url += `&status=${status}`
    return req(url)
  },
  confirmBlocker:  (id)           => req(`/blockers/${id}/confirm`, { method: 'PATCH' }),
  dismissBlocker:  (id, reason)   => req(`/blockers/${id}/dismiss`, { method: 'PATCH', body: JSON.stringify({ reason }) }),
  resolveBlocker:  (id)           => req(`/blockers/${id}/resolve`, { method: 'PATCH' }),

  // Digests
  getDigests:      (projectId, date) => req(`/digests/?project_id=${projectId}&date=${date}`),
  generateDigest:  (projectId, date) => req(`/digests/generate?project_id=${projectId}&date=${date}`, { method: 'POST' }),
}
