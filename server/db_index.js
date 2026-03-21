// db/index.js — PostgreSQL (Neon) database connection + schema + queries
require('dotenv').config();
const { Pool } = require('pg');

// ── Connection ────────────────────────────────────────────
const pool = new Pool({
  connectionString: process.env.DATABASE_URL || process.env.TURSO_DATABASE_URL,
  ssl: process.env.DATABASE_URL ? { rejectUnauthorized: false } : false,
  max: 5,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 10000,
});

pool.on('error', (err) => {
  console.error('Database pool error:', err.message);
});

// Helper to run queries
async function query(sql, params = []) {
  const client = await pool.connect();
  try {
    const result = await client.query(sql, params);
    return result;
  } finally {
    client.release();
  }
}

// ── Schema ────────────────────────────────────────────────
async function initSchema() {
  const statements = [
    `CREATE TABLE IF NOT EXISTS deals (
      id               SERIAL PRIMARY KEY,
      title            TEXT    NOT NULL,
      description      TEXT,
      ai_summary       TEXT,
      platform         TEXT    NOT NULL,
      category         TEXT    NOT NULL,
      sub_category     TEXT,
      current_price    NUMERIC NOT NULL,
      original_price   NUMERIC NOT NULL,
      discount_pct     INTEGER NOT NULL,
      coupon_code      TEXT,
      coupon_success_rate INTEGER DEFAULT 0,
      affiliate_url    TEXT    NOT NULL UNIQUE,
      image_url        TEXT,
      product_url      TEXT,
      verified         BOOLEAN DEFAULT false,
      deal_score       INTEGER DEFAULT 0,
      votes_active     INTEGER DEFAULT 0,
      votes_expired    INTEGER DEFAULT 0,
      expires_at       TIMESTAMPTZ,
      created_at       TIMESTAMPTZ DEFAULT NOW(),
      updated_at       TIMESTAMPTZ DEFAULT NOW()
    )`,
    `CREATE TABLE IF NOT EXISTS price_history (
      id         SERIAL PRIMARY KEY,
      deal_id    INTEGER NOT NULL,
      price      NUMERIC NOT NULL,
      in_stock   BOOLEAN DEFAULT true,
      scraped_at TIMESTAMPTZ DEFAULT NOW()
    )`,
    `CREATE TABLE IF NOT EXISTS coupons (
      id            SERIAL PRIMARY KEY,
      deal_id       INTEGER NOT NULL,
      code          TEXT    NOT NULL,
      success_count INTEGER DEFAULT 0,
      fail_count    INTEGER DEFAULT 0,
      last_checked  TIMESTAMPTZ,
      active        BOOLEAN DEFAULT true,
      UNIQUE(deal_id, code)
    )`,
    `CREATE TABLE IF NOT EXISTS alerts (
      id         SERIAL PRIMARY KEY,
      email      TEXT    NOT NULL,
      category   TEXT    DEFAULT 'all',
      platform   TEXT    DEFAULT 'all',
      max_price  NUMERIC,
      channel    TEXT    DEFAULT 'email',
      active     BOOLEAN DEFAULT true,
      created_at TIMESTAMPTZ DEFAULT NOW()
    )`,
    `CREATE TABLE IF NOT EXISTS votes (
      id         SERIAL PRIMARY KEY,
      deal_id    INTEGER NOT NULL,
      ip_hash    TEXT,
      vote       TEXT    NOT NULL,
      created_at TIMESTAMPTZ DEFAULT NOW()
    )`,
    `CREATE TABLE IF NOT EXISTS redirect_log (
      id         SERIAL PRIMARY KEY,
      deal_id    INTEGER,
      ip_hash    TEXT,
      user_agent TEXT,
      clicked_at TIMESTAMPTZ DEFAULT NOW()
    )`,
    `CREATE INDEX IF NOT EXISTS idx_deals_category    ON deals(category)`,
    `CREATE INDEX IF NOT EXISTS idx_deals_platform    ON deals(platform)`,
    `CREATE INDEX IF NOT EXISTS idx_deals_verified    ON deals(verified)`,
    `CREATE INDEX IF NOT EXISTS idx_price_deal        ON price_history(deal_id)`,
  ];

  for (const sql of statements) {
    try {
      await query(sql);
    } catch (err) {
      if (!err.message?.includes('already exists')) {
        console.error('Schema error:', err.message);
      }
    }
  }
  console.log('✅ Database schema ready (PostgreSQL/Neon)');
}

// ── Query helpers ─────────────────────────────────────────
// Convert SQLite ? placeholders to PostgreSQL $1, $2...
function pg(sql, args = []) {
  let i = 0;
  const pgSql = sql.replace(/\?/g, () => `$${++i}`);
  return query(pgSql, args);
}

