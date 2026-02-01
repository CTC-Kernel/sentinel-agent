import pino from 'pino';

const level = import.meta.env.VITE_LOG_LEVEL || (import.meta.env.MODE === 'production' ? 'info' : 'debug');

const base = {
  app: 'sentinel-grc',
  env: import.meta.env.MODE || 'development'
};

export const logger = pino({
  level,
  base,
  browser: { asObject: true },
  redact: ['req.headers.authorization', 'req.body.password'],
  timestamp: pino.stdTimeFunctions.isoTime
});

export type Logger = typeof logger;
