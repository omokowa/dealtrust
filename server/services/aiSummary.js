// services/aiSummary.js — Groq AI deal summaries (free tier)
// Free tier: 500,000 tokens/day = ~2,500 deal summaries/day
// Strategy: generate once, cache in DB forever — never regenerate

require('dotenv').config();
const Groq   = require('groq-sdk');
const { queries } = require('../db');
const logger = require('../utils/logger');

const groq = new Groq({
  apiKey: process.env.GROQ_API_KEY,
});

const MODEL = process.env.GROQ_MODEL || 'llama-3.3-70b-versatile';

// Rate limiting — max 1 per 2s to stay within free tier
let lastCallTime = 0;
async function rateLimit() {
  const now  = Date.now();
  const wait = Math.max(0, 2000 - (now - lastCallTime));
  if (wait > 0) await new Promise(r => setTimeout(r, wait));
  lastCallTime = Date.now();
}

// ── Generate summary for one deal ─────────────────────────
async function generateDealSummary(deal) {
  // Return cached summary if it exists — never call API twice
  if (deal.ai_summary) return deal.ai_summary;

  // Skip if no Groq key configured
  if (!process.env.GROQ_API_KEY) {
    logger.warn('[AI] GROQ_API_KEY not set — skipping summary generation');
    return null;
  }

  await rateLimit();

  const platformName = deal.platform.charAt(0).toUpperCase() + deal.platform.slice(1);
  const saving = (deal.original_price - deal.current_price).toLocaleString('en-NG');

  const prompt = `You are writing a short deal summary for Nigerian shoppers on DealTrust, a verified deals platform.

Product: ${deal.title}
Category: ${deal.category}
Platform: ${platformName}
Original price: ₦${deal.original_price.toLocaleString()}
Current price: ₦${deal.current_price.toLocaleString()}
Discount: ${deal.discount_pct}% off (save ₦${saving})
${deal.coupon_code ? `Coupon code available: YES` : ''}

Write exactly 2 sentences:
1. What the product is and why it's a good deal (mention the saving in naira)
2. One practical reason a Nigerian shopper would want it

Rules:
- Be specific and honest — no hype
- Mention the naira saving amount
- Keep it under 50 words total
- Do NOT start with "This"
- Do NOT use phrases like "great deal" or "amazing offer"`;

  try {
    const response = await groq.chat.completions.create({
      model:       MODEL,
      messages:    [{ role: 'user', content: prompt }],
      max_tokens:  120,
      temperature: 0.4,
    });

    const summary = response.choices[0]?.message?.content?.trim();
    if (!summary) return null;

    // Cache in database — never call API again for this deal
    await queries.updateDealSummary(deal.id, summary);
    logger.info(`[AI] Summary generated for deal ${deal.id}`);

    return summary;

  } catch (err) {
    // Don't crash if Groq fails — deal still works without summary
    logger.error(`[AI] Groq error for deal ${deal.id}: ${err.message}`);
    return null;
  }
}

// ── Generate summaries for a batch of deals ───────────────
// Called after each scrape run — processes deals without summaries
async function generateMissingSummaries(limit = 20) {
  if (!process.env.GROQ_API_KEY) return;

  try {

    const { db } = require('../db');
    const result = await db.query(
      `SELECT id, title, category, platform, current_price, original_price, discount_pct, coupon_code
       FROM deals WHERE ai_summary IS NULL AND verified = true
       ORDER BY deal_score DESC LIMIT $1`,
      [limit]
    );

    const deals = result.rows;
    if (!deals.length) {
      logger.info('[AI] No deals need summaries');
      return;
    }

    logger.info(`[AI] Generating summaries for ${deals.length} deals…`);
    let generated = 0;

    for (const deal of deals) {
      const summary = await generateDealSummary(deal);
      if (summary) generated++;
    }

    logger.info(`[AI] Generated ${generated}/${deals.length} summaries`);
  } catch (err) {
    logger.error(`[AI] Batch summary error: ${err.message}`);
  }
}

// ── To switch from Groq to Claude later ───────────────────
// Just change these 3 lines and update the SDK import:
//
// const Anthropic = require('@anthropic-ai/sdk');
// const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
// const MODEL = 'claude-haiku-4-5-20251001';
//
// Then update the API call:
// const response = await client.messages.create({
//   model: MODEL, max_tokens: 120,
//   messages: [{ role: 'user', content: prompt }]
// });
// const summary = response.content[0].text.trim();

module.exports = { generateDealSummary, generateMissingSummaries };
