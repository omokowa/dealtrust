import { useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { ChevronRight } from 'lucide-react'
import { useCategoryDeals } from '../hooks/index.js'
import { getCategoryMeta } from '../utils/index.js'
import DealGrid from '../components/DealGrid.jsx'
import styles from './CategoryPage.module.css'

const PLATFORM_FILTERS = ['All', 'Jumia', 'Konga', 'Temu']
const SORT_OPTIONS = [
  { value: 'newest',    label: 'Newest first' },
  { value: 'discount',  label: 'Biggest discount' },
  { value: 'score',     label: 'Best score' },
  { value: 'price_asc', label: 'Price: low → high' },
  { value: 'price_desc',label: 'Price: high → low' },
]

export default function CategoryPage() {
  const { slug } = useParams()
  const meta = getCategoryMeta(slug)

  const [subCat,   setSubCat]   = useState('All')
  const [platform, setPlatform] = useState('All')
  const [sort,     setSort]     = useState('newest')

  const params = {
    ...(subCat   !== 'All' && { sub_category: subCat }),
    ...(platform !== 'All' && { platform: platform.toLowerCase() }),
    sort,
    limit: 40,
  }

  const { deals, loading, error } = useCategoryDeals(slug, params)

  if (!meta) {
    return (
      <div style={{ textAlign: 'center', padding: '4rem 1rem' }}>
        <h2>Category not found</h2>
        <Link to="/" className="btn btn-primary" style={{ marginTop: '1rem', display: 'inline-flex' }}>
          Back to Home
        </Link>
      </div>
    )
  }

  return (
    <div>
      {/* Header */}
      <div className={styles.header}>
        <div className={styles.headerInner}>
          {/* Breadcrumb */}
          <div className={styles.breadcrumb}>
            <Link to="/" className={styles.breadLink}>Home</Link>
            <ChevronRight size={14} className={styles.breadSep} />
            <span>{meta.label}</span>
          </div>

          <div className={styles.titleRow}>
            <span className={styles.titleIcon}>{meta.icon}</span>
            <div>
              <h1 className={styles.title}>{meta.label} Deals</h1>
              <p className={styles.subtitle}>
                Verified discounts on {meta.sub.join(', ')} — from Jumia, Konga & Temu
              </p>
            </div>
          </div>

          {/* Sub-category tabs */}
          <div className={styles.subCatTabs}>
            {['All', ...meta.sub].map(s => (
              <button
                key={s}
                className={`${styles.subTab} ${subCat === s ? styles.subTabActive : ''}`}
                onClick={() => setSubCat(s)}
              >
                {s}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Filters + Grid */}
      <div className={styles.container}>
        <div className={styles.filterRow}>
          {/* Platform pills */}
          <div className={styles.pillGroup}>
            {PLATFORM_FILTERS.map(p => (
              <button
                key={p}
                className={`${styles.pill} ${platform === p ? styles.pillActive : ''}`}
                onClick={() => setPlatform(p)}
              >
                {p === 'Jumia' ? '🟠 ' : p === 'Konga' ? '🔴 ' : p === 'Temu' ? '🟣 ' : ''}{p}
              </button>
            ))}
          </div>

          {/* Sort */}
          <select
            className={styles.sortSelect}
            value={sort}
            onChange={e => setSort(e.target.value)}
          >
            {SORT_OPTIONS.map(o => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
        </div>

        {/* Count */}
        {!loading && (
          <p className={styles.count}>
            {deals.length} verified deal{deals.length !== 1 ? 's' : ''}
            {subCat !== 'All' ? ` in ${subCat}` : ` in ${meta.label}`}
          </p>
        )}

        <DealGrid
          deals={deals}
          loading={loading}
          error={error}
          emptyMessage={`No ${meta.label.toLowerCase()} deals right now. We check every 6 hours — come back soon!`}
        />
      </div>
    </div>
  )
}
