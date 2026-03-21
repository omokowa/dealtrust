// scrapers/jumia.js — Jumia Nigeria deal scraper
const axios   = require('axios');
const cheerio = require('cheerio');
const { buildAffiliateUrl } = require('../services/verify');
const logger  = require('../utils/logger');

const DELAY_MS = 3000;

const USER_AGENTS = [
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/122 Safari/537.36',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/122 Safari/537.36',
  'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome/122 Safari/537.36',
];

function randomUA() { return USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)]; }
function delay(ms)  { return new Promise(r => setTimeout(r, ms)); }

// ── Safe price parser — handles ranges like "₦14,900 - ₦15,604" ──
function parsePrice(text) {
  if (!text) return 0;
  // Take only the first number before any dash/hyphen (price ranges)
  const cleaned = text.trim().split(/[-–]/)[0].replace(/[^0-9]/g, '');
  if (!cleaned) return 0;
  const val = parseInt(cleaned);
  // Sanity check — Jumia prices should be between ₦100 and ₦10,000,000
  if (val < 100 || val > 10000000) return 0;
  return val;
}

const CATEGORY_URLS = {
  gadgets: [
    { url: 'https://www.jumia.com.ng/phones-tablets/', sub: 'Phones' },
    { url: 'https://www.jumia.com.ng/tablets/',        sub: 'Tablets' },
    { url: 'https://www.jumia.com.ng/laptops/',        sub: 'Computing' },
  ],
  electronics: [
    { url: 'https://www.jumia.com.ng/televisions/',    sub: 'TVs' },
    { url: 'https://www.jumia.com.ng/cameras/',        sub: 'Cameras' },
    { url: 'https://www.jumia.com.ng/home-audio/',     sub: 'Audio' },
  ],
  fashion: [
    { url: 'https://www.jumia.com.ng/womens-clothing/', sub: 'Women' },
    { url: 'https://www.jumia.com.ng/shoes/',           sub: 'Footwear' },
    { url: 'https://www.jumia.com.ng/bags-luggage/',    sub: 'Bags' },
  ],
  appliances: [
    { url: 'https://www.jumia.com.ng/refrigerators/',    sub: 'Fridges' },
    { url: 'https://www.jumia.com.ng/washing-machines/', sub: 'Washing' },
    { url: 'https://www.jumia.com.ng/air-conditioners/', sub: 'AC' },
  ],
  health: [
    { url: 'https://www.jumia.com.ng/beauty-health/',   sub: 'Skincare' },
    { url: 'https://www.jumia.com.ng/vitamins-dietary-supplements/', sub: 'Vitamins' },
  ],
  baby: [
    { url: 'https://www.jumia.com.ng/baby-products/',   sub: 'Baby' },
  ],
  gaming: [
    { url: 'https://www.jumia.com.ng/video-games/',     sub: 'Games' },
    { url: 'https://www.jumia.com.ng/gaming-consoles/', sub: 'Consoles' },
  ],
  supermarket: [
    { url: 'https://www.jumia.com.ng/groceries/',       sub: 'Food' },
    { url: 'https://www.jumia.com.ng/household-cleaning/', sub: 'Household' },
  ],
};

async function fetchCategoryPage(url, category, subCategory) {
  try {
    const response = await axios.get(url, {
      headers: {
        'User-Agent':    randomUA(),
        'Accept':        'text/html,application/xhtml+xml',
        'Accept-Language': 'en-NG,en;q=0.9',
        'Referer':       'https://www.jumia.com.ng/',
      },
      timeout: 15000,
    });

    const $ = cheerio.load(response.data);
    const deals = [];

    $('article.prd').each((i, el) => {
      if (i >= 12) return false;

      try {
        const $el = $(el);

        const title    = $el.find('.name').text().trim();
        const imgUrl   = $el.find('img.img').attr('data-src') || $el.find('img').attr('src');
        const linkPath = $el.find('a.core').attr('href');

        if (!title || !linkPath) return;

        // ── Fixed price parsing ──────────────────────────
        const rawPrice   = $el.find('.prc').first().text().trim();
        const rawOld     = $el.find('.old').first().text().trim();
        const discText   = $el.find('.bdg._dsct').text().replace(/[^0-9]/g, '');

        const currentPrice  = parsePrice(rawPrice);
        const originalPrice = parsePrice(rawOld);

        if (!currentPrice || currentPrice <= 0) return;

        // Calculate discount
        let discountPct = discText ? parseInt(discText) : 0;
        if (!discountPct && originalPrice > currentPrice) {
          discountPct = Math.round((originalPrice - currentPrice) / originalPrice * 100);
        }

        if (discountPct < 15) return;

        // Must have a valid original price higher than current
        const finalOriginal = originalPrice > currentPrice
          ? originalPrice
          : discountPct > 0
            ? Math.round(currentPrice * (100 / (100 - discountPct)))
            : 0;

        if (!finalOriginal || finalOriginal <= currentPrice) return;

        // Final sanity check on both prices
        if (currentPrice > 10000000 || finalOriginal > 15000000) return;

        const productUrl   = `https://www.jumia.com.ng${linkPath}`;
        const affiliateUrl = buildAffiliateUrl('jumia', productUrl);

        deals.push({
          title,
          platform:       'jumia',
          category,
          sub_category:   subCategory,
          current_price:  currentPrice,
          original_price: finalOriginal,
          discount_pct:   discountPct,
          image_url:      imgUrl || null,
          product_url:    productUrl,
          affiliate_url:  affiliateUrl,
          verified:       false,
        });

      } catch { }
    });

    logger.info(`[Jumia] ${url.split('/').filter(Boolean).pop()}: found ${deals.length} deals`);
    return deals;

  } catch (err) {
    logger.error(`[Jumia] Error fetching ${url}: ${err.message}`);
    return [];
  }
}

async function scrapeJumia(categories = ['gadgets', 'electronics', 'fashion', 'appliances']) {
  const allDeals = [];
  logger.info(`[Jumia] Starting scrape for categories: ${categories.join(', ')}`);

  for (const category of categories) {
    const pages = CATEGORY_URLS[category] || [];
    for (const { url, sub } of pages) {
      const deals = await fetchCategoryPage(url, category, sub);
      allDeals.push(...deals);
      await delay(DELAY_MS);
    }
  }

  logger.info(`[Jumia] Scrape complete: ${allDeals.length} deals found`);
  return allDeals;
}

module.exports = { scrapeJumia };
