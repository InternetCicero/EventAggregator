const BASE = '/api';

function authHeader() {
  const creds = sessionStorage.getItem('adminCreds');
  return creds ? { Authorization: `Basic ${creds}` } : {};
}

async function handle(res) {
  if (!res.ok) {
    let message = `Fehler ${res.status}`;
    try {
      const data = await res.json();
      message = data.error || message;
    } catch {}
    throw new Error(message);
  }
  if (res.status === 204) return null;
  return res.json();
}

export const api = {
  getCategories: () => fetch(`${BASE}/events/categories`).then(handle),
  getFormats: () => fetch(`${BASE}/events/formats`).then(handle),
  getTags: () => fetch(`${BASE}/events/tags`).then(handle),
  getEvents: (params = {}) => {
    const qs = new URLSearchParams(Object.entries(params).filter(([, v]) => v));
    return fetch(`${BASE}/events?${qs.toString()}`).then(handle);
  },
  submitEvent: (data) =>
    fetch(`${BASE}/events`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    }).then(handle),
  extractFromLink: (url) =>
    fetch(`${BASE}/events/extract-link`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url }),
    }).then(handle),
  extractFromImage: (file) => {
    const formData = new FormData();
    formData.append('image', file);
    return fetch(`${BASE}/events/extract-image`, { method: 'POST', body: formData }).then(handle);
  },

  // Jobs & Praktika
  getJobsMeta: () => fetch(`${BASE}/jobs/meta`).then(handle),
  getJobs: (params = {}) => {
    const qs = new URLSearchParams(Object.entries(params).filter(([, v]) => v));
    return fetch(`${BASE}/jobs?${qs.toString()}`).then(handle);
  },
  getJob: (id) => fetch(`${BASE}/jobs/${id}`).then(handle),
  submitJob: (data) =>
    fetch(`${BASE}/jobs`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    }).then(handle),
  extractJobFromLink: (url) =>
    fetch(`${BASE}/jobs/extract-link`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url }),
    }).then(handle),

  admin: {
    login: (user, pass) => {
      const creds = btoa(`${user}:${pass}`);
      return fetch(`${BASE}/admin/events?status=pending`, {
        headers: { Authorization: `Basic ${creds}` },
      }).then((res) => {
        if (!res.ok) throw new Error('Login fehlgeschlagen');
        sessionStorage.setItem('adminCreds', creds);
        return true;
      });
    },
    logout: () => sessionStorage.removeItem('adminCreds'),
    isLoggedIn: () => !!sessionStorage.getItem('adminCreds'),

    getEvents: (status) =>
      fetch(`${BASE}/admin/events?status=${status}`, { headers: authHeader() }).then(handle),
    approve: (id) =>
      fetch(`${BASE}/admin/events/${id}/approve`, { method: 'POST', headers: authHeader() }).then(handle),
    reject: (id) =>
      fetch(`${BASE}/admin/events/${id}/reject`, { method: 'POST', headers: authHeader() }).then(handle),
    deleteEvent: (id) =>
      fetch(`${BASE}/admin/events/${id}`, { method: 'DELETE', headers: authHeader() }).then(handle),
    bulkAction: (ids, action) =>
      fetch(`${BASE}/admin/events/bulk`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeader() },
        body: JSON.stringify({ ids, action }),
      }).then(handle),

    getJobs: (status) => fetch(`${BASE}/admin/jobs?status=${status}`, { headers: authHeader() }).then(handle),
    updateJob: (id, data) =>
      fetch(`${BASE}/admin/jobs/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', ...authHeader() },
        body: JSON.stringify(data),
      }).then(handle),
    bulkJobAction: (ids, action) =>
      fetch(`${BASE}/admin/jobs/bulk`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeader() },
        body: JSON.stringify({ ids, action }),
      }).then(handle),

    getCompanies: () => fetch(`${BASE}/admin/companies`, { headers: authHeader() }).then(handle),
    createCompany: (data) =>
      fetch(`${BASE}/admin/companies`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeader() },
        body: JSON.stringify(data),
      }).then(handle),
    updateCompany: (id, data) =>
      fetch(`${BASE}/admin/companies/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', ...authHeader() },
        body: JSON.stringify(data),
      }).then(handle),
    deleteCompany: (id) =>
      fetch(`${BASE}/admin/companies/${id}`, { method: 'DELETE', headers: authHeader() }).then(handle),

    getSources: () => fetch(`${BASE}/admin/sources`, { headers: authHeader() }).then(handle),
    createSource: (data) =>
      fetch(`${BASE}/admin/sources`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeader() },
        body: JSON.stringify(data),
      }).then(handle),
    updateSource: (id, data) =>
      fetch(`${BASE}/admin/sources/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', ...authHeader() },
        body: JSON.stringify(data),
      }).then(handle),
    deleteSource: (id) =>
      fetch(`${BASE}/admin/sources/${id}`, { method: 'DELETE', headers: authHeader() }).then(handle),
    runSource: (id) =>
      fetch(`${BASE}/admin/sources/${id}/run`, { method: 'POST', headers: authHeader() }).then(handle),
    runAllSources: () =>
      fetch(`${BASE}/admin/sources/run-all`, { method: 'POST', headers: authHeader() }).then(handle),
  },
};
