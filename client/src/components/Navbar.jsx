import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Search, Bell, Menu, X, Tag } from 'lucide-react'
import { CATEGORIES } from '../utils/index.js'
import styles from './Navbar.module.css'

export default function Navbar() {
  const [menuOpen, setMenuOpen] = useState(false)
  const [q, setQ] = useState('')
  const navigate = useNavigate()

  function handleSearch(e) {
    e.preventDefault()
    if (!q.trim()) return
    navigate(`/search?q=${encodeURIComponent(q.trim())}`)
    setQ('')
    setMenuOpen(false)
  }

  return (
    <header className={styles.nav}>

      {/* ── Top bar: Logo + Bell + Hamburger ── */}
      <div className={styles.inner}>
        <Link to="/" className={styles.logo}>
          <div className={styles.logoIcon}>
            <Tag size={16} color="#fff" strokeWidth={2.5} />
          </div>
          <span className={styles.logoText}>Deal<span>Trust</span></span>
        </Link>

        {/* Desktop category links */}
        <nav className={styles.catLinks}>
          {CATEGORIES.map(c => (
            <Link key={c.slug} to={`/category/${c.slug}`} className={styles.catLink}>
              {c.icon} {c.label}
            </Link>
          ))}
        </nav>

        {/* Desktop search */}
        <form className={styles.searchForm} onSubmit={handleSearch}>
          <Search size={15} className={styles.searchIcon} />
          <input
            type="text"
            placeholder="Search deals…"
            value={q}
            onChange={e => setQ(e.target.value)}
            className={styles.searchInput}
          />
        </form>

        <div className={styles.actions}>
          <Link to="/alerts" className={styles.alertBtn} title="Deal Alerts">
            <Bell size={20} />
          </Link>
          <button
            className={styles.menuBtn}
            onClick={() => setMenuOpen(!menuOpen)}
            aria-label="Menu"
          >
            {menuOpen ? <X size={20} /> : <Menu size={20} />}
          </button>
        </div>
      </div>

      {/* ── Mobile search bar — full width below top bar ── */}
      <div className={styles.mobileSearch}>
        <form onSubmit={handleSearch}>
          <div className={styles.mobileSearchWrap}>
            <Search size={15} className={styles.mobileSearchIcon} />
            <input
              type="text"
              placeholder="Search deals, brands, categories…"
              value={q}
              onChange={e => setQ(e.target.value)}
              className={styles.mobileSearchInput}
            />
            <button type="submit" className={styles.mobileSearchBtn}>
              Search
            </button>
          </div>
        </form>
      </div>

      {/* ── Mobile menu ── */}
      {menuOpen && (
        <div className={styles.mobileMenu}>
          {CATEGORIES.map(c => (
            <Link
              key={c.slug}
              to={`/category/${c.slug}`}
              className={styles.mobileLink}
              onClick={() => setMenuOpen(false)}
            >
              <span>{c.icon}</span>
              <span>{c.label}</span>
            </Link>
          ))}
          <Link to="/alerts" className={styles.mobileLink} onClick={() => setMenuOpen(false)}>
            <Bell size={16} /> Deal Alerts
          </Link>
        </div>
      )}
    </header>
  )
}
