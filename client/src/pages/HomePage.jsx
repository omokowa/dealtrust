import { useState } from 'react'
import { Link } from 'react-router-dom'
import { TrendingUp, Zap, Shield, Bell, Tag } from 'lucide-react'
import { useDeals } from '../hooks/index.js'
import { CATEGORIES } from '../utils/index.js'
import DealGrid from '../components/DealGrid.jsx'
import styles from './HomePage.module.css'

const PLATFORM_FILTERS = [
  { value: 'all',   label: 'All Platforms' },
  { value: 'jumia', label: '🟠 Jumia' },
  { value: 'konga', label: '🔴 Konga' },
  { value: 'temu',  label: '🟣 Temu' },
]

const SORT_OPTIONS = [
  { value: 'newest',    label: 'Newest' },
  { value: 'discount',  label: 'Biggest Discount' },
  { value: 'score',     label: 'Best Deal Score' },
  { value: 'price_asc', label: 'Price: Low → High' },
]

const TRUST_CARDS = [
  { icon: '✅', title: 'Verified Deals Only', desc: 'Every deal checked against 30-day price history' },
  { icon: '🎟', title: 'Real Coupon Codes',   desc: 'Codes tested before publishing — no expired ones' },
  { icon: '🔔', title: 'Instant Alerts',      desc: 'Get notified on WhatsApp or email the moment a deal drops' },
  { icon: '🛡', title: 'No Fake Prices',      desc: 'We verify the original price was not inflated before discount' },
]

export default function HomePage() {
  const [category, setCategory] = useState('all')
  const [platform, setPlatform] = useState('all')
  const [sort,     setSort]     = useState('newest')

  const params = {
    ...(category !== 'all' && { category }),
    ...(platform !== 'all' && { platform }),
    sort,
    limit: 40,
  }

  const { deals, loading, error } = useDeals(params)

  return (
    <div>
      {/* ── Hero ── */}
      <section className={styles.hero}>
        <div className={styles.heroInner}>

          {/* Left: text */}
          <div className={styles.heroLeft}>
            <div className={styles.heroBadge}>
              <Shield size={13} />
              Nigeria's most trusted deal platform
            </div>
            <h1 className={styles.heroTitle}>
              Real deals.<br />
              <span className={styles.heroAccent}>No fake discounts.</span>
            </h1>
            <p className={styles.heroSub}>
              Every deal verified against 30-day price history.
              No inflated prices. No expired coupons.
              Genuine savings on Jumia, Konga and Temu.
            </p>
            <div className={styles.heroCtas}>
              <Link to="/alerts" className={`btn btn-primary btn-lg ${styles.heroBtn}`}>
                <Bell size={16} /> Get Deal Alerts
              </Link>
              <a href="#deals" className={`btn btn-ghost btn-lg ${styles.heroBtn}`}>
                Browse Deals ↓
              </a>
            </div>
            {/* Stats row */}
            <div className={styles.stats}>
              {[
                { icon: <Shield size={15} />,    label: 'Verified today',     value: '120+' },
                { icon: <Zap size={15} />,        label: 'Avg. discount',      value: '34%' },
                { icon: <TrendingUp size={15} />, label: 'Saved by users',     value: '₦2.4M' },
              ].map(s => (
                <div key={s.label} className={styles.stat}>
                  <div className={styles.statIcon}>{s.icon}</div>
                  <div>
                    <div className={styles.statValue}>{s.value}</div>
                    <div className={styles.statLabel}>{s.label}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Right: trust cards */}
          <div className={styles.heroRight}>
            {TRUST_CARDS.map(card => (
              <div key={card.title} className={styles.trustCard}>
                <span className={styles.trustIcon}>{card.icon}</span>
                <div>
                  <div className={styles.trustTitle}>{card.title}</div>
                  <div className={styles.trustDesc}>{card.desc}</div>
                </div>
              </div>
            ))}
          </div>

        </div>
      </section>

      {/* ── Category cards ── */}
      <section className={styles.catSection}>
        <div className={styles.container}>
          <div className={styles.catGrid}>
            {CATEGORIES.map(c => (
              <button
                key={c.slug}
                className={`${styles.catCard} ${category === c.slug ? styles.catCardActive : ''}`}
                onClick={() => setCategory(category === c.slug ? 'all' : c.slug)}
              >
                <span className={styles.catIcon}>{c.icon}</span>
                <span className={styles.catLabel}>{c.label}</span>
                <span className={styles.catSubs}>{c.sub.slice(0, 2).join(' · ')}</span>
              </button>
            ))}
          </div>
        </div>
      </section>

      {/* ── Deals section ── */}
      <section className={styles.dealsSection} id="deals">
        <div className={styles.container}>
          <div className={styles.filterBar}>
            <div className={styles.filterLeft}>
              <div className={styles.pillGroup}>
                {PLATFORM_FILTERS.map(p => (
                  <button
                    key={p.value}
                    className={`${styles.pill} ${platform === p.value ? styles.pillActive : ''}`}
                    onClick={() => setPlatform(p.value)}
                  >
                    {p.label}
                  </button>
                ))}
              </div>
            </div>
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

          <div className={styles.resultsHeader}>
            <h2 className={styles.resultsTitle}>
              {category === 'all'
                ? 'All Verified Deals'
                : CATEGORIES.find(c => c.slug === category)?.label + ' Deals'}
            </h2>
            {!loading && (
              <span className={styles.resultsCount}>
                {deals.length} deal{deals.length !== 1 ? 's' : ''} found
              </span>
            )}
          </div>

          <DealGrid
            deals={deals}
            loading={loading}
            error={error}
            emptyMessage="No deals right now. Check back soon!"
          />
        </div>
      </section>

      {/* ── CTA ── */}
      <section className={styles.ctaSection}>
        <div className={styles.ctaInner}>
          <Bell size={28} className={styles.ctaIcon} />
          <h2 className={styles.ctaTitle}>Never miss a deal</h2>
          <p className={styles.ctaSub}>
            Get instant alerts on WhatsApp or email when a verified deal drops in your category.
          </p>
          <Link to="/alerts" className="btn btn-primary btn-lg">
            Set Up Free Alerts →
          </Link>
        </div>
      </section>
    </div>
  )
}
