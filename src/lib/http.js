const BASE = import.meta.env.VITE_API_URL ?? 'http://localhost:3001'

async function req(method, path, body) {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: body != null ? { 'Content-Type': 'application/json' } : {},
    body:    body != null ? JSON.stringify(body) : undefined,
  })
  if (!res.ok) {
    let msg = res.statusText
    try { const j = await res.json(); msg = j.message ?? j.error ?? msg } catch { /* ignore */ }
    throw new Error(msg)
  }
  return res.json()
}

export const http = {
  get:   (path)       => req('GET',    path),
  post:  (path, body) => req('POST',   path, body),
  put:   (path, body) => req('PUT',    path, body),
  patch: (path, body) => req('PATCH',  path, body),
  del:   (path)       => req('DELETE', path),
}
