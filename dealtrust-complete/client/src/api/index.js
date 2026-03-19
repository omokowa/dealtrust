import axios from 'axios'

const BASE = import.meta.env.VITE_API_BASE_URL || '/api'

const client = axios.create({
  baseURL: BASE,
  timeout: 10000,
})

// ── Deals ─────────────────────────────────────────────────
export const getDeals = (params = {}) =>
  client.get('/deals', { params }).then(r => r.data)

export const getDeal = (id) =>
  client.get(`/deals/${id}`).then(r => r.data)

export const getDealsByCategory = (category, params = {}) =>
  client.get(`/deals/category/${category}`, { params }).then(r => r.data)

export const searchDeals = (q, params = {}) =>
  client.get('/deals/search', { params: { q, ...params } }).then(r => r.data)

export const voteDeal = (id, vote) =>
  client.post(`/deals/${id}/vote`, { vote }).then(r => r.data)

// ── Coupons ───────────────────────────────────────────────
export const revealCoupon = (dealId) =>
  client.post(`/deals/${dealId}/reveal-coupon`).then(r => r.data)

export const reportCoupon = (dealId) =>
  client.post(`/deals/${dealId}/report-coupon`).then(r => r.data)

// ── Alerts ────────────────────────────────────────────────
export const subscribeAlert = (data) =>
  client.post('/alerts', data).then(r => r.data)

export const unsubscribeAlert = (email) =>
  client.delete('/alerts', { data: { email } }).then(r => r.data)

// ── Stats ─────────────────────────────────────────────────
export const getStats = () =>
  client.get('/stats').then(r => r.data)
