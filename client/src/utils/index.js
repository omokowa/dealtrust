import { formatDistanceToNow, isPast } from 'date-fns'

// ── Price formatting ──────────────────────────────────────
export function formatPrice(amount) {
  if (!amount && amount !== 0) return '—'
  return '₦' + Number(amount).toLocaleString('en-NG')
}

export function calcDiscount(original, current) {
  if (!original || !current || original <= current) return 0
  return Math.round(((original - current) / original) * 100)
}

export function formatSaving(original, current) {
  const saving = original - current
  if (saving <= 0) return null
  return formatPrice(saving)
}

// ── Time formatting ───────────────────────────────────────
export function timeAgo(date) {
  if (!date) return ''
  try {
    return formatDistanceToNow(new Date(date), { addSuffix: true })
  } catch { return '' }
}

export function isExpired(date) {
  if (!date) return false
  try { return isPast(new Date(date)) } catch { return false }
}

export function expiryCountdown(expiresAt) {
  if (!expiresAt) return null
  const diff = new Date(expiresAt) - Date.now()
  if (diff <= 0) return 'Expired'
  const h = Math.floor(diff / 3600000)
  const m = Math.floor((diff % 3600000) / 60000)
  if (h > 48) return `${Math.floor(h / 24)}d left`
  if (h > 0)  return `${h}h ${m}m left`
  return `${m}m left`
}

// ── Category helpers ──────────────────────────────────────
export const CATEGORIES = [
  { slug: 'gadgets',     label: 'Gadgets',        icon: '📱', sub: ['Phones', 'Tablets', 'Computing', 'Accessories'] },
  { slug: 'electronics', label: 'Electronics',    icon: '⚡', sub: ['TVs', 'Audio', 'Cameras', 'Smart Home'] },
  { slug: 'fashion',     label: 'Fashion',        icon: '👗', sub: ['Men', 'Women', 'Footwear', 'Bags'] },
  { slug: 'appliances',  label: 'Appliances',     icon: '🏠', sub: ['Fridges', 'Washing', 'AC', 'Kitchen'] },
  { slug: 'health',      label: 'Health & Beauty',icon: '💄', sub: ['Skincare', 'Haircare', 'Vitamins', 'Fitness'] },
  { slug: 'baby',        label: 'Baby Products',  icon: '🍼', sub: ['Feeding', 'Clothing', 'Toys', 'Diapers'] },
  { slug: 'gaming',      label: 'Gaming',         icon: '🎮', sub: ['Consoles', 'Controllers', 'Games', 'Accessories'] },
  { slug: 'supermarket', label: 'Supermarket',    icon: '🛒', sub: ['Food', 'Drinks', 'Household', 'Personal Care'] },
]

export function getCategoryMeta(slug) {
  return CATEGORIES.find(c => c.slug === slug) || null
}

// ── Platform helpers ──────────────────────────────────────
export const PLATFORMS = {
  jumia: { label: 'Jumia', color: '#f97316', bg: '#fff7ed', logo: '🟠' },
  konga: { label: 'Konga', color: '#dc2626', bg: '#fee2e2', logo: '🔴' },
  temu:  { label: 'Temu',  color: '#7c3aed', bg: '#ede9fe', logo: '🟣' },
}

export function getPlatformMeta(platform) {
  return PLATFORMS[platform?.toLowerCase()] || { label: platform, color: '#64748b', bg: '#f1f5f9', logo: '🛒' }
}

// ── Share helpers ─────────────────────────────────────────
export function buildShareText(deal) {
  const discount = calcDiscount(deal.original_price, deal.current_price)
  const saving   = formatSaving(deal.original_price, deal.current_price)
  const platform = getPlatformMeta(deal.platform)
  const url      = `https://dealtrust.app/go/${deal.id}`

  const lines = [
    `🔥 ${discount}% OFF — ${deal.title}`,
    ``,
    `Was ${formatPrice(deal.original_price)} → Now ${formatPrice(deal.current_price)}`,
    saving ? `You save: ${saving}` : '',
    deal.coupon_code ? `Coupon: ${deal.coupon_code.slice(0, 3)}●●● (tap to reveal full code)` : '',
    ``,
    `✅ Verified deal · Sold & delivered by ${platform.label}`,
    `👉 See deal + coupon: ${url}`,
    ``,
    `via @DealTrustNG`,
  ].filter(l => l !== null && l !== undefined)

  return lines.join('\n')
}

export function shareToWhatsApp(deal) {
  const text = encodeURIComponent(buildShareText(deal))
  window.open(`https://wa.me/?text=${text}`, '_blank')
}

export function shareToTwitter(deal) {
  const discount = calcDiscount(deal.original_price, deal.current_price)
  const url = `https://dealtrust.app/go/${deal.id}`
  const text = encodeURIComponent(
    `🔥 ${discount}% OFF — ${deal.title}\n${formatPrice(deal.current_price)} on ${deal.platform}\n\nSee verified deal + coupon 👇`
  )
  window.open(`https://twitter.com/intent/tweet?text=${text}&url=${encodeURIComponent(url)}`, '_blank')
}

export function shareToTelegram(deal) {
  const text = encodeURIComponent(buildShareText(deal))
  const url  = encodeURIComponent(`https://dealtrust.app/go/${deal.id}`)
  window.open(`https://t.me/share/url?url=${url}&text=${text}`, '_blank')
}

export async function copyDealLink(deal) {
  const url = `https://dealtrust.app/go/${deal.id}`
  try {
    await navigator.clipboard.writeText(url)
    return true
  } catch {
    // fallback
    const el = document.createElement('textarea')
    el.value = url
    document.body.appendChild(el)
    el.select()
    document.execCommand('copy')
    document.body.removeChild(el)
    return true
  }
}

// ── Deal score color ──────────────────────────────────────
export function scoreColor(score) {
  if (score >= 80) return { color: '#059669', bg: '#d1fae5' }
  if (score >= 60) return { color: '#d97706', bg: '#fef3c7' }
  return { color: '#dc2626', bg: '#fee2e2' }
}
