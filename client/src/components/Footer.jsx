import { Link } from 'react-router-dom'
import { Tag } from 'lucide-react'
import { CATEGORIES } from '../utils/index.js'
import styles from './Footer.module.css'

export default function Footer() {
  return (
    <footer className={styles.footer}>
      <div className={styles.inner}>

        <div className={styles.brand}>
          <div className={styles.logo}>
            <div className={styles.logoIcon}><Tag size={14} color="#fff" /></div>
            <span className={styles.logoText}>Deal<span>Trust</span></span>
          </div>
          <p className={styles.tagline}>
            Only verified deals with real price drops. No fake discounts. No expired coupons.
          </p>
          <p className={styles.affiliate}>
            DealTrust earns affiliate commissions when you click deal links and make a purchase.
            This never affects the price you pay.
          </p>
        </div>

        <div className={styles.links}>
          <div className={styles.linkGroup}>
            <h4 className={styles.linkHead}>Categories</h4>
            {CATEGORIES.map(c => (
              <Link key={c.slug} to={`/category/${c.slug}`} className={styles.link}>
                {c.icon} {c.label}
              </Link>
            ))}
          </div>
          <div className={styles.linkGroup}>
            <h4 className={styles.linkHead}>Platforms</h4>
            <span className={styles.link}>🟠 Jumia</span>
            <span className={styles.link}>🔴 Konga</span>
            <span className={styles.link}>🟣 Temu</span>
          </div>
          <div className={styles.linkGroup}>
            <h4 className={styles.linkHead}>DealTrust</h4>
            <Link to="/alerts" className={styles.link}>🔔 Deal Alerts</Link>
            <a href="https://twitter.com/DealTrustNG" target="_blank" rel="noopener" className={styles.link}>𝕏 @DealTrustNG</a>
          </div>
        </div>

      </div>
      <div className={styles.bottom}>
        <p>© {new Date().getFullYear()} DealTrust · Nigeria's verified deal platform</p>
        <p>Prices verified in real-time · Deals subject to change without notice</p>
      </div>
    </footer>
  )
}
