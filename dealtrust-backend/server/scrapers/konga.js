// scrapers/konga.js — Konga Nigeria deal scraper
const axios   = require('axios');
const cheerio = require('cheerio');
const { buildAffiliateUrl } = require('../services/verify');
const logger  = require('../utils/logger');

const DELAY_MS = 3500;

const USER_AGENTS = [
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/122 Safari/537.36',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 Safari/537.36',
];
const randomUA = () => USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)];
const delay = ms => new Promise(r => setTimeout(r, ms));

const CATEGORY_URLS = {
  gadgets: [
    { url: 'https://www.konga.com/category/phones-tablets-5294', sub: 'Phones' },
    { url: 'https://www.konga.com/category/laptops-5298',         sub: 'Computing' },
  ],
  electronics: [
    { url: 'https://www.konga.com/category/televisions-5290',     sub: 'TVs' },
    { url: 'https://www.konga.com/category/audio-5291',           sub: 'Audio' },
  ],
  fashion: [
    { url: 'https://www.konga.com/category/mens-clothing-5310',   sub: 'Men' },
    { url: 'https://www.konga.com/category/womens-clothing-5311', sub: 'Women' },
  ],
  appliances: [
    { url: 'https://www.konga.com/category/refrigerators-5280',   sub: 'Fridges' },
    { url: 'https://www.konga.com/category/washing-machines-5281',sub: 'Washing' },
  ],
};

async function fetchKongaPage(url, category, subCategory) {
  try {
    const response = await axios.get(url, {
      headers: {
        'User-Agent': randomUA(),
        'Accept': 'text/html,application/xhtml+xml',
        'Accept-Language': 'en-NG,en;q=0.9',
        'Referer': 'https://www.konga.com/',
      },
      timeout: 15000,
    });

    const $     = cheerio.load(response.data);
    const deals = [];

    // Konga product grid selectors
    $('[class*="product-card"], [class*="ProductCard"], ._3vkk').each((i, el) => {
      if (i >= 10) return false;

      try {
        const $el          = $(el);
        const title        = $el.find('[class*="product-name"], [class*="name"], h3').first().text().trim();
        const priceText    = $el.find('[class*="price"], [class*="Price"]').first().text().replace(/[^0-9]/g, '');
        const oldText      = $el.find('[class*="old-price"], [class*="strike"], s').first().text().replace(/[^0-9]/g, '');
        const imgUrl       = $el.find('img').first().attr('src') || $el.find('img').first().attr('data-src');
        const link         = $el.find('a').first().attr('href');

        if (!title || !priceText || !link) return;

        const currentPrice  = parseInt(priceText);
        const originalPrice = oldText ? parseInt(oldText) : 0;
        if (!originalPrice || originalPrice <= currentPrice) return;

        const discountPct = Math.round((originalPrice - currentPrice) / originalPrice * 100);
        if (discountPct < 15) return;

        const productUrl   = link.startsWith('http') ? link : `https://www.konga.com${link}`;
        const affiliateUrl = buildAffiliateUrl('konga', productUrl);

        deals.push({
          title,
          platform:      'konga',
          category,
          sub_category:  subCategory,
          current_price: currentPrice,
          original_price: originalPrice,
          discount_pct:  discountPct,
          image_url:     imgUrl || null,
          product_url:   productUrl,
          affiliate_url: affiliateUrl,
          verified:      false,
        });
      } catch { }
    });

    logger.info(`[Konga] ${category}/${subCategory}: found ${deals.length} deals`);
    return deals;

  } catch (err) {
    logger.error(`[Konga] Error fetching ${url}: ${err.message}`);
    return [];
  }
}

async function scrapeKonga(categories = ['gadgets', 'electronics', 'fashion', 'appliances']) {
  const allDeals = [];
  logger.info(`[Konga] Starting scrape…`);

  for (const category of categories) {
    const pages = CATEGORY_URLS[category] || [];
    for (const { url, sub } of pages) {
      const deals = await fetchKongaPage(url, category, sub);
      allDeals.push(...deals);
      await delay(DELAY_MS);
    }
  }

  logger.info(`[Konga] Scrape complete: ${allDeals.length} deals found`);
  return allDeals;
}

module.exports = { scrapeKonga };
