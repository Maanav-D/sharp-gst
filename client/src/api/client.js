import axios from 'axios';

const api = axios.create({
  baseURL: '/api',
  timeout: 30000,
});

// Inject X-Company-Id header on every request (except /companies and /hsn)
api.interceptors.request.use((config) => {
  const url = config.url || '';
  if (!url.startsWith('/companies') && !url.startsWith('/hsn')) {
    const companyId = localStorage.getItem('currentCompanyId');
    if (companyId) {
      config.headers['X-Company-Id'] = companyId;
    }
  }
  return config;
});

// Companies (global, no company header)
export const companiesApi = {
  getAll: () => api.get('/companies').then(r => r.data),
  getById: (id) => api.get(`/companies/${id}`).then(r => r.data),
  create: (data) => api.post('/companies', data).then(r => r.data),
  update: (id, data) => api.put(`/companies/${id}`, data).then(r => r.data),
  remove: (id) => api.delete(`/companies/${id}`).then(r => r.data),
};

// Invoices
export const invoicesApi = {
  getAll: (params) => api.get('/invoices', { params }).then(r => r.data),
  getById: (id) => api.get(`/invoices/${id}`).then(r => r.data),
  create: (data) => api.post('/invoices', data).then(r => r.data),
  update: (id, data) => api.put(`/invoices/${id}`, data).then(r => r.data),
  remove: (id) => api.delete(`/invoices/${id}`).then(r => r.data),
  cancel: (id) => api.post(`/invoices/${id}/cancel`).then(r => r.data),
  bulkAction: (ids, action) => api.post('/invoices/bulk-action', { ids, action }).then(r => r.data),
  getPdfUrl: (id) => {
    const companyId = localStorage.getItem('currentCompanyId');
    return `/api/invoices/${id}/pdf${companyId ? `?companyId=${companyId}` : ''}`;
  },
  parsePdf: (file) => {
    const formData = new FormData();
    formData.append('file', file);
    return api.post('/invoices/parse-pdf', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    }).then(r => r.data);
  },
};

// Customers
export const customersApi = {
  getAll: (params) => api.get('/customers', { params }).then(r => r.data),
  getById: (id) => api.get(`/customers/${id}`).then(r => r.data),
  create: (data) => api.post('/customers', data).then(r => r.data),
  update: (id, data) => api.put(`/customers/${id}`, data).then(r => r.data),
  remove: (id) => api.delete(`/customers/${id}`).then(r => r.data),
};

// Products
export const productsApi = {
  getAll: () => api.get('/products').then(r => r.data),
  getById: (id) => api.get(`/products/${id}`).then(r => r.data),
  create: (data) => api.post('/products', data).then(r => r.data),
  update: (id, data) => api.put(`/products/${id}`, data).then(r => r.data),
  remove: (id) => api.delete(`/products/${id}`).then(r => r.data),
};

// HSN
export const hsnApi = {
  search: (q) => api.get('/hsn', { params: { q } }).then(r => r.data),
};

// Returns
export const returnsApi = {
  getGSTR1: (month, year) => api.get('/returns/gstr1', { params: { month, year } }).then(r => r.data),
  getGSTR3B: (month, year) => api.get('/returns/gstr3b', { params: { month, year } }).then(r => r.data),
  reconcileITC: (file) => {
    const formData = new FormData();
    formData.append('file', file);
    return api.post('/returns/reconcile', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    }).then(r => r.data);
  },
  exportGSTR1: (month, year) => api.get('/returns/gstr1/export', { params: { month, year } }).then(r => r.data),
};

// Ledger
export const ledgerApi = {
  getAll: (params) => api.get('/ledger', { params }).then(r => r.data),
  create: (data) => api.post('/ledger', data).then(r => r.data),
  getAccounts: () => api.get('/ledger/accounts').then(r => r.data),
  getTrialBalance: () => api.get('/ledger/trial-balance').then(r => r.data),
};

// Inventory
export const inventoryApi = {
  getAll: (params) => api.get('/inventory', { params }).then(r => r.data),
  create: (data) => api.post('/inventory', data).then(r => r.data),
  getStockLevels: () => api.get('/inventory/stock-levels').then(r => r.data),
  getLowStock: () => api.get('/inventory/low-stock').then(r => r.data),
};

// Reports
export const reportsApi = {
  salesRegister: (params) => api.get('/reports/sales-register', { params }).then(r => r.data),
  purchaseRegister: (params) => api.get('/reports/purchase-register', { params }).then(r => r.data),
  hsnSummary: (params) => api.get('/reports/hsn-summary', { params }).then(r => r.data),
  customerOutstanding: () => api.get('/reports/customer-outstanding').then(r => r.data),
  cashFlow: () => api.get('/reports/cash-flow').then(r => r.data),
  taxLiability: () => api.get('/reports/tax-liability').then(r => r.data),
};

// Payments
export const paymentsApi = {
  getAll: (params) => api.get('/payments', { params }).then(r => r.data),
  create: (data) => api.post('/payments', data).then(r => r.data),
};

// Dashboard
export const dashboardApi = {
  get: () => api.get('/dashboard').then(r => r.data),
};

// Settings
export const settingsApi = {
  get: () => api.get('/settings').then(r => r.data),
  update: (data) => api.put('/settings', data).then(r => r.data),
};

export default api;
