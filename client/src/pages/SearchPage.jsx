import { useEffect } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Search } from 'lucide-react'
import { useSearch } from '../hooks/index.js'
import DealGrid from '../components/DealGrid.jsx'
import styles from './SearchPage.module.css'

export default function SearchPage() {
  const [searchParams] = useSearchParams()
  const urlQuery = searchParams.get('q') || ''
  const { query, setQuery, results, loading } = useSearch()

  // Sync URL query to search hook on mount
  useEffect(() => {
    if (urlQuery) setQuery(urlQuery)
  }, [urlQuery])

  return (
    <div className={styles.container}>
      {/* Search bar */}
      <div className={styles.searchWrap}>
        <div className={styles.searchBox}>
          <Search size={18} className={styles.searchIcon} />
          <input
            type="text"
            className={styles.input}
            placeholder="Search deals, brands, products…"
            value={query}
            onChange={e => setQuery(e.target.value)}
            autoFocus
          />
          {query && (
            <button className={styles.clearBtn} onClick={() => setQuery('')}>✕</button>
          )}
        </div>
      </div>

      {/* Results */}
      {!query.trim() ? (
        <div className={styles.empty}>
          <span className={styles.emptyIcon}>🔍</span>
          <h2 className={styles.emptyTitle}>Search for deals</h2>
          <p className={styles.emptyText}>
            Try "Samsung phone", "air conditioner", "Nike shoes", "laptop"
          </p>
          <div className={styles.suggestions}>
            {['iPhone', 'Samsung TV', 'Nike', 'Fridge', 'Laptop', 'Blender'].map(s => (
              <button key={s} className={styles.suggestion} onClick={() => setQuery(s)}>
                {s}
              </button>
            ))}
          </div>
        </div>
      ) : (
        <div>
          {!loading && (
            <p className={styles.resultCount}>
              {results.length > 0
                ? `${results.length} result${results.length !== 1 ? 's' : ''} for "${query}"`
                : `No results for "${query}"`}
            </p>
          )}
          <DealGrid
            deals={results}
            loading={loading}
            emptyMessage={`No deals found for "${query}". Try a different search term.`}
          />
        </div>
      )}
    </div>
  )
}