// Normalize rows — PostgreSQL returns real booleans, ensure compatibility
function rows(result) {
  return result?.rows || [];
}

// ── Queries ───────────────────────────────────────────────
const queries = {

  getDeals: async ({ category, platform, sort = 'newest', limit = 40, offset = 0 }) => {
    const conditions = ['verified = true'];
    const args = [];
    if (category && category !== 'all') { conditions.push(`category = $${args.length + 1}`); args.push(category); }
    if (platform && platform !== 'all') { conditions.push(`platform = $${args.length + 1}`); args.push(platform.toLowerCase()); }
    const sortMap = {
      newest:     'created_at DESC',
      discount:   'discount_pct DESC',
      score:      'deal_score DESC',
      price_asc:  'current_price ASC',
      price_desc: 'current_price DESC',
    };
    const orderBy = sortMap[sort] || 'created_at DESC';
    const where = `WHERE ${conditions.join(' AND ')}`;
    args.push(parseInt(limit) || 40);
    args.push(parseInt(offset) || 0);
    const result = await query(
      `SELECT * FROM deals ${where} ORDER BY ${orderBy} LIMIT $${args.length - 1} OFFSET $${args.length}`,
      args
    );
    return { rows: rows(result) };
  },

  getDealById: async (id) => {
    const result = await query(`SELECT * FROM deals WHERE id = $1`, [id]);
    return { rows: rows(result) };
  },

  getPriceHistoryForDeal: async (id) => {
    const result = await query(
      `SELECT * FROM price_history WHERE deal_id = $1 ORDER BY scraped_at DESC LIMIT 30`, [id]
    );
    return { rows: rows(result) };
  },

  getDealsByCategory: async (category, { platform, sub_category, sort = 'newest', limit = 40 }) => {
    const conditions = ['category = $1', 'verified = true'];
    const args = [category];
    if (platform && platform !== 'all') { conditions.push(`platform = $${args.length + 1}`); args.push(platform); }
    if (sub_category && sub_category !== 'All') { conditions.push(`sub_category = $${args.length + 1}`); args.push(sub_category); }
    const sortMap = { newest: 'created_at DESC', discount: 'discount_pct DESC', score: 'deal_score DESC', price_asc: 'current_price ASC', price_desc: 'current_price DESC' };
    args.push(parseInt(limit) || 40);
    const result = await query(
      `SELECT * FROM deals WHERE ${conditions.join(' AND ')} ORDER BY ${sortMap[sort] || 'created_at DESC'} LIMIT $${args.length}`,
      args
    );
    return { rows: rows(result) };
  },

  searchDeals: async (q, limit = 30) => {
    const result = await query(
      `SELECT * FROM deals WHERE verified = true AND (title ILIKE $1 OR description ILIKE $1 OR category ILIKE $1 OR platform ILIKE $1) ORDER BY deal_score DESC, created_at DESC LIMIT $2`,
      [`%${q}%`, parseInt(limit) || 30]
    );
    return { rows: rows(result) };
  },

  insertDeal: async (deal) => {
    try {
      const result = await query(
        `INSERT INTO deals (title, description, platform, category, sub_category, current_price, original_price, discount_pct, coupon_code, affiliate_url, image_url, product_url, verified, deal_score, expires_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)
         ON CONFLICT (affiliate_url) DO UPDATE SET
           current_price = EXCLUDED.current_price,
           discount_pct  = EXCLUDED.discount_pct,
           updated_at    = NOW()
         RETURNING id`,
        [
          deal.title, deal.description || null, deal.platform, deal.category,
          deal.sub_category || null, deal.current_price, deal.original_price,
          deal.discount_pct, deal.coupon_code || null, deal.affiliate_url,
          deal.image_url || null, deal.product_url || null,
          deal.verified ? true : false, deal.deal_score || 0, deal.expires_at || null
        ]
      );
      return { rows: rows(result) };
    } catch (err) {
      throw err;
    }
  },

  updateDealPrice: (id, price) => query(
    `UPDATE deals SET current_price=$1, updated_at=NOW() WHERE id=$2`, [price, id]
  ),
  updateDealSummary: (id, summary) => query(
    `UPDATE deals SET ai_summary=$1, updated_at=NOW() WHERE id=$2`, [summary, id]
  ),
  updateDealScore: (id, score, verified) => query(
    `UPDATE deals SET deal_score=$1, verified=$2, updated_at=NOW() WHERE id=$3`, [score, verified ? true : false, id]
  ),

  insertPriceHistory: (dealId, price, inStock) => query(
    `INSERT INTO price_history (deal_id, price, in_stock) VALUES ($1,$2,$3)`, [dealId, price, inStock ? true : false]
  ),
  getPriceHistory: async (dealId, days = 30) => {
    const result = await query(
      `SELECT * FROM price_history WHERE deal_id=$1 AND scraped_at >= NOW() - INTERVAL '${parseInt(days)} days' ORDER BY scraped_at ASC`,
      [dealId]
    );
    return { rows: rows(result) };
  },
  getAvgPrice: async (dealId, days = 30) => {
    const result = await query(
      `SELECT AVG(price) as avg_price, MIN(price) as min_price, MAX(price) as max_price FROM price_history WHERE deal_id=$1 AND scraped_at >= NOW() - INTERVAL '${parseInt(days)} days'`,
      [dealId]
    );
    return { rows: rows(result) };
  },

  insertCoupon: (dealId, code) => query(
    `INSERT INTO coupons (deal_id, code) VALUES ($1,$2) ON CONFLICT (deal_id, code) DO NOTHING`, [dealId, code]
  ),
  recordCouponSuccess: (dealId) => query(
    `UPDATE coupons SET success_count=success_count+1, last_checked=NOW() WHERE deal_id=$1`, [dealId]
  ),
  recordCouponFail: (dealId) => query(
    `UPDATE coupons SET fail_count=fail_count+1, last_checked=NOW() WHERE deal_id=$1`, [dealId]
  ),
  updateCouponRate: (dealId) => query(
    `UPDATE deals SET coupon_success_rate=(SELECT ROUND(success_count*100.0/(success_count+fail_count+1)) FROM coupons WHERE deal_id=$1 LIMIT 1) WHERE id=$1`,
    [dealId]
  ),

  recordVote: (dealId, ipHash, vote) => query(
    `INSERT INTO votes (deal_id, ip_hash, vote) VALUES ($1,$2,$3)`, [dealId, ipHash, vote]
  ),
  hasVoted: async (dealId, ipHash) => {
    const result = await query(
      `SELECT id FROM votes WHERE deal_id=$1 AND ip_hash=$2 AND created_at >= NOW() - INTERVAL '24 hours'`,
      [dealId, ipHash]
    );
    return { rows: rows(result) };
  },
  updateVoteCounts: (dealId) => query(
    `UPDATE deals SET
       votes_active  = (SELECT COUNT(*) FROM votes WHERE deal_id=$1 AND vote='active'),
       votes_expired = (SELECT COUNT(*) FROM votes WHERE deal_id=$1 AND vote='expired')
     WHERE id=$1`,
    [dealId]
  ),

  insertAlert: (email, category, platform, maxPrice, channel) => query(
    `INSERT INTO alerts (email, category, platform, max_price, channel) VALUES ($1,$2,$3,$4,$5)`,
    [email, category || 'all', platform || 'all', maxPrice || null, channel || 'email']
  ),
  getActiveAlerts: async () => {
    const result = await query(`SELECT * FROM alerts WHERE active = true`);
    return { rows: rows(result) };
  },
  getMatchingAlerts: async (category, platform, price) => {
    const result = await query(
      `SELECT * FROM alerts WHERE active=true AND (category='all' OR category=$1) AND (platform='all' OR platform=$2) AND (max_price IS NULL OR max_price>=$3)`,
      [category, platform, price]
    );
    return { rows: rows(result) };
  },
  unsubscribeAlert: (email) => query(
    `UPDATE alerts SET active=false WHERE email=$1`, [email]
  ),

  logRedirect: (dealId, ipHash, userAgent) => query(
    `INSERT INTO redirect_log (deal_id, ip_hash, user_agent) VALUES ($1,$2,$3)`,
    [dealId, ipHash || null, userAgent || null]
  ),

  getStats: async () => {
    const result = await query(`
      SELECT
        (SELECT COUNT(*) FROM deals WHERE verified=true)::int                                    as total_deals,
        (SELECT COUNT(*) FROM deals WHERE verified=true AND created_at >= NOW() - INTERVAL '1 day')::int as deals_today,
        (SELECT ROUND(AVG(discount_pct)) FROM deals WHERE verified=true)::int                    as avg_discount,
        (SELECT COUNT(*) FROM alerts WHERE active=true)::int                                     as total_subscribers
    `);
    return { rows: rows(result) };
  },

  cleanOldPriceHistory: () => query(
    `DELETE FROM price_history WHERE scraped_at < NOW() - INTERVAL '60 days'`
  ),
  cleanExpiredDeals: () => query(
    `DELETE FROM deals WHERE expires_at IS NOT NULL AND expires_at < NOW() - INTERVAL '7 days'`
  ),
};

module.exports = { db: pool, queries, initSchema };
