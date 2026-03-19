import { useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import {
  ChevronRight, Share2, ThumbsUp, ThumbsDown,
  Clock, Shield, ExternalLink, CheckCircle,
  TrendingDown, AlertTriangle
} from 'lucide-react'
import toast from 'react-hot-toast'
import { useDeal, useCouponReveal } from '../hooks/index.js'
import {
  formatPrice, calcDiscount, formatSaving,
  expiryCountdown, getPlatformMeta, timeAgo,
  scoreColor, isExpired, getCategoryMeta
} from '../utils/index.js'
import { voteDeal, reportCoupon } from '../api/index.js'
import ShareModal from '../components/ShareModal.jsx'
import { SkeletonCard } from '../components/DealGrid.jsx'
import styles from './DealPage.module.css'

export default function DealPage() {
  const { id } = useParams()
  const { deal, loading, error } = useDeal(id)
  const [shareOpen,    setShareOpen]    = useState(false)
  const [votedActive,  setVotedActive]  = useState(false)
  const [votedExpired, setVotedExpired] = useState(false)
  const [reported,     setReported]     = useState(false)

  const { revealed, code, loading: revealLoading, reveal } = useCouponReveal(id)

  async function handleReveal() {
    await reveal()
    if (!revealed) toast.success('Coupon revealed! Opening deal on retailer site…')
  }

  async function handleVote(vote) {
    if (votedActive || votedExpired) return
    try {
      await voteDeal(id, vote)
      if (vote === 'active')  { setVotedActive(true);  toast.success('Thanks! Marked as still active.') }
      if (vote === 'expired') { setVotedExpired(true); toast('Thanks for the heads up!') }
    } catch { toast.error('Could not submit vote') }
  }

  async function handleReportCoupon() {
    if (reported) return
    try {
      await reportCoupon(id)
      setReported(true)
      toast('Reported — we\'ll check this coupon')
    } catch { toast.error('Could not report') }
  }

  if (loading) {
    return (
      <div className={styles.container} style={{ paddingTop: '2rem' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2rem' }}>
          <SkeletonCard />
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {[100, 60, 80, 40, 100, 50].map((w, i) => (
              <div key={i} className="skeleton" style={{ height: i === 4 ? '80px' : '18px', width: w + '%', borderRadius: '6px' }} />
            ))}
          </div>
        </div>
      </div>
    )
  }

  if (error || !deal) {
    return (
      <div className={styles.container} style={{ textAlign: 'center', padding: '4rem 1rem' }}>
        <AlertTriangle size={40} style={{ color: 'var(--text3)', margin: '0 auto 1rem' }} />
        <h2>Deal not found</h2>
        <p style={{ color: 'var(--text2)', marginTop: '.5rem' }}>This deal may have expired or been removed.</p>
        <Link to="/" className="btn btn-primary" style={{ marginTop: '1.5rem', display: 'inline-flex' }}>
          Browse all deals
        </Link>
      </div>
    )
  }

  const discount  = calcDiscount(deal.original_price, deal.current_price)
  const saving    = formatSaving(deal.original_price, deal.current_price)
  const platform  = getPlatformMeta(deal.platform)
  const category  = getCategoryMeta(deal.category)
  const countdown = expiryCountdown(deal.expires_at)
  const expired   = isExpired(deal.expires_at)
  const sc        = scoreColor(deal.deal_score || 0)

  return (
    <div>
      <div className={styles.container}>
        {/* Breadcrumb */}
        <div className={styles.breadcrumb}>
          <Link to="/" className={styles.breadLink}>Home</Link>
          <ChevronRight size={13} />
          {category && (
            <>
              <Link to={`/category/${deal.category}`} className={styles.breadLink}>{category.label}</Link>
              <ChevronRight size={13} />
            </>
          )}
          <span className={styles.breadCurrent}>{deal.title.slice(0, 40)}{deal.title.length > 40 ? '…' : ''}</span>
        </div>

        <div className={styles.grid}>
          {/* Left: image */}
          <div className={styles.imageCol}>
            <div className={styles.imageWrap}>
              <img
                src={deal.image_url || '/placeholder.png'}
                alt={deal.title}
                className={styles.image}
                onError={e => { e.target.src = '/placeholder.png' }}
              />
              {discount > 0 && (
                <div className={styles.discountBadge}>-{discount}%</div>
              )}
            </div>

            {/* Platform */}
            <div className={styles.platformRow} style={{ background: platform.bg }}>
              <span style={{ fontSize: '1.1rem' }}>{platform.logo}</span>
              <div>
                <div style={{ fontWeight: 700, fontSize: '.88rem', color: platform.color }}>
                  Sold on {platform.label}
                </div>
                <div style={{ fontSize: '.75rem', color: 'var(--text2)' }}>
                  Fulfilled & delivered by {platform.label}
                </div>
              </div>
            </div>

            {/* Vote: is this deal still active? */}
            <div className={styles.voteBox}>
              <p className={styles.voteLabel}>Is this deal still active?</p>
              <div className={styles.voteButtons}>
                <button
                  className={`${styles.voteBtn} ${votedActive ? styles.voteBtnActive : ''}`}
                  onClick={() => handleVote('active')}
                  disabled={votedActive || votedExpired}
                >
                  <ThumbsUp size={14} /> Yes, still active
                  {deal.votes_active > 0 && <span className={styles.voteCount}>{deal.votes_active}</span>}
                </button>
                <button
                  className={`${styles.voteBtn} ${styles.voteBtnExpire} ${votedExpired ? styles.voteBtnExpired : ''}`}
                  onClick={() => handleVote('expired')}
                  disabled={votedActive || votedExpired}
                >
                  <ThumbsDown size={14} /> Expired
                  {deal.votes_expired > 0 && <span className={styles.voteCount}>{deal.votes_expired}</span>}
                </button>
              </div>
            </div>
          </div>

          {/* Right: deal info */}
          <div className={styles.infoCol}>
            <h1 className={styles.title}>{deal.title}</h1>

            {/* AI summary */}
            {deal.ai_summary && (
              <p className={styles.summary}>{deal.ai_summary}</p>
            )}

            {/* Badges row */}
            <div className={styles.badgeRow}>
              {deal.verified && (
                <span className="badge" style={{ background: 'var(--green-pale)', color: 'var(--green)' }}>
                  <CheckCircle size={11} /> Verified Deal
                </span>
              )}
              {deal.deal_score > 0 && (
                <span className="badge" style={{ background: sc.bg, color: sc.color }}>
                  ⭐ Score: {deal.deal_score}/100
                </span>
              )}
              {countdown && (
                <span className="badge" style={{ background: expired ? 'var(--surface2)' : 'var(--orange-pale)', color: expired ? 'var(--text3)' : 'var(--orange)' }}>
                  <Clock size={11} /> {countdown}
                </span>
              )}
            </div>

            {/* Price block */}
            <div className={styles.priceBlock}>
              <div className={styles.currentPrice}>{formatPrice(deal.current_price)}</div>
              <div className={styles.priceRow}>
                {deal.original_price > deal.current_price && (
                  <span className={styles.originalPrice}>{formatPrice(deal.original_price)}</span>
                )}
                {saving && (
                  <span className={styles.saving}>
                    <TrendingDown size={13} /> You save {saving}
                  </span>
                )}
              </div>
              <p className={styles.priceNote}>
                <Shield size={11} /> Price verified {timeAgo(deal.updated_at)} against 30-day average
              </p>
            </div>

            {/* Coupon code */}
            {deal.coupon_code && (
              <div className={styles.couponSection}>
                <p className={styles.couponLabel}>
                  🎟 Coupon code available
                  {deal.coupon_success_rate > 0 && (
                    <span className={styles.successRate}>{deal.coupon_success_rate}% success rate</span>
                  )}
                </p>
                {revealed ? (
                  <div className={styles.couponRevealed}>
                    <CheckCircle size={16} color="var(--green)" />
                    <code className={styles.couponCode}>{code || deal.coupon_code}</code>
                    <button
                      className={styles.copyBtn}
                      onClick={async () => {
                        await navigator.clipboard.writeText(code || deal.coupon_code)
                        toast.success('Code copied!')
                      }}
                    >
                      Copy
                    </button>
                    <button
                      className={styles.reportBtn}
                      onClick={handleReportCoupon}
                      disabled={reported}
                    >
                      {reported ? 'Reported' : 'Not working?'}
                    </button>
                  </div>
                ) : (
                  <button
                    className={styles.revealBtn}
                    onClick={handleReveal}
                    disabled={revealLoading || expired}
                  >
                    {revealLoading
                      ? 'Opening deal…'
                      : expired
                      ? 'Deal expired'
                      : '🎟 Reveal coupon code & open deal →'}
                  </button>
                )}
                <p className={styles.couponNote}>
                  Tapping opens the deal on {platform.label} and reveals your code
                </p>
              </div>
            )}

            {/* CTA — no coupon */}
            {!deal.coupon_code && (
              <a
                href={`/go/${deal.id}`}
                target="_blank"
                rel="noopener noreferrer"
                className={styles.goBtn}
              >
                <ExternalLink size={16} />
                See deal on {platform.label} →
              </a>
            )}

            {/* Share */}
            <button className={styles.shareBtn} onClick={() => setShareOpen(true)}>
              <Share2 size={15} /> Share this deal
            </button>

            {/* Price history */}
            {deal.price_history?.length > 1 && (
              <div className={styles.historyBox}>
                <h3 className={styles.historyTitle}>
                  <TrendingDown size={15} /> 30-Day Price History
                </h3>
                <div className={styles.historyList}>
                  {deal.price_history.slice(-7).map((h, i) => (
                    <div key={i} className={styles.historyRow}>
                      <span className={styles.historyDate}>{timeAgo(h.scraped_at)}</span>
                      <span className={styles.historyPrice}>{formatPrice(h.price)}</span>
                      {h.price === deal.current_price && (
                        <span className={styles.historyNow}>current</span>
                      )}
                    </div>
                  ))}
                </div>
                <p className={styles.historyNote}>
                  Lowest in 30 days: <strong>{formatPrice(Math.min(...deal.price_history.map(h => h.price)))}</strong>
                </p>
              </div>
            )}
          </div>
        </div>
      </div>

      {shareOpen && <ShareModal deal={deal} onClose={() => setShareOpen(false)} />}
    </div>
  )
}
