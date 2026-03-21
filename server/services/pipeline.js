// services/pipeline.js — The full data pipeline
const { scrapeJumia }  = require('../scrapers/jumia');
const { scrapeKonga }  = require('../scrapers/konga');
const { scrapeTemu }   = require('../scrapers/temu');
const { verifyDeal }   = require('./verify');
const { generateMissingSummaries } = require('./aiSummary');
const { sendDealAlerts } = require('./alerts');
const { queries, db }  = require('../db');
const logger           = require('../utils/logger');

async function runPipeline(options = {}) {
  const startTime  = Date.now();
  const categories = options.categories || ['gadgets', 'electronics', 'fashion', 'appliances'];
  const platforms  = options.platforms  || ['jumia', 'konga', 'temu'];

  logger.info('═══════════════════════════════════════════');
  logger.info('🚀 DealTrust Pipeline Starting');
  logger.info(`   Categories: ${categories.join(', ')}`);
  logger.info(`   Platforms:  ${platforms.join(', ')}`);
  logger.info('═══════════════════════════════════════════');

  const stats = { scraped: 0, saved: 0, verified: 0, rejected: 0, errors: 0, newDeals: [] };

  try {
    // ── STEP 1: Scrape ─────────────────────────────────────
    let rawDeals = [];
    if (platforms.includes('jumia')) rawDeals.push(...await scrapeJumia(categories));
    if (platforms.includes('konga')) rawDeals.push(...await scrapeKonga(categories));
    if (platforms.includes('temu'))  rawDeals.push(...await scrapeTemu(categories));

    stats.scraped = rawDeals.length;
    logger.info(`\n📦 Total scraped: ${stats.scraped} deals`);

    // ── STEP 2: Save ───────────────────────────────────────
    logger.info('\n💾 Saving deals to database…');

    for (const deal of rawDeals) {
      try {
        const result = await queries.insertDeal(deal);
        const dealId = result.rows?.[0]?.id || await getDealIdByUrl(deal.affiliate_url);
        if (!dealId) continue;
        await queries.insertPriceHistory(dealId, deal.current_price, true);
        stats.saved++;
        deal.id = dealId;
      } catch (err) {
        stats.errors++;
        logger.error(`[Pipeline] Save error: ${err.message}`);
      }
    }

    logger.info(`✅ Saved: ${stats.saved} deals`);

    // ── STEP 3: Verify ─────────────────────────────────────
    logger.info('\n🔍 Running verification engine…');

    const unverifiedResult = await db.query(
      `SELECT * FROM deals WHERE updated_at >= NOW() - INTERVAL '2 hours' ORDER BY created_at DESC`
    );

    for (const deal of unverifiedResult.rows) {
      try {
        const result = await verifyDeal(deal);
        if (result.verified) {
          stats.verified++;
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

    // ── STEP 4: AI Summaries ───────────────────────────────
    logger.info('\n🤖 Generating AI summaries…');
    await generateMissingSummaries(20);

    // ── STEP 5: Alerts ─────────────────────────────────────
    if (stats.newDeals.length > 0) {
      logger.info(`\n📧 Sending alerts for ${stats.newDeals.length} new verified deals…`);
      await sendDealAlerts(stats.newDeals);
    }

    // ── STEP 6: Cleanup (Sundays only) ─────────────────────
    if (new Date().getDay() === 0) {
      logger.info('\n🧹 Running weekly cleanup…');
      await queries.cleanOldPriceHistory();
      await queries.cleanExpiredDeals();
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
    const result = await db.query(
      `SELECT id FROM deals WHERE affiliate_url = $1 LIMIT 1`, [affiliateUrl]
    );
    return result.rows[0]?.id || null;
  } catch { return null; }
}

module.exports = { runPipeline };
