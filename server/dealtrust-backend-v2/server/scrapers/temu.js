// scrapers/temu.js — Temu deal scraper
// Temu has a public-facing web API for their product listings
// We target Electronics, Fashion, Gadgets accessories (Temu is weak on heavy Appliances)

const axios   = require('axios');
const { buildAffiliateUrl } = require('../services/verify');
const logger  = require('../utils/logger');

const delay = ms => new Promise(r => setTimeout(r, ms));
const DELAY_MS = 4000;

// Temu category IDs (from their public site structure)
const CATEGORY_CONFIGS = {
  gadgets: [
    { query: 'smartphone accessories',   sub: 'Accessories', goodIds: ['601001'] },
    { query: 'wireless earphones',        sub: 'Accessories', goodIds: [] },
    { query: 'phone case',               sub: 'Accessories', goodIds: [] },
  ],
  electronics: [
    { query: 'smart home devices',       sub: 'Smart Home',  goodIds: [] },
    { query: 'bluetooth speaker',        sub: 'Audio',       goodIds: [] },
    { query: 'led light strip',          sub: 'Smart Home',  goodIds: [] },
  ],
  fashion: [
    { query: 'mens casual shirt',        sub: 'Men',         goodIds: [] },
    { query: 'womens dress',             sub: 'Women',       goodIds: [] },
    { query: 'sneakers shoes',           sub: 'Footwear',    goodIds: [] },
    { query: 'handbag women',            sub: 'Bags',        goodIds: [] },
  ],
};

async function fetchTemuSearch(query, category, subCategory) {
  try {
    // Temu's search API endpoint
    const url = `https://www.temu.com/api/archer/search/result/v2`;
    const response = await axios.get(url, {
      params: {
        q:         query,
        page:      1,
        page_size: 20,
        sort_type: 6, // Sort by discount
      },
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/122 Safari/537.36',
        'Accept':     'application/json',
        'Referer':    'https://www.temu.com/',
      },
      timeout: 12000,
    });

    const items = response.data?.result?.goods_list || [];
    const deals = [];

    for (const item of items.slice(0, 8)) {
      try {
        const originalPrice = parseFloat(item.original_price || item.market_price || 0);
        const currentPrice  = parseFloat(item.price || item.sales_price || 0);

        if (!currentPrice || !originalPrice || originalPrice <= currentPrice) continue;

        const discountPct = Math.round((originalPrice - currentPrice) / originalPrice * 100);
        if (discountPct < 15) continue;

        const productUrl   = `https://www.temu.com/goods.html?goods_id=${item.goods_id}`;
        const affiliateUrl = buildAffiliateUrl('temu', productUrl);

        deals.push({
          title:          item.goods_name || item.name,
          platform:       'temu',
          category,
          sub_category:   subCategory,
          current_price:  Math.round(currentPrice * 1600), // Convert USD → NGN (approx)
          original_price: Math.round(originalPrice * 1600),
          discount_pct:   discountPct,
          image_url:      item.thumbnail || item.main_image || null,
          product_url:    productUrl,
          affiliate_url:  affiliateUrl,
          verified:       false,
        });
      } catch { }
    }

    logger.info(`[Temu] "${query}": found ${deals.length} deals`);
    return deals;

  } catch (err) {
    // Temu blocks aggressively — this is expected sometimes
    logger.warn(`[Temu] Could not fetch "${query}": ${err.message}`);
    return [];
  }
}

async function scrapeTemu(categories = ['gadgets', 'electronics', 'fashion']) {
  const allDeals = [];
  // Note: Temu is NOT scraped for appliances — their selection is weak
  const temuCategories = categories.filter(c => c !== 'appliances');
  logger.info(`[Temu] Starting scrape for: ${temuCategories.join(', ')}`);

  for (const category of temuCategories) {
    const configs = CATEGORY_CONFIGS[category] || [];
    for (const config of configs) {
      const deals = await fetchTemuSearch(config.query, category, config.sub);
      allDeals.push(...deals);
      await delay(DELAY_MS);
    }
  }

  logger.info(`[Temu] Scrape complete: ${allDeals.length} deals found`);
  return allDeals;
}

module.exports = { scrapeTemu };
