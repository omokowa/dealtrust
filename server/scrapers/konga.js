// scrapers/konga.js — Konga Nigeria deal scraper (API-based)
const axios  = require('axios');
const { buildAffiliateUrl } = require('../services/verify');
const logger = require('../utils/logger');

const DELAY_MS = 2000;
const delay = ms => new Promise(r => setTimeout(r, ms));

const HEADERS = {
  'User-Agent':      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/122 Safari/537.36',
  'Accept':          'application/json, text/plain, */*',
  'Accept-Language': 'en-NG,en;q=0.9',
  'Referer':         'https://www.konga.com/',
  'Origin':          'https://www.konga.com',
};

// Konga category slugs mapped to our categories
const CATEGORY_URLS = {
  gadgets: [
    { url: 'https://api.konga.com/v1/paginator/catalog/search?limit=30&category_id=5294&sort=discount_percentage%3Adesc', sub: 'Phones' },
    { url: 'https://api.konga.com/v1/paginator/catalog/search?limit=30&category_id=5298&sort=discount_percentage%3Adesc', sub: 'Computing' },
  ],
  electronics: [
    { url: 'https://api.konga.com/v1/paginator/catalog/search?limit=30&category_id=5290&sort=discount_percentage%3Adesc', sub: 'TVs' },
    { url: 'https://api.konga.com/v1/paginator/catalog/search?limit=30&category_id=5291&sort=discount_percentage%3Adesc', sub: 'Audio' },
  ],
  fashion: [
    { url: 'https://api.konga.com/v1/paginator/catalog/search?limit=30&category_id=5310&sort=discount_percentage%3Adesc', sub: 'Men' },
    { url: 'https://api.konga.com/v1/paginator/catalog/search?limit=30&category_id=5311&sort=discount_percentage%3Adesc', sub: 'Women' },
  ],
  appliances: [
    { url: 'https://api.konga.com/v1/paginator/catalog/search?limit=30&category_id=5280&sort=discount_percentage%3Adesc', sub: 'Fridges' },
    { url: 'https://api.konga.com/v1/paginator/catalog/search?limit=30&category_id=5281&sort=discount_percentage%3Adesc', sub: 'Washing' },
  ],
};

async function fetchKongaCategory(url, category, subCategory) {
  try {
    const response = await axios.get(url, { headers: HEADERS, timeout: 15000 });
    const data = response.data;

    // Konga API response structure
    const items = data?.data?.items || data?.items || data?.data || [];
    if (!Array.isArray(items) || items.length === 0) {
      // Try alternate structure
      logger.info(`[Konga] ${category}/${subCategory}: no items in response, trying alternate`);
      return [];
    }

    const deals = [];

    for (const item of items.slice(0, 12)) {
      try {
        const title         = item.name || item.title;
        const currentPrice  = parseFloat(item.special_price || item.price || 0);
        const originalPrice = parseFloat(item.price || item.original_price || 0);
        const imageUrl      = item.image_url || item.thumbnail_url || item.images?.[0]?.url;
        const slug          = item.url_key || item.slug;
        const productUrl    = slug ? `https://www.konga.com/product/${slug}` : null;

        if (!title || !currentPrice || !productUrl) continue;
        if (!originalPrice || originalPrice <= currentPrice) continue;

        const discountPct = Math.round((originalPrice - currentPrice) / originalPrice * 100);
        if (discountPct < 10) continue;

        const affiliateUrl = buildAffiliateUrl('konga', productUrl);

        deals.push({
          title,
          platform:       'konga',
          category,
          sub_category:   subCategory,
          current_price:  currentPrice,
          original_price: originalPrice,
          discount_pct:   discountPct,
          image_url:      imageUrl || null,
          product_url:    productUrl,
          affiliate_url:  affiliateUrl,
          verified:       false,
        });
      } catch { }
    }

    logger.info(`[Konga] ${category}/${subCategory}: found ${deals.length} deals`);
    return deals;

  } catch (err) {
    // If API fails, try web scraping fallback
    logger.warn(`[Konga] API failed for ${category}/${subCategory}: ${err.message} — trying web fallback`);
    return fetchKongaWeb(category, subCategory);
  }
}

// Web fallback using search endpoint
async function fetchKongaWeb(category, subCategory) {
  try {
    const searchTerms = {
      Phones: 'smartphones', Computing: 'laptops',
      TVs: 'television', Audio: 'bluetooth speaker',
      Men: 'mens clothing', Women: 'womens dress',
      Fridges: 'refrigerator', Washing: 'washing machine',
    };
    const term = searchTerms[subCategory] || subCategory.toLowerCase();
    const url = `https://www.konga.com/search?search=${encodeURIComponent(term)}`;

    const response = await axios.get(url, {
      headers: { ...HEADERS, Accept: 'text/html,application/xhtml+xml' },
      timeout: 15000,
    });

    // Look for __NEXT_DATA__ JSON embedded in the page
    const match = response.data.match(/"products":\s*(\[[\s\S]*?\])\s*[,}]/);
    if (!match) return [];

    const products = JSON.parse(match[1]);
    const deals = [];

    for (const item of products.slice(0, 10)) {
      const currentPrice  = parseFloat(item.special_price || item.price || 0);
      const originalPrice = parseFloat(item.price || 0);
      if (!currentPrice || !originalPrice || originalPrice <= currentPrice) continue;

      const discountPct = Math.round((originalPrice - currentPrice) / originalPrice * 100);
      if (discountPct < 10) continue;

      const productUrl = `https://www.konga.com/product/${item.url_key}`;
      deals.push({
        title:          item.name,
        platform:       'konga',
        category,
        sub_category:   subCategory,
        current_price:  currentPrice,
        original_price: originalPrice,
        discount_pct:   discountPct,
        image_url:      item.image_url || null,
        product_url:    productUrl,
        affiliate_url:  buildAffiliateUrl('konga', productUrl),
        verified:       false,
      });
    }

    return deals;
  } catch (err) {
    logger.error(`[Konga] Web fallback also failed: ${err.message}`);
    return [];
  }
}

async function scrapeKonga(categories = ['gadgets', 'electronics', 'fashion', 'appliances']) {
  const allDeals = [];
  logger.info(`[Konga] Starting scrape…`);

  for (const category of categories) {
    const pages = CATEGORY_URLS[category] || [];
    for (const { url, sub } of pages) {
      const deals = await fetchKongaCategory(url, category, sub);
      allDeals.push(...deals);
      await delay(DELAY_MS);
    }
  }

  logger.info(`[Konga] Scrape complete: ${allDeals.length} deals found`);
  return allDeals;
}

module.exports = { scrapeKonga };
