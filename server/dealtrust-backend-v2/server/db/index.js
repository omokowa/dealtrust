// db/index.js — Turso database connection + schema + queries
require('dotenv').config();
const { createClient } = require('@libsql/client');

const db = createClient({
  url:       process.env.TURSO_DATABASE_URL || 'file:./dealtrust.db',
  authToken: process.env.TURSO_AUTH_TOKEN   || undefined,
});

// ── Schema — run each statement individually (more compatible) ─
async function initSchema() {
  const statements = [
    `CREATE TABLE IF NOT EXISTS deals (
      id               INTEGER PRIMARY KEY AUTOINCREMENT,
      title            TEXT    NOT NULL,
      description      TEXT,
      ai_summary       TEXT,
      platform         TEXT    NOT NULL,
      category         TEXT    NOT NULL,
      sub_category     TEXT,
      current_price    REAL    NOT NULL,
      original_price   REAL    NOT NULL,
      discount_pct     INTEGER NOT NULL,
      coupon_code      TEXT,
      coupon_success_rate INTEGER DEFAULT 0,
      affiliate_url    TEXT    NOT NULL,
      image_url        TEXT,
      product_url      TEXT,
      verified         INTEGER DEFAULT 0,
      deal_score       INTEGER DEFAULT 0,
      votes_active     INTEGER DEFAULT 0,
      votes_expired    INTEGER DEFAULT 0,
      expires_at       TEXT,
      created_at       TEXT    DEFAULT (datetime('now')),
      updated_at       TEXT    DEFAULT (datetime('now'))
    )`,
    `CREATE TABLE IF NOT EXISTS price_history (
      id         INTEGER PRIMARY KEY AUTOINCREMENT,
      deal_id    INTEGER NOT NULL,
      price      REAL    NOT NULL,
      in_stock   INTEGER DEFAULT 1,
      scraped_at TEXT    DEFAULT (datetime('now'))
    )`,
    `CREATE TABLE IF NOT EXISTS coupons (
      id            INTEGER PRIMARY KEY AUTOINCREMENT,
      deal_id       INTEGER NOT NULL,
      code          TEXT    NOT NULL,
      success_count INTEGER DEFAULT 0,
      fail_count    INTEGER DEFAULT 0,
      last_checked  TEXT,
      active        INTEGER DEFAULT 1
    )`,
    `CREATE TABLE IF NOT EXISTS alerts (
      id         INTEGER PRIMARY KEY AUTOINCREMENT,
      email      TEXT    NOT NULL,
      category   TEXT    DEFAULT 'all',
      platform   TEXT    DEFAULT 'all',
      max_price  REAL,
      channel    TEXT    DEFAULT 'email',
      active     INTEGER DEFAULT 1,
      created_at TEXT    DEFAULT (datetime('now'))
    )`,
    `CREATE TABLE IF NOT EXISTS votes (
      id         INTEGER PRIMARY KEY AUTOINCREMENT,
      deal_id    INTEGER NOT NULL,
      ip_hash    TEXT,
      vote       TEXT    NOT NULL,
      created_at TEXT    DEFAULT (datetime('now'))
    )`,
    `CREATE TABLE IF NOT EXISTS redirect_log (
      id         INTEGER PRIMARY KEY AUTOINCREMENT,
      deal_id    INTEGER,
      ip_hash    TEXT,
      user_agent TEXT,
      clicked_at TEXT DEFAULT (datetime('now'))
    )`,
    `CREATE INDEX IF NOT EXISTS idx_deals_category ON deals(category)`,
    `CREATE INDEX IF NOT EXISTS idx_deals_platform ON deals(platform)`,
    `CREATE INDEX IF NOT EXISTS idx_deals_verified ON deals(verified)`,
    `CREATE INDEX IF NOT EXISTS idx_price_deal     ON price_history(deal_id)`,
  ];

  for (const sql of statements) {
    try {
      await db.execute(sql);
    } catch (err) {
      // Ignore "already exists" errors
      if (!err.message?.includes('already exists')) {
        console.error('Schema error:', err.message);
      }
    }
  }
  console.log('✅ Database schema ready');
}

