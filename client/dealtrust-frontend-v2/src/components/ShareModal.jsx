import { useState } from 'react'
import { X, MessageCircle, Twitter, Send, Link, Check } from 'lucide-react'
import toast from 'react-hot-toast'
import {
  shareToWhatsApp, shareToTwitter, shareToTelegram,
  copyDealLink, buildShareText,
  formatPrice, calcDiscount
} from '../utils/index.js'
import styles from './ShareModal.module.css'

export default function ShareModal({ deal, onClose }) {
  const [copied, setCopied] = useState(false)
  const discount = calcDiscount(deal.original_price, deal.current_price)

  async function handleCopy() {
    await copyDealLink(deal)
    setCopied(true)
    toast.success('Link copied!')
    setTimeout(() => setCopied(false), 2000)
  }

  function handleBackdrop(e) {
    if (e.target === e.currentTarget) onClose()
  }

  const shareButtons = [
    {
      label: 'WhatsApp',
      icon: <MessageCircle size={20} />,
      color: '#25d366',
      bg:    '#f0fdf4',
      border:'#bbf7d0',
      action: () => { shareToWhatsApp(deal); toast.success('Opening WhatsApp…') },
    },
    {
      label: 'Twitter / X',
      icon: <Twitter size={20} />,
      color: '#0f172a',
      bg:    '#f8fafc',
      border:'#e2e8f0',
      action: () => { shareToTwitter(deal); toast.success('Opening Twitter…') },
    },
    {
      label: 'Telegram',
      icon: <Send size={20} />,
      color: '#0088cc',
      bg:    '#f0f9ff',
      border:'#bae6fd',
      action: () => { shareToTelegram(deal); toast.success('Opening Telegram…') },
    },
  ]

  return (
    <div className={styles.overlay} onClick={handleBackdrop}>
      <div className={styles.modal}>

        {/* Header */}
        <div className={styles.header}>
          <div className={styles.headerLeft}>
            <h3 className={styles.title}>Share this deal</h3>
            <p className={styles.subtitle}>
              {discount > 0 ? `${discount}% off` : ''} · {formatPrice(deal.current_price)}
            </p>
          </div>
          <button className={styles.closeBtn} onClick={onClose}>
            <X size={18} />
          </button>
        </div>

        {/* Deal preview */}
        <div className={styles.preview}>
          {deal.image_url && (
            <img src={deal.image_url} alt={deal.title} className={styles.previewImg}
              onError={e => e.target.style.display = 'none'} />
          )}
          <div className={styles.previewText}>
            <p className={`${styles.previewTitle} line-clamp2`}>{deal.title}</p>
            <p className={styles.previewPrice}>
              <strong>{formatPrice(deal.current_price)}</strong>
              {deal.original_price > deal.current_price && (
                <span className={styles.previewOld}> {formatPrice(deal.original_price)}</span>
              )}
            </p>
            <p className={styles.previewPlatform}>Sold by {deal.platform}</p>
          </div>
        </div>

        {/* Share message preview */}
        <div className={styles.messagePreview}>
          <p className={styles.messageLabel}>What people will see:</p>
          <pre className={styles.messageText}>{buildShareText(deal)}</pre>
        </div>

        {/* Share buttons */}
        <div className={styles.buttons}>
          {shareButtons.map(btn => (
            <button
              key={btn.label}
              className={styles.shareBtn}
              style={{ '--btn-color': btn.color, '--btn-bg': btn.bg, '--btn-border': btn.border }}
              onClick={btn.action}
            >
              <span className={styles.shareBtnIcon} style={{ color: btn.color }}>{btn.icon}</span>
              <span>{btn.label}</span>
            </button>
          ))}
        </div>

        {/* Copy link */}
        <button className={`${styles.copyBtn} ${copied ? styles.copyBtnDone : ''}`} onClick={handleCopy}>
          {copied ? <Check size={16} /> : <Link size={16} />}
          {copied ? 'Link copied!' : 'Copy deal link'}
        </button>

        <p className={styles.note}>
          Your share includes your DealTrust link — you earn commission on any purchase made through it.
        </p>
      </div>
    </div>
  )
}
