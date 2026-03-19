// services/verify.js — The Verification Engine
// A deal must pass ALL checks before getting the Verified badge
// This is what separates DealTrust from fake-discount sites

const { queries } = require('../db');
const logger      = require('../utils/logger');

// ── Deal Score Weights ─────────────────────────────────────
const WEIGHTS = {
  discountDepth:    35,  // How deep the discount is vs 30-day avg
  priceStability:   20,  // Was original price stable (not inflated)?
  couponSuccessRate:20,  // How often does the coupon actually work?
  userVotes:        15,  // Community trust signal
  timeLeft:         10,  // How long until deal expires?
};

// ── Main verification function ─────────────────────────────
async function verifyDeal(deal) {
  const results = {
    passed:  [],
    failed:  [],
    score:   0,
    verified: false,
  };

  try {
    // ── CHECK 1: Minimum discount threshold (15%) ──────────
    if (deal.discount_pct < 15) {
      results.failed.push(`Discount too small: ${deal.discount_pct}% (min 15%)`);
    } else {
      results.passed.push(`Discount: ${deal.discount_pct}%`);
    }

    // ── CHECK 2: Price history — is the discount real? ─────
    const historyRes = await queries.getAvgPrice(deal.id, 30);
    const histRow    = historyRes.rows[0];

    if (histRow && histRow.avg_price) {
      const avgPrice     = parseFloat(histRow.avg_price);
      const currentPrice = deal.current_price;
      const realDrop     = ((avgPrice - currentPrice) / avgPrice) * 100;

      if (realDrop < 10) {
        results.failed.push(
          `Price not genuinely lower: current ₦${currentPrice.toLocaleString()} vs 30d avg ₦${avgPrice.toLocaleString()}`
        );
      } else {
        results.passed.push(`Genuine ${Math.round(realDrop)}% drop vs 30-day average`);
      }
    } else {
      // No history yet — new deal, give benefit of doubt
      results.passed.push('New deal — price history building');
    }

    // ── CHECK 3: User votes — trust signal ─────────────────
    const totalVotes = (deal.votes_active || 0) + (deal.votes_expired || 0);
    if (totalVotes >= 5) {
      const expiredRatio = deal.votes_expired / totalVotes;
      if (expiredRatio > 0.6) {
        results.failed.push(
          `Community flagged as expired: ${deal.votes_expired}/${totalVotes} votes say expired`
        );
      } else {
        results.passed.push(`Community verified: ${deal.votes_active} active votes`);
      }
    } else {
      results.passed.push('Insufficient votes — not penalised');
    }

    // ── CHECK 4: Deal not too old ──────────────────────────
    if (deal.expires_at) {
      const now     = new Date();
      const expires = new Date(deal.expires_at);
      if (expires < now) {
        results.failed.push('Deal has expired');
      } else {
        results.passed.push(`Expires: ${expires.toLocaleDateString()}`);
      }
    } else {
      results.passed.push('No expiry set — ongoing deal');
    }

    // ── CHECK 5: Price is positive and makes sense ─────────
    if (deal.current_price <= 0 || deal.original_price <= 0) {
      results.failed.push('Invalid price data');
    } else if (deal.current_price >= deal.original_price) {
      results.failed.push('Current price not lower than original price');
    } else {
      results.passed.push('Price data valid');
    }

    // ── DEAL SCORE CALCULATION ─────────────────────────────
    results.score = calcDealScore(deal, histRow);

    // ── FINAL VERDICT ──────────────────────────────────────
    // Must pass checks 1, 4, 5 as mandatory. Others add to score.
    const mandatoryFailed = results.failed.some(f =>
      f.includes('Discount too small') ||
      f.includes('has expired') ||
      f.includes('Invalid price') ||
      f.includes('not lower than original')
    );

    results.verified = !mandatoryFailed && results.score >= 30;

    // Save score and verified status to DB
    await queries.updateDealScore(deal.id, results.score, results.verified);

    logger.info(`[Verify] ${deal.title.slice(0, 40)} | Score: ${results.score} | ${results.verified ? '✅ VERIFIED' : '❌ REJECTED'}`);

    return results;

  } catch (err) {
    logger.error(`[Verify] Error verifying deal ${deal.id}: ${err.message}`);
    return { ...results, error: err.message };
  }
}

// ── Score calculation ──────────────────────────────────────
function calcDealScore(deal, histRow) {
  let score = 0;

  // 1. Discount depth (35 pts)
  const disc = deal.discount_pct;
  if      (disc >= 50) score += 35;
  else if (disc >= 35) score += 28;
  else if (disc >= 25) score += 22;
  else if (disc >= 15) score += 14;

  // 2. Price stability (20 pts) — was the original price stable?
  if (histRow && histRow.avg_price) {
    const avgPrice      = parseFloat(histRow.avg_price);
    const origPrice     = deal.original_price;
    const inflation     = ((origPrice - avgPrice) / avgPrice) * 100;

    if      (inflation <= 5)  score += 20; // Original price was stable — genuine
    else if (inflation <= 15) score += 14;
    else if (inflation <= 30) score += 7;
    // > 30% inflation = 0 pts (price was inflated before discount)
  } else {
    score += 10; // No history yet — neutral
  }

  // 3. Coupon success rate (20 pts)
  const rate = deal.coupon_success_rate || 0;
  if (!deal.coupon_code) {
    score += 20; // No coupon needed — full points
  } else if (rate >= 85) {
    score += 20;
  } else if (rate >= 70) {
    score += 14;
  } else if (rate >= 50) {
    score += 8;
  } else if (rate >= 30) {
    score += 4;
  }

  // 4. User votes (15 pts)
  const totalVotes = (deal.votes_active || 0) + (deal.votes_expired || 0);
  if (totalVotes > 0) {
    const activeRatio = deal.votes_active / totalVotes;
    score += Math.round(activeRatio * 15);
  } else {
    score += 8; // Neutral if no votes yet
  }

  // 5. Time left (10 pts)
  if (!deal.expires_at) {
    score += 7; // Ongoing deal
  } else {
    const hoursLeft = (new Date(deal.expires_at) - Date.now()) / 3600000;
    if      (hoursLeft > 72)  score += 10;
    else if (hoursLeft > 24)  score += 7;
    else if (hoursLeft > 6)   score += 4;
    else if (hoursLeft > 0)   score += 1;
  }

  return Math.min(100, Math.max(0, score));
}

// ── Build affiliate URL ────────────────────────────────────
function buildAffiliateUrl(platform, productUrl) {
  const affiliateIds = {
    jumia: process.env.JUMIA_AFFILIATE_ID,
    konga: process.env.KONGA_AFFILIATE_ID,
    temu:  process.env.TEMU_AFFILIATE_ID,
  };

  const id = affiliateIds[platform.toLowerCase()];
  if (!id) return productUrl;

  switch (platform.toLowerCase()) {
    case 'jumia':
      return `${productUrl}${productUrl.includes('?') ? '&' : '?'}utm_source=affiliate&utm_medium=affiliate&aff_id=${id}`;

    case 'konga':
      return `${productUrl}${productUrl.includes('?') ? '&' : '?'}ref=${id}`;

    case 'temu':
      return `${productUrl}${productUrl.includes('?') ? '&' : '?'}_bg_fs=1&refer_page_name=dealtrust&refer_page_id=dealtrust&refer_page_sn=${id}`;

    default:
      return productUrl;
  }
}

module.exports = { verifyDeal, calcDealScore, buildAffiliateUrl };