// ── Queries ───────────────────────────────────────────────
const queries = {

  getDeals: ({ category, platform, sort = 'newest', limit = 40, offset = 0 }) => {
    const conditions = ['verified = 1'];
    const args = [];
    if (category && category !== 'all') { conditions.push('category = ?'); args.push(category); }
    if (platform && platform !== 'all') { conditions.push('platform = ?'); args.push(platform.toLowerCase()); }
    const sortMap = { newest: 'created_at DESC', discount: 'discount_pct DESC', score: 'deal_score DESC', price_asc: 'current_price ASC', price_desc: 'current_price DESC' };
    const orderBy = sortMap[sort] || 'created_at DESC';
    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
    return db.execute({ sql: `SELECT * FROM deals ${where} ORDER BY ${orderBy} LIMIT ? OFFSET ?`, args: [...args, limit, offset] });
  },

  getDealById: (id) => db.execute({
    sql: `SELECT * FROM deals WHERE id = ?`,
    args: [id],
  }),

  getPriceHistoryForDeal: (id) => db.execute({
    sql: `SELECT * FROM price_history WHERE deal_id = ? ORDER BY scraped_at DESC LIMIT 30`,
    args: [id],
  }),

  getDealsByCategory: (category, { platform, sub_category, sort = 'newest', limit = 40 }) => {
    const conditions = ['category = ?', 'verified = 1'];
    const args = [category];
    if (platform && platform !== 'all') { conditions.push('platform = ?'); args.push(platform); }
    if (sub_category && sub_category !== 'All') { conditions.push('sub_category = ?'); args.push(sub_category); }
    const sortMap = { newest: 'created_at DESC', discount: 'discount_pct DESC', score: 'deal_score DESC', price_asc: 'current_price ASC', price_desc: 'current_price DESC' };
    return db.execute({ sql: `SELECT * FROM deals WHERE ${conditions.join(' AND ')} ORDER BY ${sortMap[sort]||'created_at DESC'} LIMIT ?`, args: [...args, limit] });
  },

  searchDeals: (q, limit = 30) => db.execute({
    sql: `SELECT * FROM deals WHERE verified = 1 AND (title LIKE ? OR description LIKE ? OR category LIKE ? OR platform LIKE ?) ORDER BY deal_score DESC, created_at DESC LIMIT ?`,
    args: [`%${q}%`, `%${q}%`, `%${q}%`, `%${q}%`, limit],
  }),

  insertDeal: (deal) => db.execute({
    sql: `INSERT INTO deals (title, description, platform, category, sub_category, current_price, original_price, discount_pct, coupon_code, affiliate_url, image_url, product_url, verified, deal_score, expires_at)
          VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
          ON CONFLICT(affiliate_url) DO UPDATE SET current_price=excluded.current_price, discount_pct=excluded.discount_pct, updated_at=datetime('now')`,
    args: [deal.title, deal.description||null, deal.platform, deal.category, deal.sub_category||null, deal.current_price, deal.original_price, deal.discount_pct, deal.coupon_code||null, deal.affiliate_url, deal.image_url||null, deal.product_url||null, deal.verified?1:0, deal.deal_score||0, deal.expires_at||null],
  }),

  updateDealPrice:   (id, price) => db.execute({ sql: `UPDATE deals SET current_price=?, updated_at=datetime('now') WHERE id=?`, args:[price,id] }),
  updateDealSummary: (id, summary) => db.execute({ sql: `UPDATE deals SET ai_summary=?, updated_at=datetime('now') WHERE id=?`, args:[summary,id] }),
  updateDealScore:   (id, score, verified) => db.execute({ sql: `UPDATE deals SET deal_score=?, verified=?, updated_at=datetime('now') WHERE id=?`, args:[score,verified?1:0,id] }),

  insertPriceHistory: (dealId, price, inStock) => db.execute({ sql:`INSERT INTO price_history (deal_id,price,in_stock) VALUES (?,?,?)`, args:[dealId,price,inStock?1:0] }),
  getPriceHistory:    (dealId, days=30) => db.execute({ sql:`SELECT * FROM price_history WHERE deal_id=? AND scraped_at>=datetime('now','-${days} days') ORDER BY scraped_at ASC`, args:[dealId] }),
  getAvgPrice:        (dealId, days=30) => db.execute({ sql:`SELECT AVG(price) as avg_price, MIN(price) as min_price, MAX(price) as max_price FROM price_history WHERE deal_id=? AND scraped_at>=datetime('now','-${days} days')`, args:[dealId] }),

  insertCoupon:      (dealId, code) => db.execute({ sql:`INSERT OR IGNORE INTO coupons (deal_id,code) VALUES (?,?)`, args:[dealId,code] }),
  recordCouponSuccess:(dealId) => db.execute({ sql:`UPDATE coupons SET success_count=success_count+1,last_checked=datetime('now') WHERE deal_id=?`, args:[dealId] }),
  recordCouponFail:  (dealId) => db.execute({ sql:`UPDATE coupons SET fail_count=fail_count+1,last_checked=datetime('now') WHERE deal_id=?`, args:[dealId] }),
  updateCouponRate:  (dealId) => db.execute({ sql:`UPDATE deals SET coupon_success_rate=(SELECT ROUND(success_count*100.0/(success_count+fail_count+1)) FROM coupons WHERE deal_id=?) WHERE id=?`, args:[dealId,dealId] }),

  recordVote:        (dealId, ipHash, vote) => db.execute({ sql:`INSERT INTO votes (deal_id,ip_hash,vote) VALUES (?,?,?)`, args:[dealId,ipHash,vote] }),
  hasVoted:          (dealId, ipHash) => db.execute({ sql:`SELECT id FROM votes WHERE deal_id=? AND ip_hash=? AND created_at>=datetime('now','-24 hours')`, args:[dealId,ipHash] }),
  updateVoteCounts:  (dealId) => db.execute({ sql:`UPDATE deals SET votes_active=(SELECT COUNT(*) FROM votes WHERE deal_id=? AND vote='active'), votes_expired=(SELECT COUNT(*) FROM votes WHERE deal_id=? AND vote='expired') WHERE id=?`, args:[dealId,dealId,dealId] }),

  insertAlert:       (email,category,platform,maxPrice,channel) => db.execute({ sql:`INSERT INTO alerts (email,category,platform,max_price,channel) VALUES (?,?,?,?,?)`, args:[email,category||'all',platform||'all',maxPrice||null,channel||'email'] }),
  getActiveAlerts:   () => db.execute({ sql:`SELECT * FROM alerts WHERE active=1`, args:[] }),
  getMatchingAlerts: (category,platform,price) => db.execute({ sql:`SELECT * FROM alerts WHERE active=1 AND (category='all' OR category=?) AND (platform='all' OR platform=?) AND (max_price IS NULL OR max_price>=?)`, args:[category,platform,price] }),
  unsubscribeAlert:  (email) => db.execute({ sql:`UPDATE alerts SET active=0 WHERE email=?`, args:[email] }),

  logRedirect:       (dealId,ipHash,userAgent) => db.execute({ sql:`INSERT INTO redirect_log (deal_id,ip_hash,user_agent) VALUES (?,?,?)`, args:[dealId,ipHash||null,userAgent||null] }),

  getStats: () => db.execute({
    sql: `SELECT
      (SELECT COUNT(*) FROM deals WHERE verified=1) as total_deals,
      (SELECT COUNT(*) FROM deals WHERE verified=1 AND DATE(created_at)=DATE('now')) as deals_today,
      (SELECT ROUND(AVG(discount_pct)) FROM deals WHERE verified=1) as avg_discount,
      (SELECT COUNT(*) FROM alerts WHERE active=1) as total_subscribers`,
    args: [],
  }),

  cleanOldPriceHistory: () => db.execute({ sql:`DELETE FROM price_history WHERE scraped_at<datetime('now','-60 days')`, args:[] }),
  cleanExpiredDeals:    () => db.execute({ sql:`DELETE FROM deals WHERE expires_at IS NOT NULL AND expires_at<datetime('now','-7 days')`, args:[] }),
};

module.exports = { db, queries, initSchema };
