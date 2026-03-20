// routes/redirect.js
// /go/:id — the affiliate link redirect handler
// This is the ONLY place affiliate URLs are exposed
// All share links and deal buttons go through here

const express = require('express');
const crypto  = require('crypto');
const { queries } = require('../db');
const logger  = require('../utils/logger');

const router = express.Router();

function hashIp(ip) {
  return crypto.createHash('sha256').update(ip + (process.env.COUPON_SECRET || 'salt')).digest('hex').slice(0, 16);
}

// GET /go/:id — redirect to affiliate URL
router.get('/:id', async (req, res) => {
  const { id } = req.params;
  if (!id || isNaN(id)) return res.redirect('https://dealtrust.app');

  try {
    const result = await queries.getDealById(parseInt(id));
    const deal   = result.rows[0];

    if (!deal || !deal.affiliate_url) {
      return res.redirect('https://dealtrust.app');
    }

    // Log the click for analytics
    const ipHash = hashIp(req.ip || 'unknown');
    await queries.logRedirect(deal.id, ipHash, req.headers['user-agent']?.slice(0, 100));

    logger.info(`[Redirect] Deal ${id} (${deal.platform}) → ${deal.affiliate_url.slice(0, 60)}`);

    // Redirect to affiliate URL
    res.redirect(302, deal.affiliate_url);

  } catch (err) {
    logger.error(`[Redirect] ${err.message}`);
    res.redirect('https://dealtrust.app');
  }
});

module.exports = router;
