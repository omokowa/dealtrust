import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Share2, Clock, CheckCircle, Star } from 'lucide-react'
import toast from 'react-hot-toast'
import {
  formatPrice, calcDiscount, formatSaving,
  expiryCountdown, getPlatformMeta, scoreColor,
  isExpired
} from '../utils/index.js'
import { useCouponReveal } from '../hooks/index.js'
import ShareModal from './ShareModal.jsx'
import styles from './DealCard.module.css'

export default function DealCard({ deal }) {
  const [shareOpen, setShareOpen] = useState(false)
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

  function handleShare(e) {
    e.preventDefault()
    e.stopPropagation()
    setShareOpen(true)
  }

  return (
    <>
      <Link to={`/deal/${deal.id}`} className={`${styles.card} ${expired ? styles.expired : ''}`}>

        {/* Image */}
        <div className={styles.imageWrap}>
          <img
            src={deal.image_url || '/placeholder.png'}
            alt={deal.title}
            className={styles.image}
            loading="lazy"
            onError={e => { e.target.src = '/placeholder.png' }}
          />

          {/* Discount badge */}
          {discount > 0 && (
            <div className={styles.discountBadge}>
              -{discount}%
            </div>
          )}

          {/* Platform logo badge */}
          <div
            className={styles.platformBadge}
            style={{ background: platform.bg, color: platform.color }}
          >
            {platform.logo} {platform.label}
          </div>

          {/* Share button */}
          <button
            className={styles.shareBtn}
            onClick={handleShare}
            title="Share this deal"
            aria-label="Share deal"
          >
            <Share2 size={14} />
          </button>
        </div>

        {/* Body */}
        <div className={styles.body}>

          {/* Title */}
          <h3 className={`${styles.title} line-clamp2`}>{deal.title}</h3>

          {/* AI Summary */}
          {deal.ai_summary && (
            <p className={`${styles.summary} line-clamp2`}>{deal.ai_summary}</p>
          )}

          {/* Prices */}
          <div className={styles.prices}>
            <span className={styles.currentPrice}>{formatPrice(deal.current_price)}</span>
            {deal.original_price > deal.current_price && (
              <span className={styles.originalPrice}>{formatPrice(deal.original_price)}</span>
            )}
            {saving && (
              <span className={styles.saving}>Save {saving}</span>
            )}
          </div>

          {/* Coupon code reveal */}
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
                  >
                    Copy
                  </button>
                </div>
              ) : (
                <button
                  className={styles.revealBtn}
                  onClick={handleReveal}
                  disabled={loading || expired}
                >
                  {loading ? 'Opening…' : '🎟 Tap to reveal coupon & open deal'}
                </button>
              )}
            </div>
          )}

          {/* Footer row */}
          <div className={styles.footer}>

            {/* Deal score */}
            {deal.deal_score > 0 && (
              <div className={styles.score} style={{ background: sc.bg, color: sc.color }}>
                <Star size={11} fill="currentColor" />
                {deal.deal_score}
              </div>
            )}

            {/* Verified badge */}
            {deal.verified && (
              <div className={styles.verified}>
                <CheckCircle size={11} />
                Verified
              </div>
            )}

            {/* Expiry countdown */}
            {countdown && (
              <div className={`${styles.countdown} ${expired ? styles.countdownExpired : ''}`}>
                <Clock size={11} />
                {countdown}
              </div>
            )}

          </div>
        </div>
      </Link>

      {/* Share modal */}
      {shareOpen && (
        <ShareModal deal={deal} onClose={() => setShareOpen(false)} />
      )}
    </>
  )
}
