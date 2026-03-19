// routes/deals.js — All deal-related API endpoints
const express = require('express');
const crypto  = require('crypto');
const cache   = require('../utils/cache');
const { queries } = require('../db');
const { buildAffiliateUrl } = require('../services/verify');
const logger  = require('../utils/logger');

const router = express.Router();

// ── Helper: hash IP for privacy ───────────────────────────
function hashIp(ip) {
  return crypto.createHash('sha256').update(ip + (process.env.COUPON_SECRET || 'salt')).digest('hex').slice(0, 16);
}

// ── Helper: parse price history JSON ──────────────────────
function parseDeal(row) {
  if (!row) return null;
  const deal = { ...row };
  if (deal.price_history_json) {
    try { deal.price_history = JSON.parse(deal.price_history_json); }
    catch { deal.price_history = []; }
    delete deal.price_history_json;
  }
  return deal;
}

// ── GET /api/deals — all verified deals ───────────────────
router.get('/', async (req, res) => {
  const { category, platform, sort = 'newest', limit = 40, offset = 0 } = req.query;

  const cacheKey = `deals:${category}:${platform}:${sort}:${limit}:${offset}`;
  const cached   = cache.get(cacheKey);
  if (cached) return res.json(cached);

  try {
    const result = await queries.getDeals({
      category: category && category !== 'all' ? category : undefined,
      platform: platform && platform !== 'all' ? platform : undefined,
      sort,
      limit:  Math.min(parseInt(limit) || 40, 100),
      offset: parseInt(offset) || 0,
    });

    const response = { deals: result.rows, count: result.rows.length };
    cache.set(cacheKey, response, 300); // Cache 5 minutes
    res.json(response);

  } catch (err) {
    logger.error(`[GET /deals] ${err.message}`);
    res.status(500).json({ error: 'Could not fetch deals' });
  }
});

// ── GET /api/deals/search ─────────────────────────────────
router.get('/search', async (req, res) => {
  const { q, limit = 30 } = req.query;
  if (!q?.trim() || q.trim().length < 2) return res.json({ deals: [] });

  const cacheKey = `search:${q.toLowerCase()}`;
  const cached   = cache.get(cacheKey);
  if (cached) return res.json(cached);

  try {
    const result   = await queries.searchDeals(q.trim(), Math.min(parseInt(limit) || 30, 50));
    const response = { deals: result.rows, query: q };
    cache.set(cacheKey, response, 120); // Cache 2 minutes
    res.json(response);
  } catch (err) {
    logger.error(`[GET /deals/search] ${err.message}`);
    res.status(500).json({ error: 'Search failed' });
  }
});

// ── GET /api/deals/category/:category ────────────────────
router.get('/category/:category', async (req, res) => {
  const { category }                          = req.params;
  const { platform, sub_category, sort, limit } = req.query;

  const validCategories = ['gadgets', 'electronics', 'fashion', 'appliances'];
  if (!validCategories.includes(category)) {
    return res.status(400).json({ error: 'Invalid category' });
  }

  const cacheKey = `cat:${category}:${platform}:${sub_category}:${sort}`;
  const cached   = cache.get(cacheKey);
  if (cached) return res.json(cached);

  try {
    const result   = await queries.getDealsByCategory(category, {
      platform, sub_category, sort, limit: Math.min(parseInt(limit) || 40, 80),
    });
    const response = { deals: result.rows, category };
    cache.set(cacheKey, response, 300);
    res.json(response);
  } catch (err) {
    logger.error(`[GET /deals/category] ${err.message}`);
    res.status(500).json({ error: 'Could not fetch category deals' });
  }
});

