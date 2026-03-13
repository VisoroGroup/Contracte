import axios from 'axios';

const api = axios.create({
  baseURL: '/api',
  headers: { 'Content-Type': 'application/json' },
});

// Attach JWT token to every request
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// Handle 401 globally
api.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401) {
      localStorage.removeItem('token');
      window.location.href = '/login';
    }
    return Promise.reject(err);
  }
);

export default api;

// ─── Auth ─────────────────────────────────────────────────────────────────────
export const authApi = {
  login: (email: string, password: string) =>
    api.post('/auth/login', { email, password }).then((r) => r.data),
  me: () => api.get('/auth/me').then((r) => r.data),
};

// ─── Templates ────────────────────────────────────────────────────────────────
export const templatesApi = {
  list: (params?: Record<string, string>) =>
    api.get('/templates', { params }).then((r) => r.data),
  get: (id: string) => api.get(`/templates/${id}`).then((r) => r.data),
  upload: (formData: FormData) =>
    api.post('/templates/upload', formData, { headers: { 'Content-Type': 'multipart/form-data' } }).then((r) => r.data),
  update: (id: string, data: any) => api.put(`/templates/${id}`, data).then((r) => r.data),
  updateFields: (id: string, fields: any[]) =>
    api.put(`/templates/${id}/fields`, { fields }).then((r) => r.data),
  uploadVersion: (id: string, formData: FormData) =>
    api.post(`/templates/${id}/version`, formData, { headers: { 'Content-Type': 'multipart/form-data' } }).then((r) => r.data),
  getVersions: (id: string) => api.get(`/templates/${id}/versions`).then((r) => r.data),
  archive: (id: string) => api.delete(`/templates/${id}`).then((r) => r.data),
  duplicate: (id: string) => api.post(`/templates/${id}/duplicate`).then((r) => r.data),
};

// ─── Contracts ────────────────────────────────────────────────────────────────
export const contractsApi = {
  list: (params?: Record<string, string>) =>
    api.get('/contracts', { params }).then((r) => r.data),
  get: (id: string) => api.get(`/contracts/${id}`).then((r) => r.data),
  create: (data: any) => api.post('/contracts', data).then((r) => r.data),
  update: (id: string, data: any) => api.put(`/contracts/${id}`, data).then((r) => r.data),
  generateDocx: (id: string) => api.post(`/contracts/${id}/generate/docx`).then((r) => r.data),
  generatePdf: (id: string) => api.post(`/contracts/${id}/generate/pdf`).then((r) => r.data),
  getDownloadUrl: (contractId: string, fileId: string) =>
    `/api/contracts/${contractId}/download/${fileId}`,
  duplicate: (id: string) => api.post(`/contracts/${id}/duplicate`).then((r) => r.data),
  exportCsv: () => window.open('/api/contracts/export/csv', '_blank'),
};

// ─── Settings ─────────────────────────────────────────────────────────────────
export const settingsApi = {
  get: () => api.get('/settings').then((r) => r.data),
  update: (data: Record<string, string>) => api.put('/settings', data).then((r) => r.data),
  uploadLogo: (formData: FormData) =>
    api.post('/settings/logo', formData, { headers: { 'Content-Type': 'multipart/form-data' } }).then((r) => r.data),
};

// ─── Users ────────────────────────────────────────────────────────────────────
export const usersApi = {
  list: () => api.get('/users').then((r) => r.data),
  create: (data: any) => api.post('/users', data).then((r) => r.data),
  update: (id: string, data: any) => api.put(`/users/${id}`, data).then((r) => r.data),
  deactivate: (id: string) => api.delete(`/users/${id}`).then((r) => r.data),
};

// ─── Categories ───────────────────────────────────────────────────────────────
export const categoriesApi = {
  list: () => api.get('/categories').then((r) => r.data),
  create: (name: string) => api.post('/categories', { name }).then((r) => r.data),
  update: (id: string, name: string) => api.put(`/categories/${id}`, { name }).then((r) => r.data),
  delete: (id: string) => api.delete(`/categories/${id}`).then((r) => r.data),
};
