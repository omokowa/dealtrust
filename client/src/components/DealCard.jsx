import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Clock, CheckCircle, Star } from 'lucide-react'
import toast from 'react-hot-toast'
import {
  formatPrice, calcDiscount, formatSaving,
  expiryCountdown, getPlatformMeta, scoreColor,
  isExpired
} from '../utils/index.js'
import { useCouponReveal } from '../hooks/index.js'
import styles from './DealCard.module.css'

export default function DealCard({ deal }) {
  const { revealed, code, loading, reveal } = useCouponReveal(deal.id)

  const discount  = calcDiscount(deal.original_price, deal.current_price)
  const saving    = formatSaving(deal.original_price, deal.current_price)
  const platform  = getPlatformMeta(deal.platform)
  const countdown = expiryCountdown(deal.expires_at)
  const expired   = isExpired(deal.expires_at)
  const sc        = scoreColor(deal.deal_score || 0)

  async function handleReveal(e) {
    e.preventDefault()
    e.stopPropagation()
    await reveal()
    if (!revealed) toast.success('Coupon revealed! Retailer site opening…')
  }

  return (
    <Link to={`/deal/${deal.id}`} className={`${styles.card} ${expired ? styles.expired : ''}`}>

      {/* ── Image ── */}
      <div className={styles.imageWrap}>
        <img
          src={deal.image_url || '/placeholder.png'}
          alt={deal.title}
          className={styles.image}
          loading="lazy"
          onError={e => { e.target.src = '/placeholder.png' }}
        />
        {discount > 0 && (
          <div className={styles.discountBadge}>-{discount}%</div>
        )}
        <div className={styles.platformBadge}>
          {platform.logo} {platform.label}
        </div>
      </div>

      {/* ── Body ── */}
      <div className={styles.body}>

        {/* Price — prominent, first thing user sees */}
        <div className={styles.prices}>
          <span className={styles.currentPrice}>{formatPrice(deal.current_price)}</span>
          {deal.original_price > deal.current_price && (
            <span className={styles.originalPrice}>{formatPrice(deal.original_price)}</span>
          )}
        </div>

        {/* Saving badge */}
        {saving && (
          <div className={styles.savingBadge}>Save {saving}</div>
        )}

        {/* Title */}
        <h3 className={`${styles.title} line-clamp2`}>{deal.title}</h3>

        {/* Coupon reveal */}
        {deal.coupon_code && (
          <div className={styles.couponRow}>
            {revealed ? (
              <div className={styles.couponRevealed}>
                <CheckCircle size={13} />
                <span className={styles.couponCode}>{code || deal.coupon_code}</span>
                <button
                  className={styles.copyBtn}
                  onClick={async (e) => {
                    e.preventDefault()
                    e.stopPropagation()
                    await navigator.clipboard.writeText(code || deal.coupon_code)
                    toast.success('Code copied!')
                  }}
                >Copy</button>
              </div>
            ) : (
              <button
                className={styles.revealBtn}
                onClick={handleReveal}
                disabled={loading || expired}
              >
                {loading ? 'Opening…' : '🎟 Reveal coupon'}
              </button>
            )}
          </div>
        )}

        {/* Footer */}
        <div className={styles.footer}>
          {deal.deal_score > 0 && (
            <div className={styles.score} style={{ background: sc.bg, color: sc.color }}>
              <Star size={10} fill="currentColor" />
              {deal.deal_score}
            </div>
          )}
          {deal.verified ? (
            <div className={styles.verified}>
              <CheckCircle size={10} />
              Verified
            </div>
          ) : null}
          {countdown && (
            <div className={`${styles.countdown} ${expired ? styles.countdownExpired : ''}`}>
              <Clock size={10} />
              {countdown}
            </div>
          )}
        </div>

      </div>
    </Link>
  )
}