// ── GET /api/deals/:id ────────────────────────────────────
router.get('/:id', async (req, res) => {
  const { id } = req.params;
  if (!id || isNaN(id)) return res.status(400).json({ error: 'Invalid deal ID' });

  const cacheKey = `deal:${id}`;
  const cached   = cache.get(cacheKey);
  if (cached) return res.json(cached);

  try {
    const result = await queries.getDealById(parseInt(id));
    const deal   = parseDeal(result.rows[0]);

    if (!deal) return res.status(404).json({ error: 'Deal not found' });

    cache.set(cacheKey, deal, 180); // Cache 3 minutes
    res.json(deal);
  } catch (err) {
    logger.error(`[GET /deals/:id] ${err.message}`);
    res.status(500).json({ error: 'Could not fetch deal' });
  }
});

// ── POST /api/deals/:id/reveal-coupon ─────────────────────
// The coupon gate: opens affiliate link + returns coupon code
router.post('/:id/reveal-coupon', async (req, res) => {
  const { id } = req.params;
  if (!id || isNaN(id)) return res.status(400).json({ error: 'Invalid ID' });

  try {
    const result = await queries.getDealById(parseInt(id));
    const deal   = result.rows[0];

    if (!deal)           return res.status(404).json({ error: 'Deal not found' });
    if (!deal.coupon_code) return res.status(400).json({ error: 'No coupon for this deal' });

    // Log redirect for analytics
    const ipHash = hashIp(req.ip || 'unknown');
    await queries.logRedirect(deal.id, ipHash, req.headers['user-agent']?.slice(0, 100));

    // Return coupon + affiliate URL
    res.json({
      code:         deal.coupon_code,
      affiliateUrl: deal.affiliate_url,
      platform:     deal.platform,
    });

  } catch (err) {
    logger.error(`[POST /reveal-coupon] ${err.message}`);
    res.status(500).json({ error: 'Could not reveal coupon' });
  }
});

// ── POST /api/deals/:id/report-coupon ─────────────────────
router.post('/:id/report-coupon', async (req, res) => {
  const { id } = req.params;
  try {
    await queries.recordCouponFail(parseInt(id));
    await queries.updateCouponRate(parseInt(id));
    res.json({ reported: true });
  } catch (err) {
    res.status(500).json({ error: 'Could not report' });
  }
});

// ── POST /api/deals/:id/vote ──────────────────────────────
router.post('/:id/vote', async (req, res) => {
  const { id }   = req.params;
  const { vote } = req.body;

  if (!['active', 'expired'].includes(vote)) {
    return res.status(400).json({ error: 'Vote must be "active" or "expired"' });
  }

  const ipHash = hashIp(req.ip || 'unknown');

  try {
    // Prevent double voting within 24 hours
    const existing = await queries.hasVoted(parseInt(id), ipHash);
    if (existing.rows.length > 0) {
      return res.status(429).json({ error: 'You already voted on this deal today' });
    }

    await queries.recordVote(parseInt(id), ipHash, vote);
    await queries.updateVoteCounts(parseInt(id));

    // If too many "expired" votes, mark deal as unverified
    const dealResult = await queries.getDealById(parseInt(id));
    const deal = dealResult.rows[0];
    if (deal) {
      const total = (deal.votes_active || 0) + (deal.votes_expired || 0);
      if (total >= 5 && deal.votes_expired / total > 0.6) {
        await queries.updateDealScore(deal.id, deal.deal_score, false);
        cache.del(`deal:${id}`);
        logger.info(`[Vote] Deal ${id} unverified by community votes`);
      }
    }

    cache.del(`deal:${id}`);
    res.json({ voted: true, vote });

  } catch (err) {
    logger.error(`[POST /vote] ${err.message}`);
    res.status(500).json({ error: 'Could not record vote' });
  }
});

// ── GET /api/stats ────────────────────────────────────────
router.get('/stats', async (req, res) => {
  const cached = cache.get('stats');
  if (cached) return res.json(cached);
  try {
    const result = await queries.getStats();
    const stats  = result.rows[0] || {};
    cache.set('stats', stats, 600); // Cache 10 minutes
    res.json(stats);
  } catch (err) {
    res.status(500).json({ error: 'Could not fetch stats' });
  }
});

module.exports = router;
