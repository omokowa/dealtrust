import { useState } from 'react'
import { Bell, Check, Mail, MessageCircle } from 'lucide-react'
import toast from 'react-hot-toast'
import { subscribeAlert } from '../api/index.js'
import { CATEGORIES } from '../utils/index.js'
import styles from './AlertsPage.module.css'

export default function AlertsPage() {
  const [form, setForm] = useState({
    email:    '',
    category: 'all',
    platform: 'all',
    max_price: '',
    channel:  'email',
  })
  const [loading,   setLoading]   = useState(false)
  const [submitted, setSubmitted] = useState(false)

  function update(field, value) {
    setForm(f => ({ ...f, [field]: value }))
  }

  async function handleSubmit(e) {
    e.preventDefault()
    if (!form.email.trim() || !form.email.includes('@')) {
      toast.error('Enter a valid email address')
      return
    }
    setLoading(true)
    try {
      await subscribeAlert(form)
      setSubmitted(true)
      toast.success('Deal alerts activated! 🔔')
    } catch (err) {
      toast.error(err.message || 'Could not set up alert. Try again.')
    } finally {
      setLoading(false)
    }
  }

  if (submitted) {
    return (
      <div className={styles.container}>
        <div className={styles.successCard}>
          <div className={styles.successIcon}><Check size={28} color="#fff" /></div>
          <h2 className={styles.successTitle}>You're all set! 🔔</h2>
          <p className={styles.successText}>
            We'll send you verified deal alerts for{' '}
            <strong>{form.category === 'all' ? 'all categories' : form.category}</strong>.
            You'll only get alerts for genuine deals — no spam.
          </p>
          <button className="btn btn-primary" onClick={() => setSubmitted(false)}>
            Set up another alert
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className={styles.container}>
      <div className={styles.hero}>
        <Bell size={32} className={styles.heroIcon} />
        <h1 className={styles.heroTitle}>Get Deal Alerts</h1>
        <p className={styles.heroSub}>
          Be the first to know when a verified deal drops in your category.
          Only real discounts — no spam, no fake prices.
        </p>
      </div>

      <div className={styles.formWrap}>
        <form className={styles.form} onSubmit={handleSubmit}>

          {/* Channel toggle */}
          <div className={styles.section}>
            <label className={styles.sectionLabel}>How do you want to receive alerts?</label>
            <div className={styles.channelToggle}>
              <button
                type="button"
                className={`${styles.channelBtn} ${form.channel === 'email' ? styles.channelBtnActive : ''}`}
                onClick={() => update('channel', 'email')}
              >
                <Mail size={16} /> Email
              </button>
              <button
                type="button"
                className={`${styles.channelBtn} ${form.channel === 'whatsapp' ? styles.channelBtnActive : ''}`}
                onClick={() => update('channel', 'whatsapp')}
              >
                <MessageCircle size={16} /> WhatsApp
              </button>
            </div>
          </div>

          {/* Email */}
          <div className={styles.section}>
            <label className={styles.sectionLabel} htmlFor="alert-email">
              {form.channel === 'email' ? 'Email address' : 'WhatsApp number'}
            </label>
            <input
              id="alert-email"
              type={form.channel === 'email' ? 'email' : 'tel'}
              className={styles.input}
              placeholder={form.channel === 'email' ? 'you@example.com' : '+234 800 000 0000'}
              value={form.email}
              onChange={e => update('email', e.target.value)}
              required
            />
          </div>

          {/* Category */}
          <div className={styles.section}>
            <label className={styles.sectionLabel}>Which category?</label>
            <div className={styles.catGrid}>
              <button
                type="button"
                className={`${styles.catBtn} ${form.category === 'all' ? styles.catBtnActive : ''}`}
                onClick={() => update('category', 'all')}
              >
                🌐 All categories
              </button>
              {CATEGORIES.map(c => (
                <button
                  key={c.slug}
                  type="button"
                  className={`${styles.catBtn} ${form.category === c.slug ? styles.catBtnActive : ''}`}
                  onClick={() => update('category', c.slug)}
                >
                  {c.icon} {c.label}
                </button>
              ))}
            </div>
          </div>

          {/* Platform */}
          <div className={styles.section}>
            <label className={styles.sectionLabel}>Which platform?</label>
            <div className={styles.pillGroup}>
              {['all', 'jumia', 'konga', 'temu'].map(p => (
                <button
                  key={p}
                  type="button"
                  className={`${styles.pill} ${form.platform === p ? styles.pillActive : ''}`}
                  onClick={() => update('platform', p)}
                >
                  {p === 'all' ? '🌐 All' : p === 'jumia' ? '🟠 Jumia' : p === 'konga' ? '🔴 Konga' : '🟣 Temu'}
                </button>
              ))}
            </div>
          </div>

          {/* Max price */}
          <div className={styles.section}>
            <label className={styles.sectionLabel} htmlFor="max-price">
              Only alert me for deals under (optional)
            </label>
            <div className={styles.priceInput}>
              <span className={styles.currencyPrefix}>₦</span>
              <input
                id="max-price"
                type="number"
                className={`${styles.input} ${styles.priceField}`}
                placeholder="e.g. 50000"
                value={form.max_price}
                onChange={e => update('max_price', e.target.value)}
                min="0"
              />
            </div>
          </div>

          <button
            type="submit"
            className={`btn btn-primary btn-lg ${styles.submitBtn}`}
            disabled={loading}
          >
            {loading ? 'Setting up…' : '🔔 Activate Deal Alerts →'}
          </button>

          <p className={styles.note}>
            You can unsubscribe anytime. We only send alerts for verified deals — no spam.
          </p>
        </form>

        {/* How it works */}
        <div className={styles.howBox}>
          <h3 className={styles.howTitle}>How alerts work</h3>
          <div className={styles.steps}>
            {[
              { icon: '🔍', text: 'We scan Jumia, Konga & Temu every 6 hours for price drops' },
              { icon: '✅', text: 'We verify the discount is real against 30-day price history' },
              { icon: '🔔', text: 'We send you an alert with the deal link and coupon code' },
              { icon: '🛒', text: 'You tap the link, coupon is revealed, deal is yours' },
            ].map((s, i) => (
              <div key={i} className={styles.step}>
                <span className={styles.stepIcon}>{s.icon}</span>
                <span className={styles.stepText}>{s.text}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
