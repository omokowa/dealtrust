// routes/alerts.js
const express = require('express');
const { body, validationResult } = require('express-validator');
const { queries } = require('../db');
const logger      = require('../utils/logger');

const router = express.Router();

// POST /api/alerts — subscribe to deal alerts
router.post('/',
  body('email').isEmail().normalizeEmail(),
  body('category').optional().isIn(['all', 'gadgets', 'electronics', 'fashion', 'appliances']),
  body('platform').optional().isIn(['all', 'jumia', 'konga', 'temu']),
  body('max_price').optional().isNumeric(),
  body('channel').optional().isIn(['email', 'whatsapp']),

  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ error: errors.array()[0].msg });
    }

    const { email, category = 'all', platform = 'all', max_price, channel = 'email' } = req.body;

    try {
      await queries.insertAlert(email, category, platform, max_price || null, channel);
      logger.info(`[Alerts] New subscriber: ${email} (${category}/${platform})`);
      res.status(201).json({ subscribed: true, message: 'Deal alerts activated!' });
    } catch (err) {
      logger.error(`[Alerts POST] ${err.message}`);
      res.status(500).json({ error: 'Could not set up alert' });
    }
  }
);

// DELETE /api/alerts — unsubscribe
router.delete('/', async (req, res) => {
  const { email } = req.body;
  if (!email) return res.status(400).json({ error: 'Email required' });
  try {
    await queries.unsubscribeAlert(email);
    res.json({ unsubscribed: true });
  } catch (err) {
    res.status(500).json({ error: 'Could not unsubscribe' });
  }
});

// GET /api/unsubscribe?email=... — one-click unsubscribe from email links
router.get('/unsubscribe', async (req, res) => {
  const { email } = req.query;
  if (!email) return res.status(400).send('Email required');
  try {
    await queries.unsubscribeAlert(decodeURIComponent(email));
    res.send(`
      <html><body style="font-family:sans-serif;text-align:center;padding:60px;background:#f8fafc">
        <h2 style="color:#0f172a">✅ Unsubscribed</h2>
        <p style="color:#475569">You've been removed from DealTrust deal alerts.</p>
        <a href="https://dealtrust.app" style="color:#1d4ed8">Browse deals</a>
      </body></html>
    `);
  } catch {
    res.status(500).send('Error unsubscribing');
  }
});

module.exports = router;
