import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Search, Bell, Menu, X, Tag } from 'lucide-react'
import { CATEGORIES } from '../utils/index.js'
import styles from './Navbar.module.css'

export default function Navbar() {
  const [menuOpen,   setMenuOpen]   = useState(false)
  const [searchOpen, setSearchOpen] = useState(false)
  const [q,          setQ]          = useState('')
  const navigate = useNavigate()

  function handleSearch(e) {
    e.preventDefault()
    if (!q.trim()) return
    navigate(`/search?q=${encodeURIComponent(q.trim())}`)
    setQ('')
    setSearchOpen(false)
  }

  return (
    <header className={styles.nav}>
      <div className={styles.inner}>

        {/* Logo */}
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

        {/* Actions */}
        <div className={styles.actions}>
          <Link to="/alerts" className={styles.alertBtn} title="Deal Alerts">
            <Bell size={18} />
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

      {/* Mobile search */}
      <div className={styles.mobileSearch}>
        <form onSubmit={handleSearch} style={{ position: 'relative' }}>
          <Search size={15} className={styles.searchIcon} />
          <input
            type="text"
            placeholder="Search deals, brands, categories…"
            value={q}
            onChange={e => setQ(e.target.value)}
            className={styles.searchInput}
          />
        </form>
      </div>

      {/* Mobile menu */}
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
