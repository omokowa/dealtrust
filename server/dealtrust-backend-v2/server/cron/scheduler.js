// cron/scheduler.js — Automated pipeline scheduling
// Uses node-cron for local/fallback scheduling
// In production: cron-job.org pings /api/admin/sync every 6 hours
// This file handles the schedule if running locally or as backup

const cron = require('node-cron');
const { runPipeline } = require('../services/pipeline');
const logger          = require('../utils/logger');

function startScheduler() {
  // Main sync: every 6 hours (0:00, 6:00, 12:00, 18:00)
  cron.schedule('0 */6 * * *', async () => {
    logger.info('[Cron] ⏰ 6-hour sync triggered');
    try {
      await runPipeline();
    } catch (err) {
      logger.error(`[Cron] Pipeline error: ${err.message}`);
    }
  });

  // Keep-alive ping: every 14 minutes (prevents Render free tier sleep)
  // This only applies when running on Render — harmless locally
  if (process.env.NODE_ENV === 'production') {
    cron.schedule('*/14 * * * *', async () => {
      try {
        const http = require('http');
        const port = process.env.PORT || 3000;
        http.get(`http://localhost:${port}/api/health`, () => {});
      } catch { }
    });
    logger.info('[Cron] Keep-alive ping scheduled (every 14 min)');
  }

  logger.info('[Cron] Scheduler started — pipeline runs every 6 hours');
}

module.exports = { startScheduler };
