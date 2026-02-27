/* ── API client — thin fetch wrapper with JWT injection ───────────────────── */

const API_BASE = '';  // same origin

function getToken() {
  return localStorage.getItem('ql_token');
}

function setToken(token) {
  localStorage.setItem('ql_token', token);
}

function clearToken() {
  localStorage.removeItem('ql_token');
}

async function request(method, path, body = null) {
  const headers = { 'Content-Type': 'application/json' };
  const token = getToken();
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const opts = { method, headers };
  if (body !== null) opts.body = JSON.stringify(body);

  const res = await fetch(API_BASE + path, opts);

  if (res.status === 204) return null;

  let data;
  try { data = await res.json(); } catch { data = null; }

  if (!res.ok) {
    const msg = data?.detail || `HTTP ${res.status}`;
    throw new APIError(msg, res.status);
  }

  return data;
}

class APIError extends Error {
  constructor(message, status) {
    super(message);
    this.status = status;
  }
}

// ── Auth ───────────────────────────────────────────────────────────────────
const auth = {
  register: (username, password) =>
    request('POST', '/api/auth/register', { username, password }),

  login: (username, password) =>
    request('POST', '/api/auth/login', { username, password }),

  me: () => request('GET', '/api/auth/me'),
};

// ── Quests ─────────────────────────────────────────────────────────────────
const quests = {
  list:   ()        => request('GET',    '/api/quests'),
  create: (data)    => request('POST',   '/api/quests', data),
  get:    (id)      => request('GET',    `/api/quests/${id}`),
  update: (id, data)=> request('PUT',    `/api/quests/${id}`, data),
  delete: (id)      => request('DELETE', `/api/quests/${id}`),
  checkin:(id, data)=> request('POST',   `/api/quests/${id}/checkin`, data),
  editCheckin: (id, date, data) => request('PUT', `/api/quests/${id}/checkin/${date}`, data),
  updateNumeric: (id, value, notes = null) =>
    request('POST', `/api/quests/${id}/update`, { value, notes }),
  pause:    (id)    => request('POST',   `/api/quests/${id}/pause`),
  resume:   (id)    => request('POST',   `/api/quests/${id}/resume`),
  complete: (id)    => request('POST',   `/api/quests/${id}/complete`),
};

// ── Badges ─────────────────────────────────────────────────────────────────
const badges = {
  get: () => request('GET', '/api/badges'),
};

// ── Stats ──────────────────────────────────────────────────────────────────
const stats = {
  get: () => request('GET', '/api/stats'),
};

export { getToken, setToken, clearToken, APIError, auth, quests, badges, stats };
