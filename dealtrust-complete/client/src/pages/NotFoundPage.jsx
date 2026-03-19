import { Link } from 'react-router-dom'

export default function NotFoundPage() {
  return (
    <div style={{ textAlign: 'center', padding: '5rem 1.25rem', maxWidth: '440px', margin: '0 auto' }}>
      <div style={{ fontSize: '4rem', marginBottom: '1rem' }}>🏷️</div>
      <h1 style={{ fontFamily: 'var(--font-head)', fontSize: '1.75rem', fontWeight: 800, color: 'var(--text)', marginBottom: '.75rem' }}>
        Page not found
      </h1>
      <p style={{ color: 'var(--text2)', fontSize: '.95rem', lineHeight: 1.6, marginBottom: '1.75rem' }}>
        This deal or page doesn't exist. It may have expired or been removed.
      </p>
      <Link to="/" className="btn btn-primary btn-lg">
        Browse verified deals →
      </Link>
    </div>
  )
}
