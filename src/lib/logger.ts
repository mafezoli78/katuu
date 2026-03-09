// Centralized logger to avoid noisy console.* in production.
// Use logger.debug/info/warn for dev-only logs; logger.error always prints.

export const logger = {
  debug: (...args: unknown[]) => {
    if (import.meta.env.DEV) console.log(...args);
  },
  info: (...args: unknown[]) => {
    if (import.meta.env.DEV) console.info(...args);
  },
  warn: (...args: unknown[]) => {
    if (import.meta.env.DEV) console.warn(...args);
  },
  error: (...args: unknown[]) => {
    console.error(...args);
  },
};
