// routes/admin.js — Admin endpoints
// Protected by CRON_SECRET — not public
const express = require('express');
const { runPipeline } = require('../services/pipeline');
const { queries }     = require('../db');
const cache           = require('../utils/cache');
const logger          = require('../utils/logger');

const router = express.Router();

// Middleware: require cron secret
function requireSecret(req, res, next) {
  const secret = req.headers['x-cron-secret'] || req.query.secret;
  if (secret !== process.env.CRON_SECRET) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  next();
}

// POST /api/admin/sync — trigger full pipeline manually
// Called by cron-job.org every 6 hours, and can be triggered from admin panel
router.post('/sync', requireSecret, async (req, res) => {
  logger.info('[Admin] Manual pipeline trigger');
  res.json({ message: 'Pipeline started', time: new Date().toISOString() });

  // Run in background — don't wait
  runPipeline().catch(err => logger.error(`[Admin] Pipeline error: ${err.message}`));
});

// GET /api/admin/stats — platform statistics
router.get('/stats', requireSecret, async (req, res) => {
  try {
    const [statsResult, categoryResult, platformResult] = await Promise.all([
      queries.getStats(),
      require('../db').db.execute({
        sql: `SELECT category, COUNT(*) as count, ROUND(AVG(discount_pct)) as avg_discount
              FROM deals WHERE verified = 1 GROUP BY category ORDER BY count DESC`,
        args: [],
      }),
      require('../db').db.execute({
        sql: `SELECT platform, COUNT(*) as count, ROUND(AVG(discount_pct)) as avg_discount
              FROM deals WHERE verified = 1 GROUP BY platform`,
        args: [],
      }),
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

// DELETE /api/admin/cache — clear all caches
router.delete('/cache', requireSecret, (req, res) => {
  cache.flushAll();
  logger.info('[Admin] Cache cleared');
  res.json({ cleared: true });
});

// GET /api/health — public health check (no secret needed)
// Used by cron-job.org to keep Render free tier awake
router.get('/health', (req, res) => {
  res.json({
    status:  'ok',
    service: 'DealTrust API',
    time:    new Date().toISOString(),
  });
});

module.exports = router;
