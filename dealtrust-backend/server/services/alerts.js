// services/alerts.js — Deal alert emails via Resend (free: 3000/mo)
// Strategy: batch alerts into daily digest, not instant, to stay in free tier

require('dotenv').config();
const { Resend } = require('resend');
const { queries } = require('../db');
const logger      = require('../utils/logger');

const resend = new Resend(process.env.RESEND_API_KEY);

// ── Format price in naira ──────────────────────────────────
function fmt(n) {
  return '₦' + Number(n).toLocaleString('en-NG');
}

// ── Build HTML for one deal in the email ──────────────────
function dealHtml(deal) {
  const platform = deal.platform.charAt(0).toUpperCase() + deal.platform.slice(1);
  const saving   = deal.original_price - deal.current_price;
  const url      = `https://dealtrust.app/deal/${deal.id}`;

  return `
    <div style="border:1px solid #e2e8f0;border-radius:12px;overflow:hidden;margin-bottom:16px;background:#fff">
      ${deal.image_url ? `<img src="${deal.image_url}" alt="${deal.title}" style="width:100%;height:160px;object-fit:contain;background:#f8fafc;padding:8px">` : ''}
      <div style="padding:16px">
        <p style="font-size:11px;color:#94a3b8;margin:0 0 6px;font-weight:600;letter-spacing:.06em;text-transform:uppercase">${deal.category} · ${platform}</p>
        <h3 style="font-size:15px;font-weight:700;color:#0f172a;margin:0 0 10px;line-height:1.3">${deal.title}</h3>
        ${deal.ai_summary ? `<p style="font-size:13px;color:#475569;margin:0 0 12px;line-height:1.6">${deal.ai_summary}</p>` : ''}
        <div style="display:flex;align-items:baseline;gap:8px;margin-bottom:12px;flex-wrap:wrap">
          <span style="font-size:22px;font-weight:800;color:#0f172a">${fmt(deal.current_price)}</span>
          <span style="font-size:13px;color:#94a3b8;text-decoration:line-through">${fmt(deal.original_price)}</span>
          <span style="background:#dcfce7;color:#166534;font-size:12px;font-weight:700;padding:2px 8px;border-radius:6px">-${deal.discount_pct}%</span>
          <span style="font-size:13px;color:#059669;font-weight:600">Save ${fmt(saving)}</span>
        </div>
        ${deal.coupon_code ? `
          <div style="background:#fefce8;border:1px dashed #fbbf24;border-radius:8px;padding:10px 12px;margin-bottom:12px">
            <p style="font-size:12px;font-weight:600;color:#92400e;margin:0 0 4px">🎟 Coupon available — tap button to reveal</p>
          </div>
        ` : ''}
        <a href="${url}" style="display:block;background:#1d4ed8;color:#fff;text-align:center;padding:12px;border-radius:8px;font-weight:700;font-size:14px;text-decoration:none">
          See Verified Deal + ${deal.coupon_code ? 'Coupon →' : 'Open on ' + platform + ' →'}
        </a>
        <p style="font-size:11px;color:#94a3b8;text-align:center;margin:8px 0 0">Sold & delivered by ${platform} · Price verified by DealTrust</p>
      </div>
    </div>
  `;
}

// ── Send alerts to matching subscribers ───────────────────
async function sendDealAlerts(newDeals) {
  if (!process.env.RESEND_API_KEY) {
    logger.warn('[Alerts] RESEND_API_KEY not set — skipping email alerts');
    return;
  }
  if (!newDeals.length) return;

  try {
    const alertsResult = await queries.getActiveAlerts();
    const subscribers  = alertsResult.rows;
    if (!subscribers.length) return;

    // Group subscribers by their preferences, batch into one email per subscriber
    let sent = 0;

    for (const sub of subscribers) {
      // Filter deals matching this subscriber's preferences
      const matching = newDeals.filter(deal => {
        if (sub.category !== 'all' && deal.category !== sub.category) return false;
        if (sub.platform !== 'all' && deal.platform !== sub.platform) return false;
        if (sub.max_price && deal.current_price > sub.max_price) return false;
        return true;
      });

      if (!matching.length) continue;

      // Max 3 deals per email to keep it scannable
      const featured = matching.slice(0, 3);

      const html = `
        <!DOCTYPE html>
        <html>
        <head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
        <body style="margin:0;padding:0;background:#f8fafc;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif">
          <div style="max-width:600px;margin:0 auto;padding:20px">

            <!-- Header -->
            <div style="background:#1d4ed8;border-radius:12px;padding:24px;text-align:center;margin-bottom:20px">
              <h1 style="color:#fff;font-size:24px;font-weight:800;margin:0 0 6px">🔖 DealTrust</h1>
              <p style="color:#bfdbfe;font-size:14px;margin:0">${featured.length} new verified deal${featured.length !== 1 ? 's' : ''} for you</p>
            </div>

            <!-- Deals -->
            ${featured.map(dealHtml).join('')}

            <!-- Footer -->
            <div style="text-align:center;padding:20px;color:#94a3b8;font-size:12px">
              <p style="margin:0 0 8px">
                <a href="https://dealtrust.app" style="color:#1d4ed8;font-weight:600;text-decoration:none">Browse all deals at dealtrust.app</a>
              </p>
              <p style="margin:0 0 4px">DealTrust earns affiliate commission when you buy through our links. Price you pay is never affected.</p>
              <p style="margin:0">
                <a href="https://dealtrust.app/unsubscribe?email=${encodeURIComponent(sub.email)}" style="color:#94a3b8">Unsubscribe</a>
              </p>
            </div>
          </div>
        </body>
        </html>
      `;

      try {
        await resend.emails.send({
          from:    process.env.RESEND_FROM || 'alerts@dealtrust.app',
          to:      sub.email,
          subject: `🔥 ${featured[0].discount_pct}% OFF — ${featured[0].title.slice(0, 50)} + ${featured.length - 1} more`,
          html,
        });
        sent++;

        // Small delay between sends to stay within rate limits
        await new Promise(r => setTimeout(r, 100));

      } catch (sendErr) {
        logger.error(`[Alerts] Failed to send to ${sub.email}: ${sendErr.message}`);
      }
    }

    logger.info(`[Alerts] Sent to ${sent}/${subscribers.length} subscribers`);

  } catch (err) {
    logger.error(`[Alerts] Error in sendDealAlerts: ${err.message}`);
  }
}

module.exports = { sendDealAlerts };
