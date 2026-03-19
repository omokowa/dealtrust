// utils/cache.js — In-memory cache using node-cache (free, no Redis needed)
const NodeCache = require('node-cache');

// Default TTL: 5 minutes, check for expired keys every 2 minutes
const cache = new NodeCache({ stdTTL: 300, checkperiod: 120 });

module.exports = cache;
