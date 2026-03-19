import { useState, useEffect, useCallback } from 'react'
import * as api from '../api/index.js'

// ── useDeals — fetch paginated deals ──────────────────────
export function useDeals(params = {}) {
  const [deals,   setDeals]   = useState([])
  const [loading, setLoading] = useState(true)
  const [error,   setError]   = useState(null)

  const key = JSON.stringify(params)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(null)
    api.getDeals(params)
      .then(data => { if (!cancelled) { setDeals(data.deals || []); setLoading(false) } })
      .catch(err  => { if (!cancelled) { setError(err.message); setLoading(false) } })
    return () => { cancelled = true }
  }, [key])

  return { deals, loading, error }
}

// ── useDeal — single deal ─────────────────────────────────
export function useDeal(id) {
  const [deal,    setDeal]    = useState(null)
  const [loading, setLoading] = useState(true)
  const [error,   setError]   = useState(null)

  useEffect(() => {
    if (!id) return
    let cancelled = false
    setLoading(true)
    api.getDeal(id)
      .then(data => { if (!cancelled) { setDeal(data); setLoading(false) } })
      .catch(err  => { if (!cancelled) { setError(err.message); setLoading(false) } })
    return () => { cancelled = true }
  }, [id])

  return { deal, loading, error }
}

// ── useCategoryDeals ──────────────────────────────────────
export function useCategoryDeals(category, params = {}) {
  const [deals,   setDeals]   = useState([])
  const [loading, setLoading] = useState(true)
  const [error,   setError]   = useState(null)

  const key = category + JSON.stringify(params)

  useEffect(() => {
    if (!category) return
    let cancelled = false
    setLoading(true)
    api.getDealsByCategory(category, params)
      .then(data => { if (!cancelled) { setDeals(data.deals || []); setLoading(false) } })
      .catch(err  => { if (!cancelled) { setError(err.message); setLoading(false) } })
    return () => { cancelled = true }
  }, [key])

  return { deals, loading, error }
}

// ── useSearch ─────────────────────────────────────────────
export function useSearch() {
  const [query,   setQuery]   = useState('')
  const [results, setResults] = useState([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!query.trim() || query.length < 2) { setResults([]); return }

    const timer = setTimeout(() => {
      setLoading(true)
      api.searchDeals(query)
        .then(data => { setResults(data.deals || []); setLoading(false) })
        .catch(() => setLoading(false))
    }, 350)

    return () => clearTimeout(timer)
  }, [query])

  return { query, setQuery, results, loading }
}

// ── useCouponReveal ───────────────────────────────────────
export function useCouponReveal(dealId) {
  const [revealed, setRevealed] = useState(false)
  const [code,     setCode]     = useState(null)
  const [loading,  setLoading]  = useState(false)

  const reveal = useCallback(async () => {
    if (revealed || loading) return
    setLoading(true)
    try {
      const data = await api.revealCoupon(dealId)
      setCode(data.code)
      setRevealed(true)
      // Open affiliate link when coupon is revealed
      if (data.affiliateUrl) {
        window.open(data.affiliateUrl, '_blank', 'noopener,noreferrer')
      }
    } catch (err) {
      console.error('Reveal failed:', err)
    } finally {
      setLoading(false)
    }
  }, [dealId, revealed, loading])

  return { revealed, code, loading, reveal }
}
