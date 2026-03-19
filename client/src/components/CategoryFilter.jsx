import { Link, useLocation } from 'react-router-dom'
import { CATEGORIES } from '../utils/index.js'
import styles from './CategoryFilter.module.css'

export default function CategoryFilter({ active, onChange }) {
  const location = useLocation()
  const isHome = location.pathname === '/'

  return (
    <div className={styles.wrap}>
      {isHome && (
        <button
          className={`${styles.tab} ${!active || active === 'all' ? styles.tabActive : ''}`}
          onClick={() => onChange?.('all')}
        >
          🌐 All
        </button>
      )}
      {CATEGORIES.map(c => {
        const isActive = active === c.slug
        if (isHome) {
          return (
            <button
              key={c.slug}
              className={`${styles.tab} ${isActive ? styles.tabActive : ''}`}
              onClick={() => onChange?.(c.slug)}
            >
              {c.icon} {c.label}
            </button>
          )
        }
        return (
          <Link
            key={c.slug}
            to={`/category/${c.slug}`}
            className={`${styles.tab} ${isActive ? styles.tabActive : ''}`}
          >
            {c.icon} {c.label}
          </Link>
        )
      })}
    </div>
  )
}
