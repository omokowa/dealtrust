// services/verify.js — The Verification Engine
const { queries } = require('../db');
const logger      = require('../utils/logger');

async function verifyDeal(deal) {
  const results = { passed: [], failed: [], score: 0, verified: false };

  try {
    // CHECK 1: Minimum discount
    if (deal.discount_pct < 15) {
      results.failed.push(`Discount too small: ${deal.discount_pct}%`);
    } else {
      results.passed.push(`Discount: ${deal.discount_pct}%`);
    }

    // CHECK 2: Price history
    const historyRes = await queries.getAvgPrice(deal.id, 30);
    const histRow    = historyRes.rows[0];

    if (histRow && histRow.avg_price) {
      const avgPrice = parseFloat(histRow.avg_price);
      const realDrop = ((avgPrice - deal.current_price) / avgPrice) * 100;
      if (realDrop < 10) {
        results.failed.push(`Price not genuinely lower vs 30d avg`);
      } else {
        results.passed.push(`Genuine ${Math.round(realDrop)}% drop vs 30-day average`);
      }
    } else {
      results.passed.push('New deal — price history building');
    }

    // CHECK 3: User votes
    const totalVotes = (deal.votes_active || 0) + (deal.votes_expired || 0);
    if (totalVotes >= 5) {
      const expiredRatio = deal.votes_expired / totalVotes;
      if (expiredRatio > 0.6) {
        results.failed.push(`Community flagged as expired`);
      } else {
        results.passed.push(`Community verified: ${deal.votes_active} active votes`);
      }
    } else {
      results.passed.push('Insufficient votes — not penalised');
    }

    // CHECK 4: Expiry
    if (deal.expires_at) {
      if (new Date(deal.expires_at) < new Date()) {
        results.failed.push('Deal has expired');
      } else {
        results.passed.push(`Not expired`);
      }
    } else {
      results.passed.push('No expiry — ongoing deal');
    }

    // CHECK 5: Valid prices
    if (deal.current_price <= 0 || deal.original_price <= 0) {
      results.failed.push('Invalid price data');
    } else if (deal.current_price >= deal.original_price) {
      results.failed.push('Current price not lower than original');
    } else {
      results.passed.push('Price data valid');
    }

    // Score
    results.score = calcDealScore(deal, histRow);

    // Verdict
    const mandatoryFailed = results.failed.some(f =>
      f.includes('Discount too small') ||
      f.includes('has expired') ||
      f.includes('Invalid price') ||
      f.includes('not lower than original')
    );
    results.verified = !mandatoryFailed && results.score >= 30;

    await queries.updateDealScore(deal.id, results.score, results.verified);
    logger.info(`[Verify] ${String(deal.title).slice(0, 40)} | Score: ${results.score} | ${results.verified ? '✅ VERIFIED' : '❌ REJECTED'}`);

    return results;
  } catch (err) {
    logger.error(`[Verify] Error verifying deal ${deal.id}: ${err.message}`);
    return { ...results, error: err.message };
  }
}

function calcDealScore(deal, histRow) {
  let score = 0;

  const disc = deal.discount_pct;
  if      (disc >= 50) score += 35;
  else if (disc >= 35) score += 28;
  else if (disc >= 25) score += 22;
  else if (disc >= 15) score += 14;

  if (histRow && histRow.avg_price) {
    const inflation = ((deal.original_price - parseFloat(histRow.avg_price)) / parseFloat(histRow.avg_price)) * 100;
    if      (inflation <= 5)  score += 20;
    else if (inflation <= 15) score += 14;
    else if (inflation <= 30) score += 7;
  } else {
    score += 10;
  }

  const rate = deal.coupon_success_rate || 0;
  if (!deal.coupon_code)  score += 20;
  else if (rate >= 85)    score += 20;
  else if (rate >= 70)    score += 14;
  else if (rate >= 50)    score += 8;
  else if (rate >= 30)    score += 4;

  const totalVotes = (deal.votes_active || 0) + (deal.votes_expired || 0);
  if (totalVotes > 0) {
    score += Math.round((deal.votes_active / totalVotes) * 15);
  } else {
    score += 8;
  }

  if (!deal.expires_at) {
    score += 7;
  } else {
    const hoursLeft = (new Date(deal.expires_at) - Date.now()) / 3600000;
    if      (hoursLeft > 72) score += 10;
    else if (hoursLeft > 24) score += 7;
    else if (hoursLeft > 6)  score += 4;
    else if (hoursLeft > 0)  score += 1;
  }

  return Math.min(100, Math.max(0, score));
}

function buildAffiliateUrl(platform, productUrl) {
  const affiliateIds = {
    jumia: process.env.JUMIA_AFFILIATE_ID,
    konga: process.env.KONGA_AFFILIATE_ID,
    temu:  process.env.TEMU_AFFILIATE_ID,
  };
  const id = affiliateIds[platform?.toLowerCase()];
  if (!id) return productUrl;

  switch (platform.toLowerCase()) {
    case 'jumia':
      return `${productUrl}${productUrl.includes('?') ? '&' : '?'}utm_source=affiliate&utm_medium=affiliate&aff_id=${id}`;
    case 'konga':
      return `${productUrl}${productUrl.includes('?') ? '&' : '?'}ref=${id}`;
    case 'temu':
      return `${productUrl}${productUrl.includes('?') ? '&' : '?'}_bg_fs=1&refer_page_sn=${id}`;
    default:
      return productUrl;
  }
}

module.exports = { verifyDeal, calcDealScore, buildAffiliateUrl };
