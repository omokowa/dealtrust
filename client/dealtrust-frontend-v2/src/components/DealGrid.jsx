import DealCard from './DealCard.jsx'
import styles from './DealGrid.module.css'

// ── Skeleton card for loading state ──────────────────────
export function SkeletonCard() {
  return (
    <div className={styles.skeleton}>
      <div className={`skeleton ${styles.skeletonImage}`} />
      <div className={styles.skeletonBody}>
        <div className={`skeleton ${styles.skeletonLine}`} style={{ width: '85%' }} />
        <div className={`skeleton ${styles.skeletonLine}`} style={{ width: '65%', height: '12px' }} />
        <div className={`skeleton ${styles.skeletonLine}`} style={{ width: '50%', height: '22px', marginTop: '4px' }} />
        <div className={`skeleton ${styles.skeletonLine}`} style={{ width: '100%', height: '36px', marginTop: '4px', borderRadius: '8px' }} />
      </div>
    </div>
  )
}

// ── Deal grid ─────────────────────────────────────────────
export default function DealGrid({ deals, loading, error, emptyMessage }) {
  if (error) {
    return (
      <div className={styles.state}>
        <span className={styles.stateIcon}>⚠️</span>
        <p className={styles.stateText}>Could not load deals. Check your connection and try again.</p>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="deal-grid">
        {Array.from({ length: 8 }).map((_, i) => <SkeletonCard key={i} />)}
      </div>
    )
  }

  if (!deals?.length) {
    return (
      <div className={styles.state}>
        <span className={styles.stateIcon}>🔍</span>
        <p className={styles.stateText}>{emptyMessage || 'No deals found right now. Check back soon!'}</p>
      </div>
    )
  }

  return (
    <div className="deal-grid fade-in">
      {deals.map(deal => (
        <DealCard key={deal.id} deal={deal} />
      ))}
    </div>
  )
}
