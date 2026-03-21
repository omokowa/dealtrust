const express = require('express');
const { runPipeline } = require('../services/pipeline');
const { queries, db } = require('../db');
const cache  = require('../utils/cache');
const logger = require('../utils/logger');

const router = express.Router();

function requireSecret(req, res, next) {
  const secret = req.headers['x-cron-secret'] || req.query.secret;
  if (!process.env.CRON_SECRET || secret !== process.env.CRON_SECRET) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  next();
}

router.post('/sync', requireSecret, async (req, res) => {
  logger.info('[Admin] Manual pipeline trigger');
  res.json({ message: 'Pipeline started', time: new Date().toISOString() });
  runPipeline().catch(err => logger.error(`[Admin] Pipeline error: ${err.message}`));
});

router.get('/stats', requireSecret, async (req, res) => {
  try {
    const [statsResult, categoryResult, platformResult] = await Promise.all([
      queries.getStats(),
      db.query(`SELECT category, COUNT(*)::int as count, ROUND(AVG(discount_pct))::int as avg_discount FROM deals WHERE verified = true GROUP BY category ORDER BY count DESC`),
      db.query(`SELECT platform, COUNT(*)::int as count, ROUND(AVG(discount_pct))::int as avg_discount FROM deals WHERE verified = true GROUP BY platform`),
    ]);
    res.json({
      overview:   statsResult.rows[0],
      categories: categoryResult.rows,
      platforms:  platformResult.rows,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.delete('/cache', requireSecret, (req, res) => {
  cache.flushAll();
  logger.info('[Admin] Cache cleared');
  res.json({ cleared: true });
});

router.get('/health', (req, res) => {
  res.json({ status: 'ok', service: 'DealTrust API', time: new Date().toISOString() });
});

module.exports = router;
