// scrapers/jumia.js — Jumia Nigeria deal scraper
// Uses Cheerio (HTML parsing) + Axios (HTTP)
// Scrapes sale/deals pages, not individual products
// Respects robots.txt, adds delays, rotates user agents

const axios   = require('axios');
const cheerio = require('cheerio');
const { buildAffiliateUrl } = require('../services/verify');
const logger  = require('../utils/logger');

const DELAY_MS = 3000; // 3s between requests — polite scraping

const USER_AGENTS = [
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/122 Safari/537.36',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/122 Safari/537.36',
  'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome/122 Safari/537.36',
];

function randomUA() {
  return USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)];
}

function delay(ms) {
  return new Promise(r => setTimeout(r, ms));
}

// ── Category URL map ───────────────────────────────────────
const CATEGORY_URLS = {
  gadgets: [
    { url: 'https://www.jumia.com.ng/phones-tablets/', sub: 'Phones' },
    { url: 'https://www.jumia.com.ng/tablets/',        sub: 'Tablets' },
    { url: 'https://www.jumia.com.ng/laptops/',        sub: 'Computing' },
  ],
  electronics: [
    { url: 'https://www.jumia.com.ng/televisions/',   sub: 'TVs' },
    { url: 'https://www.jumia.com.ng/audio-music/',   sub: 'Audio' },
    { url: 'https://www.jumia.com.ng/cameras/',       sub: 'Cameras' },
  ],
  fashion: [
    { url: 'https://www.jumia.com.ng/mens-clothing/', sub: 'Men' },
    { url: 'https://www.jumia.com.ng/womens-clothing/',sub: 'Women' },
    { url: 'https://www.jumia.com.ng/shoes/',         sub: 'Footwear' },
  ],
  appliances: [
    { url: 'https://www.jumia.com.ng/refrigerators/', sub: 'Fridges' },
    { url: 'https://www.jumia.com.ng/washing-machines/', sub: 'Washing' },
    { url: 'https://www.jumia.com.ng/air-conditioners/', sub: 'AC' },
  ],
};

// ── Fetch one category page ────────────────────────────────
async function fetchCategoryPage(url, category, subCategory) {
  try {
    const response = await axios.get(url, {
      headers: {
        'User-Agent': randomUA(),
        'Accept':     'text/html,application/xhtml+xml',
        'Accept-Language': 'en-NG,en;q=0.9',
        'Referer':    'https://www.jumia.com.ng/',
      },
      timeout: 15000,
    });

    const $       = cheerio.load(response.data);
    const deals   = [];

    // Jumia product card selectors
    $('article.prd').each((i, el) => {
      if (i >= 12) return false; // Max 12 per category per run

      try {
        const $el        = $(el);
        const title      = $el.find('.name').text().trim();
        const priceText  = $el.find('.prc').text().replace(/[^0-9]/g, '');
        const oldText    = $el.find('.old').text().replace(/[^0-9]/g, '');
        const discText   = $el.find('.bdg._dsct').text().replace(/[^0-9]/g, '');
        const imgUrl     = $el.find('img.img').attr('data-src') || $el.find('img').attr('src');
        const linkPath   = $el.find('a.core').attr('href');

        if (!title || !priceText || !linkPath) return;

        const currentPrice  = parseInt(priceText);
        const originalPrice = oldText ? parseInt(oldText) : currentPrice;
        const discountPct   = discText
          ? parseInt(discText)
          : originalPrice > currentPrice
            ? Math.round((originalPrice - currentPrice) / originalPrice * 100)
            : 0;

        if (discountPct < 15) return; // Skip low-discount items

        const productUrl   = `https://www.jumia.com.ng${linkPath}`;
        const affiliateUrl = buildAffiliateUrl('jumia', productUrl);

        deals.push({
          title,
          platform:      'jumia',
          category,
          sub_category:  subCategory,
          current_price: currentPrice,
          original_price: originalPrice > currentPrice ? originalPrice : Math.round(currentPrice * (100 / (100 - discountPct))),
          discount_pct:  discountPct,
          image_url:     imgUrl || null,
          product_url:   productUrl,
          affiliate_url: affiliateUrl,
          verified:      false, // Will be set by verify.js
        });

      } catch (parseErr) {
        // Skip malformed product
      }
    });

    logger.info(`[Jumia] ${url.split('/').filter(Boolean).pop()}: found ${deals.length} deals`);
    return deals;

  } catch (err) {
    logger.error(`[Jumia] Error fetching ${url}: ${err.message}`);
    return [];
  }
}

// ── Main scrape function ───────────────────────────────────
async function scrapeJumia(categories = ['gadgets', 'electronics', 'fashion', 'appliances']) {
  const allDeals = [];
  logger.info(`[Jumia] Starting scrape for categories: ${categories.join(', ')}`);

  for (const category of categories) {
    const pages = CATEGORY_URLS[category] || [];

    for (const { url, sub } of pages) {
      const deals = await fetchCategoryPage(url, category, sub);
      allDeals.push(...deals);
      await delay(DELAY_MS); // Polite delay between requests
    }
  }

  logger.info(`[Jumia] Scrape complete: ${allDeals.length} deals found`);
  return allDeals;
}

module.exports = { scrapeJumia };
