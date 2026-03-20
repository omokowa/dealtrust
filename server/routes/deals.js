// routes/deals.js
const express = require('express');
const crypto  = require('crypto');
const cache   = require('../utils/cache');
const { queries } = require('../db');
const logger  = require('../utils/logger');

const router = express.Router();

function hashIp(ip) {
  return crypto.createHash('sha256').update(ip + (process.env.COUPON_SECRET || 'salt')).digest('hex').slice(0, 16);
}

// GET /api/deals
router.get('/', async (req, res) => {
  const { category, platform, sort = 'newest', limit = 40, offset = 0 } = req.query;
  const cacheKey = `deals:${category}:${platform}:${sort}:${limit}:${offset}`;
  const cached = cache.get(cacheKey);
  if (cached) return res.json(cached);
  try {
    const result = await queries.getDeals({
      category: category && category !== 'all' ? category : undefined,
      platform: platform && platform !== 'all' ? platform : undefined,
      sort, limit: Math.min(parseInt(limit)||40, 100), offset: parseInt(offset)||0,
    });
    const response = { deals: result.rows, count: result.rows.length };
    cache.set(cacheKey, response, 300);
    res.json(response);
  } catch (err) {
    logger.error(`[GET /deals] ${err.message}`);
    res.status(500).json({ error: 'Could not fetch deals', detail: err.message });
  }
});

// GET /api/deals/search
router.get('/search', async (req, res) => {
  const { q, limit = 30 } = req.query;
  if (!q?.trim() || q.trim().length < 2) return res.json({ deals: [] });
  const cacheKey = `search:${q.toLowerCase()}`;
  const cached = cache.get(cacheKey);
  if (cached) return res.json(cached);
  try {
    const result = await queries.searchDeals(q.trim(), Math.min(parseInt(limit)||30, 50));
    const response = { deals: result.rows, query: q };
    cache.set(cacheKey, response, 120);
    res.json(response);
  } catch (err) {
    logger.error(`[GET /deals/search] ${err.message}`);
    res.status(500).json({ error: 'Search failed', detail: err.message });
  }
});

// GET /api/deals/category/:category
router.get('/category/:category', async (req, res) => {
  const { category } = req.params;
  const { platform, sub_category, sort, limit } = req.query;
  const valid = ['gadgets','electronics','fashion','appliances'];
  if (!valid.includes(category)) return res.status(400).json({ error: 'Invalid category' });
  const cacheKey = `cat:${category}:${platform}:${sub_category}:${sort}`;
  const cached = cache.get(cacheKey);
  if (cached) return res.json(cached);
  try {
    const result = await queries.getDealsByCategory(category, {
      platform, sub_category, sort,
      limit: Math.min(parseInt(limit)||40, 80)
    });
    const response = { deals: result.rows, category };
    cache.set(cacheKey, response, 300);
    res.json(response);
  } catch (err) {
    logger.error(`[GET /deals/category] ${err.message}`);
    res.status(500).json({ error: 'Could not fetch category deals', detail: err.message });
  }
});

// GET /api/deals/stats — must be BEFORE /:id
router.get('/stats', async (req, res) => {
  const cached = cache.get('stats');
  if (cached) return res.json(cached);
  try {
    const result = await queries.getStats();
    const stats = result.rows[0] || {};
    cache.set('stats', stats, 600);
    res.json(stats);
  } catch (err) {
    res.status(500).json({ error: 'Could not fetch stats', detail: err.message });
  }
});

// GET /api/deals/:id
router.get('/:id', async (req, res) => {
  const { id } = req.params;
  if (!id || isNaN(id)) return res.status(400).json({ error: 'Invalid deal ID' });
  const cacheKey = `deal:${id}`;
  const cached = cache.get(cacheKey);
  if (cached) return res.json(cached);
  try {
    const result = await queries.getDealById(parseInt(id));
    const deal = result.rows[0];
    if (!deal) return res.status(404).json({ error: 'Deal not found' });
    const histResult = await queries.getPriceHistoryForDeal(parseInt(id));
    deal.price_history = histResult.rows || [];
    cache.set(cacheKey, deal, 180);
    res.json(deal);
  } catch (err) {
    logger.error(`[GET /deals/:id] ${err.message}`);
    res.status(500).json({ error: 'Could not fetch deal', detail: err.message });
  }
});

// POST /api/deals/:id/reveal-coupon
router.post('/:id/reveal-coupon', async (req, res) => {
  const { id } = req.params;
  if (!id || isNaN(id)) return res.status(400).json({ error: 'Invalid ID' });
  try {
    const result = await queries.getDealById(parseInt(id));
    const deal = result.rows[0];
    if (!deal) return res.status(404).json({ error: 'Deal not found' });
    if (!deal.coupon_code) return res.status(400).json({ error: 'No coupon for this deal' });
    const ipHash = hashIp(req.ip || 'unknown');
    await queries.logRedirect(deal.id, ipHash, req.headers['user-agent']?.slice(0, 100));
    res.json({ code: deal.coupon_code, affiliateUrl: deal.affiliate_url, platform: deal.platform });
  } catch (err) {
    logger.error(`[POST /reveal-coupon] ${err.message}`);
    res.status(500).json({ error: 'Could not reveal coupon' });
  }
});

// POST /api/deals/:id/report-coupon
router.post('/:id/report-coupon', async (req, res) => {
  try {
    await queries.recordCouponFail(parseInt(req.params.id));
    await queries.updateCouponRate(parseInt(req.params.id));
    res.json({ reported: true });
  } catch (err) {
    res.status(500).json({ error: 'Could not report' });
  }
});

// POST /api/deals/:id/vote
router.post('/:id/vote', async (req, res) => {
  const { id } = req.params;
  const { vote } = req.body;
  if (!['active','expired'].includes(vote)) {
    return res.status(400).json({ error: 'Vote must be active or expired' });
  }
  const ipHash = hashIp(req.ip || 'unknown');
  try {
    const existing = await queries.hasVoted(parseInt(id), ipHash);
    if (existing.rows.length > 0) return res.status(429).json({ error: 'Already voted today' });
    await queries.recordVote(parseInt(id), ipHash, vote);
    await queries.updateVoteCounts(parseInt(id));
    cache.del(`deal:${id}`);
    res.json({ voted: true, vote });
  } catch (err) {
    logger.error(`[POST /vote] ${err.message}`);
    res.status(500).json({ error: 'Could not record vote' });
  }
});

module.exports = router;
