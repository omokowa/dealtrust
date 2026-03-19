// services/pipeline.js — The full data pipeline
// Scrape → Verify → Save → Generate AI Summaries → Send Alerts
// Called by cron scheduler every 6 hours

const { scrapeJumia }   = require('../scrapers/jumia');
const { scrapeKonga }   = require('../scrapers/konga');
const { scrapeTemu }    = require('../scrapers/temu');
const { verifyDeal }    = require('./verify');
const { generateMissingSummaries } = require('./aiSummary');
const { sendDealAlerts } = require('./alerts');
const { queries }       = require('../db');
const logger            = require('../utils/logger');

// ── Run the full pipeline ──────────────────────────────────
async function runPipeline(options = {}) {
  const startTime  = Date.now();
  const categories = options.categories || ['gadgets', 'electronics', 'fashion', 'appliances'];
  const platforms  = options.platforms  || ['jumia', 'konga', 'temu'];

  logger.info('═══════════════════════════════════════════');
  logger.info('🚀 DealTrust Pipeline Starting');
  logger.info(`   Categories: ${categories.join(', ')}`);
  logger.info(`   Platforms:  ${platforms.join(', ')}`);
  logger.info('═══════════════════════════════════════════');

  const stats = {
    scraped:  0,
    saved:    0,
    verified: 0,
    rejected: 0,
    errors:   0,
    newDeals: [],
  };

  try {
    // ── STEP 1: Scrape all platforms ───────────────────────
    let rawDeals = [];

    if (platforms.includes('jumia')) {
      const jumiaDeals = await scrapeJumia(categories);
      rawDeals.push(...jumiaDeals);
    }

    if (platforms.includes('konga')) {
      const kongaDeals = await scrapeKonga(categories);
      rawDeals.push(...kongaDeals);
    }

    if (platforms.includes('temu')) {
      const temuDeals = await scrapeTemu(categories);
      rawDeals.push(...temuDeals);
    }

    stats.scraped = rawDeals.length;
    logger.info(`\n📦 Total scraped: ${stats.scraped} deals`);

    // ── STEP 2: Save to database ───────────────────────────
    logger.info('\n💾 Saving deals to database…');

    for (const deal of rawDeals) {
      try {
        const result = await queries.insertDeal(deal);

        // Get the deal ID (inserted or existing)
        const dealId = result.lastInsertRowid
          ? Number(result.lastInsertRowid)
          : await getDealIdByUrl(deal.affiliate_url);

        if (!dealId) continue;

        // Save current price to history
        await queries.insertPriceHistory(dealId, deal.current_price, true);

        stats.saved++;
        deal.id = dealId;

      } catch (err) {
        stats.errors++;
        logger.error(`[Pipeline] Save error: ${err.message}`);
      }
    }

    logger.info(`✅ Saved: ${stats.saved} deals`);

    // ── STEP 3: Verify deals ───────────────────────────────
    logger.info('\n🔍 Running verification engine…');

    // Get all unverified deals from DB for verification
    const unverifiedResult = await require('../db').db.execute({
      sql: `SELECT d.*, c.success_count, c.fail_count
            FROM deals d
            LEFT JOIN coupons c ON c.deal_id = d.id
            WHERE d.updated_at >= datetime('now', '-2 hours')
            ORDER BY d.created_at DESC`,
      args: [],
    });

    for (const deal of unverifiedResult.rows) {
      try {
        const result = await verifyDeal(deal);
        if (result.verified) {
          stats.verified++;
          // Track new verified deals for alert sending
          const isNew = rawDeals.some(r => r.id === deal.id);
          if (isNew) stats.newDeals.push(deal);
        } else {
          stats.rejected++;
        }
      } catch (err) {
        logger.error(`[Pipeline] Verify error for deal ${deal.id}: ${err.message}`);
      }
    }

    logger.info(`✅ Verified: ${stats.verified} | ❌ Rejected: ${stats.rejected}`);

    // ── STEP 4: Generate AI summaries ──────────────────────
    logger.info('\n🤖 Generating AI summaries…');
    await generateMissingSummaries(20); // Max 20 per run to stay in free tier

    // ── STEP 5: Send deal alerts ───────────────────────────
    if (stats.newDeals.length > 0) {
      logger.info(`\n📧 Sending alerts for ${stats.newDeals.length} new verified deals…`);
      await sendDealAlerts(stats.newDeals);
    }

    // ── STEP 6: Cleanup old data (weekly) ──────────────────
    const dayOfWeek = new Date().getDay();
    if (dayOfWeek === 0) { // Sundays only
      logger.info('\n🧹 Running weekly cleanup…');
      await queries.cleanOldPriceHistory();
      await queries.cleanExpiredDeals();
      logger.info('✅ Cleanup complete');
    }

    const duration = ((Date.now() - startTime) / 1000).toFixed(1);
    logger.info(`\n═══════════════════════════════════════════`);
    logger.info(`✅ Pipeline complete in ${duration}s`);
    logger.info(`   Scraped: ${stats.scraped} | Saved: ${stats.saved} | Verified: ${stats.verified}`);
    logger.info(`═══════════════════════════════════════════\n`);

    return stats;

  } catch (err) {
    logger.error(`[Pipeline] Fatal error: ${err.message}`);
    throw err;
  }
}

async function getDealIdByUrl(affiliateUrl) {
  try {
    const result = await require('../db').db.execute({
      sql:  `SELECT id FROM deals WHERE affiliate_url = ? LIMIT 1`,
      args: [affiliateUrl],
    });
    return result.rows[0]?.id || null;
  } catch { return null; }
}

module.exports = { runPipeline };
