// utils/logger.js — Simple console logger with timestamps
const isDev = process.env.NODE_ENV !== 'production';

function timestamp() {
  return new Date().toISOString().replace('T', ' ').slice(0, 19);
}

const logger = {
  info:  (...args) => console.log( `[${timestamp()}] INFO `, ...args),
  warn:  (...args) => console.warn( `[${timestamp()}] WARN `, ...args),
  error: (...args) => console.error(`[${timestamp()}] ERROR`, ...args),
  debug: (...args) => { if (isDev) console.log(`[${timestamp()}] DEBUG`, ...args); },
};

module.exports = logger;
