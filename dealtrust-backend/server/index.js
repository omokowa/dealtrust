// index.js — DealTrust Backend Server
require('dotenv').config();

const express    = require('express');
const cors       = require('cors');
const helmet     = require('helmet');
const rateLimit  = require('express-rate-limit');
const path       = require('path');

const { initSchema }      = require('./db');
const dealsRouter         = require('./routes/deals');
const alertsRouter        = require('./routes/alerts');
const redirectRouter      = require('./routes/redirect');
const adminRouter         = require('./routes/admin');
const { startScheduler }  = require('./cron/scheduler');
const logger              = require('./utils/logger');

const app  = express();
const PORT = process.env.PORT || 3000;

// ── Security & Middleware ─────────────────────────────────
app.use(helmet({
  contentSecurityPolicy: false, // Let frontend handle its own CSP
  crossOriginEmbedderPolicy: false,
}));

app.use(cors({
  origin: [
    process.env.FRONTEND_URL || 'https://dealtrust.app',
    'http://localhost:5173', // Vite dev server
    'http://localhost:3000',
  ],
  methods: ['GET', 'POST', 'DELETE'],
  credentials: false,
}));

app.use(express.json({ limit: '10kb' }));
app.use(express.urlencoded({ extended: false }));

// ── Rate limiting ─────────────────────────────────────────
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max:      100,              // 100 requests per 15 min per IP
  message:  { error: 'Too many requests — please wait 15 minutes' },
  standardHeaders: true,
  legacyHeaders:   false,
});

const strictLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max:      20,               // 20 votes/reveals per hour per IP
  message:  { error: 'Too many requests' },
});

app.use('/api', apiLimiter);
app.use('/api/deals/:id/vote',          strictLimiter);
app.use('/api/deals/:id/reveal-coupon', strictLimiter);

// ── Routes ────────────────────────────────────────────────
app.use('/api/deals',   dealsRouter);
app.use('/api/alerts',  alertsRouter);
app.use('/api/unsubscribe', alertsRouter); // One-click unsubscribe
app.use('/api/admin',   adminRouter);
app.use('/api/health',  (req, res) => res.json({ status: 'ok', time: new Date().toISOString() }));

// The affiliate redirect — lives at /go/:id not /api/go/:id
// This keeps share links clean: dealtrust.app/go/123
app.use('/go', redirectRouter);

// ── 404 handler ───────────────────────────────────────────
app.use('/api/*', (req, res) => {
  res.status(404).json({ error: 'Endpoint not found' });
});

// ── Error handler ─────────────────────────────────────────
app.use((err, req, res, next) => {
  logger.error(`Unhandled error: ${err.message}`);
  res.status(500).json({ error: 'Internal server error' });
});

// ── Start ─────────────────────────────────────────────────
async function start() {
  try {
    // Init database schema
    await initSchema();

    // Start server
    app.listen(PORT, () => {
      logger.info('╔═══════════════════════════════════╗');
      logger.info('║   DealTrust Backend API Server    ║');
      logger.info('╚═══════════════════════════════════╝');
      logger.info(`🚀 Running on port ${PORT}`);
      logger.info(`📦 Database: ${process.env.TURSO_DATABASE_URL ? 'Turso (cloud)' : 'SQLite (local)'}`);
      logger.info(`🤖 AI: ${process.env.GROQ_API_KEY ? 'Groq enabled' : 'No Groq key — summaries disabled'}`);
      logger.info(`📧 Email: ${process.env.RESEND_API_KEY ? 'Resend enabled' : 'No Resend key — alerts disabled'}`);
      logger.info(`🔗 Affiliate: Jumia=${!!process.env.JUMIA_AFFILIATE_ID} Konga=${!!process.env.KONGA_AFFILIATE_ID} Temu=${!!process.env.TEMU_AFFILIATE_ID}`);
    });

    // Start cron scheduler
    startScheduler();

    // Run first pipeline after 30s if DB is empty (first deploy)
    setTimeout(async () => {
      try {
        const result = await require('./db').db.execute({ sql: 'SELECT COUNT(*) as c FROM deals', args: [] });
        const count  = result.rows[0]?.c || 0;
        if (count === 0) {
          logger.info('📥 Empty DB detected — running first pipeline…');
          const { runPipeline } = require('./services/pipeline');
          await runPipeline();
        }
      } catch { }
    }, 30000);

  } catch (err) {
    logger.error(`Failed to start: ${err.message}`);
    process.exit(1);
  }
}

start();
